import type { ChatGatewayRequest } from '../application/chat-gateway'
import { geminiHttpStrategy, type GeminiResponse } from './provider-http-strategies'
import type { SseEvent } from './sse-events'
import {
  toAnthropicMessages,
  toGeminiContents,
  toOpenAiMessages,
} from './provider-message-mapping'

const MAX_OUTPUT_TOKENS = 2560

type AccumulationMode = 'append' | 'prefix-aware'

export interface StreamProviderStrategy<TPayload> {
  createRequest(request: ChatGatewayRequest): { readonly url: string; readonly init: RequestInit }
  parseEventPayload(event: SseEvent): TPayload | null
  extractErrorMessage(payload: TPayload): string | null
  extractText(payload: TPayload): string | null
  readonly accumulationMode: AccumulationMode
}

interface OpenAiStreamResponse {
  readonly choices?: Array<{
    readonly delta?: {
      readonly content?: string
    }
  }>
  readonly error?: {
    readonly message?: string
  }
}

const parseJsonPayload = <T>(text: string): T | null => {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export const openAiStreamStrategy: StreamProviderStrategy<OpenAiStreamResponse> = {
  createRequest: (request) => ({
    url: 'https://api.openai.com/v1/chat/completions',
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        stream: true,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: toOpenAiMessages(request),
      }),
      signal: request.signal,
    },
  }),
  parseEventPayload: (event) => {
    if (event.data === '[DONE]') {
      return null
    }

    return parseJsonPayload<OpenAiStreamResponse>(event.data)
  },
  extractErrorMessage: (payload) => payload.error?.message?.trim() ?? null,
  extractText: (payload) => payload.choices?.at(0)?.delta?.content ?? null,
  accumulationMode: 'append',
}

interface AnthropicStreamResponse {
  readonly type?: string
  readonly delta?: {
    readonly type?: string
    readonly text?: string
  }
  readonly error?: {
    readonly message?: string
  }
}

export const anthropicStreamStrategy: StreamProviderStrategy<AnthropicStreamResponse> = {
  createRequest: (request) => ({
    url: 'https://api.anthropic.com/v1/messages',
    init: {
      method: 'POST',
      headers: {
        'x-api-key': request.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        Accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
        system: request.systemPrompt?.trim() || undefined,
        messages: toAnthropicMessages(request),
      }),
      signal: request.signal,
    },
  }),
  parseEventPayload: (event) => parseJsonPayload<AnthropicStreamResponse>(event.data),
  extractErrorMessage: (payload) => {
    if (payload.type !== 'error') {
      return null
    }

    return payload.error?.message?.trim() ?? 'Anthropic stream returned an error event.'
  },
  extractText: (payload) => {
    if (payload.type !== 'content_block_delta') {
      return null
    }

    if (payload.delta?.type !== 'text_delta') {
      return null
    }

    return payload.delta.text ?? null
  },
  accumulationMode: 'append',
}

export const geminiStreamStrategy: StreamProviderStrategy<GeminiResponse> = {
  createRequest: (request) => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`,
    init: {
      method: 'POST',
      headers: {
        'x-goog-api-key': request.apiKey,
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: request.systemPrompt?.trim()
          ? {
              parts: [{ text: request.systemPrompt.trim() }],
            }
          : undefined,
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
        contents: toGeminiContents(request),
      }),
      signal: request.signal,
    },
  }),
  parseEventPayload: (event) => {
    if (event.data === '[DONE]') {
      return null
    }

    return parseJsonPayload<GeminiResponse>(event.data)
  },
  extractErrorMessage: () => null,
  extractText: (payload) => geminiHttpStrategy.extractContent(payload),
  accumulationMode: 'prefix-aware',
}

export const mergeStreamText = (
  currentText: string,
  deltaText: string,
  mode: AccumulationMode,
): string => {
  if (mode === 'append') {
    return currentText + deltaText
  }

  return deltaText.startsWith(currentText) ? deltaText : currentText + deltaText
}
