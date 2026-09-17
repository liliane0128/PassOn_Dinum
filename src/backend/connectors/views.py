"""Expose the existing connectors through a per-request, read-only API."""
from urllib.parse import urlparse, urlunparse

import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from groq import APIError as GroqAPIError
from . import docs_client, drive_client, messages_client
from . import generation
from . import extraction
from . import mock_clients, mock_data
from accounts.session import CREDENTIAL_KEYS as LOGIN_CREDENTIAL_KEYS
from accounts.session import USER_KEY

REAL_CLIENTS = {"docs": docs_client, "drive": drive_client, "messages": messages_client}
MOCK_CLIENTS = {
    "docs": mock_clients.docs_mock,
    "drive": mock_clients.drive_mock,
    "messages": mock_clients.messages_mock,
}
# Which normalize_items() kwarg carries each service's base_url / session.
_NORMALIZE_BASE_URL_KWARG = {
    "docs": "docs_base_url", "drive": "drive_base_url", "messages": "messages_base_url",
}
_NORMALIZE_SESSION_KWARG = {"docs": "docs_session", "drive": "drive_session"}


class UpstreamSession(requests.Session):
    def request(self, method, url, **kwargs):
        kwargs["timeout"] = settings.DINUM_API_TIMEOUT
        kwargs["allow_redirects"] = False
        response = super().request(method, url, **kwargs)
        if 300 <= response.status_code < 400:
            raise requests.HTTPError("Unexpected upstream redirect", response=response)
        return response


def failure(service, code, status):
    return JsonResponse({"service": service, "error": code}, status=status)


def _enabled(service):
    """Whether this deployment reads a service at all (DINUM_ENABLED_SERVICES).

    Distinct from having no credential for it: that is a fact about the
    caller, this is a decision about the product.
    """
    return service in settings.DINUM_ENABLED_SERVICES


def _is_valid_credential(credential):
    return not any(ord(ch) < 33 or ord(ch) > 126 or ch in ';,"\\' for ch in credential)


def _to_public_url(url):
    """Rewrite an upstream URL so the user's browser can actually follow it.

    Items carry links built from DOCS_URL/DRIVE_URL/MESSAGES_URL, which is how
    *this process* reaches those services -- host.docker.internal from inside a
    container. That name means nothing in a browser, so the host is swapped
    back to the public one before the link leaves the API. Ports and paths are
    untouched, and hosts we do not recognise are left alone.
    """
    if not url:
        return url
    parts = urlparse(url)
    reachable_hosts = {
        urlparse(config["url"]).hostname for config in settings.DINUM_SERVICES.values()
    }
    if parts.hostname == settings.DINUM_PUBLIC_HOST or parts.hostname not in reachable_hosts:
        return url
    netloc = settings.DINUM_PUBLIC_HOST
    if parts.port:
        netloc = f"{netloc}:{parts.port}"
    return urlunparse(parts._replace(netloc=netloc))


def _publicize(items):
    """Apply _to_public_url() to every link in a list of normalized items."""
    for item in items:
        source = item.get("source")
        if not isinstance(source, dict):
            continue
        source["resource_url"] = _to_public_url(source.get("resource_url"))
        source["content_url"] = _to_public_url(source.get("content_url"))
    return items


def _session_credential(request, service):
    """The credential our own login flow stored, if it covers this service.

    Logging in walks Drive's OIDC flow, and Messages' too when the account
    exists there (see accounts/oidc_login.py). Docs has no entry, so it keeps
    requiring an explicit header or cookie.
    """
    key = LOGIN_CREDENTIAL_KEYS.get(service)
    return request.session.get(key) if key else None


def _credential_for(request, service):
    """Which credential this request may use for a service, and in what order.

    Header first: it is deliberate, and it is how manual calls and tests pass
    one in.

    Then the credential our own login stored for the caller. That one is
    theirs by construction.

    The upstream cookie comes last, and only for a caller who is *not* logged
    in here. Cookies are not scoped by port -- Messages on localhost:8900 and
    this app on localhost:8090 share one jar for host "localhost" -- so the
    cookie in a browser belongs to whoever used that service last, not to
    whoever is logged in here. The two are the same person often enough for
    it to look harmless, and different exactly when it matters: someone with
    no account on a service has no credential of their own, so the cookie
    filled the gap with a colleague's mailbox, and the handover generated
    from it was stored under their name.
    """
    config = settings.DINUM_SERVICES[service]
    explicit = request.headers.get(config["header"])
    if explicit:
        return explicit
    own = _session_credential(request, service)
    if own:
        return own
    if request.session.get(USER_KEY):
        # Logged in, but with nothing for this service: that is an answer,
        # not a gap to fill from the browser's jar.
        return None
    return request.COOKIES.get(config["cookie"])


