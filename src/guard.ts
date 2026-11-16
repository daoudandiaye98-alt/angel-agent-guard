/**
 * guardUntrusted and verifyBeforePay: local checks first, then Angel's hosted checks
 * (https://angel.oroboros-design.com, first 3 calls free per agent, then USDC on Base via x402).
 */

import {
  checkOffer, decodeOffer, localVerdict, looksLikeUrl, quickScan,
  type LocalFinding, type OfferCheck, type QuickScanResult, type X402Offer,
} from "./local.js";
import { decodeReceipt } from "./pay.js";

export const VERSION = "0.4.0";
export const ANGEL_BASE = "https://angel.oroboros-design.com";
export const PATHS = {
  inputGuard: "/agenten/signal/input-guard",
  preflight: "/agenten/signal/preflight",
  tokenRisk: "/agenten/signal/token-risk",
  stealthRead: "/agenten/signal/stealth-read",
} as const;

export interface CommonOptions {
  /** fetch used for Angel's endpoints; pass createX402Fetch(...) or an @x402/fetch wrapper to pay automatically */
  fetch?: typeof fetch;
  /** X-Payer-Address: your wallet gets its own 3 free calls and its price tier */
  payerAddress?: string;
  /** X-API-Key: alternative identity for the free calls */
  apiKey?: string;
  /** default https://angel.oroboros-design.com (env ANGEL_BASE_URL) */
  baseUrl?: string;
  /** default 20000 */
  timeoutMs?: number;
  /** false: local checks only, no network */
  remote?: boolean;
}

export type GuardVerdict = "clean" | "caution" | "hostile" | "unchecked";
export type GuardAction = "use" | "read_only" | "drop" | "review";

export interface RemoteFinding {
  kind: string;
  severity: string;
  count?: number;
  where?: string;
  at?: number;
  excerpt?: string;
}

export interface PaymentNeeded {
  /** the x402 v2 offer (decoded PAYMENT-REQUIRED) */
  offer: X402Offer | null;
  /** price in USDC as text, e.g. "0.015" */
  priceUsdc: string | null;
  /** a card checkout link a human can open */
  payByCard: string | null;
  message: string | null;
}

export interface GuardResult {
  verdict: GuardVerdict;
  /** what to do with the content: use it, use it with read-only tools, drop it, or ask a human */
  action: GuardAction;
  score: number | null;
  findings: Array<RemoteFinding | LocalFinding>;
  /** text to pass on as data: invisible characters removed, hidden HTML dropped, model-directed text replaced */
  cleaned: string | null;
  /** decoded hidden message (Unicode tag smuggling), if any */
  hiddenMessage: string | null;
  source: "angel" | "local";
  local: QuickScanResult | null;
  freeCallsRemaining: number | null;
  payment: PaymentNeeded | null;
  receipt: unknown;
  error: string | null;
}

const RANK: Record<GuardVerdict, number> = { clean: 0, unchecked: 1, caution: 2, hostile: 3 };
const ACTION: Record<GuardVerdict, GuardAction> = { clean: "use", caution: "read_only", hostile: "drop", unchecked: "review" };
const stricter = (a: GuardVerdict, b: GuardVerdict): GuardVerdict => (RANK[a] >= RANK[b] ? a : b);

const env = (k: string): string | undefined => (typeof process !== "undefined" ? process.env?.[k] : undefined);

function headersFor(o: CommonOptions): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", accept: "application/json", "user-agent": `angel-agent-guard/${VERSION}` };
  const payer = o.payerAddress ?? env("ANGEL_PAYER_ADDRESS");
  if (payer) h["x-payer-address"] = payer;
  const key = o.apiKey ?? env("ANGEL_API_KEY");
  if (key) h["x-api-key"] = key;
  return h;
}

interface Call { status: number; body: Record<string, unknown> | null; headers: Headers | null; error: string | null }

