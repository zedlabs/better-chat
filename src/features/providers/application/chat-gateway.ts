import type { ChatMessage } from '../../chat/domain/chat-message'
import type { ProviderId } from '../../settings/domain/provider-settings'

export interface ChatGatewayRequest {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly apiKey: string
  readonly model: string
  readonly signal?: AbortSignal
}

export interface ChatGateway {
  complete(request: ChatGatewayRequest): Promise<string>
}

export interface ProviderGatewayRegistry {
  resolve(providerId: ProviderId): ChatGateway
}
