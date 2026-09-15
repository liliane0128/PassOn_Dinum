"""Expose the existing connectors through a per-request, read-only API."""
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


def _is_valid_credential(credential):
    return not any(ord(ch) < 33 or ord(ch) > 126 or ch in ';,"\\' for ch in credential)


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
    credential = request.headers.get(config["header"]) or request.COOKIES.get(config["cookie"])
    if not credential:
        return None, None, failure(service, "authentication_required", 401)
    if not _is_valid_credential(credential):
        return None, None, failure(service, "invalid_session", 400)
    session = UpstreamSession()
    session.cookies.set(config["cookie"], credential)
    return session, REAL_CLIENTS[service], None


@require_GET
def items(request, service, item_id=None):
    session, client, error = _resolve_client(request, service)
    config = settings.DINUM_SERVICES[service]
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
        items_out = extraction.normalize_items(
            mock_data.MOCK_DOCS, mock_data.MOCK_DRIVE_ITEMS, mock_data.MOCK_MESSAGES,
        )
        response = JsonResponse({"items": items_out, "errors": {}})
        response["Cache-Control"] = "private, no-store"
        return response

    credentials = {}
    for service in REAL_CLIENTS:
        config = settings.DINUM_SERVICES[service]
        credential = request.headers.get(config["header"]) or request.COOKIES.get(config["cookie"])
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
                raw_by_service = {"docs": [], "drive": [], "messages": []}
                raw_by_service[service] = raw

                normalized = extraction.normalize_items(
                    raw_by_service["docs"], raw_by_service["drive"], raw_by_service["messages"],
                    **normalize_kwargs,
                )
            items_out.extend(normalized)
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
    """List raw items for one service. Returns (data, None) or (None, error_response)."""
    session, client, error = _resolve_client(request, service)
    if error:
        return None, error
    config = settings.DINUM_SERVICES[service]
    try:
        with session:
            return client.list_items(session, base_url=config["url"]), None
    except requests.Timeout:
        return None, failure(service, "upstream_timeout", 504)
    except requests.HTTPError as exc:
        upstream_status = exc.response.status_code if exc.response is not None else 502
        status = upstream_status if upstream_status in (400, 401, 403, 404, 429) else 502
        return None, failure(service, "upstream_error", status)
    except requests.RequestException:
        return None, failure(service, "upstream_unavailable", 502)
    except (ValueError, KeyError, TypeError, IndexError, RuntimeError):
        return None, failure(service, "invalid_upstream_response", 502)


@require_GET
def dossier(request):
    """Generate the handover dossier as a downloadable Markdown file.

    Requires a valid per-service credential for docs/drive/messages (same
    headers/cookies as /api/<service>/items/) unless DINUM_USE_MOCK is set,
    in which case static demo data is used instead and no credential is
    required.
    """
    if settings.DINUM_USE_MOCK:
        raw_docs, raw_drive, raw_messages = (
            mock_data.MOCK_DOCS,
            mock_data.MOCK_DRIVE_ITEMS,
            mock_data.MOCK_MESSAGES,
        )
    else:
        raw_docs, error = _fetch_raw_items(request, "docs")
        if error:
            return error
        raw_drive, error = _fetch_raw_items(request, "drive")
        if error:
            return error
        raw_messages, error = _fetch_raw_items(request, "messages")
        if error:
            return error

    items_ = extraction.normalize_items(raw_docs, raw_drive, raw_messages)
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
