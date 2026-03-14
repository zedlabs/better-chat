import type {
  ChatGateway,
  ChatGatewayRequest,
  ProviderGatewayRegistry,
} from '../application/chat-gateway'
import type { ChatMessage } from '../../chat/domain/chat-message'
import type { ProviderId } from '../../settings/domain/provider-settings'

interface OpenAiResponse {
  readonly choices?: Array<{
    readonly message?: {
      readonly content?: string | Array<{ readonly text?: string }>
    }
  }>
  readonly error?: {
    readonly message?: string
  }
}

interface AnthropicResponse {
  readonly content?: Array<{
    readonly type?: string
    readonly text?: string
  }>
  readonly error?: {
    readonly message?: string
  }
}

interface GeminiResponse {
  readonly candidates?: Array<{
    readonly content?: {
      readonly parts?: Array<{
        readonly text?: string
      }>
    }
  }>
  readonly error?: {
    readonly message?: string
  }
}

class OpenAiChatGateway implements ChatGateway {
  async complete(request: ChatGatewayRequest): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    })

    const payload = await parseResponse<OpenAiResponse>(response)
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

    throw new Error(payload.error?.message ?? 'OpenAI returned an empty response.')
  }
}

class AnthropicChatGateway implements ChatGateway {
  async complete(request: ChatGatewayRequest): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': request.apiKey,
        'anthropic-version': '2023-06-01',
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
    })

    const payload = await parseResponse<AnthropicResponse>(response)
    const textBlock = payload.content?.find((block) => block.type === 'text')
    const content = textBlock?.text?.trim()

    if (content && content.length > 0) {
      return content
    }

    throw new Error(payload.error?.message ?? 'Anthropic returned an empty response.')
  }
}

class GeminiChatGateway implements ChatGateway {
  async complete(request: ChatGatewayRequest): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey)}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: request.messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
      }),
      signal: request.signal,
    })

    const payload = await parseResponse<GeminiResponse>(response)
    const content = payload.candidates
      ?.at(0)
      ?.content?.parts
      ?.map((part) => part.text?.trim() ?? '')
      .join(' ')
      .trim()

    if (content && content.length > 0) {
      return content
    }

    throw new Error(payload.error?.message ?? 'Gemini returned an empty response.')
  }
}

const toProviderErrorMessage = async (response: Response): Promise<string> => {
  const responseText = await response.text()

  if (responseText.length === 0) {
    return `Request failed with status ${response.status}.`
  }

  try {
    const payload = JSON.parse(responseText) as {
      error?: { message?: string }
      message?: string
    }

    const apiErrorMessage = payload.error?.message ?? payload.message
    if (apiErrorMessage && apiErrorMessage.trim().length > 0) {
      return apiErrorMessage
    }
  } catch {
    return responseText
  }

  return `Request failed with status ${response.status}.`
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorMessage = await toProviderErrorMessage(response)
    throw new Error(errorMessage)
  }

  return (await response.json()) as T
}

class StaticProviderGatewayRegistry implements ProviderGatewayRegistry {
  private readonly gateways: Record<ProviderId, ChatGateway>

  constructor(gateways: Record<ProviderId, ChatGateway>) {
    this.gateways = gateways
  }

  resolve(providerId: ProviderId): ChatGateway {
    return this.gateways[providerId]
  }
}

export const createHttpProviderGatewayRegistry = (): ProviderGatewayRegistry =>
  new StaticProviderGatewayRegistry({
    openai: new OpenAiChatGateway(),
    anthropic: new AnthropicChatGateway(),
    gemini: new GeminiChatGateway(),
  })

export const mapToProviderRole = (message: ChatMessage): 'user' | 'assistant' =>
  message.role === 'assistant' ? 'assistant' : 'user'
