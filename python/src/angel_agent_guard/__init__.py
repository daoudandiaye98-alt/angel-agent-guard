"""angel-agent-guard: Angel Shield, the spend firewall for AI agents, and the checks an agent should run before it acts.

- shield_check(payment): allow, hold or block a payment before it happens (spend rules, daily budget, merchant, trigger, token)

- guard_untrusted(text_or_url): prompt-injection check for content written by someone else
- verify_before_pay(url_or_token): pre-purchase check for any shop, checkout or payment link, paid API, x402 endpoint or token
- read_safe_url(url): any public URL as clean, injection-scrubbed Markdown for an LLM
- quick_scan(text): offline pass (invisible Unicode, tag smuggling, exfiltration images), zero dependencies

Integrations: angel_agent_guard.integrations.browser_use, .langchain, .crewai
"""

from ._guard import (
    ANGEL_BASE,
    PATHS,
    VERSION,
    GuardResult,
    PaymentNeeded,
    SafeReadResult,
    VerifyResult,
    aguard_untrusted,
    aread_safe_url,
    averify_before_pay,
    guard_untrusted,
    read_safe_url,
    verify_before_pay,
)
from ._shield import SHIELD_PATHS, ShieldResult, local_policy_check, shield_check, shield_confirm, shield_free_key, shield_policy, shield_release
from ._local import USDC, LocalFinding, OfferCheck, QuickScanResult, check_offer, decode_offer, fence, local_verdict, looks_like_url, quick_scan

__version__ = VERSION
__all__ = [
    "VERSION", "ANGEL_BASE", "PATHS", "USDC",
    "shield_check", "shield_confirm", "shield_release", "shield_policy", "shield_free_key", "local_policy_check", "ShieldResult", "SHIELD_PATHS",
    "guard_untrusted", "verify_before_pay", "read_safe_url", "aguard_untrusted", "averify_before_pay", "aread_safe_url",
    "quick_scan", "local_verdict", "fence", "looks_like_url", "check_offer", "decode_offer",
    "GuardResult", "VerifyResult", "PaymentNeeded", "SafeReadResult", "QuickScanResult", "LocalFinding", "OfferCheck",
]
