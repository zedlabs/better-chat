import type { ChatGatewayRequest } from '../application/chat-gateway'
import { geminiHttpStrategy, type GeminiResponse } from './provider-http-strategies'
import type { SseEvent } from './sse-events'

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
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
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
        max_tokens: 1024,
        stream: true,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
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
        contents: request.messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
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
