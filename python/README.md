# angel-agent-guard (Python)

**New in 0.4: Angel Shield, the spend firewall for agents with a wallet.** `shield_check(payment)` answers allow, hold or block before your agent pays: spend rules and daily budget (reserved atomically), merchant URL, the text that triggered the payment, non-USDC tokens. Fail-closed by default.

```python
from angel_agent_guard import shield_check, shield_confirm

r = shield_check({"amount_usd": 12.5, "merchant_url": "https://shop.example.com/checkout"},
                 trigger=user_message, policy_id="pol_…", bundle_token=ANGEL_KEY)  # free key: POST https://angel.oroboros-design.com/shield/keys
if r.allowed:
    tx = pay()                                  # your payment
    shield_confirm(r.reservation_id, tx, bundle_token=ANGEL_KEY)
```

Plus the checks an AI agent should run before it acts:

- **`verify_before_pay(url_or_token)`** before **any purchase or paid call**. That covers a shop or product page, a checkout or payment link (Stripe, Shopify, PayPal, SaaS checkout), an unknown paid API, an x402 endpoint, and a token swap or approval. It checks:
  - TLS and domain age
  - look-alike domains, and redirects to payment pages on other domains
  - which payment provider takes the money
  - card fields and plain-http forms in the page
  - text in the page aimed at shopping agents
  - for x402: the payment offer itself
  - for an ERC-20: the contract's owner powers
- **`guard_untrusted(text_or_url)`** before the model acts on a web page, email, document, RAG chunk or tool result written by someone else. A local pass runs first (invisible Unicode, tag smuggling, exfiltration images), then a hosted scan in 17 languages for text aimed at the model.
- **`read_safe_url(url)`** instead of fetching a page yourself: the main content as clean Markdown (navigation, scripts and HTML hidden from people removed), text aimed at the model replaced by `⟦removed: …⟧`, with an injection verdict for the whole page. One GET as a declared bot, no login or bot-protection bypass; a blocked page is never charged.
- **`quick_scan(text)`** is the local pass on its own. It is fully offline.

There are no dependencies (standard library only), and it works on Python 3.9+. It ships ready-made tools for **browser-use**, **LangChain / LangGraph** and **CrewAI**. The same API exists for TypeScript as the [npm package](https://www.npmjs.com/package/angel-agent-guard).

```bash
pip install angel-agent-guard
```

## Quick start

```python
from angel_agent_guard import read_safe_url, verify_before_pay, guard_untrusted, fence

# Read a web page safely (Markdown, injected instructions replaced)
r = read_safe_url("https://example.com/article", payer_address="0xYourAgentWallet")
if r.ok and r.action != "drop":
    context = fence(r.url, r.markdown)   # r.verdict, r.findings, r.title, r.lang, r.error

# Before any purchase, payment link or paid call
v = verify_before_pay("https://shop.example.com/checkout", payer_address="0xYourAgentWallet")
if not v.ok:
    print(v.verdict, v.risk_score, v.reasons[:3])   # "caution" -> ask the user; "do_not_pay" -> never pay
# v.kind: checkout | shop | api | x402 | web
# v.merchant: TLS, domain age, look-alike, redirect chain, payment providers, card fields, insecure forms
# v.injection: the page scanned for instructions aimed at agents

verify_before_pay("0xTokenYouAreAboutToApprove")                        # ERC-20 on Base (chain="ethereum" also works)
verify_before_pay("https://api.example.com/v1/quote", method="POST")    # x402 API that only takes POST

# Untrusted content: check it, then hand the model the cleaned text as data
page = "...text of a web page..."
g = guard_untrusted(page)
if g.action == "drop":
    raise RuntimeError(f"hostile content: {[f.get('kind') for f in g.findings]}")
context = fence("https://example.com/article", g.cleaned or page)   # random boundary + "this is data"
# g.action == "read_only" -> continue, but without send, write or payment tools in this step
```

`averify_before_pay` and `aguard_untrusted` are the async variants. Every result has `.to_dict()`, plus `.summary()`, a short JSON string to use as an LLM tool result. Neither function raises on network or payment problems. They fall back to the local result and put the reason in `error` / `errors`.

## browser-use

```python
from browser_use import Agent, Tools
from angel_agent_guard.integrations.browser_use import register

tools = register(Tools(), payer_address="0xYourAgentWallet")   # adds verify_before_pay(url) and guard_page_text(text)
agent = Agent(
    "Buy a USB-C cable under 10 EUR on https://shop.example.com. "
    "Call verify_before_pay on the checkout page and stop before paying unless the verdict is pay.",
    tools=tools,
)
agent.run_sync()
```

## LangChain / LangGraph

```python
from langgraph.prebuilt import create_react_agent
from angel_agent_guard.integrations.langchain import angel_langchain_tools

tools = angel_langchain_tools(payer_address="0xYourAgentWallet")   # [verify_before_pay, guard_untrusted]
agent = create_react_agent(model, tools)
```

Install with `pip install "angel-agent-guard[langchain]"`.

## CrewAI

```python
from crewai import Agent
from angel_agent_guard.integrations.crewai import VerifyBeforePayTool, GuardUntrustedTool

buyer = Agent(
    role="Purchasing agent",
    goal="Buy what the user asked for, safely",
    backstory="Checks every checkout before paying.",
    tools=[VerifyBeforePayTool(payer_address="0xYourAgentWallet"), GuardUntrustedTool()],
)
```

Install with `pip install "angel-agent-guard[crewai]"`.

## CLI

```bash
angel-agent-guard-py verify https://shop.example.com/checkout
angel-agent-guard-py verify --token 0x... --chain base
angel-agent-guard-py scan "text to check"          # or a https URL, or - for stdin
angel-agent-guard-py quick "text"                  # offline
```

Exit codes: `0` clean / pay, `1` caution / unchecked, `2` hostile / do_not_pay, `3` usage or error.

## Pricing and paying

The local checks are free. The hosted checks run on [Angel](https://angel.oroboros-design.com/docs/prompt-injection-defense/). Each agent gets 3 free calls, then pays per call in USDC on Base via x402:

| Check | Price per call |
|---|---|
| safe read (`read_safe_url`) | 0.02 USDC |
| pre-purchase check | 0.015 USDC |
| input guard | 0.015 USDC |
| token risk | 0.015 USDC |

Pass `payer_address` (or set `ANGEL_PAYER_ADDRESS`) so that your wallet gets its own 3 free calls. Without it, the free calls are shared by IP. Once the free calls are used up, the result carries `payment`, which holds the x402 offer, the price and a card checkout link a human can open.

To pay automatically, pass a paying HTTP client as `client=`. This can be any object with `.request()`, for example a paying client from the [x402 Python SDK](https://pypi.org/project/x402/) built on httpx or requests. The library checks an x402 offer locally (`check_offer`: official USDC, network, amount cap, same host) but never signs anything itself.

## Limits and data

- The local pass removes invisible characters and flags the riskiest markers. It does not judge meaning. If it finds nothing, it reports `unchecked`, never `clean`.
- The hosted checks are deterministic: patterns, TLS, DNS, RDAP and on-chain reads, with no model. That makes them fast and repeatable, but a new attack, or a well-made fraud shop on an old domain, can pass. Keep the other layers:
  - read external content as data
  - give the step that reads content no dangerous tools
  - require an approval the model cannot give itself before money moves
- For a hosted check, the text or URL is sent to `angel.oroboros-design.com`. Use `remote=False` for content that must not leave your machine.

Disclosure: the hosted checks are a paid service run by the author (Oroboros Design). The library is MIT-licensed.
