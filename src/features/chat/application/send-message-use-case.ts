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

export class SendMessageUseCase {
  private readonly providerGatewayRegistry: ProviderGatewayRegistry

  constructor(providerGatewayRegistry: ProviderGatewayRegistry) {
    this.providerGatewayRegistry = providerGatewayRegistry
  }

  async execute(input: SendMessageInput): Promise<ChatMessage> {
    const providerId = input.providerSettings.activeProvider
    const providerMetadata = getProviderMetadata(providerId)
    const providerConfiguration = input.providerSettings.configurations[providerId]

    if (providerConfiguration.apiKey.trim().length === 0) {
      return createAssistantMessage(
        `Add an API key for ${providerMetadata.label} in Settings to send real messages.`,
      )
    }

    try {
      const gateway = this.providerGatewayRegistry.resolve(providerId)
      const answer = await gateway.complete({
        messages: input.history,
        apiKey: providerConfiguration.apiKey,
        model: providerConfiguration.model,
        signal: input.signal,
      })

      return createAssistantMessage(answer)
    } catch (error) {
      return createAssistantMessage(
        `Could not reach ${providerMetadata.label}. ${(error as Error).message}`,
      )
    }
  }
}
