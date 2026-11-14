#!/usr/bin/env node
/**
 * angel-agent-guard CLI
 *   angel-agent-guard scan "<text>" | scan https://example.com/page   → guardUntrusted
 *   angel-agent-guard scan -                                          → reads stdin
 *   angel-agent-guard verify https://api.example.com/paid [--get] [--token 0x… --chain base]
 *   angel-agent-guard quick "<text>"                                  → local only, offline
 * Prints JSON. Exit code: 0 clean/pay, 1 caution/unchecked, 2 hostile/do_not_pay, 3 usage or error.
 * Env: ANGEL_PAYER_ADDRESS, ANGEL_AGENT_PRIVATE_KEY (auto-pay, needs viem), ANGEL_MAX_USDC, ANGEL_BASE_URL.
 */
export {};
