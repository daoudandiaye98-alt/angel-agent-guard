// node examples/agent-loop.mjs https://example.com/
// Read a page the way an agent should: check it, then pass the cleaned text to the model as fenced data.
import { guardUntrusted, fence } from "angel-agent-guard";

const url = process.argv[2] ?? "https://example.com/";
const html = await fetch(url).then((r) => r.text());
const g = await guardUntrusted(html, { payerAddress: process.env.ANGEL_PAYER_ADDRESS });

if (g.action === "drop") {
  console.log(`dropped ${url}: ${g.findings.map((f) => f.kind).join(", ")}`);
} else {
  const context = fence(url, g.cleaned ?? html);
  console.log(`${g.verdict} → ${g.action}; ${context.length} chars of fenced context ready for the model`);
}
