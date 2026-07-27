/**
 * AI provider abstraction.
 * Powers AI SEO, product descriptions, inventory/demand/sales forecasting,
 * fraud detection, customer segmentation, recommendations, and chatbot.
 * Providers (OpenAI, Vertex, etc.) implement this interface.
 */

export interface AICompleteInput {
    prompt: string;
    system?: string;
    max_tokens?: number;
    temperature?: number;
}

export interface AICompleteResult {
    text: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface AIForecastInput {
    data: number[];
    horizon: number;
}

export interface AIForecastResult {
    forecast: number[];
    confidence?: number;
}

export interface AIClassifyInput {
    input: string;
    categories: string[];
}

export interface AIClassifyResult {
    category: string;
    confidence: number;
}

export interface AIProvider {
    readonly identifier: string;
    complete(input: AICompleteInput): Promise<AICompleteResult>;
    forecast(input: AIForecastInput): Promise<AIForecastResult>;
    classify(input: AIClassifyInput): Promise<AIClassifyResult>;
}
