import { createUniqueId } from '../../../shared/domain/unique-id'

export type ChatMessageRole = 'user' | 'assistant'

export interface ChatMessage {
  readonly id: string
  readonly role: ChatMessageRole
  readonly content: string
  readonly createdAtIso: string
}

const createChatMessage = (
  role: ChatMessageRole,
  content: string,
): ChatMessage => ({
  id: createUniqueId(),
  role,
  content: content.trim(),
  createdAtIso: new Date().toISOString(),
})

export const createUserMessage = (content: string): ChatMessage =>
  createChatMessage('user', content)

export const createAssistantMessage = (content: string): ChatMessage =>
  createChatMessage('assistant', content)
