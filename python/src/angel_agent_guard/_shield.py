"""Angel Shield: the spend firewall for AI agents with a wallet or a card.

shield_check(payment, ...) asks Angel before a payment and returns decision allow | hold | block with reasons. With a stored
policy (shield_policy -> policy_id) an allowed amount is reserved: confirm it after paying (shield_confirm) or release it
(shield_release). Fail-closed: when Angel cannot be reached or asks for payment, the decision is "hold" (fail_open=True
turns that into "allow").
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from ._http import Transport, client_transport, urllib_transport

ANGEL_BASE = "https://angel.oroboros-design.com"
SHIELD_PATHS = {"check": "/agenten/signal/shield-check", "policy": "/shield/policy", "confirm": "/shield/confirm", "release": "/shield/release", "keys": "/shield/keys"}


@dataclass
class ShieldResult:
    decision: str  # allow | hold | block
    reasons: List[str] = field(default_factory=list)
    reservation_id: Optional[str] = None
    reservation_expires_at: Optional[str] = None
    budget: Optional[Dict[str, Any]] = None
    advice: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    source: str = "local"

    @property
    def allowed(self) -> bool:
        return self.decision == "allow"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def __getitem__(self, key: str) -> Any:  # r["decision"], r["reasons"]
        return getattr(self, key)


def _send(http: Optional[Transport], client: Any) -> Transport:
    if http is not None:
        return http
    if client is not None:
        return client_transport(client)
    return urllib_transport


def _call(method: str, path: str, body: Optional[Dict[str, Any]], *, bundle_token: Optional[str], base_url: Optional[str], timeout: float, send: Transport):
    base = (base_url or os.environ.get("ANGEL_BASE_URL") or ANGEL_BASE).rstrip("/")
    headers = {"content-type": "application/json", "accept": "application/json", "user-agent": "angel-agent-guard-py/0.4.0"}
    key = bundle_token or os.environ.get("ANGEL_BUNDLE_TOKEN")
    if key:
        headers["x-bundle-token"] = key
    try:
        r = send(method, f"{base}{path}", headers, json.dumps(body or {}).encode("utf-8") if method == "POST" else None, timeout)
    except Exception as e:  # noqa: BLE001 - never raise for network trouble
        return None, None, str(e)
    try:
        j = json.loads(r.body.decode("utf-8") or "null")
    except ValueError:
        j = None
    return r, (j if isinstance(j, dict) else None), None


def _host(u: str) -> Optional[str]:
    h = urlparse(u).hostname
    return h.lower().removeprefix("www.") if h else None


def _matches(merchant_url: Optional[str], pay_to: Optional[str], entry: str) -> bool:
    e = entry.strip().lower()
    if e.startswith("0x") and len(e) == 42:
        return bool(pay_to) and pay_to.lower() == e
    host = _host(merchant_url) if merchant_url else None
    want = _host(e) if e.startswith("http") else e.removeprefix("www.")
    return bool(host and want and (host == want or host.endswith("." + want)))


def local_policy_check(payment: Dict[str, Any], policy: Optional[Dict[str, Any]]) -> ShieldResult:
    """The rules that need no network: cap, kill switch, allow and block lists."""
    amount = float(payment.get("amount_usd") or 0)
    url, pay_to = payment.get("merchant_url"), payment.get("pay_to")
    reasons: List[str] = []
    if amount <= 0:
        reasons.append("[block] amount_usd must be > 0")
    p = policy or {}
    if p.get("kill"):
        reasons.append("[block] kill switch is on")
    cap = p.get("max_per_payment_usd")
    if cap is not None and amount > float(cap):
        reasons.append(f"[block] amount {amount} USD is above the per-payment cap of {cap} USD")
    if any(_matches(url, pay_to, e) for e in p.get("block_merchants") or []):
        reasons.append("[block] merchant is on the block list")
    allow = p.get("allow_merchants") or []
    if allow and not any(_matches(url, pay_to, e) for e in allow):
        reasons.append("[block] merchant is not on the allow list")
    return ShieldResult("block" if reasons else "allow", reasons)


def shield_check(
    payment: Dict[str, Any],
    *,
    trigger: Optional[str] = None,
    policy: Optional[Dict[str, Any]] = None,
    policy_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    bundle_token: Optional[str] = None,
    fail_open: bool = False,
    base_url: Optional[str] = None,
    timeout: float = 30.0,
    http: Optional[Transport] = None,
    client: Any = None,
) -> ShieldResult:
    """Ask Angel Shield before a payment. payment: {"amount_usd", "merchant_url" or "pay_to", "chain"?, "asset"?}."""
    local = local_policy_check(payment, policy if not policy_id else None)
    if local.decision == "block":
        local.advice = "Do not pay."
        return local
    body: Dict[str, Any] = {"payment": {k: v for k, v in payment.items() if v is not None}}
    if policy_id:
        body["policy_id"] = policy_id
    elif policy:
        body["policy"] = policy
    if trigger:
        body["trigger"] = {"url": trigger} if trigger.startswith("https://") and " " not in trigger else {"text": trigger[:100_000]}
    if idempotency_key:
        body["idempotency_key"] = idempotency_key
    r, j, err = _call("POST", SHIELD_PATHS["check"], body, bundle_token=bundle_token, base_url=base_url, timeout=timeout, send=_send(http, client))
    fallback = "allow" if fail_open else "hold"
    if r is not None and r.status == 200 and j and isinstance(j.get("decision"), str):
        res = j.get("reservation") or {}
        return ShieldResult(
            decision=j["decision"] if j["decision"] in ("allow", "hold", "block") else "hold",
            reasons=list(j.get("reasons") or []),
            reservation_id=res.get("id") if isinstance(res, dict) else None,
            reservation_expires_at=res.get("expires_at") if isinstance(res, dict) else None,
            budget=j.get("budget"), advice=j.get("advice"), raw=j, source="angel",
        )
    if r is not None and r.status == 402:
        return ShieldResult(fallback, [f"[{fallback}] Shield needs a key (bundle_token) or an x402 payment (0.02 USDC)"], error="payment_required")
    if r is not None and r.status == 400:
        return ShieldResult("block", [f"[block] {(j or {}).get('message') or 'bad request'}"], error="bad_request")
    why = err or (f"HTTP {r.status}" if r is not None else "no response")
    return ShieldResult(fallback, [f"[{fallback}] Shield unreachable: {why}"], error=why)


def _simple(path: str, body: Dict[str, Any], *, bundle_token: Optional[str], base_url: Optional[str], timeout: float, http: Optional[Transport], client: Any) -> Dict[str, Any]:
    r, j, err = _call("POST", path, body, bundle_token=bundle_token, base_url=base_url, timeout=timeout, send=_send(http, client))
    status = r.status if r is not None else 0
    return {"ok": status in (200, 201), "status": status, **(j or {}), **({"error": err} if err else {})}


def shield_confirm(reservation_id: str, tx: Optional[str] = None, *, bundle_token: Optional[str] = None, base_url: Optional[str] = None, timeout: float = 20.0, http: Optional[Transport] = None, client: Any = None) -> Dict[str, Any]:
    """After paying: the amount counts against today's budget, the merchant is remembered."""
    return _simple(SHIELD_PATHS["confirm"], {"reservation_id": reservation_id, **({"tx": tx} if tx else {})}, bundle_token=bundle_token, base_url=base_url, timeout=timeout, http=http, client=client)