def _resolve_client(request, service):
    """Validate the caller's credential and pick the real/mock client for it.

    In mock mode, no credential is required -- the mock clients ignore the
    session entirely and return static data regardless.

    Returns (session, client, None) on success, or (None, None, error_response).
    """
    config = settings.DINUM_SERVICES[service]
    if settings.DINUM_USE_MOCK:
        session = UpstreamSession()
        return session, MOCK_CLIENTS[service], None
    credential = _credential_for(request, service)
    if not credential:
        return None, None, failure(service, "authentication_required", 401)
    if not _is_valid_credential(credential):
        return None, None, failure(service, "invalid_session", 400)
    session = UpstreamSession()
    session.cookies.set(config["cookie"], credential)
    return session, REAL_CLIENTS[service], None


@require_GET
def items(request, service, item_id=None):
    config = settings.DINUM_SERVICES[service]
    if not _enabled(service):
        # The route exists in this build but the deployment does not read
        # this service, so there is nothing here to answer with.
        response = failure(service, "service_disabled", 404)
        response["Cache-Control"] = "private, no-store"
        response["Vary"] = f"Cookie, {config['header']}"
        return response
    session, client, error = _resolve_client(request, service)
    if error:
        response = error
    elif request.GET:
        # Existing connectors do not implement filtering or pagination yet.
        response = failure(service, "query_parameters_not_supported", 400)
    else:
        try:
            with session:
                if item_id is None:
                    data = client.list_items(session, base_url=config["url"])
                else:
                    data = client.get_item(session, str(item_id), base_url=config["url"])
            response = JsonResponse({"service": service, "data": data})
        except requests.Timeout:
            response = failure(service, "upstream_timeout", 504)
        except requests.HTTPError as exc:
            upstream_status = exc.response.status_code if exc.response is not None else 502
            status = upstream_status if upstream_status in (400, 401, 403, 404, 429) else 502
            response = failure(service, "upstream_error", status)
        except requests.RequestException:
            response = failure(service, "upstream_unavailable", 502)
        except (ValueError, KeyError, TypeError, IndexError, RuntimeError):
            response = failure(service, "invalid_upstream_response", 502)
    response["Cache-Control"] = "private, no-store"
    response["Vary"] = f"Cookie, {config['header']}"
    return response


# Each domain searched is one upstream request, so the list is capped. The
# caller's own domain comes first, and it is the one that matters most.
MAX_DIRECTORY_DOMAINS = 4


def _directory_domains(request):
    """Which domains to ask Drive about, most useful first.

    The caller's own, always: colleagues usually share it. But a document's
    owner need not -- demo profiles in one domain sharing with a real account
    in another is exactly the case that showed this up -- so the domains this
    application already knows about are asked for too. They come from the
    collaborator rows login creates, which is to say from people who have
    actually used PassOn, not from an arbitrary search.
    """
    from passon.models import Collaborator  # local: passon imports this module

    user = request.session.get(USER_KEY) or {}
    _, _, own = (user.get("email") or "").partition("@")
    domains = [own] if own else []
    for email in Collaborator.objects.values_list("email", flat=True):
        _, _, domain = (email or "").partition("@")
        if domain and domain not in domains:
            domains.append(domain)
    return domains[:MAX_DIRECTORY_DOMAINS]


def _drive_directory(request, session, base_url):
    """Addresses for the people whose documents this account can see.

    Drive names an item's creator and gives no address for them, so a
    document owner could be matched by name and written to never. Its user
    search does return addresses -- but it matches on the address itself, so
    a creator's name finds nothing. A domain, on the other hand, brings back
    everyone in it, each carrying the same `id` the item's creator block
    does, so the match is on that id rather than on a name.

    Which domains to ask for is `_directory_domains`. An owner in none of
    them stays unresolved: this puts an address on the people the caller and
    this application already know, it is not a way to walk Drive's directory.

    An error here is never fatal: the items matter more than the addresses,
    so a failed search leaves that domain out and every owner keeps its name.
    """
    directory = {}
    for domain in _directory_domains(request):
        try:
            people = drive_client.list_users(session, domain, base_url=base_url)
        except (requests.RequestException, ValueError, KeyError, TypeError):
            continue
        for person in people:
            if isinstance(person, dict) and person.get("id") and person.get("email"):
                directory.setdefault(person["id"], person["email"])
    return directory


