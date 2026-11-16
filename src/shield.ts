/**
 * Angel Shield — the spend firewall for AI agents with a wallet or a card.
 *
 * shieldCheck asks Angel before a payment: your rules (per-payment cap, daily budget reserved atomically, allow/block lists,
 * chains, tokens, approval threshold, hold new merchants, kill switch), the merchant URL (preflight), the text that triggered
 * the payment (input guard) and non-USDC tokens (token risk) → allow | hold | block with reasons.
 *
 * createShieldedFetch wraps fetch like createX402Fetch, but every 402 offer is checked by Shield before it is signed. An
 * allowed amount is reserved; after the paid retry the reservation is confirmed (or released if the retry failed).
 *
 * Fail-closed by default: when Shield cannot be reached or asks for payment, the decision is "hold" and nothing is signed.
 */

import { ANGEL_BASE, VERSION, type CommonOptions, type PaymentNeeded } from "./guard.js";
import { checkOffer, decodeOffer, type X402Requirement } from "./local.js";
import { decodeReceipt, resolveSigner, signPayment, type TypedDataSigner, type X402FetchOptions } from "./pay.js";

export const SHIELD_PATHS = {
  check: "/agenten/signal/shield-check",
  policy: "/shield/policy",
  confirm: "/shield/confirm",
  release: "/shield/release",
  keys: "/shield/keys",
} as const;

export type ShieldDecision = "allow" | "hold" | "block";

export interface ShieldPayment {
  /** amount in USD (USDC 1:1) */
  amountUsd: number;
  /** the shop, checkout or payment link, API or x402 endpoint you are about to pay */
  merchantUrl?: string;
  /** recipient address when there is no URL */
  payTo?: string;
  /** base, ethereum or eip155:<id> */
  chain?: string;
  /** "USDC" or a token address */
  asset?: string;
  method?: "GET" | "POST";
}

export interface ShieldPolicy {
  maxPerPaymentUsd?: number | null;
  /** needs a stored policy (shieldPolicy → policyId) to count across calls */
  dailyBudgetUsd?: number | null;
  allowMerchants?: string[];
  blockMerchants?: string[];
  allowedChains?: string[];
  allowedAssets?: string[];
  holdAboveUsd?: number | null;
  /** needs a stored policy to remember merchants */
  holdNewMerchants?: boolean;
  kill?: boolean;
  expiresAt?: string | null;
}

export interface ShieldOptions extends CommonOptions {
  /** your key: pass, pack or free Shield key (env ANGEL_BUNDLE_TOKEN) — sent as X-Bundle-Token */
  bundleToken?: string;
  /** a stored policy (daily budget, remembered merchants, reservations) */
  policyId?: string;
  /** inline rules for this call (stateless) */
  policy?: ShieldPolicy;
  /** the message, instruction or page that made the agent want to pay */
  trigger?: string | { url: string };
  /** same key = same reservation */
  idempotencyKey?: string;
  /** how long an allowed amount stays reserved, 60..3600 s (default 900) */
  holdSeconds?: number;
  /** true: allow when Shield is unreachable or asks for payment. Default false (hold). */
  failOpen?: boolean;
}

export interface ShieldResult {
  decision: ShieldDecision;
  reasons: string[];
  /** set when a stored policy reserved the amount: confirm after paying, release otherwise */
  reservationId: string | null;
  reservationExpiresAt: string | null;
  budget: { dailyUsd: number; usedUsd: number; remainingUsd: number } | null;
  advice: string | null;
  /** the full answer from Angel */
  raw: Record<string, unknown> | null;
  payment: PaymentNeeded | null;
  error: string | null;
  source: "angel" | "local";
}

const env = (k: string): string | undefined => (typeof process !== "undefined" ? process.env?.[k] : undefined);

function headers(o: ShieldOptions): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", accept: "application/json", "user-agent": `angel-agent-guard/${VERSION}` };
  const key = o.bundleToken ?? env("ANGEL_BUNDLE_TOKEN");
  if (key) h["x-bundle-token"] = key;
  const payer = o.payerAddress ?? env("ANGEL_PAYER_ADDRESS");
  if (payer) h["x-payer-address"] = payer;
  return h;
}

