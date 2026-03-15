import type { ProviderGatewayRegistry } from '../../providers/application/chat-gateway'
import {
  getProviderMetadata,
  type ProviderSettings,
} from '../../settings/domain/provider-settings'
import {
  createAssistantMessage,
  type ChatMessage,
} from '../domain/chat-message'

interface SendMessageInput {
  readonly history: ReadonlyArray<ChatMessage>
  readonly providerSettings: ProviderSettings
  readonly signal?: AbortSignal
}

interface SendMessageStreamingInput extends SendMessageInput {
  readonly onContent: (content: string) => void
}

export class SendMessageUseCase {
  private readonly providerGatewayRegistry: ProviderGatewayRegistry

  constructor(providerGatewayRegistry: ProviderGatewayRegistry) {
    this.providerGatewayRegistry = providerGatewayRegistry
  }

  async execute(input: SendMessageInput): Promise<ChatMessage> {
    return this.executeStreaming({
      ...input,
      onContent: () => {
        // no-op for non-streaming callers
      },
    })
  }

  async executeStreaming(input: SendMessageStreamingInput): Promise<ChatMessage> {
    const providerId = input.providerSettings.activeProvider
    const providerMetadata = getProviderMetadata(providerId)
    const providerConfiguration = input.providerSettings.configurations[providerId]

    if (providerConfiguration.apiKey.trim().length === 0) {
      return createAssistantMessage(
        `Add an API key for ${providerMetadata.label} in Settings to send real messages.`,
        providerConfiguration.model,
      )
    }

    try {
      const gateway = this.providerGatewayRegistry.resolve(providerId)
      const request = {
        messages: input.history,
        apiKey: providerConfiguration.apiKey,
        model: providerConfiguration.model,
        systemPrompt: input.providerSettings.globalSystemPrompt,
        signal: input.signal,
      }
      const answer = gateway.stream
        ? await gateway.stream(request, input.onContent)
        : await gateway.complete(request)

      if (!gateway.stream) {
        input.onContent(answer)
      }

      return createAssistantMessage(answer, providerConfiguration.model)
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw error
      }

      const rawMessage = (error as Error).message
      const normalizedMessage =
        rawMessage === 'Failed to fetch'
          ? `${providerMetadata.label} request was blocked by the browser or network. Confirm CORS support and API key restrictions.`
          : rawMessage

      return createAssistantMessage(
        `Could not reach ${providerMetadata.label}. ${normalizedMessage}`,
        providerConfiguration.model,
      )
    }
  }
}
