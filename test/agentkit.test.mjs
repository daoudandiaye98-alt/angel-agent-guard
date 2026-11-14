import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { angelGuardActionProvider } from "../dist/agentkit.js";

// AgentKit sends its own usage analytics on every action; keep the test offline.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => (String(url).includes("cca-lite.coinbase.com") ? new Response("{}", { status: 200 }) : realFetch(url, init));

test("AgentKit: provider exposes three actions; the wallet provider is the x402 signer", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = { getName: () => "test_wallet", getAddress: () => account.address, getNetwork: () => ({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }), signTypedData: (td) => account.signTypedData(td) };
  const provider = angelGuardActionProvider({ pay: false });
  const actions = provider.getActions(wallet);
  assert.deepEqual(actions.map((a) => a.name.replace(/^.*_(guard_untrusted_content|verify_before_pay|quick_scan_untrusted_text)$/, "$1")), ["guard_untrusted_content", "verify_before_pay", "quick_scan_untrusted_text"]);
  const quick = actions.find((a) => a.name.endsWith("quick_scan_untrusted_text"));
  assert.equal(JSON.parse(await quick.invoke({ text: "a​b" })).suspicious, true);
  const guard = actions.find((a) => a.name.endsWith("guard_untrusted_content"));
  assert.match(await guard.invoke({}), /send text or url/);
  assert.equal(provider.supportsNetwork({ protocolFamily: "evm" }), true);
});
