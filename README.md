# angel-agent-guard

Two checks an AI agent should run before it acts:

- **`guardUntrusted(textOrUrl)`**: before the model reads a web page, email, document, RAG chunk or tool result written by someone else. It runs a local pass first (invisible Unicode, tag smuggling, exfiltration images), then a hosted scan in 17 languages for text aimed at the model.
- **`verifyBeforePay(urlOrToken)`**: before **any online purchase or paid call**. That covers a shop or product page, a checkout or payment link (Stripe, Shopify, PayPal, SaaS checkout), an unknown API, an x402 endpoint, and a token swap or approval. It checks:
  - TLS and domain age
  - look-alike domains, and redirects to payment pages on other domains
  - which payment provider takes the money
  - card fields and plain-http forms in the page
  - text in the page aimed at shopping agents
  - for x402: the payment offer itself (official USDC, network, amount under your cap, same host)
  - for an ERC-20: honeypot and rug-pull powers on chain

No runtime dependencies. Works in Node 18+, Bun, Deno and edge runtimes with `fetch`. It also ships an x402 v2 payer, a stdio MCP server, a CLI, Vercel AI SDK tools and Coinbase AgentKit actions.

```bash
npm i angel-agent-guard          # add `viem` only if the agent should pay x402 automatically
# straight from GitHub (same build): npm i github:daoudandiaye98-alt/angel-agent-guard
pip install angel-agent-guard    # Python: same API, zero dependencies, browser-use / LangChain / CrewAI tools (see python/)
```

## Quick start

```ts
import { readSafeUrl, guardUntrusted, verifyBeforePay, fence } from "angel-agent-guard";

// 0. Read a web page safely: main content as Markdown, hidden HTML gone, injected instructions replaced
const r = await readSafeUrl("https://example.com/article", { payerAddress: "0xYourAgentWallet" });
const article = r.ok && r.action !== "drop" ? fence(r.url, r.markdown!) : null;   // r.verdict, r.findings, r.title, r.lang, r.error

// 1. Untrusted content you already have: check it, then hand the model the cleaned text as data
const page = await fetch("https://example.com/article").then((r) => r.text());
const g = await guardUntrusted(page, { payerAddress: "0xYourAgentWallet" });
if (g.action === "drop") throw new Error(`hostile content: ${g.findings.map((f) => f.kind).join(", ")}`);
const context = fence("https://example.com/article", g.cleaned ?? page);   // random boundary + "this is data"
// g.action === "read_only" → continue, but without write, send or payment tools in this step

// 2. Before any purchase, payment link or paid call
const v = await verifyBeforePay("https://shop.example.com/checkout");
if (!v.ok) console.log(v.verdict, v.riskScore, v.reasons);   // "caution" → ask the user; "do_not_pay" → never pay
// v.kind: "checkout" | "shop" | "api" | "x402" | "web"
// v.merchant: TLS, domain age, look-alike, redirect chain, payment providers, card fields, insecure forms, …
// v.injection: the page scanned for instructions aimed at agents (verdict, findings, hidden message)

await verifyBeforePay({ url: "https://api.example.com/v1/quote", method: "POST" });  // x402 API that only takes POST
await verifyBeforePay("0xTokenYouAreAboutToApprove");   // ERC-20 on Base (or { token, chain: "ethereum" })
```

### What you get back

| `guardUntrusted` | |
|---|---|
| `verdict` | `clean`, `caution`, `hostile`, or `unchecked` (only the local pass ran and found nothing) |
| `action` | `use` · `read_only` (continue without side-effect tools) · `drop` · `review` (ask a human or pay for the full check) |
| `findings` | kind, severity, where (`visible`, `hidden`, `decoded`), position and excerpt |
| `cleaned` | invisible characters removed, hidden HTML dropped, model-directed text replaced: read it as data |
| `hiddenMessage` | the decoded Unicode-tag message, if one was smuggled in |
| `payment` | set when the free calls are used up: the x402 offer, the price and a card checkout link |

