import { createUniqueId } from '../../../shared/domain/unique-id'

export type ChatMessageRole = 'user' | 'assistant'

export interface ChatMessage {
  readonly id: string
  readonly role: ChatMessageRole
  readonly content: string
  readonly createdAtIso: string
  readonly generatedModel?: string
  readonly isStreaming?: boolean
}

const createChatMessage = (
  role: ChatMessageRole,
  content: string,
  generatedModel?: string,
): ChatMessage => ({
  id: createUniqueId(),
  role,
  content: content.trim(),
  createdAtIso: new Date().toISOString(),
  generatedModel,
})

export const createUserMessage = (content: string): ChatMessage =>
  createChatMessage('user', content)

export const createAssistantMessage = (
  content: string,
  generatedModel?: string,
): ChatMessage => createChatMessage('assistant', content, generatedModel)
