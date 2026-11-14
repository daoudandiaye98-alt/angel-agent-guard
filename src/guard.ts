/**
 * guardUntrusted and verifyBeforePay: local checks first, then Angel's hosted checks
 * (https://angel.oroboros-design.com, first 3 calls free per agent, then USDC on Base via x402).
 */

import {
  checkOffer, decodeOffer, localVerdict, looksLikeUrl, quickScan,
  type LocalFinding, type OfferCheck, type QuickScanResult, type X402Offer,
} from "./local.js";
import { decodeReceipt } from "./pay.js";

export const VERSION = "0.1.0";
export const ANGEL_BASE = "https://angel.oroboros-design.com";
export const PATHS = {
  inputGuard: "/agenten/signal/input-guard",
  preflight: "/agenten/signal/preflight",
  tokenRisk: "/agenten/signal/token-risk",
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
  /** price in USDC as text, e.g. "0.99" */
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

function paymentFrom(c: Call): PaymentNeeded {
  const offer = decodeOffer(c.headers?.get("payment-required")) ?? (c.body && Array.isArray(c.body.accepts) ? (c.body as unknown as X402Offer) : null);
  const amount = offer?.accepts?.[0]?.amount;
  return {
    offer,
    priceUsdc: amount ? (Number(amount) / 1e6).toFixed(2) : typeof c.body?.price_usd === "string" ? c.body.price_usd : null,
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

/* ------------------------------------------------------------------ verifyBeforePay */

export interface VerifyTarget {
  /** the paid endpoint you are about to pay */
  url?: string;
  /** HTTP method of that endpoint; default POST */
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
  /** probe the endpoint yourself (empty JSON body) and check its 402 locally; default true */
  probe?: boolean;
}

export interface VerifyResult {
  /** true only when at least one check ran and all of them say pay */
  ok: boolean;
  verdict: "pay" | "caution" | "do_not_pay" | "unchecked";
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
 * Check before money moves: an x402 endpoint (local probe + Angel's /preflight) and/or an ERC-20 (Angel's /token-risk).
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
          method: t.method ?? "POST",
          headers: { "content-type": "application/json", "user-agent": `angel-agent-guard/${VERSION}` },
          ...((t.method ?? "POST") === "POST" ? { body: "{}" } : {}),
          signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
        });
        if (r.status === 402) offer = decodeOffer(r.headers.get("payment-required"));
        else reasons.push(`[info] probe: HTTP ${r.status} without payment${r.status === 200 ? " (free, or not protected for this method)" : ""}.`);
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
      const c = await post(PATHS.preflight, { url: t.url, method: t.method ?? "POST" }, o);
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
  return { ok: ran > 0 && verdict === "pay", verdict: ran ? verdict : "unchecked", reasons, local, preflight, token, payment, errors };
}
