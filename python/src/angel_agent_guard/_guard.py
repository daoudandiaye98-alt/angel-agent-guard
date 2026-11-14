"""guard_untrusted and verify_before_pay: local checks first, then Angel's hosted checks.

Neither function raises for network or payment problems: they fall back to the local result and say why in
`error` / `errors`.
"""

from __future__ import annotations

import base64
import json
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from ._http import Response, Transport, client_transport, urllib_transport
from ._local import LocalFinding, OfferCheck, QuickScanResult, check_offer, decode_offer, local_verdict, looks_like_url, quick_scan

VERSION = "0.2.0"
ANGEL_BASE = "https://angel.oroboros-design.com"
PATHS = {"input_guard": "/agenten/signal/input-guard", "preflight": "/agenten/signal/preflight", "token_risk": "/agenten/signal/token-risk"}

_RANK = {"clean": 0, "unchecked": 1, "caution": 2, "hostile": 3}
_ACTION = {"clean": "use", "caution": "read_only", "hostile": "drop", "unchecked": "review"}
_VRANK = {"pay": 0, "unchecked": 1, "caution": 2, "do_not_pay": 3}


@dataclass
class PaymentNeeded:
    """Set when the free calls are used up: the x402 offer, the price and a card link a human can open."""

    offer: Optional[Dict[str, Any]]
    price_usdc: Optional[str]
    pay_by_card: Optional[str]
    message: Optional[str]


@dataclass
class GuardResult:
    verdict: str  # clean | caution | hostile | unchecked
    action: str  # use | read_only | drop | review
    score: Optional[float]
    findings: List[Dict[str, Any]]
    cleaned: Optional[str]
    hidden_message: Optional[str]
    source: str  # angel | local
    free_calls_remaining: Optional[int] = None
    payment: Optional[PaymentNeeded] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def summary(self) -> str:
        """Short JSON for an LLM tool result."""
        kinds = sorted({str(f.get("kind")) for f in self.findings})
        out: Dict[str, Any] = {"verdict": self.verdict, "action": self.action, "findings": kinds, "hidden_message": self.hidden_message}
        if self.payment:
            out["payment_needed"] = {"price_usdc": self.payment.price_usdc, "pay_by_card": self.payment.pay_by_card}
        if self.error:
            out["error"] = self.error
        return json.dumps(out, ensure_ascii=False)


@dataclass
class VerifyResult:
    ok: bool  # True only when at least one check ran and all of them say pay
    verdict: str  # pay | caution | do_not_pay | unchecked
    risk_score: Optional[float] = None  # 0 (nothing found) .. 100 (do not pay)
    kind: Optional[str] = None  # checkout | shop | api | x402 | web
    merchant: Optional[Dict[str, Any]] = None  # TLS, domain age, look-alike, redirects, payment providers, card fields
    injection: Optional[Dict[str, Any]] = None  # text in the page aimed at agents
    reasons: List[str] = field(default_factory=list)
    local: Optional[OfferCheck] = None
    preflight: Optional[Dict[str, Any]] = None
    token: Optional[Dict[str, Any]] = None
    payment: Optional[PaymentNeeded] = None
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def summary(self) -> str:
        """Short JSON for an LLM tool result."""
        m = self.merchant or {}
        out: Dict[str, Any] = {
            "ok": self.ok, "verdict": self.verdict, "risk_score": self.risk_score, "kind": self.kind,
            "payment_providers": m.get("payment_providers"), "injection": (self.injection or {}).get("verdict"),
            "reasons": self.reasons[:8],
        }
        if self.payment:
            out["payment_needed"] = {"price_usdc": self.payment.price_usdc, "pay_by_card": self.payment.pay_by_card}
        if self.errors:
            out["errors"] = self.errors
        return json.dumps(out, ensure_ascii=False)


def _transport(http: Optional[Transport], client: Any) -> Transport:
    if http is not None:
        return http
    if client is not None:
        return client_transport(client)
    return urllib_transport


def _headers(payer_address: Optional[str], api_key: Optional[str]) -> Dict[str, str]:
    h = {"content-type": "application/json", "accept": "application/json", "user-agent": f"angel-agent-guard-py/{VERSION}"}
    payer = payer_address or os.environ.get("ANGEL_PAYER_ADDRESS")
    if payer:
        h["x-payer-address"] = payer
    key = api_key or os.environ.get("ANGEL_API_KEY")
    if key:
        h["x-api-key"] = key
    return h


def _json(r: Response) -> Optional[Dict[str, Any]]:
    try:
        v = json.loads(r.body.decode("utf-8"))
        return v if isinstance(v, dict) else None
    except Exception:
        return None


