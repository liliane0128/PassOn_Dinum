"""Read-only, per-user bridges to the local Docs and Drive APIs."""
import json
import socket
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def error(service, code, message, status):
    return JsonResponse({"service": service, "error": code, "detail": message}, status=status)


@require_GET
def relay(request, service, resource, resource_id=None):
    config = settings.DINUM_SERVICES[service]
    cookie_name = config["cookie"]
    session = request.headers.get(config["header"]) or request.COOKIES.get(cookie_name)
    if not session:
        response = error(service, "authentication_required", "Log in to the upstream service and provide its session cookie.", 401)
    elif any(ord(c) < 33 or ord(c) > 126 or c in ';,\"\\' for c in session):
        response = error(service, "invalid_session", "Invalid session credential.", 400)
    else:
        endpoint = resource + (f"/{resource_id}" if resource_id else "")
        query = urlencode(list(request.GET.lists()), doseq=True)
        url = f"{config['url'].rstrip('/')}/api/v1.0/{endpoint}/"
        if query:
            url += "?" + query
        upstream_request = Request(url, headers={"Accept": "application/json", "Cookie": f"{cookie_name}={session}"})
        try:
            with build_opener(NoRedirects()).open(upstream_request, timeout=settings.DINUM_API_TIMEOUT) as upstream:
                data = json.load(upstream)
            response = JsonResponse(data, safe=False)
        except HTTPError as exc:
            status = exc.code if exc.code in (400, 401, 403, 404, 429) else 502
            response = error(service, "upstream_error", f"Upstream returned HTTP {exc.code}.", status)
            exc.close()
        except (TimeoutError, socket.timeout):
            response = error(service, "upstream_timeout", "The upstream service timed out.", 504)
        except URLError as exc:
            timed_out = isinstance(exc.reason, (TimeoutError, socket.timeout))
            response = error(service, "upstream_timeout" if timed_out else "upstream_unavailable", "Unable to reach the upstream service.", 504 if timed_out else 502)
        except (ValueError, UnicodeError):
            response = error(service, "invalid_upstream_response", "The upstream service did not return valid JSON.", 502)
    response["Cache-Control"] = "private, no-store"
    response["Vary"] = f"Cookie, {config['header']}"
    return response
