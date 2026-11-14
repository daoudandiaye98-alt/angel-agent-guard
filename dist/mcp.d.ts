#!/usr/bin/env node
/**
 * angel-agent-guard-mcp — a local stdio MCP server with three tools:
 *   guard_untrusted   check untrusted text or a URL before the model reads it
 *   verify_before_pay check an x402 endpoint and/or an ERC-20 before money moves
 *   quick_scan        local-only pass (invisible Unicode, tag smuggling, exfiltration images), free, offline
 *
 * Env (all optional):
 *   ANGEL_PAYER_ADDRESS   your wallet address: its own 3 free hosted calls
 *   ANGEL_AGENT_PRIVATE_KEY  enables automatic x402 payment (needs `npm i viem`); keep it a low-balance hot wallet
 *   ANGEL_MAX_USDC        per-payment cap, default 1.00
 *   ANGEL_BASE_URL        default https://angel.oroboros-design.com
 */
import { type CommonOptions } from "./guard.js";
type Json = Record<string, unknown>;
export declare const TOOLS: readonly [{
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
    readonly title: "Check an x402 endpoint or ERC-20 before paying";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly url: {
                readonly type: "string";
                readonly pattern: "^https://";
                readonly description: "the paid endpoint you are about to pay";
            };
            readonly method: {
                readonly type: "string";
                readonly enum: readonly ["GET", "POST"];
                readonly description: "its HTTP method, default POST";
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