def _post(path: str, body: Dict[str, Any], *, payer_address: Optional[str], api_key: Optional[str], base_url: Optional[str], timeout: float, send: Transport):
    base = (base_url or os.environ.get("ANGEL_BASE_URL") or ANGEL_BASE).rstrip("/")
    try:
        r = send("POST", f"{base}{path}", _headers(payer_address, api_key), json.dumps(body).encode("utf-8"), timeout)
        return r, _json(r), None
    except Exception as e:  # network errors never raise to the caller
        return None, None, str(e) or type(e).__name__


def _payment(r: Optional[Response], body: Optional[Dict[str, Any]]) -> PaymentNeeded:
    offer = decode_offer((r.headers if r else {}).get("payment-required"))
    if offer is None and body and isinstance(body.get("accepts"), list):
        offer = body
    amount = ((offer or {}).get("accepts") or [{}])[0].get("amount") if offer else None
    price = f"{int(amount) / 1e6:.2f}" if amount else (body or {}).get("price_usd")
    msg = (body or {}).get("task_blocked") or (body or {}).get("error")
    return PaymentNeeded(offer, price if isinstance(price, str) else None, (body or {}).get("pay_by_card"), msg if isinstance(msg, str) else None)


def _receipt(header: Optional[str]) -> Any:
    if not header:
        return None
    try:
        return json.loads(base64.b64decode(header + "=" * (-len(header) % 4)).decode("utf-8"))
    except Exception:
        return None


def guard_untrusted(
    text_or_url: str,
    payer_address: Optional[str] = None,
    api_key: Optional[str] = None,
    *,
    remote: bool = True,
    base_url: Optional[str] = None,
    timeout: float = 20.0,
    client: Any = None,
    http: Optional[Transport] = None,
) -> GuardResult:
    """Check untrusted text, or a public https URL, before an agent reads it.

    Local pass first (invisible Unicode, tag smuggling, exfiltration images), then Angel's 17-language input guard.
    Act on ``result.action``: use, read_only (continue without send/write/payment tools), drop, or review (ask a human).
    """
    is_url = looks_like_url(text_or_url)
    local: Optional[QuickScanResult] = None if is_url else quick_scan(text_or_url)
    local_v = local_verdict(local) if local else "unchecked"
    hidden = next((f.decoded for f in (local.findings if local else []) if f.kind == "unicode_tags"), None)
    base = GuardResult(local_v, _ACTION[local_v], None, [f.to_dict() for f in (local.findings if local else [])], local.cleaned if local else None, hidden, "local")
    if not remote:
        return base
    body = {"url": text_or_url.strip()} if is_url else {"text": text_or_url[:100_000]}
    r, j, err = _post(PATHS["input_guard"], body, payer_address=payer_address, api_key=api_key, base_url=base_url, timeout=timeout, send=_transport(http, client))
    if r is not None and r.status == 200 and j and isinstance(j.get("verdict"), str):
        remote_v = j["verdict"] if j["verdict"] in ("clean", "caution", "hostile") else "caution"
        lv = "clean" if local_v == "unchecked" else local_v
        verdict = remote_v if _RANK[remote_v] >= _RANK[lv] else lv
        free = r.headers.get("x-free-calls-remaining")
        return GuardResult(
            verdict, _ACTION[verdict], j.get("score") if isinstance(j.get("score"), (int, float)) else None,
            j.get("findings") if isinstance(j.get("findings"), list) else [],
            j.get("cleaned") if isinstance(j.get("cleaned"), str) else base.cleaned,
            ((j.get("hidden") or {}).get("tag_message") if isinstance(j.get("hidden"), dict) else None) or hidden,
            "angel", int(free) if free and free.isdigit() else None,
        )
    if r is not None and r.status == 402:
        base.payment = _payment(r, j)
        base.free_calls_remaining = 0
        base.error = "payment_required: free calls used; pay via x402 (pass a paying client) or by card"
        return base
    base.error = err or f"input guard HTTP {r.status if r else 0}"
    return base