async function call(method: "GET" | "POST", path: string, body: unknown, o: ShieldOptions): Promise<{ status: number; body: Record<string, unknown> | null; headers: Headers | null; error: string | null }> {
  const base = (o.baseUrl ?? env("ANGEL_BASE_URL") ?? ANGEL_BASE).replace(/\/+$/, "");
  const f = o.fetch ?? globalThis.fetch;
  try {
    const r = await f(`${base}${path}`, { method, headers: headers(o), ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}), signal: AbortSignal.timeout(o.timeoutMs ?? 30_000) });
    let parsed: Record<string, unknown> | null = null;
    try { parsed = (await r.json()) as Record<string, unknown>; } catch { parsed = null; }
    return { status: r.status, body: parsed, headers: r.headers, error: null };
  } catch (e) {
    return { status: 0, body: null, headers: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** snake_case for the wire */
export function policyBody(p: ShieldPolicy): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const put = (k: string, v: unknown) => { if (v !== undefined) out[k] = v; };
  put("max_per_payment_usd", p.maxPerPaymentUsd); put("daily_budget_usd", p.dailyBudgetUsd);
  put("allow_merchants", p.allowMerchants); put("block_merchants", p.blockMerchants);
  put("allowed_chains", p.allowedChains); put("allowed_assets", p.allowedAssets);
  put("hold_above_usd", p.holdAboveUsd); put("hold_new_merchants", p.holdNewMerchants);
  put("kill", p.kill); put("expires_at", p.expiresAt);
  return out;
}

const hostOf = (u: string): string | null => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
const matches = (p: ShieldPayment, entry: string): boolean => {
  const e = entry.trim().toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(e)) return !!p.payTo && p.payTo.toLowerCase() === e;
  const host = p.merchantUrl ? hostOf(p.merchantUrl) : null;
  const want = /^https?:\/\//.test(e) ? hostOf(e) : e.replace(/^www\./, "");
  return !!host && !!want && (host === want || host.endsWith(`.${want}`));
};

/** The rules that need no network: cap, kill switch, expiry, block and allow lists. Used before the call and when offline. */
export function localPolicyCheck(p: ShieldPayment, policy: ShieldPolicy | undefined, now = new Date()): { decision: ShieldDecision; reasons: string[] } {
  const reasons: string[] = [];
  if (!(p.amountUsd > 0)) reasons.push("[block] amountUsd must be > 0");
  if (policy) {
    if (policy.kill) reasons.push("[block] kill switch is on");
    if (policy.expiresAt && Date.parse(policy.expiresAt) <= now.getTime()) reasons.push(`[block] policy expired at ${policy.expiresAt}`);
    if (policy.maxPerPaymentUsd != null && p.amountUsd > policy.maxPerPaymentUsd) reasons.push(`[block] amount ${p.amountUsd} USD is above the per-payment cap of ${policy.maxPerPaymentUsd} USD`);
    if (policy.blockMerchants?.some((e) => matches(p, e))) reasons.push("[block] merchant is on the block list");
    if (policy.allowMerchants?.length && !policy.allowMerchants.some((e) => matches(p, e))) reasons.push("[block] merchant is not on the allow list");
  }
  return { decision: reasons.length ? "block" : "allow", reasons };
}

const blank = (o: Partial<ShieldResult>): ShieldResult => ({
  decision: "hold", reasons: [], reservationId: null, reservationExpiresAt: null, budget: null, advice: null, raw: null, payment: null, error: null, source: "local", ...o,
});

/**
 * Ask Shield before a payment. Never throws: on network trouble or a missing payment the decision is "hold"
 * (or "allow" with failOpen), and error says why.
 */
