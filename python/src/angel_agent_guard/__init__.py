"""angel-agent-guard: two checks an AI agent should run before it acts.

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
from ._local import USDC, LocalFinding, OfferCheck, QuickScanResult, check_offer, decode_offer, fence, local_verdict, looks_like_url, quick_scan

__version__ = VERSION
__all__ = [
    "VERSION", "ANGEL_BASE", "PATHS", "USDC",
    "guard_untrusted", "verify_before_pay", "read_safe_url", "aguard_untrusted", "averify_before_pay", "aread_safe_url",
    "quick_scan", "local_verdict", "fence", "looks_like_url", "check_offer", "decode_offer",
    "GuardResult", "VerifyResult", "PaymentNeeded", "SafeReadResult", "QuickScanResult", "LocalFinding", "OfferCheck",
]
