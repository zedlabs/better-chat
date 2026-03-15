import { createUniqueId } from '../../../shared/domain/unique-id'
import type { ChatMessage } from './chat-message'

export interface MessageBranch {
  readonly id: string
  readonly conversationId: string
  readonly sourceMessageId: string
  readonly quote: string
  readonly notes: string
  readonly messages: ReadonlyArray<ChatMessage>
}

export const createMessageBranch = (
  conversationId: string,
  sourceMessageId: string,
  quote: string,
): MessageBranch => ({
  id: createUniqueId(),
  conversationId,
  sourceMessageId,
  quote: quote.trim(),
  notes: '',
  messages: [],
})