export async function shieldCheck(payment: ShieldPayment, o: ShieldOptions = {}): Promise<ShieldResult> {
  const local = localPolicyCheck(payment, o.policy);
  if (local.decision === "block") return blank({ decision: "block", reasons: local.reasons, advice: "Do not pay.", source: "local" });
  if (o.remote === false) return blank({ decision: "hold", reasons: ["[hold] remote disabled: only the local rules ran"], error: "remote_disabled" });

  const body: Record<string, unknown> = {
    payment: {
      amount_usd: payment.amountUsd,
      ...(payment.merchantUrl ? { merchant_url: payment.merchantUrl } : {}),
      ...(payment.payTo ? { pay_to: payment.payTo } : {}),
      ...(payment.chain ? { chain: payment.chain } : {}),
      ...(payment.asset ? { asset: payment.asset } : {}),
      ...(payment.method ? { method: payment.method } : {}),
    },
    ...(o.policyId ? { policy_id: o.policyId } : o.policy ? { policy: policyBody(o.policy) } : {}),
    ...(o.trigger ? { trigger: typeof o.trigger === "string" ? { text: o.trigger.slice(0, 100_000) } : { url: o.trigger.url } } : {}),
    ...(o.idempotencyKey ? { idempotency_key: o.idempotencyKey } : {}),
    ...(o.holdSeconds ? { hold_seconds: o.holdSeconds } : {}),
  };
  const c = await call("POST", SHIELD_PATHS.check, body, o);
  const fallback: ShieldDecision = o.failOpen ? "allow" : "hold";
  if (c.status === 200 && c.body && typeof c.body.decision === "string") {
    const d = (["allow", "hold", "block"].includes(c.body.decision) ? c.body.decision : "hold") as ShieldDecision;
    const res = (c.body.reservation ?? null) as Record<string, unknown> | null;
    const b = (c.body.budget ?? null) as Record<string, unknown> | null;
    return {
      decision: d,
      reasons: Array.isArray(c.body.reasons) ? (c.body.reasons as string[]) : [],
      reservationId: res && typeof res.id === "string" ? res.id : null,
      reservationExpiresAt: res && typeof res.expires_at === "string" ? res.expires_at : null,
      budget: b ? { dailyUsd: Number(b.daily_usd), usedUsd: Number(b.used_usd), remainingUsd: Number(b.remaining_usd) } : null,
      advice: typeof c.body.advice === "string" ? c.body.advice : null,
      raw: c.body, payment: null, error: null, source: "angel",
    };
  }
  if (c.status === 402) {
    return blank({
      decision: fallback, reasons: [`[${fallback}] Shield needs a key or an x402 payment (0.02 USDC)`], error: "payment_required",
      payment: { offer: decodeOffer(c.headers?.get("payment-required")), priceUsdc: "0.02", payByCard: typeof c.body?.pay_by_card === "string" ? c.body.pay_by_card : null, message: typeof c.body?.error === "string" ? c.body.error : null },
    });
  }
  const why = typeof c.body?.message === "string" ? c.body.message : typeof c.body?.error === "string" ? c.body.error : c.error;
  return blank({ decision: c.status === 400 ? "block" : fallback, reasons: [`[${c.status === 400 ? "block" : fallback}] ${why ?? `Shield HTTP ${c.status}`}`], error: c.status === 400 ? "bad_request" : c.error ?? `http_${c.status}` });
}

/** After paying: the amount counts against today's budget and the merchant is remembered. */
export async function shieldConfirm(reservationId: string, tx: string | null = null, o: ShieldOptions = {}): Promise<{ ok: boolean; result: string; message: string | null }> {
  const c = await call("POST", SHIELD_PATHS.confirm, { reservation_id: reservationId, ...(tx ? { tx } : {}) }, o);
  return { ok: c.status === 200, result: String(c.body?.result ?? c.error ?? c.status), message: typeof c.body?.message === "string" ? c.body.message : null };
}

/** You did not pay: the reserved amount is free again. */
export async function shieldRelease(reservationId: string, o: ShieldOptions = {}): Promise<{ ok: boolean; result: string; message: string | null }> {
  const c = await call("POST", SHIELD_PATHS.release, { reservation_id: reservationId }, o);
  return { ok: c.status === 200, result: String(c.body?.result ?? c.error ?? c.status), message: typeof c.body?.message === "string" ? c.body.message : null };
}

/** Create (no policyId) or update a stored policy; returns its id. */
export async function shieldPolicy(policy: ShieldPolicy & { name?: string; policyId?: string }, o: ShieldOptions = {}): Promise<{ ok: boolean; policyId: string | null; policy: Record<string, unknown> | null; error: string | null }> {
  const c = await call("POST", SHIELD_PATHS.policy, { ...(policy.policyId ? { policy_id: policy.policyId } : {}), ...(policy.name ? { name: policy.name } : {}), ...policyBody(policy) }, o);
  const ok = c.status === 200 || c.status === 201;
  return { ok, policyId: ok && typeof c.body?.policy_id === "string" ? c.body.policy_id : null, policy: ok ? c.body : null, error: ok ? null : String(c.body?.message ?? c.body?.error ?? c.error ?? c.status) };
}

