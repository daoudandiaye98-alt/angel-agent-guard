#!/usr/bin/env node
/**
 * angel-agent-guard CLI
 *   angel-agent-guard scan "<text>" | scan https://example.com/page   → guardUntrusted
 *   angel-agent-guard scan -                                          → reads stdin
 *   angel-agent-guard verify https://shop.example.com/checkout [--post] [--token 0x… --chain base]
 *   angel-agent-guard quick "<text>"                                  → local only, offline
 * Prints JSON. Exit code: 0 clean/pay, 1 caution/unchecked, 2 hostile/do_not_pay, 3 usage or error.
 * Env: ANGEL_PAYER_ADDRESS, ANGEL_AGENT_PRIVATE_KEY (auto-pay, needs viem), ANGEL_MAX_USDC, ANGEL_BASE_URL.
 */
import { guardUntrusted, verifyBeforePay } from "./guard.js";
import { quickScan } from "./local.js";
import { optionsFromEnv } from "./mcp.js";
async function readStdin() {
    const chunks = [];
    for await (const c of process.stdin)
        chunks.push(c);
    return Buffer.concat(chunks).toString("utf8");
}
const USAGE = `usage:
  angel-agent-guard scan "<text>" | <https-url> | -
  angel-agent-guard verify <https-url> [--post] [--token 0x...] [--chain base|ethereum]
  angel-agent-guard verify --token 0x... [--chain base|ethereum]
  angel-agent-guard quick "<text>" | -`;
async function main(argv) {
    const [cmd, ...rest] = argv;
    const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
    const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--token", "--chain"].includes(rest[i - 1] ?? "")));
    const o = await optionsFromEnv();
    if (cmd === "scan" || cmd === "quick") {
        let input = positional[0];
        if (input === "-" || (input === undefined && !process.stdin.isTTY))
            input = await readStdin();
        if (!input) {
            console.error(USAGE);
            return 3;
        }
        if (cmd === "quick") {
            const q = quickScan(input);
            console.log(JSON.stringify(q, null, 2));
            return q.findings.some((f) => f.severity === "high") ? 2 : q.suspicious ? 1 : 0;
        }
        const r = await guardUntrusted(input, o);
        console.log(JSON.stringify(r, null, 2));
        return r.verdict === "clean" ? 0 : r.verdict === "hostile" ? 2 : 1;
    }
    if (cmd === "verify") {
        const url = positional[0];
        const token = flag("--token");
        if (!url && !token) {
            console.error(USAGE);
            return 3;
        }
        const chain = flag("--chain") === "ethereum" ? "ethereum" : "base";
        const r = await verifyBeforePay({ url, token, chain, method: rest.includes("--post") ? "POST" : "GET" }, o);
        console.log(JSON.stringify(r, null, 2));
        return r.verdict === "pay" ? 0 : r.verdict === "do_not_pay" ? 2 : 1;
    }
    console.error(USAGE);
    return 3;
}
main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(3); });
