import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createShieldedFetch, localPolicyCheck, shieldCheck, shieldPolicy } from "../dist/index.js";
import { TOOLS, callTool } from "../dist/mcp.js";

const OFFER = { x402Version: 2, resource: { url: "https://api.good.org/quote" }, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "990000", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo: "0x0CAc7D3c89be4f478E4c8f713C0D3D2D0954678D", maxTimeoutSeconds: 300, extra: { name: "USD Coin", version: "2" } }] };
const b64 = (x) => Buffer.from(JSON.stringify(x)).toString("base64");

/** a fake Angel that records calls and answers with the given decision */
function fakeAngel(decision, extra = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, body, headers: new Headers(init.headers) });
    if (path === "/agenten/signal/shield-check") {
      return new Response(JSON.stringify({ decision, reasons: decision === "allow" ? [] : ["[block] policy: amount is above the per-payment cap"], reservation: decision === "allow" ? { id: "res_abcdefgh1234", expires_at: "2026-11-16T12:15:00Z" } : null, budget: { daily_usd: 10, used_usd: 0.99, remaining_usd: 9.01 }, ...extra }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (path === "/shield/confirm" || path === "/shield/release") return new Response(JSON.stringify({ result: path === "/shield/confirm" ? "confirmed" : "released" }), { status: 200 });
    if (path === "/shield/policy") return new Response(JSON.stringify({ policy_id: "pol_abcdefgh1234", daily_budget_usd: 10 }), { status: 201 });
    return new Response("{}", { status: 404 });
  };
  return { f, calls };
}

test("localPolicyCheck: cap, kill switch, allow and block lists without any network", () => {
  assert.equal(localPolicyCheck({ amountUsd: 5, merchantUrl: "https://pay.shop.example.com/c" }, { maxPerPaymentUsd: 10, allowMerchants: ["example.com"] }).decision, "allow");
  assert.equal(localPolicyCheck({ amountUsd: 50, merchantUrl: "https://shop.example.com" }, { maxPerPaymentUsd: 10 }).decision, "block");
  assert.equal(localPolicyCheck({ amountUsd: 5, merchantUrl: "https://shop.example.com" }, { kill: true }).decision, "block");
  assert.equal(localPolicyCheck({ amountUsd: 5, merchantUrl: "https://evil.com" }, { allowMerchants: ["example.com"] }).decision, "block");
  assert.equal(localPolicyCheck({ amountUsd: 5, payTo: "0x000000000000000000000000000000000000dEaD" }, { blockMerchants: ["0x000000000000000000000000000000000000dead"] }).decision, "block");
});

test("shieldCheck: sends the key and snake_case body; fail-closed on 402 and network errors unless failOpen", async () => {
  const a = fakeAngel("allow");
  const r = await shieldCheck({ amountUsd: 12.5, merchantUrl: "https://shop.example.com/c" }, { fetch: a.f, bundleToken: "tsb_test", policyId: "pol_abcdefgh1234", trigger: "buy the report" });
  assert.equal(r.decision, "allow"); assert.equal(r.reservationId, "res_abcdefgh1234"); assert.equal(r.budget.remainingUsd, 9.01);
  assert.equal(a.calls[0].headers.get("x-bundle-token"), "tsb_test");
  assert.deepEqual(a.calls[0].body, { payment: { amount_usd: 12.5, merchant_url: "https://shop.example.com/c" }, policy_id: "pol_abcdefgh1234", trigger: { text: "buy the report" } });
  const blocked = await shieldCheck({ amountUsd: 99, merchantUrl: "https://shop.example.com" }, { fetch: a.f, policy: { maxPerPaymentUsd: 10 } });
  assert.equal(blocked.decision, "block"); assert.equal(blocked.source, "local"); assert.equal(a.calls.length, 1, "local block needs no call");
  const zahlen = async () => new Response(JSON.stringify({ error: "payment required" }), { status: 402, headers: { "payment-required": b64(OFFER) } });
  assert.equal((await shieldCheck({ amountUsd: 1, merchantUrl: "https://x.example.com" }, { fetch: zahlen })).decision, "hold");
  assert.equal((await shieldCheck({ amountUsd: 1, merchantUrl: "https://x.example.com" }, { fetch: async () => { throw new Error("offline"); } })).decision, "hold");
  assert.equal((await shieldCheck({ amountUsd: 1, merchantUrl: "https://x.example.com" }, { fetch: async () => { throw new Error("offline"); }, failOpen: true })).decision, "allow");
});

test("createShieldedFetch: Shield allows → signs, pays and confirms the reservation with the tx", async () => {
  const angel = fakeAngel("allow");
  const sent = [];
  const target = async (url, init = {}) => {
    sent.push(new Headers(init.headers).get("payment-signature"));
    if (!sent.at(-1)) return new Response("{}", { status: 402, headers: { "payment-required": b64(OFFER) } });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "payment-response": b64({ transaction: "0xabc" }) } });
  };
  const decisions = [];
  const f = createShieldedFetch({ signer: privateKeyToAccount(generatePrivateKey()), fetch: target, angelFetch: angel.f, bundleToken: "tsb_test", policyId: "pol_abcdefgh1234", onDecision: (d) => decisions.push(d.result.decision) });
  const r = await f("https://api.good.org/quote", { method: "POST", body: "{}" });
  assert.equal(r.status, 200); assert.equal(sent.length, 2); assert.deepEqual(decisions, ["allow"]);
  assert.deepEqual(angel.calls.map((c) => c.path), ["/agenten/signal/shield-check", "/shield/confirm"]);
  assert.equal(angel.calls[0].body.payment.amount_usd, 0.99); assert.equal(angel.calls[0].body.payment.pay_to, OFFER.accepts[0].payTo);
  assert.deepEqual(angel.calls[1].body, { reservation_id: "res_abcdefgh1234", tx: "0xabc" });
});