/** A free Shield key: 100 checks, 30 days, Shield only. */
export async function shieldFreeKey(email?: string, o: CommonOptions = {}): Promise<{ key: string | null; validUntil: string | null; error: string | null }> {
  const c = await call("POST", SHIELD_PATHS.keys, email ? { email } : {}, o);
  return c.status === 201 && typeof c.body?.key === "string"
    ? { key: c.body.key, validUntil: typeof c.body.valid_until === "string" ? c.body.valid_until : null, error: null }
    : { key: null, validUntil: null, error: String(c.body?.message ?? c.body?.error ?? c.error ?? c.status) };
}

export interface ShieldedFetchOptions extends X402FetchOptions {
  bundleToken?: string;
  policyId?: string;
  policy?: ShieldPolicy;
  /** fixed trigger text for every payment, or a function of the request */
  trigger?: string | ((url: string) => string | undefined);
  failOpen?: boolean;
  /** Angel's base URL (default https://angel.oroboros-design.com) */
  angelBaseUrl?: string;
  /** fetch used to reach Angel (default globalThis.fetch) */
  angelFetch?: typeof fetch;
  /** called with every Shield decision before anything is signed */
  onDecision?: (info: { url: string; requirement: X402Requirement; result: ShieldResult }) => void;
}

const bodyIsReplayable = (body: unknown): boolean =>
  body === undefined || body === null || typeof body === "string" || body instanceof URLSearchParams || body instanceof ArrayBuffer || ArrayBuffer.isView(body);

/**
 * A fetch that pays x402 v2 "exact" offers only after Angel Shield allows them. Without a signer it behaves like fetch.
 * hold or block: the 402 comes back unchanged and nothing is signed.
 */
export function createShieldedFetch(o: ShieldedFetchOptions = {}): typeof fetch {
  const base = o.fetch ?? globalThis.fetch;
  let signerPromise: Promise<TypedDataSigner | null> | null = null;
  const shieldOpts = (url: string): ShieldOptions => ({
    bundleToken: o.bundleToken, policyId: o.policyId, policy: o.policyId ? undefined : o.policy, failOpen: o.failOpen,
    baseUrl: o.angelBaseUrl, fetch: o.angelFetch,
    trigger: typeof o.trigger === "function" ? o.trigger(url) : o.trigger,
  });
  const shielded = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const first = await base(input, init);
    if (first.status !== 402) return first;
    signerPromise ??= resolveSigner(o);
    const signer = await signerPromise;
    if (!signer || !bodyIsReplayable(init.body)) return first;
    const offer = decodeOffer(first.headers.get("payment-required"));
    if (!offer) return first;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const local = checkOffer(offer, { url, maxAmountAtomic: o.maxAmountAtomic, networks: o.networks });
    if (!local.option || local.verdict === "do_not_pay") return first;
    const req = local.option;
    const result = await shieldCheck({ amountUsd: Number(req.amount) / 1e6, merchantUrl: url, payTo: req.payTo, chain: req.network, asset: req.asset, method: (init.method ?? "GET").toUpperCase() === "POST" ? "POST" : "GET" }, shieldOpts(url));
    o.onDecision?.({ url, requirement: req, result });
    if (result.decision !== "allow") return first;
    const so = shieldOpts(url);
    let paid: Response;
    try {
      const header = await signPayment(offer, req, signer, o.validForSeconds);
      const h = new Headers(init.headers);
      h.set("PAYMENT-SIGNATURE", header);
      paid = await base(input, { ...init, headers: h });
    } catch (e) {
      if (result.reservationId) await shieldRelease(result.reservationId, so);
      throw e;
    }
    const receipt = decodeReceipt(paid.headers.get("payment-response"));
    if (result.reservationId) {
      const tx = receipt && typeof receipt === "object" && typeof (receipt as Record<string, unknown>).transaction === "string" ? String((receipt as Record<string, unknown>).transaction) : null;
      if (paid.ok) await shieldConfirm(result.reservationId, tx, so);
      else await shieldRelease(result.reservationId, so);
    }
    if (paid.ok && o.onPayment) o.onPayment({ url, requirement: req, receipt });
    return paid;
  };
  return shielded as typeof fetch;
}
