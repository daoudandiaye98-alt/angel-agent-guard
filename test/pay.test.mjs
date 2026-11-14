import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { verifyTypedData } from "viem";
import { createX402Fetch } from "../dist/index.js";

const OFFER = { x402Version: 2, resource: { url: "https://api.good.org/quote" }, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "990000", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo: "0x0CAc7D3c89be4f478E4c8f713C0D3D2D0954678D", maxTimeoutSeconds: 300, extra: { name: "USD Coin", version: "2" } }] };

test("createX402Fetch signs a valid EIP-3009 authorization for exactly the asked amount and retries once", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const sent = [];
  const base = async (url, init = {}) => {
    sent.push(new Headers(init.headers).get("payment-signature"));
    if (!sent.at(-1)) return new Response("{}", { status: 402, headers: { "payment-required": Buffer.from(JSON.stringify(OFFER)).toString("base64") } });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "payment-response": Buffer.from(JSON.stringify({ transaction: "0xabc" })).toString("base64") } });
  };
  let receipt;
  const f = createX402Fetch({ signer: account, fetch: base, onPayment: (i) => { receipt = i.receipt; } });
  const r = await f("https://api.good.org/quote", { method: "POST", body: JSON.stringify({ q: 1 }) });
  assert.equal(r.status, 200); assert.equal(sent.length, 2); assert.deepEqual(receipt, { transaction: "0xabc" });
  const p = JSON.parse(Buffer.from(sent[1], "base64").toString("utf8"));
  assert.equal(p.x402Version, 2); assert.deepEqual(p.accepted, OFFER.accepts[0]);
  const a = p.payload.authorization;
  assert.equal(a.value, "990000"); assert.equal(a.to, OFFER.accepts[0].payTo); assert.equal(a.from, account.address);
  assert.ok(Number(a.validBefore) - Number(a.validAfter) <= 3600 + 30);
  const valid = await verifyTypedData({
    address: account.address,
    domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: OFFER.accepts[0].asset },
    types: { TransferWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] },
    primaryType: "TransferWithAuthorization",
    message: { ...a, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore) },
    signature: p.payload.signature,
  });
  assert.equal(valid, true);
});

test("createX402Fetch never signs above the cap, for a lookalike asset, or without a signer", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  for (const [offer, opts] of [
    [{ ...OFFER, accepts: [{ ...OFFER.accepts[0], amount: "2500000" }] }, { signer: account }],
    [{ ...OFFER, accepts: [{ ...OFFER.accepts[0], asset: "0x0000000000000000000000000000000000000001" }] }, { signer: account }],
    [OFFER, {}],
  ]) {
    let n = 0;
    const base = async () => { n++; return new Response("{}", { status: 402, headers: { "payment-required": Buffer.from(JSON.stringify(offer)).toString("base64") } }); };
    const r = await createX402Fetch({ ...opts, fetch: base })("https://api.good.org/quote", { method: "POST", body: "{}" });
    assert.equal(r.status, 402); assert.equal(n, 1, "no second, signed request");
  }
});

test("createX402Fetch accepts a raw private key through the optional viem peer", async () => {
  let header;
  const base = async (u, init = {}) => {
    header = new Headers(init.headers).get("payment-signature");
    return header ? new Response("{}", { status: 200 }) : new Response("{}", { status: 402, headers: { "payment-required": Buffer.from(JSON.stringify(OFFER)).toString("base64") } });
  };
  const r = await createX402Fetch({ privateKey: generatePrivateKey(), fetch: base })("https://api.good.org/quote", { method: "POST", body: "{}" });
  assert.equal(r.status, 200); assert.ok(header);
});
