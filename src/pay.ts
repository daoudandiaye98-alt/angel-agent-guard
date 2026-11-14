/**
 * x402 v2 "exact" payments for EVM (EIP-3009 TransferWithAuthorization), without an SDK.
 *
 * createX402Fetch wraps fetch: on a 402 it decodes PAYMENT-REQUIRED, runs checkOffer (official USDC, network,
 * your per-payment cap, host), signs one authorization for exactly the asked amount and retries once with
 * PAYMENT-SIGNATURE. Anything that fails a check is not signed; the 402 is returned unchanged.
 */

import { checkOffer, decodeOffer, type OfferCheckOptions, type X402Offer, type X402Requirement } from "./local.js";

/** Anything that can sign EIP-712 typed data: a viem LocalAccount, a wallet client adapter, AgentKit's wallet provider adapter. */
export interface TypedDataSigner {
  address: string;
  signTypedData(typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
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
  onPayment?: (info: { url: string; requirement: X402Requirement; receipt: unknown }) => void;
}

const TRANSFER_WITH_AUTHORIZATION = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "validAfter", type: "uint256" },
  { name: "validBefore", type: "uint256" },
  { name: "nonce", type: "bytes32" },
];

const toBase64 = (s: string): string =>
  typeof btoa === "function" ? btoa(String.fromCharCode(...new TextEncoder().encode(s))) : Buffer.from(s, "utf8").toString("base64");

export function decodeReceipt(header: string | null | undefined): unknown {
  if (!header) return null;
  try {
    const json = typeof atob === "function"
      ? new TextDecoder().decode(Uint8Array.from(atob(header.trim()), (c) => c.charCodeAt(0)))
      : Buffer.from(header.trim(), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return header;
  }
}

function randomNonce(): string {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  return `0x${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Build the PAYMENT-SIGNATURE header value for one requirement of an offer. */
export async function signPayment(offer: X402Offer, requirement: X402Requirement, signer: TypedDataSigner, validForSeconds = 600): Promise<string> {
  const chainId = Number(requirement.network.split(":")[1]);
  if (!Number.isInteger(chainId)) throw new Error(`unsupported network ${requirement.network}`);
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.min(3600, Math.max(60, Math.floor(validForSeconds)));
  const authorization = {
    from: signer.address,
    to: requirement.payTo,
    value: requirement.amount,
    validAfter: String(now - 30),
    validBefore: String(now + ttl),
    nonce: randomNonce(),
  };
  const signature = await signer.signTypedData({
    domain: {
      name: requirement.extra?.name ?? "USD Coin",
      version: requirement.extra?.version ?? "2",
      chainId,
      verifyingContract: requirement.asset,
    },
    types: { TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION },
    primaryType: "TransferWithAuthorization",
    message: {
      ...authorization,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
    },
  });
  return toBase64(JSON.stringify({ x402Version: 2, resource: offer.resource, accepted: requirement, payload: { signature, authorization } }));
}

/** Resolve a signer from options; a private key needs the optional peer dependency `viem`. */
export async function resolveSigner(o: Pick<X402FetchOptions, "signer" | "privateKey">): Promise<TypedDataSigner | null> {
  if (o.signer) return o.signer;
  if (!o.privateKey) return null;
  let mod: { privateKeyToAccount: (k: `0x${string}`) => TypedDataSigner };
  try {
    mod = (await import("viem/accounts" as string)) as typeof mod;
  } catch {
    throw new Error("privateKey needs the optional dependency viem: npm i viem");
  }
  const key = (o.privateKey.startsWith("0x") ? o.privateKey : `0x${o.privateKey}`) as `0x${string}`;
  return mod.privateKeyToAccount(key);
}

const bodyIsReplayable = (body: unknown): boolean =>
  body === undefined || body === null || typeof body === "string" || body instanceof URLSearchParams || body instanceof ArrayBuffer || ArrayBuffer.isView(body);

/**
 * A fetch that pays x402 v2 "exact" offers on EVM within your cap. Without a signer it behaves like fetch.
 * The request body must be replayable (string, URLSearchParams, ArrayBuffer); streams are not retried.
 */
export function createX402Fetch(o: X402FetchOptions = {}): typeof fetch {
  const base = o.fetch ?? globalThis.fetch;
  let signerPromise: Promise<TypedDataSigner | null> | null = null;
  const paying = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const first = await base(input, init);
    if (first.status !== 402) return first;
    signerPromise ??= resolveSigner(o);
    const signer = await signerPromise;
    if (!signer || !bodyIsReplayable(init.body)) return first;
    const offer = decodeOffer(first.headers.get("payment-required"));
    if (!offer) return first;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const check = checkOffer(offer, { url, maxAmountAtomic: o.maxAmountAtomic, networks: o.networks });
    if (!check.option || check.verdict === "do_not_pay") return first;
    const header = await signPayment(offer, check.option, signer, o.validForSeconds);
    const headers = new Headers(init.headers);
    headers.set("PAYMENT-SIGNATURE", header);
    const paid = await base(input, { ...init, headers });
    if (paid.ok && o.onPayment) o.onPayment({ url, requirement: check.option, receipt: decodeReceipt(paid.headers.get("payment-response")) });
    return paid;
  };
  return paying as typeof fetch;
}
