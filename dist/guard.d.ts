/**
 * guardUntrusted and verifyBeforePay: local checks first, then Angel's hosted checks
 * (https://angel.oroboros-design.com, first 3 calls free per agent, then USDC on Base via x402).
 */
import { type LocalFinding, type OfferCheck, type QuickScanResult, type X402Offer } from "./local.js";
export declare const VERSION = "0.1.0";
export declare const ANGEL_BASE = "https://angel.oroboros-design.com";
export declare const PATHS: {
    readonly inputGuard: "/agenten/signal/input-guard";
    readonly preflight: "/agenten/signal/preflight";
    readonly tokenRisk: "/agenten/signal/token-risk";
};
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
/**
 * Check untrusted text or a public https URL before an agent reads it.
 * Local pass first (invisible Unicode, tag smuggling, exfiltration images), then Angel's 17-language input guard.
 * Never throws for network or payment problems: falls back to the local verdict and says why.
 */
export declare function guardUntrusted(input: string | URL, o?: CommonOptions): Promise<GuardResult>;
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
/**
 * Check before money moves: an x402 endpoint (local probe + Angel's /preflight) and/or an ERC-20 (Angel's /token-risk).
 * ok is true only when at least one check ran and every check says pay. caution: read the reasons; do_not_pay: never sign.
 */
export declare function verifyBeforePay(target: string | VerifyTarget, o?: VerifyOptions): Promise<VerifyResult>;
