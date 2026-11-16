import json

from angel_agent_guard import local_policy_check, shield_check, shield_confirm, shield_policy
from angel_agent_guard._http import Response


def resp(status, body=None):
    return Response(status, {}, json.dumps(body or {}).encode())


class Fake:
    def __init__(self, routes):
        self.routes, self.calls = routes, []

    def __call__(self, method, url, headers, body, timeout):
        self.calls.append({"url": url, "headers": headers, "body": json.loads(body) if body else None})
        for key, fn in self.routes.items():
            if url.endswith(key):
                return fn()
        return resp(404)


def test_local_policy_blocks_without_network():
    assert local_policy_check({"amount_usd": 50, "merchant_url": "https://shop.example.com"}, {"max_per_payment_usd": 10}).decision == "block"
    assert local_policy_check({"amount_usd": 5, "merchant_url": "https://pay.shop.example.com"}, {"allow_merchants": ["example.com"]}).decision == "allow"
    assert local_policy_check({"amount_usd": 5, "pay_to": "0x000000000000000000000000000000000000dEaD"}, {"allow_merchants": ["example.com"]}).decision == "block"
    fake = Fake({})
    r = shield_check({"amount_usd": 99, "merchant_url": "https://shop.example.com"}, policy={"max_per_payment_usd": 10}, http=fake)
    assert r.decision == "block" and fake.calls == []


def test_shield_check_allow_with_reservation_and_key_header():
    fake = Fake({"/agenten/signal/shield-check": lambda: resp(200, {"decision": "allow", "reasons": [], "reservation": {"id": "res_abcdefgh1234", "expires_at": "2026-11-16T12:15:00Z"}, "budget": {"daily_usd": 10, "used_usd": 2, "remaining_usd": 8}})})
    r = shield_check({"amount_usd": 2, "merchant_url": "https://shop.example.com/c"}, policy_id="pol_abcdefgh1234", trigger="buy the report", bundle_token="tsb_x", http=fake)
    assert r.allowed and r["reservation_id"] == "res_abcdefgh1234" and r.budget["remaining_usd"] == 8
    c = fake.calls[0]
    assert c["headers"]["x-bundle-token"] == "tsb_x"
    assert c["body"] == {"payment": {"amount_usd": 2, "merchant_url": "https://shop.example.com/c"}, "policy_id": "pol_abcdefgh1234", "trigger": {"text": "buy the report"}}


def test_fail_closed():
    pay = Fake({"/agenten/signal/shield-check": lambda: resp(402, {"error": "payment required"})})
    assert shield_check({"amount_usd": 1, "merchant_url": "https://x.example.com"}, http=pay).decision == "hold"

    def boom(*a):
        raise OSError("offline")

    assert shield_check({"amount_usd": 1, "merchant_url": "https://x.example.com"}, http=boom).decision == "hold"
    assert shield_check({"amount_usd": 1, "merchant_url": "https://x.example.com"}, http=boom, fail_open=True).decision == "allow"


def test_policy_and_confirm():
    fake = Fake({"/shield/policy": lambda: resp(201, {"policy_id": "pol_abcdefgh1234"}), "/shield/confirm": lambda: resp(200, {"result": "confirmed"})})
    p = shield_policy({"max_per_payment_usd": 5, "daily_budget_usd": 10}, name="agent", bundle_token="tsb_x", http=fake)
    assert p["ok"] and p["policy_id"] == "pol_abcdefgh1234"
    assert fake.calls[0]["body"] == {"max_per_payment_usd": 5, "daily_budget_usd": 10, "name": "agent"}
    c = shield_confirm("res_abcdefgh1234", "0xabc", bundle_token="tsb_x", http=fake)
    assert c["ok"] and c["result"] == "confirmed"