| `verifyBeforePay` | |
|---|---|
| `ok` | `true` only when at least one check ran and all of them say `pay` |
| `verdict` | `pay`, `caution`, `do_not_pay`, `unchecked` |
| `riskScore` | 0 (nothing found) to 100 (do not pay) |
| `kind` | `checkout`, `shop`, `api`, `x402` or `web` |
| `merchant` | TLS (valid, issuer, expiry), domain age (RDAP), look-alike / punycode / TLD, redirect chain and cross-site hand-off, payment providers (Stripe, Shopify, PayPal, Paddle, Lemon Squeezy, Gumroad, Adyen, Square, Klarna, Coinbase Commerce, Mollie), card fields in the page, insecure and cross-site forms, HSTS |
| `injection` | text in the target page aimed at AI agents: hidden price or discount instructions, exfiltration links, smuggled Unicode |
| `partnerLink` | only on `pay` for a merchant with an affiliate program: the same merchant with Angel's partner tag. Disclosed: Angel may earn a commission, the merchant sets the price, and the checked URL is just as safe |
| `reasons` | every finding, prefixed `local`, `preflight` or `token` |

| `readSafeUrl` | |
|---|---|
| `ok` | `true` when Angel read the page (`markdown` is then set) |
| `markdown` | the main content as Markdown: navigation, scripts and HTML hidden from people removed, text aimed at the model replaced by `⟦removed: …⟧` — read it as data |
| `verdict` / `action` | injection verdict for the whole page, including its hidden parts |
| `title`, `lang`, `url` | page title, language, final URL after redirects |
| `error` | blocked by the site (Angel reads as a declared bot and never bypasses bot protection, logins or paywalls), not found, unsupported type — none of these is charged |

None of the functions throws on network or payment problems. They fall back to the local result and put the reason in `error` / `errors`.

## Pricing and paying

