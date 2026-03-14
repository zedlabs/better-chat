import type { ChatGateway, ChatGatewayRequest, ProviderGatewayRegistry } from '../application/chat-gateway'
import type { ProviderId } from '../../settings/domain/provider-settings'
import {
  anthropicHttpStrategy,
  geminiHttpStrategy,
  openAiHttpStrategy,
  type HttpProviderStrategy,
} from './provider-http-strategies'
import { executeWithResilience } from './request-resilience'

const retryableStatusCodes = new Set([408, 409, 425, 429, 500, 502, 503, 504])

const createHttpGateway = <TPayload>(strategy: HttpProviderStrategy<TPayload>): ChatGateway => ({
  async complete(request: ChatGatewayRequest): Promise<string> {
    const { url, init } = strategy.createRequest(request)
    const response = await executeWithResilience({
      operation: (signal) => fetch(url, { ...init, signal }),
      shouldRetry: (result) => !result.ok && retryableStatusCodes.has(result.status),
      signal: request.signal,
    })
    const payload = await parseResponse<TPayload>(response)
    const content = strategy.extractContent(payload)

    if (!content) {
      throw new Error(strategy.emptyResponseMessage)
    }

    return content
  },
})

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

export const createHttpProviderGatewayRegistry = (): ProviderGatewayRegistry => {
  const gateways: Record<ProviderId, ChatGateway> = {
    openai: createHttpGateway(openAiHttpStrategy),
    anthropic: createHttpGateway(anthropicHttpStrategy),
    gemini: createHttpGateway(geminiHttpStrategy),
  }

  return {
    resolve(providerId: ProviderId): ChatGateway {
      return gateways[providerId]
    },
  }
}
