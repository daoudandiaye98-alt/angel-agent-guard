/**
 * Local, offline checks. No network, no dependencies.
 *
 * quickScan: strips invisible characters, decodes Unicode tag smuggling and flags the riskiest markers.
 * checkOffer: static checks of a decoded x402 v2 PAYMENT-REQUIRED offer before anything is signed.
 */
export type Severity = "high" | "medium" | "low";
export interface LocalFinding {
    kind: string;
    severity: Severity;
    count: number;
    decoded?: string;
}
export interface QuickScanResult {
    suspicious: boolean;
    findings: LocalFinding[];
    cleaned: string;
}
/** Zero-dependency pre-filter for untrusted text. It does not judge meaning: use it as a first pass. */
export declare function quickScan(text: string): QuickScanResult;
/** Verdict from local findings alone. Without a semantic check, "no findings" is "unchecked", never "clean". */
export declare function localVerdict(q: QuickScanResult): "hostile" | "caution" | "unchecked";
/** Wrap external content as data, with a boundary an attacker cannot predict. */
export declare function fence(source: string, content: string): string;
export declare const looksLikeUrl: (s: string) => boolean;
export interface X402Requirement {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds?: number;
    extra?: {
        name?: string;
        version?: string;
        [k: string]: unknown;
    };
}
export interface X402Offer {
    x402Version: number;
    resource?: {
        url?: string;
        description?: string;
        mimeType?: string;
        [k: string]: unknown;
    };
    accepts: X402Requirement[];
    [k: string]: unknown;
}
/** Official native USDC contracts by CAIP-2 network (lowercase). */
export declare const USDC: Readonly<Record<string, {
    address: string;
    name: string;
    version: string;
    testnet?: boolean;
}>>;
/** Decode the base64 PAYMENT-REQUIRED header of an x402 v2 402 response. */
export declare function decodeOffer(header: string | null | undefined): X402Offer | null;
export interface OfferCheck {
    /** the first option that passed every hard check, or null */
    option: X402Requirement | null;
    verdict: "pay" | "caution" | "do_not_pay";
    reasons: string[];
}
export interface OfferCheckOptions {
    /** the URL you called; the offer's resource must be on the same host */
    url?: string;
    /** per-payment cap in atomic units of USDC (6 decimals); default 1_000_000 = 1.00 USDC */
    maxAmountAtomic?: bigint | number | string;
    /** CAIP-2 networks you hold funds on; default ["eip155:8453"] (Base) */
    networks?: string[];
}
/** Static checks of an x402 offer: official USDC, network, amount cap, EIP-712 domain, payTo shape, host. */
export declare function checkOffer(offer: X402Offer, o?: OfferCheckOptions): OfferCheck;