@require_GET
def extraction_items(request):
    """GET /api/extraction/items/ -- normalized, LLM-ready items merged
    across whichever of docs/drive/messages the caller supplied a session
    for. A service with no credential is skipped (not an error) so a
    caller only logged into some of the three still gets a result; a
    service whose credential was given but whose upstream call failed
    gets an entry in "errors" instead of aborting the whole request. At
    least one credential is required, unless DINUM_USE_MOCK is set, in
    which case static demo data is returned for all three services and no
    credential is required at all.

    Content is always fetched (docs_session/drive_session passed through
    to normalize_items()) -- returning items with empty content would
    defeat the point of this endpoint.
    """
    if request.GET:
        return failure("extraction", "query_parameters_not_supported", 400)

    if settings.DINUM_USE_MOCK:
        items_out = _publicize(extraction.normalize_items(
            mock_data.MOCK_DOCS if _enabled("docs") else [],
            mock_data.MOCK_DRIVE_ITEMS if _enabled("drive") else [],
            mock_data.MOCK_MESSAGES if _enabled("messages") else [],
        ))
        response = JsonResponse({"items": items_out, "errors": {}})
        response["Cache-Control"] = "private, no-store"
        return response

    credentials = {}
    for service in REAL_CLIENTS:
        if not _enabled(service):
            continue
        config = settings.DINUM_SERVICES[service]
        credential = (
            _credential_for(request, service)
        )
        if credential and not _is_valid_credential(credential):
            return failure(service, "invalid_session", 400)
        credentials[service] = credential

    if not any(credentials.values()):
        return failure("extraction", "authentication_required", 401)

    items_out = []
    errors = {}

    for service, credential in credentials.items():
        if not credential:
            continue
        config = settings.DINUM_SERVICES[service]
        try:
            with UpstreamSession() as session:
                session.cookies.set(config["cookie"], credential)
                raw = REAL_CLIENTS[service].list_items(session, base_url=config["url"])

                normalize_kwargs = {_NORMALIZE_BASE_URL_KWARG[service]: config["url"]}
                if service in _NORMALIZE_SESSION_KWARG:
                    normalize_kwargs[_NORMALIZE_SESSION_KWARG[service]] = session
                if service == "drive":
                    # One extra call, once per listing, so that a document's
                    # owner comes back with an address and not just a name.
                    normalize_kwargs["drive_directory"] = _drive_directory(
                        request, session, config["url"]
                    )
                raw_by_service = {"docs": [], "drive": [], "messages": []}
                raw_by_service[service] = raw

                normalized = extraction.normalize_items(
                    raw_by_service["docs"], raw_by_service["drive"], raw_by_service["messages"],
                    **normalize_kwargs,
                )
            items_out.extend(_publicize(normalized))
        except requests.Timeout:
            errors[service] = "upstream_timeout"
        except requests.HTTPError as exc:
            upstream_status = exc.response.status_code if exc.response is not None else 502
            errors[service] = (
                "upstream_error" if upstream_status in (400, 401, 403, 404, 429) else "upstream_unavailable"
            )
        except requests.RequestException:
            errors[service] = "upstream_unavailable"
        except (ValueError, KeyError, TypeError, IndexError, RuntimeError):
            errors[service] = "invalid_upstream_response"

    response = JsonResponse({"items": items_out, "errors": errors})
    response["Cache-Control"] = "private, no-store"
    response["Vary"] = "Cookie, X-Docs-Session, X-Drive-Session, X-Messages-Session"
    return response


