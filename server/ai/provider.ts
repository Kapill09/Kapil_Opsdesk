/**
 * LLM Provider Abstraction
 *
 * Isolates all provider-specific logic so the rest of OpsDesk
 * never imports a vendor SDK directly.
 *
 * Supported providers: openai (default), any OpenAI-compatible API.
 *
 * Environment variables:
 *   LLM_API_KEY   – required, the provider API key
 *   LLM_MODEL     – optional, defaults to "gpt-4o-mini"
 *   LLM_BASE_URL  – optional, defaults to OpenAI endpoint
 *   LLM_PROVIDER  – optional, defaults to "openai"
 */

// ─── Types ───────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 503,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

// ─── Configuration ───────────────────────────────────────────────

export function getLLMConfig() {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  const provider = process.env.LLM_PROVIDER || 'openai';

  return { apiKey, model, baseUrl, provider };
}

export function isLLMConfigured(): boolean {
  return !!process.env.LLM_API_KEY;
}

// ─── Provider Implementation ─────────────────────────────────────

/**
 * Generate an LLM response using the configured provider.
 * Uses a raw fetch to avoid adding a heavy SDK dependency.
 */
export async function generateCompletion(request: LLMRequest): Promise<LLMResponse> {
  const { apiKey, model, baseUrl } = getLLMConfig();

  if (!apiKey) {
    throw new LLMProviderError(
      'LLM provider is not configured. Set LLM_API_KEY environment variable.',
      503,
      false,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1024,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        throw new LLMProviderError('Invalid LLM API key.', 503, false);
      }
      if (status === 429) {
        throw new LLMProviderError('LLM rate limit exceeded. Try again later.', 429, true);
      }
      if (status >= 500) {
        throw new LLMProviderError('LLM provider is temporarily unavailable.', 503, true);
      }
      throw new LLMProviderError(`LLM provider error (HTTP ${status}).`, 503, false);
    }

    const data = await response.json();

    const choice = data.choices?.[0];
    if (!choice?.message?.content) {
      throw new LLMProviderError('LLM returned an empty or malformed response.', 502, true);
    }

    return {
      content: choice.message.content,
      finishReason: choice.finish_reason ?? 'unknown',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    if (error instanceof LLMProviderError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new LLMProviderError('LLM request timed out after 30 seconds.', 504, true);
    }
    throw new LLMProviderError(
      'Failed to connect to LLM provider.',
      503,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}
