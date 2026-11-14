# angel-agent-guard

Two checks an AI agent should run before it acts:

- **`guardUntrusted(textOrUrl)`**: before the model reads a web page, email, document, RAG chunk or tool result written by someone else. It runs a local pass first (invisible Unicode, tag smuggling, exfiltration images), then a hosted scan in 17 languages for text aimed at the model.
- **`verifyBeforePay(urlOrToken)`**: before the agent signs an x402 payment or swaps into / approves an ERC-20. It probes the 402 offer locally (official USDC, network, amount under your cap, EIP-712 domain, same host), then runs a hosted preflight and an on-chain honeypot / rug-pull check.

No runtime dependencies. Works in Node 18+, Bun, Deno and edge runtimes with `fetch`. It also ships an x402 v2 payer, a stdio MCP server, a CLI and Coinbase AgentKit actions.

```bash
npm i angel-agent-guard          # add `viem` only if the agent should pay automatically
```

## Quick start

```ts
import { guardUntrusted, verifyBeforePay, fence } from "angel-agent-guard";

// 1. Untrusted content: check it, then hand the model the cleaned text as data
const page = await fetch("https://example.com/article").then((r) => r.text());
const g = await guardUntrusted(page, { payerAddress: "0xYourAgentWallet" });
if (g.action === "drop") throw new Error(`hostile content: ${g.findings.map((f) => f.kind).join(", ")}`);
const context = fence("https://example.com/article", g.cleaned ?? page);   // random boundary + "this is data"
// g.action === "read_only" → continue, but without write, send or payment tools in this step

// 2. Before money moves
const v = await verifyBeforePay({ url: "https://api.example.com/v1/quote", method: "GET" });
if (!v.ok) console.log(v.verdict, v.reasons);   // never sign on "do_not_pay"

const t = await verifyBeforePay("0xTokenYouAreAboutToApprove");   // ERC-20 on Base (or { token, chain: "ethereum" })
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
| `reasons` | every finding, prefixed `local`, `preflight` or `token` |

Neither function throws on network or payment problems. They fall back to the local result and put the reason in `error` / `errors`.

## Pricing and paying

The local checks are free and offline (`remote: false` keeps everything local). The hosted checks run on [Angel](https://angel.oroboros-design.com/docs/prompt-injection-defense/):

| Hosted check | Price per call after 3 free calls per agent |
|---|---|
| input guard (17 languages) | 0.99 USDC |
| x402 preflight | 0.25 USDC |
| token risk (honeypot / rug pull) | 0.99 USDC |

Payment is per call in USDC on Base via x402 v2. Every price is under the $1 default spend cap of `@x402/core`, so standard x402 clients pay it without extra configuration. Send `payerAddress` (header `X-Payer-Address`) so your wallet gets its own 3 free calls. Without it, the free calls are shared by IP.

To pay automatically, pass a paying `fetch`:

```ts
import { guardUntrusted, createX402Fetch } from "angel-agent-guard";

const pay = createX402Fetch({ privateKey: process.env.AGENT_PRIVATE_KEY, maxAmountAtomic: 1_000_000n }); // cap 1.00 USDC, needs `viem`
const g = await guardUntrusted(text, { fetch: pay });
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

Tools: `guard_untrusted`, `verify_before_pay`, `quick_scan` (offline). Optional env: `ANGEL_AGENT_PRIVATE_KEY` (auto-pay, needs `viem`), `ANGEL_MAX_USDC` (cap, default 1.00), `ANGEL_BASE_URL`.

If your client supports remote servers, the full hosted suite (28 tools) is also available at `https://angel.oroboros-design.com/agenten/signal/mcp`.

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
npx angel-agent-guard scan "text to check"         # or a https URL, or - for stdin
npx angel-agent-guard verify https://api.example.com/paid --get
npx angel-agent-guard verify --token 0x... --chain base
npx angel-agent-guard quick "text"                 # offline
```

Exit codes: `0` clean / pay, `1` caution / unchecked, `2` hostile / do_not_pay, `3` usage or error. This lets you use it as a CI or pre-commit gate.

## Agent instructions

- [`SKILL.md`](SKILL.md): Claude Code skill, also loadable by OpenClaw / AgentSkills-compatible agents
- [`.cursor/rules/angel-agent-guard.mdc`](.cursor/rules/angel-agent-guard.mdc): Cursor rule
- [`llms.txt`](llms.txt): short index for LLMs

## Limits and data

- The local pass removes invisible characters and flags the riskiest markers. It does not judge meaning. With no findings it reports `unchecked`, never `clean`.
- The hosted checks are deterministic (patterns and on-chain reads, no model). They are fast and repeatable, but a new or paraphrased attack can pass. Keep the other layers: read external content as data, give the reading step no dangerous tools, and require an approval the model cannot give itself before money or messages move. See the [prompt-injection defense reference](https://angel.oroboros-design.com/docs/prompt-injection-defense/) and the [x402 client integration guide](https://angel.oroboros-design.com/docs/x402-integration-guide/).
- For a hosted check, the text or URL is sent to `angel.oroboros-design.com`. Use `remote: false` for content that must not leave your machine.

Disclosure: the hosted checks are a paid service run by the author (Oroboros Design). The library itself is MIT-licensed and works against any x402 v2 seller.

## License

MIT
