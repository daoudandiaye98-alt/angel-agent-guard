import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { handle, TOOLS } from "../dist/mcp.js";

test("MCP: initialize, tools/list, quick_scan via handle(); notifications get no answer", async () => {
  const init = await handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, {});
  assert.equal(init.result.protocolVersion, "2025-06-18"); assert.equal(init.result.serverInfo.name, "angel-agent-guard");
  const list = await handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }, {});
  assert.deepEqual(list.result.tools.map((t) => t.name), ["shield_check", "read_safe_url", "guard_untrusted", "verify_before_pay", "quick_scan"]);
  const q = await handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "quick_scan", arguments: { text: "a​b" } } }, {});
  assert.equal(q.result.structuredContent.suspicious, true);
  assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }, {}), null);
  const bad = await handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope", arguments: {} } }, {});
  assert.equal(bad.result.isError, true);
  for (const t of TOOLS) assert.ok(t.description.length <= 800);
});

test("MCP: the stdio binary answers line-delimited JSON-RPC", async () => {
  const child = spawn(process.execPath, [new URL("../dist/mcp.js", import.meta.url).pathname], { stdio: ["pipe", "pipe", "inherit"] });
  const lines = [];
  child.stdout.setEncoding("utf8");
  const done = new Promise((ok) => child.stdout.on("data", (d) => { lines.push(...d.split("\n").filter(Boolean)); if (lines.length >= 2) ok(); }));
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
  await done; child.kill();
  assert.equal(JSON.parse(lines[0]).result.serverInfo.name, "angel-agent-guard");
  assert.equal(JSON.parse(lines[1]).result.tools.length, 5);
});