def _fetch_raw_items(request, service):
    """List raw items for one service.

    Returns (data, session, None) or (None, None, error_response). The session
    is handed back still open, because normalize_items() needs it to fetch
    each item's actual content afterwards; the caller closes it.
    """
    session, client, error = _resolve_client(request, service)
    if error:
        return None, None, error
    config = settings.DINUM_SERVICES[service]
    try:
        return client.list_items(session, base_url=config["url"]), session, None
    except requests.Timeout:
        session.close()
        return None, None, failure(service, "upstream_timeout", 504)
    except requests.HTTPError as exc:
        session.close()
        upstream_status = exc.response.status_code if exc.response is not None else 502
        status = upstream_status if upstream_status in (400, 401, 403, 404, 429) else 502
        return None, None, failure(service, "upstream_error", status)
    except requests.RequestException:
        session.close()
        return None, None, failure(service, "upstream_unavailable", 502)
    except (ValueError, KeyError, TypeError, IndexError, RuntimeError):
        session.close()
        return None, None, failure(service, "invalid_upstream_response", 502)


@require_GET
def dossier(request):
    """Generate the handover dossier as a downloadable Markdown file.

    Uses whichever services the caller has a credential for -- header, cookie,
    or the session stored at login -- and skips the others, the same rule
    /api/extraction/items/ follows. Demanding all three would make the
    endpoint unusable wherever one of them simply is not deployed, which is
    the normal case for Docs today. At least one is required, unless
    DINUM_USE_MOCK is set, in which case static demo data is used instead and
    no credential is needed.
    """
    sessions = {}
    if settings.DINUM_USE_MOCK:
        raw_docs, raw_drive, raw_messages = (
            mock_data.MOCK_DOCS if _enabled("docs") else [],
            mock_data.MOCK_DRIVE_ITEMS if _enabled("drive") else [],
            mock_data.MOCK_MESSAGES if _enabled("messages") else [],
        )
    else:
        raw = {}
        sessions = {}
        authenticated = False
        for service in REAL_CLIENTS:
            if not _enabled(service):
                raw[service] = []
                continue
            config = settings.DINUM_SERVICES[service]
            has_credential = (
                _credential_for(request, service)
            )
            if not has_credential:
                raw[service] = []
                continue
            authenticated = True
            raw[service], session, error = _fetch_raw_items(request, service)
            if error:
                # Only successful fetches leave a session behind; a failed one
                # has already closed its own and returns None in its place.
                for open_session in sessions.values():
                    open_session.close()
                return error
            sessions[service] = session
        # Keyed on credentials, not on data: someone logged in with an empty
        # Drive is authenticated, and belongs in the "nothing to summarize"
        # branch below rather than being told to log in again.
        if not authenticated:
            return failure("dossier", "authentication_required", 401)
        raw_docs, raw_drive, raw_messages = raw["docs"], raw["drive"], raw["messages"]

    # The sessions and base URLs have to be passed through: without them
    # normalize_items() returns metadata only, and the model is asked to write
    # a handover from a list of filenames. Rewritten before generation, since
    # generation.py fills each document's link from these items and the
    # handover's links must be the browser-usable ones.
    normalize_kwargs = {}
    for service, session in sessions.items():
        normalize_kwargs[_NORMALIZE_BASE_URL_KWARG[service]] = settings.DINUM_SERVICES[service]["url"]
        if service in _NORMALIZE_SESSION_KWARG:
            normalize_kwargs[_NORMALIZE_SESSION_KWARG[service]] = session
    try:
        items_ = _publicize(
            extraction.normalize_items(raw_docs, raw_drive, raw_messages, **normalize_kwargs)
        )
    finally:
        for open_session in sessions.values():
            open_session.close()
    if not items_:
        return JsonResponse({"error": "no_data_to_summarize"}, status=422)

    try:
        summary = generation.generate_dossier(items_)
    except ImproperlyConfigured:
        # GROQ_API_KEY not set -- a server misconfiguration, not something
        # the caller can fix.
        return JsonResponse({"error": "llm_not_configured"}, status=500)
    except GroqAPIError as exc:
        # Only APIStatusError (and subclasses like RateLimitError) carry a
        # real status_code; APIConnectionError/APITimeoutError are network-
        # level and have none.
        upstream_status = getattr(exc, "status_code", None)
        status = upstream_status if upstream_status == 429 else 502
        return JsonResponse({"error": "llm_error", "status": upstream_status}, status=status)
    except RuntimeError:
        return JsonResponse({"error": "llm_empty_response"}, status=502)

    response = JsonResponse(summary)
    response["Cache-Control"] = "private, no-store"
    return response
