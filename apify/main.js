/**
 * Safe Web Reader for LLMs — an Apify Actor around Angel's stealth-read
 * (https://angel.oroboros-design.com/llms.txt).
 *
 * For each URL: the main content as clean Markdown (navigation, scripts and HTML hidden from people removed), text aimed
 * at the model replaced by ⟦removed: …⟧, invisible Unicode stripped, plus an injection verdict and findings for the page.
 * One GET as a declared bot: no login, paywall, CAPTCHA or bot-protection bypass. Blocked pages, errors and unsupported
 * types are reported and never charged (event "page-read" only on success).
 */
import { Actor } from "apify";

const ENDPOINT = "https://angel.oroboros-design.com/agenten/signal/stealth-read";
const MAX_URLS = 1000;

await Actor.init();
const input = (await Actor.getInput()) ?? {};
const urls = [...new Set((input.startUrls ?? [])
  .map((s) => (typeof s === "string" ? s : s?.url))
  .filter((u) => typeof u === "string" && /^https:\/\/\S+$/i.test(u.trim()))
  .map((u) => u.trim()))].slice(0, MAX_URLS);
if (!urls.length) {
  await Actor.fail("Add at least one https URL to startUrls.");
}
const token = process.env.ANGEL_BUNDLE_TOKEN;
if (!token) await Actor.fail("Missing ANGEL_BUNDLE_TOKEN (Actor owner setting).");

let read = 0, failed = 0;
for (const url of urls) {
  let status = 0, body = null;
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-bundle-token": token, "user-agent": "angel-apify-safe-web-reader/1.0" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30_000),
    });
    status = r.status;
    body = await r.json().catch(() => null);
  } catch (e) {
    body = { error: e instanceof Error ? e.message : String(e) };
  }
  if (status === 200 && body && typeof body.markdown === "string") {
    const hostile = body.verdict === "hostile";
    await Actor.pushData({
      url: body.url ?? url, requestedUrl: url, title: body.title ?? null, lang: body.lang ?? null,
      verdict: body.verdict, score: body.score, words: body.words, chars: body.chars, truncated: body.truncated === true,
      markdown: input.dropHostile && hostile ? null : body.markdown,
      ...(input.includeFindings === false ? {} : { findings: body.findings ?? [] }),
      removed: body.removed ?? null, extractedFrom: body.extracted_from ?? null, fetchedAt: body.asof ?? new Date().toISOString(), error: null,
    });
    await Actor.charge({ eventName: "page-read" });
    read += 1;
  } else {
    const why = body?.message ?? body?.error ?? `HTTP ${status}`;
    await Actor.pushData({ url, requestedUrl: url, title: null, verdict: null, score: null, words: 0, markdown: null, error: `${why} (not charged)` });
    failed += 1;
  }
}
await Actor.setStatusMessage(`${read} page(s) read, ${failed} not read (not charged).`);
await Actor.exit();
