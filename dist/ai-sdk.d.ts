/**
 * Vercel AI SDK tools (AI SDK 5, 6 and 7).
 *
 *   import { generateText, isStepCount } from "ai";
 *   import { verifyBeforePay, guardUntrusted } from "angel-agent-guard/ai-sdk";
 *
 *   const { text } = await generateText({
 *     model: "openai/gpt-5-mini",
 *     prompt: "Is https://shop.example.com/checkout safe to pay?",
 *     tools: { verifyBeforePay: verifyBeforePay(), guardUntrusted: guardUntrusted() },
 *     stopWhen: isStepCount(3),
 *   });
 *
 * Peer dependency: ai. Every factory takes the same options as the core functions
 * (payerAddress, apiKey, fetch, baseUrl, timeoutMs, remote), plus `privateKey` and `maxUsdc`
 * to pay x402 automatically after the 3 free calls (needs the optional peer `viem`).
 */
import { type CommonOptions, type VerifyOptions } from "./guard.js";
export interface AiSdkToolOptions extends CommonOptions {
    /** hex private key of a low-balance agent wallet; pays x402 (USDC on Base) after the free calls. Needs `viem`. */
    privateKey?: string;
    /** per-payment cap in USDC when paying; default 1.00 */
    maxUsdc?: number;
}
interface GuardInput {
    text?: string;
    url?: string;
}
interface VerifyInput {
    url?: string;
    method?: "GET" | "POST";
    token?: string;
    chain?: "base" | "ethereum";
}
/** Prompt-injection check for content the agent did not write, before the model acts on it. */
export declare function guardUntrusted(o?: AiSdkToolOptions): ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<GuardInput>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<GuardInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: GuardInput;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: GuardInput;
        output: NoInfer<{
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<GuardInput, {
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    description?: string | ((options: {
        context: NoInfer<import("@ai-sdk/provider-utils").Context>;
        experimental_sandbox?: import("ai").Experimental_SandboxSession;
    }) => string) | undefined;
    strict?: boolean;
    inputExamples?: {
        input: NoInfer<GuardInput>;
    }[] | undefined;
    id?: never;
    isProviderExecuted?: never;
    args?: never;
    supportsDeferredResults?: never;
} & {
    type?: undefined | "function";
} & {
    execute: import("ai").ToolExecuteFunction<GuardInput, {
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<GuardInput>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<GuardInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: GuardInput;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: GuardInput;
        output: NoInfer<{
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<GuardInput, {
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    description?: string | ((options: {
        context: NoInfer<import("@ai-sdk/provider-utils").Context>;
        experimental_sandbox?: import("ai").Experimental_SandboxSession;
    }) => string) | undefined;
    strict?: boolean;
    inputExamples?: {
        input: NoInfer<GuardInput>;
    }[] | undefined;
    id?: never;
    isProviderExecuted?: never;
    args?: never;
    supportsDeferredResults?: never;
} & {
    type: "dynamic";
} & {
    execute: import("ai").ToolExecuteFunction<GuardInput, {
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<GuardInput>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<GuardInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: GuardInput;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: GuardInput;
        output: NoInfer<{
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<GuardInput, {
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    type: "provider";
    id: `${string}.${string}`;
    args: Record<string, unknown>;
    description?: never;
    strict?: never;
    inputExamples?: never;
} & {
    isProviderExecuted: false;
    supportsDeferredResults?: never;
} & {
    execute: import("ai").ToolExecuteFunction<GuardInput, {
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<GuardInput>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<GuardInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: GuardInput;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: GuardInput;
        output: NoInfer<{
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<GuardInput, {
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    type: "provider";
    id: `${string}.${string}`;
    args: Record<string, unknown>;
    description?: never;
    strict?: never;
    inputExamples?: never;
} & {
    isProviderExecuted: true;
    supportsDeferredResults?: boolean;
} & {
    execute: import("ai").ToolExecuteFunction<GuardInput, {
        verdict: import("./guard.js").GuardVerdict;
        action: import("./guard.js").GuardAction;
        score: number | null;
        findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
        cleaned: string | null;
        hiddenMessage: string | null;
        payment: import("./guard.js").PaymentNeeded | null;
        error: string | null;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
});
/** Pre-purchase check for any shop, checkout or payment link, paid API, x402 endpoint or ERC-20. */
export declare function verifyBeforePay(o?: AiSdkToolOptions & Pick<VerifyOptions, "maxAmountAtomic" | "networks" | "probe">): ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<VerifyInput>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<VerifyInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: VerifyInput;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: VerifyInput;
        output: NoInfer<{
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<VerifyInput, {
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    description?: string | ((options: {
        context: NoInfer<import("@ai-sdk/provider-utils").Context>;
        experimental_sandbox?: import("ai").Experimental_SandboxSession;
    }) => string) | undefined;
    strict?: boolean;
    inputExamples?: {
        input: NoInfer<VerifyInput>;
    }[] | undefined;
    id?: never;
    isProviderExecuted?: never;
    args?: never;
    supportsDeferredResults?: never;
} & {
    type?: undefined | "function";
} & {
    execute: import("ai").ToolExecuteFunction<VerifyInput, {
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<VerifyInput>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<VerifyInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: VerifyInput;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: VerifyInput;
        output: NoInfer<{
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<VerifyInput, {
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    description?: string | ((options: {
        context: NoInfer<import("@ai-sdk/provider-utils").Context>;
        experimental_sandbox?: import("ai").Experimental_SandboxSession;
    }) => string) | undefined;
    strict?: boolean;
    inputExamples?: {
        input: NoInfer<VerifyInput>;
    }[] | undefined;
    id?: never;
    isProviderExecuted?: never;
    args?: never;
    supportsDeferredResults?: never;
} & {
    type: "dynamic";
} & {
    execute: import("ai").ToolExecuteFunction<VerifyInput, {
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<VerifyInput>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<VerifyInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: VerifyInput;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: VerifyInput;
        output: NoInfer<{
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<VerifyInput, {
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    type: "provider";
    id: `${string}.${string}`;
    args: Record<string, unknown>;
    description?: never;
    strict?: never;
    inputExamples?: never;
} & {
    isProviderExecuted: false;
    supportsDeferredResults?: never;
} & {
    execute: import("ai").ToolExecuteFunction<VerifyInput, {
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<VerifyInput>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<VerifyInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: VerifyInput;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: VerifyInput;
        output: NoInfer<{
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<VerifyInput, {
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    type: "provider";
    id: `${string}.${string}`;
    args: Record<string, unknown>;
    description?: never;
    strict?: never;
    inputExamples?: never;
} & {
    isProviderExecuted: true;
    supportsDeferredResults?: boolean;
} & {
    execute: import("ai").ToolExecuteFunction<VerifyInput, {
        ok: boolean;
        verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
        riskScore: number | null;
        kind: string | null;
        reasons: string[];
        merchant: Record<string, unknown> | null;
        injection: Record<string, unknown> | null;
        partnerLink: {
            url: string;
            network: string;
            same_merchant: boolean;
            disclosure: string;
        } | null;
        payment: import("./guard.js").PaymentNeeded | null;
        errors: string[];
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
});
/** Offline pass: invisible Unicode, tag smuggling, exfiltration images. No network, no cost. */
export declare function quickScanUntrusted(): ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<{
        text: string;
    }>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
        text: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: {
            text: string;
        };
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: {
            text: string;
        };
        output: NoInfer<{
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<{
        text: string;
    }, {
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    description?: string | ((options: {
        context: NoInfer<import("@ai-sdk/provider-utils").Context>;
        experimental_sandbox?: import("ai").Experimental_SandboxSession;
    }) => string) | undefined;
    strict?: boolean;
    inputExamples?: {
        input: NoInfer<{
            text: string;
        }>;
    }[] | undefined;
    id?: never;
    isProviderExecuted?: never;
    args?: never;
    supportsDeferredResults?: never;
} & {
    type?: undefined | "function";
} & {
    execute: import("ai").ToolExecuteFunction<{
        text: string;
    }, {
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<{
        text: string;
    }>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
        text: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: {
            text: string;
        };
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: {
            text: string;
        };
        output: NoInfer<{
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<{
        text: string;
    }, {
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    description?: string | ((options: {
        context: NoInfer<import("@ai-sdk/provider-utils").Context>;
        experimental_sandbox?: import("ai").Experimental_SandboxSession;
    }) => string) | undefined;
    strict?: boolean;
    inputExamples?: {
        input: NoInfer<{
            text: string;
        }>;
    }[] | undefined;
    id?: never;
    isProviderExecuted?: never;
    args?: never;
    supportsDeferredResults?: never;
} & {
    type: "dynamic";
} & {
    execute: import("ai").ToolExecuteFunction<{
        text: string;
    }, {
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<{
        text: string;
    }>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
        text: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: {
            text: string;
        };
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: {
            text: string;
        };
        output: NoInfer<{
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<{
        text: string;
    }, {
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    type: "provider";
    id: `${string}.${string}`;
    args: Record<string, unknown>;
    description?: never;
    strict?: never;
    inputExamples?: never;
} & {
    isProviderExecuted: false;
    supportsDeferredResults?: never;
} & {
    execute: import("ai").ToolExecuteFunction<{
        text: string;
    }, {
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
}) | ({
    deferLoading?: boolean;
    title?: string;
    providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
    metadata?: import("@ai-sdk/provider").JSONObject;
    inputSchema: import("ai").FlexibleSchema<{
        text: string;
    }>;
    contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
    needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
        text: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
    onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputDelta?: ((options: {
        inputTextDelta: string;
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    onInputAvailable?: ((options: {
        input: {
            text: string;
        };
    } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
    toModelOutput?: ((options: {
        toolCallId: string;
        input: {
            text: string;
        };
        output: NoInfer<{
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }>;
    }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
} & {
    outputSchema?: import("ai").FlexibleSchema<{
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }> | undefined;
    execute: import("ai").ToolExecuteFunction<{
        text: string;
    }, {
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
} & {
    type: "provider";
    id: `${string}.${string}`;
    args: Record<string, unknown>;
    description?: never;
    strict?: never;
    inputExamples?: never;
} & {
    isProviderExecuted: true;
    supportsDeferredResults?: boolean;
} & {
    execute: import("ai").ToolExecuteFunction<{
        text: string;
    }, {
        suspicious: boolean;
        findings: import("./local.js").LocalFinding[];
        cleaned: string;
    }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
});
/** All three tools, ready to spread into `tools`. */
export declare function angelGuardTools(o?: AiSdkToolOptions): {
    guardUntrusted: ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<GuardInput>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<GuardInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: GuardInput;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: GuardInput;
            output: NoInfer<{
                verdict: import("./guard.js").GuardVerdict;
                action: import("./guard.js").GuardAction;
                score: number | null;
                findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
                cleaned: string | null;
                hiddenMessage: string | null;
                payment: import("./guard.js").PaymentNeeded | null;
                error: string | null;
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<GuardInput, {
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        description?: string | ((options: {
            context: NoInfer<import("@ai-sdk/provider-utils").Context>;
            experimental_sandbox?: import("ai").Experimental_SandboxSession;
        }) => string) | undefined;
        strict?: boolean;
        inputExamples?: {
            input: NoInfer<GuardInput>;
        }[] | undefined;
        id?: never;
        isProviderExecuted?: never;
        args?: never;
        supportsDeferredResults?: never;
    } & {
        type?: undefined | "function";
    } & {
        execute: import("ai").ToolExecuteFunction<GuardInput, {
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<GuardInput>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<GuardInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: GuardInput;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: GuardInput;
            output: NoInfer<{
                verdict: import("./guard.js").GuardVerdict;
                action: import("./guard.js").GuardAction;
                score: number | null;
                findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
                cleaned: string | null;
                hiddenMessage: string | null;
                payment: import("./guard.js").PaymentNeeded | null;
                error: string | null;
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<GuardInput, {
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        description?: string | ((options: {
            context: NoInfer<import("@ai-sdk/provider-utils").Context>;
            experimental_sandbox?: import("ai").Experimental_SandboxSession;
        }) => string) | undefined;
        strict?: boolean;
        inputExamples?: {
            input: NoInfer<GuardInput>;
        }[] | undefined;
        id?: never;
        isProviderExecuted?: never;
        args?: never;
        supportsDeferredResults?: never;
    } & {
        type: "dynamic";
    } & {
        execute: import("ai").ToolExecuteFunction<GuardInput, {
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<GuardInput>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<GuardInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: GuardInput;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: GuardInput;
            output: NoInfer<{
                verdict: import("./guard.js").GuardVerdict;
                action: import("./guard.js").GuardAction;
                score: number | null;
                findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
                cleaned: string | null;
                hiddenMessage: string | null;
                payment: import("./guard.js").PaymentNeeded | null;
                error: string | null;
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<GuardInput, {
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        description?: never;
        strict?: never;
        inputExamples?: never;
    } & {
        isProviderExecuted: false;
        supportsDeferredResults?: never;
    } & {
        execute: import("ai").ToolExecuteFunction<GuardInput, {
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<GuardInput>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<GuardInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: GuardInput;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: GuardInput;
            output: NoInfer<{
                verdict: import("./guard.js").GuardVerdict;
                action: import("./guard.js").GuardAction;
                score: number | null;
                findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
                cleaned: string | null;
                hiddenMessage: string | null;
                payment: import("./guard.js").PaymentNeeded | null;
                error: string | null;
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<GuardInput, {
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        description?: never;
        strict?: never;
        inputExamples?: never;
    } & {
        isProviderExecuted: true;
        supportsDeferredResults?: boolean;
    } & {
        execute: import("ai").ToolExecuteFunction<GuardInput, {
            verdict: import("./guard.js").GuardVerdict;
            action: import("./guard.js").GuardAction;
            score: number | null;
            findings: (import("./local.js").LocalFinding | import("./guard.js").RemoteFinding)[];
            cleaned: string | null;
            hiddenMessage: string | null;
            payment: import("./guard.js").PaymentNeeded | null;
            error: string | null;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    });
    verifyBeforePay: ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<VerifyInput>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<VerifyInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: VerifyInput;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: VerifyInput;
            output: NoInfer<{
                ok: boolean;
                verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
                riskScore: number | null;
                kind: string | null;
                reasons: string[];
                merchant: Record<string, unknown> | null;
                injection: Record<string, unknown> | null;
                partnerLink: {
                    url: string;
                    network: string;
                    same_merchant: boolean;
                    disclosure: string;
                } | null;
                payment: import("./guard.js").PaymentNeeded | null;
                errors: string[];
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<VerifyInput, {
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        description?: string | ((options: {
            context: NoInfer<import("@ai-sdk/provider-utils").Context>;
            experimental_sandbox?: import("ai").Experimental_SandboxSession;
        }) => string) | undefined;
        strict?: boolean;
        inputExamples?: {
            input: NoInfer<VerifyInput>;
        }[] | undefined;
        id?: never;
        isProviderExecuted?: never;
        args?: never;
        supportsDeferredResults?: never;
    } & {
        type?: undefined | "function";
    } & {
        execute: import("ai").ToolExecuteFunction<VerifyInput, {
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<VerifyInput>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<VerifyInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: VerifyInput;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: VerifyInput;
            output: NoInfer<{
                ok: boolean;
                verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
                riskScore: number | null;
                kind: string | null;
                reasons: string[];
                merchant: Record<string, unknown> | null;
                injection: Record<string, unknown> | null;
                partnerLink: {
                    url: string;
                    network: string;
                    same_merchant: boolean;
                    disclosure: string;
                } | null;
                payment: import("./guard.js").PaymentNeeded | null;
                errors: string[];
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<VerifyInput, {
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        description?: string | ((options: {
            context: NoInfer<import("@ai-sdk/provider-utils").Context>;
            experimental_sandbox?: import("ai").Experimental_SandboxSession;
        }) => string) | undefined;
        strict?: boolean;
        inputExamples?: {
            input: NoInfer<VerifyInput>;
        }[] | undefined;
        id?: never;
        isProviderExecuted?: never;
        args?: never;
        supportsDeferredResults?: never;
    } & {
        type: "dynamic";
    } & {
        execute: import("ai").ToolExecuteFunction<VerifyInput, {
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<VerifyInput>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<VerifyInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: VerifyInput;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: VerifyInput;
            output: NoInfer<{
                ok: boolean;
                verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
                riskScore: number | null;
                kind: string | null;
                reasons: string[];
                merchant: Record<string, unknown> | null;
                injection: Record<string, unknown> | null;
                partnerLink: {
                    url: string;
                    network: string;
                    same_merchant: boolean;
                    disclosure: string;
                } | null;
                payment: import("./guard.js").PaymentNeeded | null;
                errors: string[];
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<VerifyInput, {
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        description?: never;
        strict?: never;
        inputExamples?: never;
    } & {
        isProviderExecuted: false;
        supportsDeferredResults?: never;
    } & {
        execute: import("ai").ToolExecuteFunction<VerifyInput, {
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<VerifyInput>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<VerifyInput, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: VerifyInput;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: VerifyInput;
            output: NoInfer<{
                ok: boolean;
                verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
                riskScore: number | null;
                kind: string | null;
                reasons: string[];
                merchant: Record<string, unknown> | null;
                injection: Record<string, unknown> | null;
                partnerLink: {
                    url: string;
                    network: string;
                    same_merchant: boolean;
                    disclosure: string;
                } | null;
                payment: import("./guard.js").PaymentNeeded | null;
                errors: string[];
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<VerifyInput, {
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        description?: never;
        strict?: never;
        inputExamples?: never;
    } & {
        isProviderExecuted: true;
        supportsDeferredResults?: boolean;
    } & {
        execute: import("ai").ToolExecuteFunction<VerifyInput, {
            ok: boolean;
            verdict: "caution" | "unchecked" | "pay" | "do_not_pay";
            riskScore: number | null;
            kind: string | null;
            reasons: string[];
            merchant: Record<string, unknown> | null;
            injection: Record<string, unknown> | null;
            partnerLink: {
                url: string;
                network: string;
                same_merchant: boolean;
                disclosure: string;
            } | null;
            payment: import("./guard.js").PaymentNeeded | null;
            errors: string[];
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    });
    quickScanUntrusted: ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<{
            text: string;
        }>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            text: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: {
                text: string;
            };
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                text: string;
            };
            output: NoInfer<{
                suspicious: boolean;
                findings: import("./local.js").LocalFinding[];
                cleaned: string;
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<{
            text: string;
        }, {
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        description?: string | ((options: {
            context: NoInfer<import("@ai-sdk/provider-utils").Context>;
            experimental_sandbox?: import("ai").Experimental_SandboxSession;
        }) => string) | undefined;
        strict?: boolean;
        inputExamples?: {
            input: NoInfer<{
                text: string;
            }>;
        }[] | undefined;
        id?: never;
        isProviderExecuted?: never;
        args?: never;
        supportsDeferredResults?: never;
    } & {
        type?: undefined | "function";
    } & {
        execute: import("ai").ToolExecuteFunction<{
            text: string;
        }, {
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<{
            text: string;
        }>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            text: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: {
                text: string;
            };
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                text: string;
            };
            output: NoInfer<{
                suspicious: boolean;
                findings: import("./local.js").LocalFinding[];
                cleaned: string;
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<{
            text: string;
        }, {
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        description?: string | ((options: {
            context: NoInfer<import("@ai-sdk/provider-utils").Context>;
            experimental_sandbox?: import("ai").Experimental_SandboxSession;
        }) => string) | undefined;
        strict?: boolean;
        inputExamples?: {
            input: NoInfer<{
                text: string;
            }>;
        }[] | undefined;
        id?: never;
        isProviderExecuted?: never;
        args?: never;
        supportsDeferredResults?: never;
    } & {
        type: "dynamic";
    } & {
        execute: import("ai").ToolExecuteFunction<{
            text: string;
        }, {
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<{
            text: string;
        }>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            text: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: {
                text: string;
            };
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                text: string;
            };
            output: NoInfer<{
                suspicious: boolean;
                findings: import("./local.js").LocalFinding[];
                cleaned: string;
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<{
            text: string;
        }, {
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        description?: never;
        strict?: never;
        inputExamples?: never;
    } & {
        isProviderExecuted: false;
        supportsDeferredResults?: never;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            text: string;
        }, {
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    }) | ({
        deferLoading?: boolean;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        metadata?: import("@ai-sdk/provider").JSONObject;
        inputSchema: import("ai").FlexibleSchema<{
            text: string;
        }>;
        contextSchema?: import("ai").FlexibleSchema<import("@ai-sdk/provider-utils").Context> | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            text: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>> | undefined;
        onInputStart?: ((options: import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputDelta?: ((options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        onInputAvailable?: ((options: {
            input: {
                text: string;
            };
        } & import("ai").ToolExecutionOptions<NoInfer<import("@ai-sdk/provider-utils").Context>>) => void | PromiseLike<void>) | undefined;
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                text: string;
            };
            output: NoInfer<{
                suspicious: boolean;
                findings: import("./local.js").LocalFinding[];
                cleaned: string;
            }>;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        outputSchema?: import("ai").FlexibleSchema<{
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }> | undefined;
        execute: import("ai").ToolExecuteFunction<{
            text: string;
        }, {
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        description?: never;
        strict?: never;
        inputExamples?: never;
    } & {
        isProviderExecuted: true;
        supportsDeferredResults?: boolean;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            text: string;
        }, {
            suspicious: boolean;
            findings: import("./local.js").LocalFinding[];
            cleaned: string;
        }, NoInfer<import("@ai-sdk/provider-utils").Context>>;
    });
};
export {};