def verify_before_pay(
    target: Optional[str] = None,
    payer_address: Optional[str] = None,
    api_key: Optional[str] = None,
    *,
    url: Optional[str] = None,
    method: str = "GET",
    token: Optional[str] = None,
    chain: str = "base",
    remote: bool = True,
    probe: bool = True,
    max_amount_atomic: int = 1_000_000,
    networks: Sequence[str] = ("eip155:8453",),
    base_url: Optional[str] = None,
    timeout: float = 20.0,
    client: Any = None,
    http: Optional[Transport] = None,
) -> VerifyResult:
    """Check before money moves: a shop or product page, a checkout or payment link (Stripe, Shopify, PayPal, SaaS
    checkout), an unknown paid API, an x402 endpoint, or an ERC-20 before a swap or approval.

    ``target`` is a URL or a 0x token address. ``ok`` is True only when at least one check ran and every check says pay.
    On ``caution`` show the reasons to the user and wait; on ``do_not_pay`` never pay.
    """
    if target:
        t = target.strip()
        if t.startswith("0x") and len(t) == 42:
            token = token or t
        else:
            url = url or t
    send = _transport(http, client)
    reasons: List[str] = []
    errors: List[str] = []
    verdict, ran = "unchecked", 0
    res = VerifyResult(False, "unchecked")

    def stricter(a: str, b: str) -> str:
        return a if _VRANK[a] >= _VRANK[b] else b

    if url:
        offer = None
        if probe:
            try:
                h = {"user-agent": f"angel-agent-guard-py/{VERSION}", "accept": "*/*"}
                data = None
                if method.upper() == "POST":
                    h["content-type"] = "application/json"
                    data = b"{}"
                r = send(method.upper(), url, h, data, timeout)
                if r.status == 402:
                    offer = decode_offer(r.headers.get("payment-required"))
                else:
                    reasons.append(f"[info] probe: HTTP {r.status}, no x402 offer (regular page, checkout or API).")
            except Exception as e:
                errors.append(f"probe: {e}")
        if offer:
            res.local = check_offer(offer, url=url, max_amount_atomic=max_amount_atomic, networks=networks)
            reasons += [f"local {x}" for x in res.local.reasons]
            verdict, ran = res.local.verdict, ran + 1
        if remote:
            r, j, err = _post(PATHS["preflight"], {"url": url, "method": method.upper()}, payer_address=payer_address, api_key=api_key, base_url=base_url, timeout=timeout, send=send)
            if r is not None and r.status == 200 and j:
                res.preflight = j
                pv = j.get("verdict")
                mapped = pv if pv in ("pay", "do_not_pay") else "caution"
                verdict = stricter(verdict, mapped) if ran else mapped
                ran += 1
                reasons += [f"preflight {x}" for x in (j.get("reasons") or []) if isinstance(x, str)]
            elif r is not None and r.status == 402:
                res.payment = _payment(r, j)
                errors.append("preflight: payment_required (free calls used); pass a paying client to continue")
            else:
                errors.append(f"preflight: {err or f'HTTP {r.status if r else 0}'}")

    if token:
        if not remote:
            errors.append("token: needs the remote check (remote=False)")
        else:
            r, j, err = _post(PATHS["token_risk"], {"token": token, "chain": chain}, payer_address=payer_address, api_key=api_key, base_url=base_url, timeout=timeout, send=send)
            if r is not None and r.status == 200 and j:
                res.token = j
                risk = j.get("risk")
                mapped = "pay" if risk == "low" else "caution" if risk == "medium" else "do_not_pay"
                verdict = stricter(verdict, mapped) if ran else mapped
                ran += 1
                reasons += [f"token {x}" for x in (j.get("reasons") or []) if isinstance(x, str)]
            elif r is not None and r.status == 402:
                res.payment = _payment(r, j)
                errors.append("token: payment_required (free calls used); pass a paying client to continue")
            else:
                errors.append(f"token: {err or f'HTTP {r.status if r else 0}'}")

    if not url and not token:
        errors.append("nothing to check: pass a url and/or a token")
    p = res.preflight or {}
    res.ok = ran > 0 and verdict == "pay"
    res.verdict = verdict if ran else "unchecked"
    res.risk_score = p.get("risk_score") if isinstance(p.get("risk_score"), (int, float)) else None
    res.kind = p.get("kind") if isinstance(p.get("kind"), str) else None
    res.merchant = p.get("merchant_signals") if isinstance(p.get("merchant_signals"), dict) else None
    res.injection = p.get("injection_check") if isinstance(p.get("injection_check"), dict) else None
    res.reasons, res.errors = reasons, errors
    return res


async def averify_before_pay(*args: Any, **kwargs: Any) -> VerifyResult:
    """Async variant (runs the stdlib call in a worker thread)."""
    import asyncio

    return await asyncio.to_thread(verify_before_pay, *args, **kwargs)


async def aguard_untrusted(*args: Any, **kwargs: Any) -> GuardResult:
    """Async variant (runs the stdlib call in a worker thread)."""
    import asyncio

    return await asyncio.to_thread(guard_untrusted, *args, **kwargs)


__all__ = [
    "VERSION", "ANGEL_BASE", "PATHS", "GuardResult", "VerifyResult", "PaymentNeeded",
    "guard_untrusted", "verify_before_pay", "aguard_untrusted", "averify_before_pay", "LocalFinding",
]