test("createShieldedFetch: Shield blocks → nothing is signed, the 402 comes back unchanged", async () => {
  const angel = fakeAngel("block");
  let signed = 0;
  const target = async (url, init = {}) => { if (new Headers(init.headers).get("payment-signature")) signed++; return new Response("{}", { status: 402, headers: { "payment-required": b64(OFFER) } }); };
  const f = createShieldedFetch({ signer: privateKeyToAccount(generatePrivateKey()), fetch: target, angelFetch: angel.f });
  const r = await f("https://api.good.org/quote");
  assert.equal(r.status, 402); assert.equal(signed, 0);
});

test("createShieldedFetch: paid retry fails → reservation released", async () => {
  const angel = fakeAngel("allow");
  let n = 0;
  const target = async () => (n++ === 0 ? new Response("{}", { status: 402, headers: { "payment-required": b64(OFFER) } }) : new Response("{}", { status: 500 }));
  const f = createShieldedFetch({ signer: privateKeyToAccount(generatePrivateKey()), fetch: target, angelFetch: angel.f, policyId: "pol_abcdefgh1234" });
  assert.equal((await f("https://api.good.org/quote")).status, 500);
  assert.deepEqual(angel.calls.map((c) => c.path), ["/agenten/signal/shield-check", "/shield/release"]);
});

test("shieldPolicy and the MCP tool shield_check", async () => {
  const angel = fakeAngel("hold");
  const p = await shieldPolicy({ name: "agent", maxPerPaymentUsd: 5, dailyBudgetUsd: 10, holdNewMerchants: true }, { fetch: angel.f, bundleToken: "tsb_test" });
  assert.equal(p.policyId, "pol_abcdefgh1234");
  assert.deepEqual(angel.calls[0].body, { name: "agent", max_per_payment_usd: 5, daily_budget_usd: 10, hold_new_merchants: true });
  assert.equal(TOOLS[0].name, "shield_check");
  const r = await callTool("shield_check", { amount_usd: 3, merchant_url: "https://shop.example.com" }, { fetch: angel.f });
  assert.equal(r.decision, "hold");
});
