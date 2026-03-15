import { type ChatMessage } from '../../chat/domain/chat-message'
import { clearMessageBranches } from '../../chat/application/message-branch-storage'
import {
  providerIds,
  type ProviderId,
  type ProviderSettings,
} from '../../settings/domain/provider-settings'
import {
  readingSchemeIds,
  type ReadingModeSettings,
} from '../../settings/domain/reading-mode-settings'

export const CHAT_WORKSPACE_STORAGE_KEY = 'better-chat-ui.workspace.v1'

const inMemoryStorage: Record<string, string> = {}

interface ConversationSummary {
  readonly id: string
  readonly title: string
  readonly updatedAtLabel: string
}

export interface PersistedChatWorkspaceState {
  readonly readingModeSettings: ReadingModeSettings
  readonly providerSettings: ProviderSettings
  readonly history: ReadonlyArray<ConversationSummary>
  readonly activeConversationId: string
  readonly conversationMessages: Readonly<Record<string, ReadonlyArray<ChatMessage>>>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isValidProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && providerIds.includes(value as ProviderId)

const isValidProviderSettings = (value: unknown): value is ProviderSettings => {
  if (!isObject(value) || !isValidProviderId(value.activeProvider)) {
    return false
  }

  if (
    value.globalSystemPrompt !== undefined &&
    typeof value.globalSystemPrompt !== 'string'
  ) {
    return false
  }

  const configurations = value.configurations
  if (!isObject(configurations)) {
    return false
  }

  return providerIds.every((providerId) => {
    const configuration = configurations[providerId]
    return (
      isObject(configuration) &&
      typeof configuration.apiKey === 'string' &&
      typeof configuration.model === 'string'
    )
  })
}

const isValidReadingModeSettings = (value: unknown): value is ReadingModeSettings =>
  isObject(value) &&
  typeof value.isEnabled === 'boolean' &&
  typeof value.schemeId === 'string' &&
  readingSchemeIds.includes(value.schemeId as (typeof readingSchemeIds)[number])

const isValidMessage = (value: unknown): value is ChatMessage =>
  isObject(value) &&
  typeof value.id === 'string' &&
  (value.role === 'user' || value.role === 'assistant') &&
  typeof value.content === 'string' &&
  typeof value.createdAtIso === 'string' &&
  (value.generatedModel === undefined || typeof value.generatedModel === 'string') &&
  (value.isStreaming === undefined || typeof value.isStreaming === 'boolean')

const isValidHistory = (value: unknown): value is ReadonlyArray<ConversationSummary> =>
  Array.isArray(value) &&
  value.every(
    (conversation) =>
      isObject(conversation) &&
      typeof conversation.id === 'string' &&
      typeof conversation.title === 'string' &&
      typeof conversation.updatedAtLabel === 'string',
  )

const isValidConversationMessages = (
  value: unknown,
): value is Readonly<Record<string, ReadonlyArray<ChatMessage>>> =>
  isObject(value) &&
  Object.values(value).every(
    (messages) => Array.isArray(messages) && messages.every((message) => isValidMessage(message)),
  )

export const loadChatWorkspaceState = (): PersistedChatWorkspaceState | null => {
  try {
    const raw = readStorageValue(CHAT_WORKSPACE_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isObject(parsed)) {
      return null
    }

    if (
      !isValidReadingModeSettings(parsed.readingModeSettings) ||
      !isValidProviderSettings(parsed.providerSettings) ||
      !isValidHistory(parsed.history) ||
      typeof parsed.activeConversationId !== 'string' ||
      !isValidConversationMessages(parsed.conversationMessages)
    ) {
      return null
    }

    if (!(parsed.activeConversationId in parsed.conversationMessages)) {
      return null
    }

    return {
      readingModeSettings: {
        isEnabled: parsed.readingModeSettings.isEnabled,
        schemeId: parsed.readingModeSettings.schemeId,
        hideTopBar: typeof parsed.readingModeSettings.hideTopBar === 'boolean'
          ? parsed.readingModeSettings.hideTopBar
          : true,
        hideSidebar: typeof parsed.readingModeSettings.hideSidebar === 'boolean'
          ? parsed.readingModeSettings.hideSidebar
          : true,
        hideComposer: typeof parsed.readingModeSettings.hideComposer === 'boolean'
          ? parsed.readingModeSettings.hideComposer
          : true,
        hideUserMessages: typeof parsed.readingModeSettings.hideUserMessages === 'boolean'
          ? parsed.readingModeSettings.hideUserMessages
          : false,
      },
      providerSettings: {
        ...parsed.providerSettings,
        globalSystemPrompt: parsed.providerSettings.globalSystemPrompt ?? '',
      },
      history: parsed.history,
      activeConversationId: parsed.activeConversationId,
      conversationMessages: parsed.conversationMessages,
    }
  } catch {
    return null
  }
}

export const saveChatWorkspaceState = (state: PersistedChatWorkspaceState): void => {
  try {
    writeStorageValue(CHAT_WORKSPACE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore persistence failures in constrained browser environments.
  }
}

export const clearChatWorkspaceState = (): void => {
  try {
    removeStorageValue(CHAT_WORKSPACE_STORAGE_KEY)
    clearMessageBranches()
  } catch {
    // Ignore cleanup failures in constrained browser environments.
  }
}

const readStorageValue = (key: string): string | null => {
  if (
    typeof window !== 'undefined' &&
    window.localStorage &&
    typeof window.localStorage.getItem === 'function'
  ) {
    return window.localStorage.getItem(key)
  }

  return inMemoryStorage[key] ?? null
}

const writeStorageValue = (key: string, value: string): void => {
  if (
    typeof window !== 'undefined' &&
    window.localStorage &&
    typeof window.localStorage.setItem === 'function'
  ) {
    window.localStorage.setItem(key, value)
    return
  }

  inMemoryStorage[key] = value
}

const removeStorageValue = (key: string): void => {
  if (
    typeof window !== 'undefined' &&
    window.localStorage &&
    typeof window.localStorage.removeItem === 'function'
  ) {
    window.localStorage.removeItem(key)
    return
  }

  delete inMemoryStorage[key]
}
