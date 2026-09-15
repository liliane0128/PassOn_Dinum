"""Expose the existing connectors through a per-request, read-only API."""
import requests
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from . import docs_client, drive_client, messages_client

CLIENTS = {"docs": docs_client, "drive": drive_client, "messages": messages_client}


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


@require_GET
def items(request, service, item_id=None):
    config = settings.DINUM_SERVICES[service]
    credential = request.headers.get(config["header"]) or request.COOKIES.get(config["cookie"])
    if not credential:
        response = failure(service, "authentication_required", 401)
    elif any(ord(ch) < 33 or ord(ch) > 126 or ch in ';,\"\\' for ch in credential):
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
