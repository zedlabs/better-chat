import type { ChatGatewayRequest } from '../application/chat-gateway'

export interface HttpProviderStrategy<TPayload> {
  readonly id: 'openai' | 'anthropic' | 'gemini'
  createRequest(request: ChatGatewayRequest): {
    readonly url: string
    readonly init: RequestInit
  }
  extractContent(payload: TPayload): string | null
  readonly emptyResponseMessage: string
}

interface OpenAiResponse {
  readonly choices?: Array<{
    readonly message?: {
      readonly content?: string | Array<{ readonly text?: string }>
    }
  }>
}

interface AnthropicResponse {
  readonly content?: Array<{
    readonly type?: string
    readonly text?: string
  }>
}

export interface GeminiResponse {
  readonly candidates?: Array<{
    readonly content?: {
      readonly parts?: Array<{
        readonly text?: string
      }>
    }
  }>
}

export const openAiHttpStrategy: HttpProviderStrategy<OpenAiResponse> = {
  id: 'openai',
  createRequest: (request) => ({
    url: 'https://api.openai.com/v1/chat/completions',
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
      signal: request.signal,
    },
  }),
  extractContent: (payload) => {
    const content = payload.choices?.at(0)?.message?.content

    if (typeof content === 'string' && content.trim().length > 0) {
      return content.trim()
    }

    if (Array.isArray(content)) {
      const composedContent = content
        .map((part) => part.text?.trim() ?? '')
        .join(' ')
        .trim()

      if (composedContent.length > 0) {
        return composedContent
      }
    }

    return null
  },
  emptyResponseMessage: 'OpenAI returned an empty response.',
}

export const anthropicHttpStrategy: HttpProviderStrategy<AnthropicResponse> = {
  id: 'anthropic',
  createRequest: (request) => ({
    url: 'https://api.anthropic.com/v1/messages',
    init: {
      method: 'POST',
      headers: {
        'x-api-key': request.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 1024,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
      signal: request.signal,
    },
  }),
  extractContent: (payload) => {
    const textBlock = payload.content?.find((block) => block.type === 'text')
    const content = textBlock?.text?.trim()

    return content && content.length > 0 ? content : null
  },
  emptyResponseMessage: 'Anthropic returned an empty response.',
}

export const geminiHttpStrategy: HttpProviderStrategy<GeminiResponse> = {
  id: 'gemini',
  createRequest: (request) => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`,
    init: {
      method: 'POST',
      headers: {
        'x-goog-api-key': request.apiKey,
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
  extractContent: (payload) => {
    const content = payload.candidates
      ?.at(0)
      ?.content?.parts
      ?.map((part) => part.text?.trim() ?? '')
      .join(' ')
      .trim()

    return content && content.length > 0 ? content : null
  },
  emptyResponseMessage: 'Gemini returned an empty response.',
}