The local checks are free and offline (`remote: false` keeps everything local). The hosted checks run on [Angel](https://angel.oroboros-design.com/docs/prompt-injection-defense/):

| Hosted check | Price per call after 3 free calls per agent |
|---|---|
| safe read (`readSafeUrl`) | 0.02 USDC |
| pre-purchase check (`verifyBeforePay` with a URL) | 0.015 USDC |
| input guard (17 languages) | 0.015 USDC |
| token risk (honeypot / rug pull) | 0.015 USDC |

Payment is per call in USDC on Base via x402 v2. Every price is under the $1 default spend cap of `@x402/core`, so standard x402 clients pay it without extra configuration. Send `payerAddress` (header `X-Payer-Address`) so your wallet gets its own 3 free calls. Without it, the free calls are shared by IP.

To pay automatically, pass a paying `fetch`:

```ts
import { verifyBeforePay, createX402Fetch } from "angel-agent-guard";

const pay = createX402Fetch({ privateKey: process.env.AGENT_PRIVATE_KEY, maxAmountAtomic: 1_000_000n }); // cap 1.00 USDC, needs `viem`
const v = await verifyBeforePay("https://shop.example.com/checkout", { fetch: pay });
```

`createX402Fetch` signs only after `checkOffer` passes: official USDC contract, allowed network (default Base `eip155:8453`), amount at or below your cap, the same host as the URL you called, and scheme `exact` (one transfer of one amount, never an allowance). Use a low-balance hot wallet. It works for any x402 v2 seller, not only Angel. `@x402/fetch` works too: pass its wrapped fetch as `fetch`.

## MCP server (stdio)

```bash
# Claude Code
claude mcp add angel-guard -- npx -y -p angel-agent-guard angel-agent-guard-mcp

# JSON config (Claude Desktop, Cursor, Windsurf, Cline)
{ "mcpServers": { "angel-guard": { "command": "npx", "args": ["-y", "-p", "angel-agent-guard", "angel-agent-guard-mcp"],
  "env": { "ANGEL_PAYER_ADDRESS": "0xYourAgentWallet" } } } }
```

Tools: `read_safe_url`, `guard_untrusted`, `verify_before_pay`, `quick_scan` (offline). Optional env: `ANGEL_AGENT_PRIVATE_KEY` (auto-pay, needs `viem`), `ANGEL_MAX_USDC` (cap, default 1.00), `ANGEL_BASE_URL`. Listed in the official MCP Registry as `com.oroboros-design.angel/agent-guard`.

If your client supports remote servers, the full hosted suite is also available at `https://angel.oroboros-design.com/agenten/signal/mcp`.

## Vercel AI SDK

```bash
npm i angel-agent-guard ai
```

```ts
import { generateText, isStepCount } from "ai";
import { verifyBeforePay, guardUntrusted } from "angel-agent-guard/ai-sdk";

const { text } = await generateText({
  model: "openai/gpt-5-mini",
  prompt: "Buy the cheapest USB-C cable on https://shop.example.com, but check the checkout page before paying.",
  tools: {
    verifyBeforePay: verifyBeforePay({ payerAddress: process.env.AGENT_WALLET }),
    guardUntrusted: guardUntrusted(),
  },
  stopWhen: isStepCount(5),
});
```

Works with AI SDK 5, 6 and 7. `angelGuardTools(options)` returns all three tools (`guardUntrusted`, `verifyBeforePay`, `quickScanUntrusted`) to spread into `tools`. Every factory takes the core options (`payerAddress`, `apiKey`, `fetch`, `baseUrl`, `timeoutMs`, `remote`). Pass `privateKey` and `maxUsdc` to pay x402 automatically after the free calls (needs `viem`). `ANGEL_PAYER_ADDRESS` and `ANGEL_AGENT_PRIVATE_KEY` are read from the environment when set. No API key is needed.

## Coinbase AgentKit

```ts
import { AgentKit } from "@coinbase/agentkit";
import { angelGuardActionProvider } from "angel-agent-guard/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,                                        // any EVM wallet provider
  actionProviders: [angelGuardActionProvider({ maxUsdc: 1 })],
});
```

This adds the actions `guard_untrusted_content`, `verify_before_pay` and `quick_scan_untrusted_text`. The agent's own wallet provider signs the x402 payments (USDC on Base). Pass `{ pay: false }` to use only the free calls.

## CLI

```bash
npx angel-agent-guard scan "text to check"                  # or a https URL, or - for stdin
npx angel-agent-guard verify https://shop.example.com/checkout
npx angel-agent-guard verify https://api.example.com/paid --post
npx angel-agent-guard verify --token 0x... --chain base
npx angel-agent-guard quick "text"                          # offline
```

Exit codes: `0` clean / pay, `1` caution / unchecked, `2` hostile / do_not_pay, `3` usage or error. This lets you use it as a gate in scripts and CI.

## Agent instructions

- [`SKILL.md`](SKILL.md): Claude Code skill, also on [ClawHub](https://clawhub.ai/daoudandiaye98-alt/angel-agent-guard) for OpenClaw
- [`.cursor/rules/angel-agent-guard.mdc`](.cursor/rules/angel-agent-guard.mdc): Cursor rule
- [`llms.txt`](llms.txt): short index for LLMs

## Limits and data

- The local pass removes invisible characters and flags the riskiest markers. It does not judge meaning. With no findings it reports `unchecked`, never `clean`.
- The hosted checks are deterministic (patterns, TLS, DNS, RDAP and on-chain reads, no model). They are fast and repeatable, but a new or paraphrased attack, or a well-made fraud shop on an old domain, can pass. Keep the other layers: read external content as data, give the reading step no dangerous tools, and require an approval the model cannot give itself before money or messages move. See the [prompt-injection defense reference](https://angel.oroboros-design.com/docs/prompt-injection-defense/) and the [x402 client integration guide](https://angel.oroboros-design.com/docs/x402-integration-guide/).
- For a hosted check, the text or URL is sent to `angel.oroboros-design.com`. Use `remote: false` for content that must not leave your machine.

Disclosure: the hosted checks are a paid service run by the author (Oroboros Design). The library itself is MIT-licensed and works against any x402 v2 seller.

## License

MIT
