/**
 * x402 v2 "exact" payments for EVM (EIP-3009 TransferWithAuthorization), without an SDK.
 *
 * createX402Fetch wraps fetch: on a 402 it decodes PAYMENT-REQUIRED, runs checkOffer (official USDC, network,
 * your per-payment cap, host), signs one authorization for exactly the asked amount and retries once with
 * PAYMENT-SIGNATURE. Anything that fails a check is not signed; the 402 is returned unchanged.
 */
import { type OfferCheckOptions, type X402Offer, type X402Requirement } from "./local.js";
/** Anything that can sign EIP-712 typed data: a viem LocalAccount, a wallet client adapter, AgentKit's wallet provider adapter. */
export interface TypedDataSigner {
    address: string;
    signTypedData(typedData: {
        domain: Record<string, unknown>;
        types: Record<string, Array<{
            name: string;
            type: string;
        }>>;
        primaryType: string;
        message: Record<string, unknown>;
    }): Promise<string>;
}
export interface X402FetchOptions extends OfferCheckOptions {
    /** a signer, e.g. viem's privateKeyToAccount(...) */
    signer?: TypedDataSigner;
    /** hex private key; needs the optional peer dependency `viem` */
    privateKey?: string;
    /** underlying fetch; default globalThis.fetch */
    fetch?: typeof fetch;
    /** seconds the authorization stays valid; default 600 (allowed 60..3600) */
    validForSeconds?: number;
    /** called after each settled payment with the decoded PAYMENT-RESPONSE */
    onPayment?: (info: {
        url: string;
        requirement: X402Requirement;
        receipt: unknown;
    }) => void;
}
export declare function decodeReceipt(header: string | null | undefined): unknown;
/** Build the PAYMENT-SIGNATURE header value for one requirement of an offer. */
export declare function signPayment(offer: X402Offer, requirement: X402Requirement, signer: TypedDataSigner, validForSeconds?: number): Promise<string>;
/** Resolve a signer from options; a private key needs the optional peer dependency `viem`. */
export declare function resolveSigner(o: Pick<X402FetchOptions, "signer" | "privateKey">): Promise<TypedDataSigner | null>;
/**
 * A fetch that pays x402 v2 "exact" offers on EVM within your cap. Without a signer it behaves like fetch.
 * The request body must be replayable (string, URLSearchParams, ArrayBuffer); streams are not retried.
 */
export declare function createX402Fetch(o?: X402FetchOptions): typeof fetch;
