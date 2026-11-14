/**
 * Coinbase AgentKit integration: an action provider with Angel's security and preflight suite.
 *
 *   import { AgentKit } from "@coinbase/agentkit";
 *   import { angelGuardActionProvider } from "angel-agent-guard/agentkit";
 *   const agentkit = await AgentKit.from({ walletProvider, actionProviders: [angelGuardActionProvider()] });
 *
 * The agent's own EVM wallet provider signs x402 payments (USDC on Base, at most `maxUsdc` per call, default 1.00).
 * Peer dependencies: @coinbase/agentkit, zod (v3, as used by AgentKit).
 */
import { type EvmWalletProvider } from "@coinbase/agentkit";
import { z } from "zod";
import { type TypedDataSigner } from "./pay.js";
export interface AngelGuardActionOptions {
    /** per-payment cap in USDC; default 1.00 */
    maxUsdc?: number;
    /** false: never pay, only use the free calls and the local checks */
    pay?: boolean;
    /** default https://angel.oroboros-design.com */
    baseUrl?: string;
}
export declare const GuardUntrustedSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url?: string | undefined;
    text?: string | undefined;
}, {
    url?: string | undefined;
    text?: string | undefined;
}>;
export declare const VerifyBeforePaySchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
    method: z.ZodOptional<z.ZodEnum<["GET", "POST"]>>;
    token: z.ZodOptional<z.ZodString>;
    chain: z.ZodOptional<z.ZodEnum<["base", "ethereum"]>>;
}, "strip", z.ZodTypeAny, {
    url?: string | undefined;
    method?: "POST" | "GET" | undefined;
    token?: string | undefined;
    chain?: "base" | "ethereum" | undefined;
}, {
    url?: string | undefined;
    method?: "POST" | "GET" | undefined;
    token?: string | undefined;
    chain?: "base" | "ethereum" | undefined;
}>;
export declare const QuickScanSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
/** Adapter: AgentKit EVM wallet provider → x402 typed-data signer. */
export declare function walletSigner(w: EvmWalletProvider): TypedDataSigner;
export declare function angelGuardActionProvider(opts?: AngelGuardActionOptions): import("@coinbase/agentkit").CustomActionProvider<EvmWalletProvider>;