def shield_release(reservation_id: str, *, bundle_token: Optional[str] = None, base_url: Optional[str] = None, timeout: float = 20.0, http: Optional[Transport] = None, client: Any = None) -> Dict[str, Any]:
    """You did not pay: the reserved amount is free again."""
    return _simple(SHIELD_PATHS["release"], {"reservation_id": reservation_id}, bundle_token=bundle_token, base_url=base_url, timeout=timeout, http=http, client=client)


def shield_policy(policy: Dict[str, Any], *, name: Optional[str] = None, policy_id: Optional[str] = None, bundle_token: Optional[str] = None, base_url: Optional[str] = None, timeout: float = 20.0, http: Optional[Transport] = None, client: Any = None) -> Dict[str, Any]:
    """Create (no policy_id) or update a stored policy; the answer carries policy_id."""
    body = {**policy, **({"name": name} if name else {}), **({"policy_id": policy_id} if policy_id else {})}
    return _simple(SHIELD_PATHS["policy"], body, bundle_token=bundle_token, base_url=base_url, timeout=timeout, http=http, client=client)


def shield_free_key(email: Optional[str] = None, *, base_url: Optional[str] = None, timeout: float = 20.0, http: Optional[Transport] = None, client: Any = None) -> Dict[str, Any]:
    """A free Shield key: 100 checks, 30 days, Shield only."""
    return _simple(SHIELD_PATHS["keys"], {"email": email} if email else {}, bundle_token=None, base_url=base_url, timeout=timeout, http=http, client=client)
