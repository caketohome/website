import type {
    AIProvider,
    AICompleteInput,
    AICompleteResult,
    AIForecastInput,
    AIForecastResult,
    AIClassifyInput,
    AIClassifyResult,
} from "../types/provider";

/**
 * Stub AI provider. Returns deterministic placeholder output.
 * Wire a real provider (OpenAI, Vertex AI) in production via Settings (ai group).
 */
export class StubAIProvider implements AIProvider {
    readonly identifier = "ai-stub";

    async complete(input: AICompleteInput): Promise<AICompleteResult> {
        return {
            text: `[CakeToHome AI stub] ${input.prompt.slice(0, 100)}`,
            usage: {
                prompt_tokens: input.prompt.length,
                completion_tokens: 0,
                total_tokens: input.prompt.length,
            },
        };
    }

    async forecast(input: AIForecastInput): Promise<AIForecastResult> {
        const last = input.data[input.data.length - 1] ?? 0;
        const forecast = Array.from({ length: input.horizon }, (_, i) =>
            Math.max(0, last * (1 + 0.01 * (i + 1)))
        );
        return { forecast, confidence: 0.5 };
    }

    async classify(input: AIClassifyInput): Promise<AIClassifyResult> {
        return {
            category: input.categories[0] ?? "unknown",
            confidence: 0.5,
        };
    }
}
