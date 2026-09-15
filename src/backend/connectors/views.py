"""Expose the existing connectors through a per-request, read-only API."""
import requests
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from . import docs_client, drive_client, extraction, messages_client

CLIENTS = {"docs": docs_client, "drive": drive_client, "messages": messages_client}
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


@require_GET
def items(request, service, item_id=None):
    config = settings.DINUM_SERVICES[service]
    credential = request.headers.get(config["header"]) or request.COOKIES.get(config["cookie"])
    if not credential:
        response = failure(service, "authentication_required", 401)
    elif not _is_valid_credential(credential):
        response = failure(service, "invalid_session", 400)
    elif request.GET:
        # Existing connectors do not implement filtering or pagination yet.
        response = failure(service, "query_parameters_not_supported", 400)
    else:
        try:
            with UpstreamSession() as session:
                session.cookies.set(config["cookie"], credential)
                client = CLIENTS[service]
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
    least one credential is required.

    Content is always fetched (docs_session/drive_session passed through
    to normalize_items()) -- returning items with empty content would
    defeat the point of this endpoint.
    """
    if request.GET:
        return failure("extraction", "query_parameters_not_supported", 400)

    credentials = {}
    for service in CLIENTS:
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
                raw = CLIENTS[service].list_items(session, base_url=config["url"])

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