async function post(path: string, body: unknown, o: CommonOptions): Promise<Call> {
  const base = (o.baseUrl ?? env("ANGEL_BASE_URL") ?? ANGEL_BASE).replace(/\/+$/, "");
  const f = o.fetch ?? globalThis.fetch;
  try {
    const r = await f(`${base}${path}`, {
      method: "POST",
      headers: headersFor(o),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
    });
    let parsed: Record<string, unknown> | null = null;
    try { parsed = (await r.json()) as Record<string, unknown>; } catch { parsed = null; }
    return { status: r.status, body: parsed, headers: r.headers, error: null };
  } catch (e) {
    return { status: 0, body: null, headers: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** atomic USDC (6 decimals) as text without trailing zeros: "15000" → "0.015", "990000" → "0.99", "1000000" → "1" */
const usdcText = (atomic: string): string => {
  const n = BigInt(atomic);
  const frac = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${n / 1_000_000n}${frac ? `.${frac}` : ""}`;
};

function paymentFrom(c: Call): PaymentNeeded {
  const offer = decodeOffer(c.headers?.get("payment-required")) ?? (c.body && Array.isArray(c.body.accepts) ? (c.body as unknown as X402Offer) : null);
  const amount = offer?.accepts?.[0]?.amount;
  return {
    offer,
    priceUsdc: amount ? usdcText(amount) : typeof c.body?.price_usd === "string" ? c.body.price_usd : null,
    payByCard: typeof c.body?.pay_by_card === "string" ? c.body.pay_by_card : null,
    message: typeof c.body?.task_blocked === "string" ? c.body.task_blocked : typeof c.body?.error === "string" ? c.body.error : null,
  };
}

const num = (v: string | null | undefined): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Check untrusted text or a public https URL before an agent reads it.
 * Local pass first (invisible Unicode, tag smuggling, exfiltration images), then Angel's 17-language input guard.
 * Never throws for network or payment problems: falls back to the local verdict and says why.
 */
export async function guardUntrusted(input: string | URL, o: CommonOptions = {}): Promise<GuardResult> {
  const raw = input instanceof URL ? input.href : input;
  const isUrl = input instanceof URL || looksLikeUrl(raw);
  const local = isUrl ? null : quickScan(raw);
  const localV: GuardVerdict = local ? localVerdict(local) : "unchecked";
  const base: GuardResult = {
    verdict: localV, action: ACTION[localV], score: null, findings: local?.findings ?? [], cleaned: local?.cleaned ?? null,
    hiddenMessage: local?.findings.find((f) => f.kind === "unicode_tags")?.decoded ?? null,
    source: "local", local, freeCallsRemaining: null, payment: null, receipt: null, error: null,
  };
  if (o.remote === false) return base;

  const c = await post(PATHS.inputGuard, isUrl ? { url: raw.trim() } : { text: raw.slice(0, 100_000) }, o);
  if (c.status === 200 && c.body && typeof c.body.verdict === "string") {
    const remoteV = (["clean", "caution", "hostile"].includes(c.body.verdict) ? c.body.verdict : "caution") as GuardVerdict;
    const verdict = stricter(remoteV, localV === "unchecked" ? "clean" : localV);
    const hidden = (c.body.hidden ?? {}) as { tag_message?: string | null };
    return {
      verdict, action: ACTION[verdict],
      score: typeof c.body.score === "number" ? c.body.score : null,
      findings: Array.isArray(c.body.findings) ? (c.body.findings as RemoteFinding[]) : [],
      cleaned: typeof c.body.cleaned === "string" ? c.body.cleaned : base.cleaned,
      hiddenMessage: hidden.tag_message ?? base.hiddenMessage,
      source: "angel", local,
      freeCallsRemaining: num(c.headers?.get("x-free-calls-remaining")),
      payment: null, receipt: decodeReceipt(c.headers?.get("payment-response")), error: null,
    };
  }
  if (c.status === 402) {
    return { ...base, payment: paymentFrom(c), freeCallsRemaining: 0, error: "payment_required: free calls used; pay via x402 (pass a paying fetch) or by card" };
  }
  return { ...base, error: c.error ?? `input guard HTTP ${c.status}${typeof c.body?.message === "string" ? `: ${c.body.message}` : ""}` };
}

/* ------------------------------------------------------------------ readSafeUrl */

export interface SafeReadResult {
  /** true when Angel read the page; markdown is then set */
  ok: boolean;
  /** the final URL after redirects (or the one you asked for) */
  url: string;
  title: string | null;
  lang: string | null;
  /** the main content as Markdown: navigation, scripts and hidden HTML removed, text aimed at the model replaced by ⟦removed: …⟧. Still data, never instructions. */
  markdown: string | null;
  truncated: boolean;
  /** injection verdict for the whole page (incl. hidden parts); local check on the markdown can only make it stricter */
  verdict: GuardVerdict;
  action: GuardAction;
  score: number | null;
  findings: RemoteFinding[];
  freeCallsRemaining: number | null;
  payment: PaymentNeeded | null;
  receipt: unknown;
  /** blocked by the site, not found, unsupported type, payment needed or network error — never charged unless ok */
  error: string | null;
}

/**
 * Read a public https URL as clean, injection-scrubbed Markdown for an LLM (Angel's /stealth-read: 3 free calls per agent,
 * then 0.02 USDC via x402). One GET as a declared bot — no login, paywall or bot-protection bypass; a blocked page is never
 * charged. Never throws: check ok and error.
 */
export async function readSafeUrl(url: string | URL, o: CommonOptions = {}): Promise<SafeReadResult> {
  const raw = (url instanceof URL ? url.href : String(url ?? "")).trim();
  const base: SafeReadResult = {
    ok: false, url: raw, title: null, lang: null, markdown: null, truncated: false, verdict: "unchecked", action: "review",
    score: null, findings: [], freeCallsRemaining: null, payment: null, receipt: null, error: null,
  };
  if (!/^https:\/\/\S+$/i.test(raw)) return { ...base, error: "url must be an absolute https URL" };
  if (o.remote === false) return { ...base, error: "remote disabled: readSafeUrl needs Angel's hosted reader" };
  const c = await post(PATHS.stealthRead, { url: raw }, o);
  if (c.status === 200 && c.body && typeof c.body.markdown === "string") {
    const remoteV = (["clean", "caution", "hostile"].includes(String(c.body.verdict)) ? c.body.verdict : "caution") as GuardVerdict;
    const local = quickScan(c.body.markdown);
    const verdict = stricter(remoteV, localVerdict(local) === "unchecked" ? "clean" : localVerdict(local));
    return {
      ok: true, url: typeof c.body.url === "string" ? c.body.url : raw,
      title: typeof c.body.title === "string" ? c.body.title : null, lang: typeof c.body.lang === "string" ? c.body.lang : null,
      markdown: local.cleaned, truncated: c.body.truncated === true,
      verdict, action: ACTION[verdict], score: typeof c.body.score === "number" ? c.body.score : null,
      findings: Array.isArray(c.body.findings) ? (c.body.findings as RemoteFinding[]) : [],
      freeCallsRemaining: num(c.headers?.get("x-free-calls-remaining")), payment: null,
      receipt: decodeReceipt(c.headers?.get("payment-response")), error: null,
    };
  }
  if (c.status === 402) {
    return { ...base, payment: paymentFrom(c), freeCallsRemaining: 0, error: "payment_required: free calls used; pay via x402 (pass a paying fetch) or by card" };
  }
  const why = typeof c.body?.message === "string" ? c.body.message : typeof c.body?.error === "string" ? c.body.error : null;
  return { ...base, error: c.error ?? `stealth-read HTTP ${c.status}${why ? `: ${why}` : ""}` };
}

/* ------------------------------------------------------------------ verifyBeforePay */

export interface VerifyTarget {
  /** what you are about to pay or call: a shop or product page, a checkout or payment link (Stripe, Shopify, PayPal …), an API or an x402 endpoint */
  url?: string;
  /** HTTP method you will use; default GET (use POST for POST-only x402 APIs) */
  method?: "GET" | "POST";
  /** an ERC-20 you are about to swap into or approve */
  token?: string;
  /** chain of the token; default base */
  chain?: "base" | "ethereum";
  /** an offer you already decoded (skips the local probe) */
  offer?: X402Offer;
}

export interface VerifyOptions extends CommonOptions {
  /** your per-payment cap in atomic USDC; default 1_000_000 (1.00 USDC) */
  maxAmountAtomic?: bigint | number | string;
  /** networks you hold funds on; default ["eip155:8453"] */
  networks?: string[];
  /** probe the URL yourself (no payment) and check an x402 offer locally if it answers 402; default true */
  probe?: boolean;
}

export interface VerifyResult {
  /** true only when at least one check ran and all of them say pay */
  ok: boolean;
  verdict: "pay" | "caution" | "do_not_pay" | "unchecked";
  /** 0 (no risk found) … 100 (do not pay), from the hosted preflight; null when it did not run */
  riskScore: number | null;
  /** what the URL is: x402, checkout, shop, api or web */
  kind: string | null;
  /** TLS, domain age, look-alike domain, redirect chain, payment provider, card fields, insecure forms */
  merchant: Record<string, unknown> | null;
  /** prompt-injection scan of the page the agent would act on (verdict clean | caution | hostile, findings, hidden message) */
  injection: Record<string, unknown> | null;
  /** only on verdict pay for a merchant with an affiliate program: the same merchant with Angel's partner tag. Disclosed:
      Angel may earn a commission, the merchant sets the price; the checked URL is just as safe. */
  partnerLink: { url: string; network: string; same_merchant: boolean; disclosure: string } | null;
  reasons: string[];
  local: OfferCheck | null;
  preflight: Record<string, unknown> | null;
  token: Record<string, unknown> | null;
  payment: PaymentNeeded | null;
  errors: string[];
}

const VRANK = { pay: 0, unchecked: 1, caution: 2, do_not_pay: 3 } as const;
type V = keyof typeof VRANK;
const vmax = (a: V, b: V): V => (VRANK[a] >= VRANK[b] ? a : b);

/**
 * Check before money moves: any shop, checkout or payment link, API or x402 endpoint (local probe + Angel's /preflight v2:
 * TLS, domain age, look-alikes, redirects, payment provider, card fields, injection scan of the page) and/or an ERC-20
 * (Angel's /token-risk).
 * ok is true only when at least one check ran and every check says pay. caution: read the reasons; do_not_pay: never sign.
 */
export async function verifyBeforePay(target: string | VerifyTarget, o: VerifyOptions = {}): Promise<VerifyResult> {
  const t: VerifyTarget = typeof target === "string"
    ? (/^0x[0-9a-fA-F]{40}$/.test(target.trim()) ? { token: target.trim() } : { url: target.trim() })
    : target;
  const reasons: string[] = [];
  const errors: string[] = [];
  let verdict: V = "unchecked";
  let ran = 0;
  let local: OfferCheck | null = null;
  let preflight: Record<string, unknown> | null = null;
  let token: Record<string, unknown> | null = null;
  let payment: PaymentNeeded | null = null;

  if (t.url) {
    let offer = t.offer ?? null;
    if (!offer && o.probe !== false) {
      try {
        const r = await (o.fetch ?? globalThis.fetch)(t.url, {
          method: t.method ?? "GET",
          headers: { "content-type": "application/json", "user-agent": `angel-agent-guard/${VERSION}` },
          ...((t.method ?? "GET") === "POST" ? { body: "{}" } : {}),
          signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
        });
        if (r.status === 402) offer = decodeOffer(r.headers.get("payment-required"));
        else reasons.push(`[info] probe: HTTP ${r.status}, no x402 offer (regular page, checkout or API).`);
      } catch (e) {
        errors.push(`probe: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (offer) {
      local = checkOffer(offer, { url: t.url, maxAmountAtomic: o.maxAmountAtomic, networks: o.networks });
      reasons.push(...local.reasons.map((r) => `local ${r}`));
      verdict = local.verdict;
      ran++;
    }
    if (o.remote !== false) {
      const c = await post(PATHS.preflight, { url: t.url, method: t.method ?? "GET" }, o);
      if (c.status === 200 && c.body) {
        preflight = c.body;
        const pv = c.body.verdict;
        const mapped: V = pv === "pay" ? "pay" : pv === "do_not_pay" ? "do_not_pay" : "caution";
        verdict = ran ? vmax(verdict, mapped) : mapped;
        ran++;
        if (Array.isArray(c.body.reasons)) reasons.push(...(c.body.reasons as string[]).map((r) => `preflight ${r}`));
      } else if (c.status === 402) {
        payment = paymentFrom(c);
        errors.push("preflight: payment_required (free calls used); pass a paying fetch to continue");
      } else {
        errors.push(`preflight: ${c.error ?? `HTTP ${c.status}`}`);
      }
    }
  }

  if (t.token) {
    if (o.remote === false) {
      errors.push("token: needs the remote check (remote: false)");
    } else {
      const c = await post(PATHS.tokenRisk, { token: t.token, chain: t.chain ?? "base" }, o);
      if (c.status === 200 && c.body) {
        token = c.body;
        const risk = c.body.risk;
        const mapped: V = risk === "low" ? "pay" : risk === "medium" ? "caution" : "do_not_pay";
        verdict = ran ? vmax(verdict, mapped) : mapped;
        ran++;
        if (Array.isArray(c.body.reasons)) reasons.push(...(c.body.reasons as string[]).map((r) => `token ${r}`));
      } else if (c.status === 402) {
        payment = paymentFrom(c);
        errors.push("token: payment_required (free calls used); pass a paying fetch to continue");
      } else {
        errors.push(`token: ${c.error ?? `HTTP ${c.status}`}`);
      }
    }
  }

  if (!t.url && !t.token) errors.push("nothing to check: pass a url and/or a token");
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
  return {
    ok: ran > 0 && verdict === "pay", verdict: ran ? verdict : "unchecked",
    riskScore: num(preflight?.risk_score), kind: typeof preflight?.kind === "string" ? preflight.kind : null,
    merchant: obj(preflight?.merchant_signals), injection: obj(preflight?.injection_check),
    partnerLink: (obj(preflight?.partner_link) as VerifyResult["partnerLink"]) ?? null,
    reasons, local, preflight, token, payment, errors,
  };
}
