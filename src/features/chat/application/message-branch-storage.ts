import type { ChatMessage } from '../domain/chat-message'
import type { MessageBranch } from '../domain/message-branch'

const MESSAGE_BRANCH_STORAGE_KEY = 'better-chat-ui.branches.v1'

type BranchMap = Record<string, ReadonlyArray<MessageBranch>>

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isValidMessage = (value: unknown): value is ChatMessage =>
  isObject(value) &&
  typeof value.id === 'string' &&
  (value.role === 'user' || value.role === 'assistant') &&
  typeof value.content === 'string' &&
  typeof value.createdAtIso === 'string' &&
  (value.generatedModel === undefined || typeof value.generatedModel === 'string') &&
  (value.isStreaming === undefined || typeof value.isStreaming === 'boolean')

const isValidBranch = (value: unknown): value is MessageBranch =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.conversationId === 'string' &&
  typeof value.sourceMessageId === 'string' &&
  typeof value.quote === 'string' &&
  typeof value.notes === 'string' &&
  Array.isArray(value.messages) &&
  value.messages.every((message) => isValidMessage(message))

const isValidBranchMap = (value: unknown): value is BranchMap =>
  isObject(value) &&
  Object.values(value).every(
    (branches) =>
      Array.isArray(branches) && branches.every((branch) => isValidBranch(branch)),
  )

export const loadMessageBranches = (): BranchMap => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(MESSAGE_BRANCH_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown
    return isValidBranchMap(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export const saveMessageBranches = (branches: BranchMap): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    window.localStorage.setItem(MESSAGE_BRANCH_STORAGE_KEY, JSON.stringify(branches))
  } catch {
    // Ignore storage write failures in restricted environments.
  }
}

export const clearMessageBranches = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    window.localStorage.removeItem(MESSAGE_BRANCH_STORAGE_KEY)
  } catch {
    // Ignore storage cleanup failures in restricted environments.
  }
}
