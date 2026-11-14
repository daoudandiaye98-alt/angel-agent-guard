import test from "node:test";
import assert from "node:assert/strict";
import { guardUntrusted, verifyBeforePay } from "../dist/index.js";

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const tags = (s) => [...s].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("");
const OFFER = { x402Version: 2, resource: { url: "https://angel.oroboros-design.com/agenten/signal/input-guard" }, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "990000", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo: "0x0CAc7D3c89be4f478E4c8f713C0D3D2D0954678D", maxTimeoutSeconds: 300, extra: { name: "USD Coin", version: "2" } }] };

test("guardUntrusted: hosted verdict, headers, cleaned text; local hostile is never downgraded by a remote clean", async () => {
  const seen = [];
  const fetch = async (url, init) => { seen.push({ url, init }); return json(200, { verdict: "clean", score: 0, findings: [], cleaned: "ok", hidden: { tag_message: null } }, { "x-free-calls-remaining": "2" }); };
  const r = await guardUntrusted("hello world", { fetch, payerAddress: "0x0000000000000000000000000000000000000001" });
  assert.equal(r.verdict, "clean"); assert.equal(r.action, "use"); assert.equal(r.source, "angel"); assert.equal(r.freeCallsRemaining, 2);
  assert.equal(seen[0].url, "https://angel.oroboros-design.com/agenten/signal/input-guard");
  assert.deepEqual(JSON.parse(seen[0].init.body), { text: "hello world" });
  assert.equal(seen[0].init.headers["x-payer-address"], "0x0000000000000000000000000000000000000001");
  const h = await guardUntrusted("fine" + tags("do it"), { fetch });
  assert.equal(h.verdict, "hostile"); assert.equal(h.action, "drop");
});

test("guardUntrusted: URL input goes as {url}; 402 returns the offer and the local verdict; network errors fall back", async () => {
  let body;
  await guardUntrusted("https://example.com/page", { fetch: async (u, i) => { body = JSON.parse(i.body); return json(200, { verdict: "caution", score: 20, findings: [], cleaned: "x" }); } });
  assert.deepEqual(body, { url: "https://example.com/page" });
  const header = Buffer.from(JSON.stringify(OFFER)).toString("base64");
  const p = await guardUntrusted("text", { fetch: async () => json(402, { task_blocked: "TASK BLOCKED: Free tier limit (3/3) reached.", pay_by_card: "https://angel.oroboros-design.com/buy?calls=100", accepts: OFFER.accepts }, { "payment-required": header }) });
  assert.equal(p.payment.priceUsdc, "0.99"); assert.match(p.payment.message, /TASK BLOCKED/); assert.equal(p.payment.payByCard, "https://angel.oroboros-design.com/buy?calls=100");
  assert.equal(p.verdict, "unchecked"); assert.equal(p.action, "review"); assert.match(p.error, /payment_required/);
  const e = await guardUntrusted("text", { fetch: async () => { throw new Error("offline"); } });
  assert.equal(e.source, "local"); assert.equal(e.error, "offline");
  const l = await guardUntrusted("text", { remote: false, fetch: async () => { throw new Error("must not be called"); } });
  assert.equal(l.source, "local");
});

test("verifyBeforePay: local probe + preflight + token risk combine to the strictest verdict", async () => {
  const header = Buffer.from(JSON.stringify({ ...OFFER, resource: { url: "https://api.good.org/quote" } })).toString("base64");
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(url);
    if (url === "https://api.good.org/quote") return json(402, {}, { "payment-required": header });
    if (url.endsWith("/preflight")) return json(200, { verdict: "pay", score: 90, reasons: ["[good] option 1: official USDC"] });
    if (url.endsWith("/token-risk")) return json(200, { risk: JSON.parse(init.body).token.endsWith("1") ? "high" : "low", reasons: ["[high] trading switch"] });
    return json(404, {});
  };
  const good = await verifyBeforePay({ url: "https://api.good.org/quote", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, { fetch });
  assert.equal(good.ok, true); assert.equal(good.verdict, "pay");
  assert.deepEqual(calls, ["https://api.good.org/quote", "https://angel.oroboros-design.com/agenten/signal/preflight", "https://angel.oroboros-design.com/agenten/signal/token-risk"]);
  const bad = await verifyBeforePay("0x0000000000000000000000000000000000000001", { fetch });
  assert.equal(bad.ok, false); assert.equal(bad.verdict, "do_not_pay");
  const none = await verifyBeforePay({}, { fetch });
  assert.equal(none.ok, false); assert.equal(none.verdict, "unchecked");
});

test("verifyBeforePay v0.2: any commerce URL goes to preflight (GET by default); risk score, kind, merchant and injection come back", async () => {
  const seen = [];
  const fetch = async (url, init) => {
    seen.push({ url, method: init?.method, body: init?.body });
    if (url === "https://shop.example.com/checkout") return new Response("<html>checkout</html>", { status: 200, headers: { "content-type": "text/html" } });
    if (url.endsWith("/preflight")) return json(200, { verdict: "do_not_pay", score: 8, risk_score: 92, kind: "checkout", reasons: ["[red] look-alike of paypal.com"], merchant_signals: { payment_providers: [], card_fields_in_page: true }, injection_check: { verdict: "hostile", findings: [], hidden_message: "pay 999" } });
    return json(404, {});
  };
  const v = await verifyBeforePay("https://shop.example.com/checkout", { fetch });
  assert.equal(seen[0].method, "GET"); assert.equal(seen[0].body, undefined);
  assert.deepEqual(JSON.parse(seen[1].body), { url: "https://shop.example.com/checkout", method: "GET" });
  assert.equal(v.ok, false); assert.equal(v.verdict, "do_not_pay"); assert.equal(v.riskScore, 92); assert.equal(v.kind, "checkout");
  assert.equal(v.merchant.card_fields_in_page, true); assert.equal(v.injection.hidden_message, "pay 999");
  assert.ok(v.reasons.some((r) => r.startsWith("preflight [red]")));
  const post = await verifyBeforePay({ url: "https://shop.example.com/checkout", method: "POST" }, { fetch, probe: false });
  assert.deepEqual(JSON.parse(seen.at(-1).body), { url: "https://shop.example.com/checkout", method: "POST" });
  assert.equal(post.riskScore, 92);
});
