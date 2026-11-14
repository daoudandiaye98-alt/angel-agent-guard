"""LangChain / LangGraph tools (langchain-core).

    from angel_agent_guard.integrations.langchain import angel_langchain_tools
    tools = angel_langchain_tools(payer_address="0xYourAgentWallet")   # [verify_before_pay, guard_untrusted]
    agent = create_react_agent(model, tools)                            # LangGraph prebuilt agent, or bind_tools(...)
"""

from __future__ import annotations

from typing import Any, List, Optional

from .. import _guard
from ._texts import GUARD_DESCRIPTION, VERIFY_DESCRIPTION

try:
    from langchain_core.tools import StructuredTool
    from pydantic import BaseModel, Field
except ImportError as e:  # pragma: no cover - depends on the environment
    raise ImportError("pip install langchain-core (or angel-agent-guard[langchain])") from e


class VerifyBeforePayInput(BaseModel):
    url: str = Field(description="The shop, checkout or payment link, paid API or x402 endpoint you are about to pay, or a 0x token address.")
    method: str = Field(default="GET", description="HTTP method you will use: GET (default) or POST for POST-only x402 APIs.")


class GuardUntrustedInput(BaseModel):
    text: str = Field(description="The untrusted text, or a public https URL to fetch once and check.")


def verify_before_pay_tool(payer_address: Optional[str] = None, api_key: Optional[str] = None, **options: Any) -> "StructuredTool":
    def run(url: str, method: str = "GET") -> str:
        return _guard.verify_before_pay(url, payer_address, api_key, method=method, **options).summary()

    async def arun(url: str, method: str = "GET") -> str:
        return (await _guard.averify_before_pay(url, payer_address, api_key, method=method, **options)).summary()

    return StructuredTool.from_function(func=run, coroutine=arun, name="verify_before_pay", description=VERIFY_DESCRIPTION, args_schema=VerifyBeforePayInput)


def guard_untrusted_tool(payer_address: Optional[str] = None, api_key: Optional[str] = None, **options: Any) -> "StructuredTool":
    def run(text: str) -> str:
        return _guard.guard_untrusted(text, payer_address, api_key, **options).summary()

    async def arun(text: str) -> str:
        return (await _guard.aguard_untrusted(text, payer_address, api_key, **options)).summary()

    return StructuredTool.from_function(func=run, coroutine=arun, name="guard_untrusted", description=GUARD_DESCRIPTION, args_schema=GuardUntrustedInput)


def angel_langchain_tools(payer_address: Optional[str] = None, api_key: Optional[str] = None, **options: Any) -> List["StructuredTool"]:
    return [verify_before_pay_tool(payer_address, api_key, **options), guard_untrusted_tool(payer_address, api_key, **options)]
