import type { ChatGateway, ChatGatewayRequest, ProviderGatewayRegistry } from '../application/chat-gateway'
import type { ProviderId } from '../../settings/domain/provider-settings'
import {
  anthropicHttpStrategy,
  geminiHttpStrategy,
  openAiHttpStrategy,
  type HttpProviderStrategy,
} from './provider-http-strategies'
import {
  anthropicStreamStrategy,
  geminiStreamStrategy,
  mergeStreamText,
  openAiStreamStrategy,
  type StreamProviderStrategy,
} from './provider-stream-strategies'
import { executeWithResilience } from './request-resilience'
import { readSseEvents } from './sse-events'

const retryableStatusCodes = new Set([408, 409, 425, 429, 500, 502, 503, 504])

const requestWithResilience = async (
  url: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
): Promise<Response> =>
  executeWithResilience({
    operation: (mergedSignal) => fetch(url, { ...init, signal: mergedSignal }),
    shouldRetry: (result) => !result.ok && retryableStatusCodes.has(result.status),
    signal,
  })

const createHttpGateway = <TResponse, TStreamPayload>(
  responseStrategy: HttpProviderStrategy<TResponse>,
  streamStrategy: StreamProviderStrategy<TStreamPayload> | null,
): ChatGateway => {
  const executeComplete = async (request: ChatGatewayRequest): Promise<string> => {
    const preparedRequest = responseStrategy.createRequest(request)
    const response = await requestWithResilience(
      preparedRequest.url,
      preparedRequest.init,
      request.signal,
    )
    const payload = await parseResponse<TResponse>(response)
    const content = responseStrategy.extractContent(payload)

    if (!content) {
      throw new Error(responseStrategy.emptyResponseMessage)
    }

    return content
  }

  return {
    complete: executeComplete,

    async stream(
      request: ChatGatewayRequest,
      onContent: (content: string) => void,
    ): Promise<string> {
      if (!streamStrategy) {
        const completeContent = await executeComplete(request)
        onContent(completeContent)
        return completeContent
      }

      const preparedRequest = streamStrategy.createRequest(request)
      const response = await requestWithResilience(
        preparedRequest.url,
        preparedRequest.init,
        request.signal,
      )

      if (!response.ok) {
        const errorMessage = await toProviderErrorMessage(response)
        throw new Error(errorMessage)
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        const payload = (await response.json()) as TResponse
        const content = responseStrategy.extractContent(payload)

        if (!content) {
          throw new Error(responseStrategy.emptyResponseMessage)
        }

        onContent(content)
        return content
      }

      let accumulatedText = ''

      await readSseEvents(response, (event) => {
        const payload = streamStrategy.parseEventPayload(event)
        if (!payload) {
          return
        }

        const streamErrorMessage = streamStrategy.extractErrorMessage(payload)
        if (streamErrorMessage) {
          throw new Error(streamErrorMessage)
        }

        const textDelta = streamStrategy.extractText(payload)
        if (!textDelta || textDelta.length === 0) {
          return
        }

        accumulatedText = mergeStreamText(
          accumulatedText,
          textDelta,
          streamStrategy.accumulationMode,
        )
        onContent(accumulatedText)
      })

      if (accumulatedText.length === 0) {
        throw new Error(responseStrategy.emptyResponseMessage)
      }

      return accumulatedText
    },
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

export const createHttpProviderGatewayRegistry = (): ProviderGatewayRegistry => {
  const gateways: Record<ProviderId, ChatGateway> = {
    openai: createHttpGateway(openAiHttpStrategy, openAiStreamStrategy),
    anthropic: createHttpGateway(anthropicHttpStrategy, anthropicStreamStrategy),
    gemini: createHttpGateway(geminiHttpStrategy, geminiStreamStrategy),
  }

  return {
    resolve(providerId: ProviderId): ChatGateway {
      return gateways[providerId]
    },
  }
}
