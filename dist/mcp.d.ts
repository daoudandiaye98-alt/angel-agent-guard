#!/usr/bin/env node
/**
 * angel-agent-guard-mcp — a local stdio MCP server with five tools:
 *   shield_check      Angel Shield: allow, hold or block a payment before the agent makes it
 *   read_safe_url     read a URL as clean, injection-scrubbed Markdown
 *   guard_untrusted   check untrusted text or a URL before the model reads it
 *   verify_before_pay check an x402 endpoint and/or an ERC-20 before money moves
 *   quick_scan        local-only pass (invisible Unicode, tag smuggling, exfiltration images), free, offline
 *
 * Env (all optional):
 *   ANGEL_PAYER_ADDRESS   your wallet address: its own 3 free hosted calls
 *   ANGEL_AGENT_PRIVATE_KEY  enables automatic x402 payment (needs `npm i viem`); keep it a low-balance hot wallet
 *   ANGEL_MAX_USDC        per-payment cap, default 1.00
 *   ANGEL_BASE_URL        default https://angel.oroboros-design.com
 *   ANGEL_BUNDLE_TOKEN    your Angel key (pass, pack or free Shield key) for shield_check and every hosted check
 *   ANGEL_SHIELD_POLICY   a stored Shield policy id (pol_…) used when shield_check gets none
 */
import { type CommonOptions } from "./guard.js";
type Json = Record<string, unknown>;
export declare const TOOLS: readonly [{
    readonly name: "shield_check";
    readonly title: "Angel Shield: allow, hold or block a payment before it happens";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly amount_usd: {
                readonly type: "number";
                readonly exclusiveMinimum: 0;
                readonly description: "the amount you are about to pay, in USD";
            };
            readonly merchant_url: {
                readonly type: "string";
                readonly pattern: "^https://";
                readonly description: "shop, checkout or payment link, API or x402 endpoint";
            };
            readonly pay_to: {
                readonly type: "string";
                readonly pattern: "^0x[0-9a-fA-F]{40}$";
                readonly description: "recipient address when there is no URL";
            };
            readonly chain: {
                readonly type: "string";
                readonly description: "base, ethereum or eip155:<id>";
            };
            readonly asset: {
                readonly type: "string";
                readonly description: "USDC or a token address";
            };
            readonly trigger: {
                readonly type: "string";
                readonly maxLength: 100000;
                readonly description: "the message or instruction that made you want to pay";
            };
            readonly policy_id: {
                readonly type: "string";
                readonly pattern: "^pol_[A-Za-z0-9]{8,40}$";
                readonly description: "stored policy (default: env ANGEL_SHIELD_POLICY)";
            };
            readonly max_per_payment_usd: {
                readonly type: "number";
                readonly minimum: 0;
                readonly description: "inline cap when no stored policy is used";
            };
        };
        readonly required: readonly ["amount_usd"];
        readonly additionalProperties: false;
    };
    readonly annotations: {
        readonly readOnlyHint: false;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "read_safe_url";
    readonly title: "Read a URL as clean, injection-scrubbed Markdown";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly url: {
                readonly type: "string";
                readonly pattern: "^https://";
                readonly description: "the public https page to read";
            };
        };
        readonly required: readonly ["url"];
        readonly additionalProperties: false;
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "guard_untrusted";
    readonly title: "Check untrusted content for prompt injection";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly text: {
                readonly type: "string";
                readonly maxLength: 100000;
                readonly description: "the untrusted content";
            };
            readonly url: {
                readonly type: "string";
                readonly pattern: "^https://";
                readonly description: "a public https page to fetch and check instead of text";
            };
        };
        readonly additionalProperties: false;
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "verify_before_pay";
    readonly title: "Check a shop, checkout link, API or token before paying";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly url: {
                readonly type: "string";
                readonly pattern: "^https://";
                readonly description: "the shop or product page, checkout or payment link, API or x402 endpoint";
            };
            readonly method: {
                readonly type: "string";
                readonly enum: readonly ["GET", "POST"];
                readonly description: "HTTP method you will use, default GET";
            };
            readonly token: {
                readonly type: "string";
                readonly pattern: "^0x[0-9a-fA-F]{40}$";
                readonly description: "ERC-20 contract you are about to swap into or approve";
            };
            readonly chain: {
                readonly type: "string";
                readonly enum: readonly ["base", "ethereum"];
                readonly description: "chain of the token, default base";
            };
        };
        readonly additionalProperties: false;
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "quick_scan";
    readonly title: "Local scan for invisible characters (offline)";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly text: {
                readonly type: "string";
                readonly maxLength: 1000000;
            };
        };
        readonly required: readonly ["text"];
        readonly additionalProperties: false;
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: false;
    };
}];
export declare function optionsFromEnv(env?: NodeJS.ProcessEnv): Promise<CommonOptions & {
    maxAmountAtomic: bigint;
}>;
export declare function callTool(name: string, args: Json, o: CommonOptions & {
    maxAmountAtomic?: bigint;
}): Promise<Json>;
/** Handle one JSON-RPC message; returns the response or null for notifications. */
export declare function handle(msg: Json, o: CommonOptions & {
    maxAmountAtomic?: bigint;
}): Promise<Json | null>;
export {};
