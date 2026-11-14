/**
 * guardUntrusted and verifyBeforePay: local checks first, then Angel's hosted checks
 * (https://angel.oroboros-design.com, first 3 calls free per agent, then USDC on Base via x402).
 */
import { checkOffer, decodeOffer, localVerdict, looksLikeUrl, quickScan, } from "./local.js";
import { decodeReceipt } from "./pay.js";
export const VERSION = "0.2.0";
export const ANGEL_BASE = "https://angel.oroboros-design.com";
export const PATHS = {
    inputGuard: "/agenten/signal/input-guard",
    preflight: "/agenten/signal/preflight",
    tokenRisk: "/agenten/signal/token-risk",
};
const RANK = { clean: 0, unchecked: 1, caution: 2, hostile: 3 };
const ACTION = { clean: "use", caution: "read_only", hostile: "drop", unchecked: "review" };
const stricter = (a, b) => (RANK[a] >= RANK[b] ? a : b);
const env = (k) => (typeof process !== "undefined" ? process.env?.[k] : undefined);
function headersFor(o) {
    const h = { "content-type": "application/json", accept: "application/json", "user-agent": `angel-agent-guard/${VERSION}` };
    const payer = o.payerAddress ?? env("ANGEL_PAYER_ADDRESS");
    if (payer)
        h["x-payer-address"] = payer;
    const key = o.apiKey ?? env("ANGEL_API_KEY");
    if (key)
        h["x-api-key"] = key;
    return h;
}
async function post(path, body, o) {
    const base = (o.baseUrl ?? env("ANGEL_BASE_URL") ?? ANGEL_BASE).replace(/\/+$/, "");
    const f = o.fetch ?? globalThis.fetch;
    try {
        const r = await f(`${base}${path}`, {
            method: "POST",
            headers: headersFor(o),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
        });
        let parsed = null;
        try {
            parsed = (await r.json());
        }
        catch {
            parsed = null;
        }
        return { status: r.status, body: parsed, headers: r.headers, error: null };
    }
    catch (e) {
        return { status: 0, body: null, headers: null, error: e instanceof Error ? e.message : String(e) };
    }
}
function paymentFrom(c) {
    const offer = decodeOffer(c.headers?.get("payment-required")) ?? (c.body && Array.isArray(c.body.accepts) ? c.body : null);
    const amount = offer?.accepts?.[0]?.amount;
    return {
        offer,
        priceUsdc: amount ? (Number(amount) / 1e6).toFixed(2) : typeof c.body?.price_usd === "string" ? c.body.price_usd : null,
        payByCard: typeof c.body?.pay_by_card === "string" ? c.body.pay_by_card : null,
        message: typeof c.body?.task_blocked === "string" ? c.body.task_blocked : typeof c.body?.error === "string" ? c.body.error : null,
    };
}
const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
/**
 * Check untrusted text or a public https URL before an agent reads it.
 * Local pass first (invisible Unicode, tag smuggling, exfiltration images), then Angel's 17-language input guard.
 * Never throws for network or payment problems: falls back to the local verdict and says why.
 */
