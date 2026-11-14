"""Tiny HTTP layer: the standard library by default, or any client you pass (httpx, requests, an x402 paying client)."""

from __future__ import annotations

import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional


@dataclass
class Response:
    status: int
    headers: Dict[str, str]  # lower-case keys
    body: bytes


#: transport(method, url, headers, body, timeout) -> Response
Transport = Callable[[str, str, Dict[str, str], Optional[bytes], float], Response]


def urllib_transport(method: str, url: str, headers: Dict[str, str], body: Optional[bytes], timeout: float) -> Response:
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - https URLs only, checked by the caller
            return Response(r.status, {k.lower(): v for k, v in r.headers.items()}, r.read())
    except urllib.error.HTTPError as e:  # 4xx/5xx still carry a body (402 offers, errors)
        return Response(e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, e.read() or b"")


def client_transport(client: Any) -> Transport:
    """Wrap an httpx.Client, a requests.Session or a paying x402 client (anything with .request())."""

    def send(method: str, url: str, headers: Dict[str, str], body: Optional[bytes], timeout: float) -> Response:
        if "httpx" in type(client).__module__ or hasattr(client, "build_request"):
            r = client.request(method, url, headers=headers, content=body, timeout=timeout)
        else:
            r = client.request(method, url, headers=headers, data=body, timeout=timeout)
        status = getattr(r, "status_code", None) or getattr(r, "status", 0)
        return Response(int(status), {str(k).lower(): str(v) for k, v in dict(r.headers).items()}, bytes(r.content or b""))

    return send
