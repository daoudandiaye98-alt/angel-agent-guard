"""browser-use 1.0 custom tools.

    from browser_use import Agent, Tools
    from angel_agent_guard.integrations.browser_use import register

    tools = register(Tools(), payer_address="0xYourAgentWallet")
    Agent("Buy a USB-C cable under 10 EUR on https://shop.example.com; verify the checkout before paying.", tools=tools)

Adds the actions verify_before_pay(url) and guard_page_text(text).
"""

from __future__ import annotations

from typing import Any, Optional

from .. import _guard
from ._texts import GUARD_DESCRIPTION, VERIFY_DESCRIPTION


def register(tools: Any, payer_address: Optional[str] = None, api_key: Optional[str] = None, **options: Any) -> Any:
    """Register verify_before_pay and guard_page_text on a browser_use Tools() instance and return it."""

    @tools.action(VERIFY_DESCRIPTION)
    async def verify_before_pay(url: str) -> str:
        r = await _guard.averify_before_pay(url, payer_address, api_key, **options)
        return r.summary()

    @tools.action(GUARD_DESCRIPTION)
    async def guard_page_text(text: str) -> str:
        r = await _guard.aguard_untrusted(text, payer_address, api_key, **options)
        return r.summary()

    return tools


def angel_tools(payer_address: Optional[str] = None, api_key: Optional[str] = None, **options: Any) -> Any:
    """A new browser_use Tools() with both actions registered."""
    try:
        from browser_use import Tools
    except ImportError as e:  # pragma: no cover - depends on the environment
        raise ImportError("pip install browser-use (or angel-agent-guard[browser-use])") from e
    return register(Tools(), payer_address, api_key, **options)