export async function guardUntrusted(input, o = {}) {
    const raw = input instanceof URL ? input.href : input;
    const isUrl = input instanceof URL || looksLikeUrl(raw);
    const local = isUrl ? null : quickScan(raw);
    const localV = local ? localVerdict(local) : "unchecked";
    const base = {
        verdict: localV, action: ACTION[localV], score: null, findings: local?.findings ?? [], cleaned: local?.cleaned ?? null,
        hiddenMessage: local?.findings.find((f) => f.kind === "unicode_tags")?.decoded ?? null,
        source: "local", local, freeCallsRemaining: null, payment: null, receipt: null, error: null,
    };
    if (o.remote === false)
        return base;
    const c = await post(PATHS.inputGuard, isUrl ? { url: raw.trim() } : { text: raw.slice(0, 100_000) }, o);
    if (c.status === 200 && c.body && typeof c.body.verdict === "string") {
        const remoteV = (["clean", "caution", "hostile"].includes(c.body.verdict) ? c.body.verdict : "caution");
        const verdict = stricter(remoteV, localV === "unchecked" ? "clean" : localV);
        const hidden = (c.body.hidden ?? {});
        return {
            verdict, action: ACTION[verdict],
            score: typeof c.body.score === "number" ? c.body.score : null,
            findings: Array.isArray(c.body.findings) ? c.body.findings : [],
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
const VRANK = { pay: 0, unchecked: 1, caution: 2, do_not_pay: 3 };
const vmax = (a, b) => (VRANK[a] >= VRANK[b] ? a : b);
/**
 * Check before money moves: any shop, checkout or payment link, API or x402 endpoint (local probe + Angel's /preflight v2:
 * TLS, domain age, look-alikes, redirects, payment provider, card fields, injection scan of the page) and/or an ERC-20
 * (Angel's /token-risk).
 * ok is true only when at least one check ran and every check says pay. caution: read the reasons; do_not_pay: never sign.
 */
export async function verifyBeforePay(target, o = {}) {
    const t = typeof target === "string"
        ? (/^0x[0-9a-fA-F]{40}$/.test(target.trim()) ? { token: target.trim() } : { url: target.trim() })
        : target;
    const reasons = [];
    const errors = [];
    let verdict = "unchecked";
    let ran = 0;
    let local = null;
    let preflight = null;
    let token = null;
    let payment = null;
    if (t.url) {
        let offer = t.offer ?? null;
        if (!offer && o.probe !== false) {
            try {
                const r = await (o.fetch ?? globalThis.fetch)(t.url, {
                    method: t.method ?? "GET",
                    headers: { "content-type": "application/json", "user-agent": `angel-agent-guard/${VERSION}` },
                    ...((t.method ?? "GET") === "POST" ? { body: "{}" } : {}),
                    signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
                });
                if (r.status === 402)
                    offer = decodeOffer(r.headers.get("payment-required"));
                else
                    reasons.push(`[info] probe: HTTP ${r.status}, no x402 offer (regular page, checkout or API).`);
            }
            catch (e) {
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
            const c = await post(PATHS.preflight, { url: t.url, method: t.method ?? "GET" }, o);
            if (c.status === 200 && c.body) {
                preflight = c.body;
                const pv = c.body.verdict;
                const mapped = pv === "pay" ? "pay" : pv === "do_not_pay" ? "do_not_pay" : "caution";
                verdict = ran ? vmax(verdict, mapped) : mapped;
                ran++;
                if (Array.isArray(c.body.reasons))
                    reasons.push(...c.body.reasons.map((r) => `preflight ${r}`));
            }
            else if (c.status === 402) {
                payment = paymentFrom(c);
                errors.push("preflight: payment_required (free calls used); pass a paying fetch to continue");
            }
            else {
                errors.push(`preflight: ${c.error ?? `HTTP ${c.status}`}`);
            }
        }
    }
    if (t.token) {
        if (o.remote === false) {
            errors.push("token: needs the remote check (remote: false)");
        }
        else {
            const c = await post(PATHS.tokenRisk, { token: t.token, chain: t.chain ?? "base" }, o);
            if (c.status === 200 && c.body) {
                token = c.body;
                const risk = c.body.risk;
                const mapped = risk === "low" ? "pay" : risk === "medium" ? "caution" : "do_not_pay";
                verdict = ran ? vmax(verdict, mapped) : mapped;
                ran++;
                if (Array.isArray(c.body.reasons))
                    reasons.push(...c.body.reasons.map((r) => `token ${r}`));
            }
            else if (c.status === 402) {
                payment = paymentFrom(c);
                errors.push("token: payment_required (free calls used); pass a paying fetch to continue");
            }
            else {
                errors.push(`token: ${c.error ?? `HTTP ${c.status}`}`);
            }
        }
    }
    if (!t.url && !t.token)
        errors.push("nothing to check: pass a url and/or a token");
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const obj = (v) => (v && typeof v === "object" ? v : null);
    return {
        ok: ran > 0 && verdict === "pay", verdict: ran ? verdict : "unchecked",
        riskScore: num(preflight?.risk_score), kind: typeof preflight?.kind === "string" ? preflight.kind : null,
        merchant: obj(preflight?.merchant_signals), injection: obj(preflight?.injection_check),
        reasons, local, preflight, token, payment, errors,
    };
}
