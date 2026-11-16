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
import { type CommonOptions, type PaymentNeeded } from "./guard.js";
import { type X402Requirement } from "./local.js";
import { type X402FetchOptions } from "./pay.js";
export declare const SHIELD_PATHS: {
    readonly check: "/agenten/signal/shield-check";
    readonly policy: "/shield/policy";
    readonly confirm: "/shield/confirm";
    readonly release: "/shield/release";
    readonly keys: "/shield/keys";
};
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
    trigger?: string | {
        url: string;
    };
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
    budget: {
        dailyUsd: number;
        usedUsd: number;
        remainingUsd: number;
    } | null;
    advice: string | null;
    /** the full answer from Angel */
    raw: Record<string, unknown> | null;
    payment: PaymentNeeded | null;
    error: string | null;
    source: "angel" | "local";
}
/** snake_case for the wire */
export declare function policyBody(p: ShieldPolicy): Record<string, unknown>;
/** The rules that need no network: cap, kill switch, expiry, block and allow lists. Used before the call and when offline. */
export declare function localPolicyCheck(p: ShieldPayment, policy: ShieldPolicy | undefined, now?: Date): {
    decision: ShieldDecision;
    reasons: string[];
};
/**
 * Ask Shield before a payment. Never throws: on network trouble or a missing payment the decision is "hold"
 * (or "allow" with failOpen), and error says why.
 */
export declare function shieldCheck(payment: ShieldPayment, o?: ShieldOptions): Promise<ShieldResult>;
/** After paying: the amount counts against today's budget and the merchant is remembered. */
export declare function shieldConfirm(reservationId: string, tx?: string | null, o?: ShieldOptions): Promise<{
    ok: boolean;
    result: string;
    message: string | null;
}>;
/** You did not pay: the reserved amount is free again. */
export declare function shieldRelease(reservationId: string, o?: ShieldOptions): Promise<{
    ok: boolean;
    result: string;
    message: string | null;
}>;
/** Create (no policyId) or update a stored policy; returns its id. */
export declare function shieldPolicy(policy: ShieldPolicy & {
    name?: string;
    policyId?: string;
}, o?: ShieldOptions): Promise<{
    ok: boolean;
    policyId: string | null;
    policy: Record<string, unknown> | null;
    error: string | null;
}>;
/** A free Shield key: 100 checks, 30 days, Shield only. */
export declare function shieldFreeKey(email?: string, o?: CommonOptions): Promise<{
    key: string | null;
    validUntil: string | null;
    error: string | null;
}>;
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
    onDecision?: (info: {
        url: string;
        requirement: X402Requirement;
        result: ShieldResult;
    }) => void;
}
/**
 * A fetch that pays x402 v2 "exact" offers only after Angel Shield allows them. Without a signer it behaves like fetch.
 * hold or block: the 402 comes back unchanged and nothing is signed.
 */
export declare function createShieldedFetch(o?: ShieldedFetchOptions): typeof fetch;
