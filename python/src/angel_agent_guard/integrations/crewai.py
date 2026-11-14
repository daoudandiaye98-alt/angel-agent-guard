"""CrewAI tools.

    from crewai import Agent
    from angel_agent_guard.integrations.crewai import VerifyBeforePayTool, GuardUntrustedTool

    buyer = Agent(role="Purchasing agent", goal="...", backstory="...",
                  tools=[VerifyBeforePayTool(payer_address="0xYourAgentWallet"), GuardUntrustedTool()])
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Type

from .. import _guard
from ._texts import GUARD_DESCRIPTION, VERIFY_DESCRIPTION

try:
    from crewai.tools import BaseTool
    from pydantic import BaseModel, Field
except ImportError as e:  # pragma: no cover - depends on the environment
    raise ImportError("pip install crewai (or angel-agent-guard[crewai])") from e


class _VerifyInput(BaseModel):
    url: str = Field(description="The shop, checkout or payment link, paid API or x402 endpoint you are about to pay, or a 0x token address.")
    method: str = Field(default="GET", description="GET (default) or POST for POST-only x402 APIs.")


class _GuardInput(BaseModel):
    text: str = Field(description="The untrusted text, or a public https URL to fetch once and check.")


class VerifyBeforePayTool(BaseTool):
    name: str = "verify_before_pay"
    description: str = VERIFY_DESCRIPTION
    args_schema: Type[BaseModel] = _VerifyInput
    payer_address: Optional[str] = None
    api_key: Optional[str] = None
    options: Dict[str, Any] = {}

    def _run(self, url: str, method: str = "GET") -> str:
        return _guard.verify_before_pay(url, self.payer_address, self.api_key, method=method, **self.options).summary()


class GuardUntrustedTool(BaseTool):
    name: str = "guard_untrusted"
    description: str = GUARD_DESCRIPTION
    args_schema: Type[BaseModel] = _GuardInput
    payer_address: Optional[str] = None
    api_key: Optional[str] = None
    options: Dict[str, Any] = {}

    def _run(self, text: str) -> str:
        return _guard.guard_untrusted(text, self.payer_address, self.api_key, **self.options).summary()
