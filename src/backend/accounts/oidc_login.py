"""Check an email/password against a Suite Numérique service (Drive, Messages).

These services do not verify passwords themselves: it delegates to Keycloak (OIDC
authorization code flow). There is no endpoint that takes an email and a
password and answers yes or no -- the Keycloak client Drive uses has direct
access grants disabled -- so the only way to check a credential is to walk the
same redirect chain a browser would:

    GET  <drive>/api/v1.0/authenticate/   -> 302 to Keycloak
    GET  <keycloak>/realms/drive/...      -> the HTML login form
    POST <the form's action>              -> 302 back to Drive's callback
    GET  <drive>/api/v1.0/callback/...    -> sets the drive_sessionid cookie

What comes out is the session cookie that service's own frontend uses, which
is also exactly the credential connectors/ needs. Logging a user in and being
able to read their files are therefore the same operation here.

Drive and Messages each run their own Keycloak, with their own user lists, and
are reached the same way -- hence one function taking the service name. Docs
would work identically if it were ever run alongside.

Three quirks of this local setup are handled below.

1. Addressing. Every URL in the chain says "localhost", because that is what a
   browser on this machine uses and what Keycloak has registered as Drive's
   allowed redirect URIs. Django may not share that network namespace (in
   Docker, "localhost" is the container itself), so each request is *sent* to
   DRIVE_URL's host while still *presenting* the public host in its Host
   header. Both halves matter: without the first, nothing connects from a
   container; without the second, Drive builds its redirect_uri from our Host
   header, hands Keycloak a redirect_uri it has never seen, and Keycloak
   answers "Invalid parameter: redirect_uri". When Django runs directly on
   this machine the two hosts are identical and none of this does anything.

2. Cookies. Keycloak marks its cookies Secure and this runs over plain http,
   so requests would refuse to send them back on the next hop. They are
   unmarked after every response.

3. Telling success from failure. A wrong password is not an error status:
   Keycloak answers 200 and simply renders the login form again. Worse, Drive
   sets a drive_sessionid cookie at the *start* of the flow, to hold the OIDC
   state, so merely having that cookie proves nothing either. Success is
   therefore confirmed positively, by calling /api/v1.0/users/me/ at the end.
   Note that /api/v1.0/items/ cannot be used for this -- it answers 200 with
   an empty list to anonymous callers, so it would accept a failed login.
"""

import re
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from django.conf import settings

# Enough hops for authenticate -> Keycloak -> form POST -> callback, with room
# to spare; a chain longer than this means the flow is not what we think.
MAX_REDIRECTS = 10

_LOGIN_FORM = re.compile(r'<form id="kc-form-login"[^>]*action="([^"]+)"')


class LoginFailed(Exception):
    """Raised when the flow above does not end with a usable Drive session.

    `code` is the machine-readable reason reported to the caller of the API,
    and `status` the HTTP status it maps to.
    """

    def __init__(self, code, status):
        super().__init__(code)
        self.code = code
        self.status = status


def _config(service):
    return settings.DINUM_SERVICES[service]


def _origin(url):
    parts = urlparse(url)
    return (parts.scheme, parts.hostname, parts.port)


def _address(url, service):
    """Split a URL into where to send it and which Host to claim (quirk 1).

    Returns (url_to_request, host_header). The port is never touched: Drive,
    Keycloak and Drive's frontend all live on this machine, only on different
    ports.
    """
    parts = urlparse(url)
    reachable_host = urlparse(_config(service)["url"]).hostname
    public_host = settings.DINUM_PUBLIC_HOST

    def with_host(host):
        return host if parts.port is None else f"{host}:{parts.port}"

    return urlunparse(parts._replace(netloc=with_host(reachable_host))), with_host(public_host)


def _request(session, service, method, url, **kwargs):
    """One hop: reachable address, public Host header, no automatic redirects."""
    target, host_header = _address(url, service)
    headers = {**kwargs.pop("headers", {}), "Host": host_header}
    response = session.request(
        method,
        target,
        headers=headers,
        allow_redirects=False,
        timeout=settings.DINUM_API_TIMEOUT,
        **kwargs,
    )
    for cookie in session.cookies:  # quirk 2
        cookie.secure = False
    return response


def _follow(session, service, method, url, flow_origins, **kwargs):
    """Run a request and follow its redirects while they stay inside the flow.

    `flow_origins` holds Drive's and Keycloak's origins. The chain stops at the
    first redirect pointing anywhere else, which is how the last hop is
    recognised: once Drive's callback has set the session cookie it redirects
    to Drive's own frontend (http://localhost:3000), a different application
    that is usually not even running and has nothing we need. That redirect's
    response is returned rather than followed.
    """
    for _ in range(MAX_REDIRECTS):
        response = _request(session, service, method, url, **kwargs)
        if response.status_code not in (301, 302, 303, 307, 308):
            return response

        location = response.headers.get("Location")
        if not location:
            raise LoginFailed("unexpected_response", 502)
        target = urljoin(response.url, location)
        if _origin(target) not in flow_origins:
            return response

        url = target
        # Anything after a redirect is a plain GET of the new location: the
        # body and method of the original request must not be replayed.
        method, kwargs = "GET", {}
    raise LoginFailed("unexpected_response", 502)


def login(service, email, password):
    """Return (session_cookie, user) for valid credentials on `service`.

    `user` is that service's own /users/me/ payload, so the identity our app
    displays is the one the service knows rather than one we invent. Raises
    LoginFailed for bad credentials (401) and for an unreachable (502) or slow
    (504) service.
    """
    config = _config(service)
    cookie_name = config["cookie"]
    public_port = urlparse(config["url"]).port
    public_base = f"http://{settings.DINUM_PUBLIC_HOST}"
    if public_port:
        public_base = f"{public_base}:{public_port}"
    session = requests.Session()

    try:
        # The service redirects to its Keycloak, which is how we learn that
        # Keycloak's address: it is configured there, not here. Drive and
        # Messages each run their own.
        handoff = _request(session, service, "GET", f"{public_base}/api/v1.0/authenticate/")
        keycloak_url = handoff.headers.get("Location")
        if handoff.status_code not in (301, 302, 303, 307, 308) or not keycloak_url:
            raise LoginFailed("unexpected_response", 502)
        flow_origins = {_origin(public_base), _origin(keycloak_url)}

        form_page = _follow(session, service, "GET", keycloak_url, flow_origins)
        match = _LOGIN_FORM.search(form_page.text)
        if not match:
            # Either Keycloak's markup changed or it refused the request
            # outright; both mean the flow is not what this code expects.
            raise LoginFailed("unexpected_response", 502)

        _follow(
            session,
            service,
            "POST",
            match.group(1).replace("&amp;", "&"),
            flow_origins,
            data={"username": email, "password": password},
        )

        whoami = _request(session, service, "GET", f"{public_base}/api/v1.0/users/me/")
    except requests.Timeout as error:
        raise LoginFailed(f"{service}_timeout", 504) from error
    except requests.RequestException as error:
        raise LoginFailed(f"{service}_unreachable", 502) from error
    finally:
        session.close()

    if whoami.status_code == 401:  # quirk 3
        raise LoginFailed("invalid_credentials", 401)
    if whoami.status_code != 200:
        raise LoginFailed("unexpected_response", 502)

    credential = session.cookies.get(cookie_name)
    if not credential:
        raise LoginFailed("unexpected_response", 502)
    return credential, whoami.json()
