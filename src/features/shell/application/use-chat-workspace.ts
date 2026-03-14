import { useCallback, useEffect, useReducer, useRef } from 'react'
import { SendMessageUseCase } from '../../chat/application/send-message-use-case'
import {
  createAssistantMessage,
  createUserMessage,
  type ChatMessage,
} from '../../chat/domain/chat-message'
import {
  defaultReadingModeSettings,
  setReadingScheme,
  toggleReadingMode,
  type ReadingModeSettings,
  type ReadingSchemeId,
} from '../../settings/domain/reading-mode-settings'
import {
  createDefaultProviderSettings,
  setActiveProvider,
  updateProviderConfiguration,
  type ProviderId,
  type ProviderSettings,
} from '../../settings/domain/provider-settings'
import { createUniqueId } from '../../../shared/domain/unique-id'
import {
  loadChatWorkspaceState,
  saveChatWorkspaceState,
} from './chat-workspace-storage'
import { streamAssistantResponse } from './assistant-response-stream'

interface ConversationSummary {
  readonly id: string
  readonly title: string
  readonly updatedAtLabel: string
}

interface ChatWorkspaceState {
  readonly isSidebarCollapsed: boolean
  readonly isSettingsOpen: boolean
  readonly readingModeSettings: ReadingModeSettings
  readonly providerSettings: ProviderSettings
  readonly providerDraftSettings: ProviderSettings
  readonly hasUnsavedProviderChanges: boolean
  readonly history: ReadonlyArray<ConversationSummary>
  readonly activeConversationId: string
  readonly conversationMessages: Readonly<Record<string, ReadonlyArray<ChatMessage>>>
  readonly messages: ReadonlyArray<ChatMessage>
  readonly composerValue: string
  readonly isSending: boolean
}

type ChatWorkspaceAction =
  | { readonly type: 'sidebar/toggled' }
  | { readonly type: 'settings/opened' }
  | { readonly type: 'settings/closed' }
  | { readonly type: 'reading-mode/toggled' }
  | {
      readonly type: 'reading-scheme/selected'
      readonly schemeId: ReadingSchemeId
    }
  | {
      readonly type: 'provider/selected'
      readonly providerId: ProviderId
    }
  | {
      readonly type: 'provider/api-key-changed'
      readonly providerId: ProviderId
      readonly apiKey: string
    }
  | {
      readonly type: 'provider/model-changed'
      readonly providerId: ProviderId
      readonly model: string
    }
  | { readonly type: 'provider/saved' }
  | { readonly type: 'conversation/created' }
  | { readonly type: 'conversation/selected'; readonly conversationId: string }
  | { readonly type: 'composer/changed'; readonly value: string }
  | { readonly type: 'message/sending-started'; readonly message: ChatMessage }
  | {
      readonly type: 'message/regeneration-started'
      readonly history: ReadonlyArray<ChatMessage>
    }
  | { readonly type: 'message/assistant-stream-started'; readonly message: ChatMessage }
  | {
      readonly type: 'message/assistant-stream-updated'
      readonly messageId: string
      readonly content: string
    }
  | { readonly type: 'message/sending-cancelled'; readonly message: ChatMessage }
  | { readonly type: 'message/sending-finished' }

const createWelcomeMessage = (): ChatMessage =>
  createAssistantMessage(
    'Welcome to Better Chat. Add your API key in Settings, then start the conversation.',
  )

const createDefaultState = (): ChatWorkspaceState => {
  const initialProviderSettings = createDefaultProviderSettings()
  const initialConversationId = createUniqueId()
  const initialConversationMessages = [createWelcomeMessage()]

  return {
    isSidebarCollapsed: false,
    isSettingsOpen: false,
    readingModeSettings: defaultReadingModeSettings,
    providerSettings: initialProviderSettings,
    providerDraftSettings: initialProviderSettings,
    hasUnsavedProviderChanges: false,
    history: [
      {
        id: initialConversationId,
        title: 'Thread 1',
        updatedAtLabel: 'Just now',
      },
    ],
    activeConversationId: initialConversationId,
    conversationMessages: {
      [initialConversationId]: initialConversationMessages,
    },
    messages: initialConversationMessages,
    composerValue: '',
    isSending: false,
  }
}

const createInitialState = (): ChatWorkspaceState => {
  const persistedState = loadChatWorkspaceState()

  if (!persistedState) {
    return createDefaultState()
  }

  return {
    ...createDefaultState(),
    readingModeSettings: persistedState.readingModeSettings,
    providerSettings: persistedState.providerSettings,
    providerDraftSettings: persistedState.providerSettings,
    history: persistedState.history,
    activeConversationId: persistedState.activeConversationId,
    conversationMessages: persistedState.conversationMessages,
    messages:
      persistedState.conversationMessages[persistedState.activeConversationId] ??
      [createWelcomeMessage()],
  }
}

const areProviderSettingsEqual = (
  left: ProviderSettings,
  right: ProviderSettings,
): boolean => JSON.stringify(left) === JSON.stringify(right)

const renameThreadFromFirstUserMessage = (
  history: ReadonlyArray<ConversationSummary>,
  activeConversationId: string,
  content: string,
): ReadonlyArray<ConversationSummary> =>
  history.map((conversation) => {
    if (conversation.id !== activeConversationId) {
      return conversation
    }

    if (conversation.title !== 'Thread 1' && !conversation.title.startsWith('Thread ')) {
      return conversation
    }

    return {
      ...conversation,
      title: content.slice(0, 36),
      updatedAtLabel: 'Just now',
    }
  })

const buildRegenerationHistory = (
  messages: ReadonlyArray<ChatMessage>,
): ReadonlyArray<ChatMessage> | null => {
  if (messages.length < 2) {
    return null
  }

  const lastMessage = messages.at(-1)
  if (!lastMessage || lastMessage.role !== 'assistant') {
    return null
  }

  const historyWithoutLastAssistant = messages.slice(0, -1)
  const hasUserPrompt = historyWithoutLastAssistant.some(
    (message) => message.role === 'user',
  )

  return hasUserPrompt ? historyWithoutLastAssistant : null
}

const reducer = (
  state: ChatWorkspaceState,
  action: ChatWorkspaceAction,
): ChatWorkspaceState => {
  switch (action.type) {
    case 'sidebar/toggled':
      return {
        ...state,
        isSidebarCollapsed: !state.isSidebarCollapsed,
      }

    case 'settings/opened':
      return {
        ...state,
        isSettingsOpen: true,
      }

    case 'settings/closed':
      return {
        ...state,
        isSettingsOpen: false,
      }

    case 'reading-mode/toggled':
      return {
        ...state,
        readingModeSettings: toggleReadingMode(state.readingModeSettings),
      }

    case 'reading-scheme/selected':
      return {
        ...state,
        readingModeSettings: setReadingScheme(
          state.readingModeSettings,
          action.schemeId,
        ),
      }

    case 'provider/selected': {
      const providerDraftSettings = setActiveProvider(
        state.providerDraftSettings,
        action.providerId,
      )

      return {
        ...state,
        providerDraftSettings,
        hasUnsavedProviderChanges: !areProviderSettingsEqual(
          providerDraftSettings,
          state.providerSettings,
        ),
      }
    }

    case 'provider/api-key-changed': {
      const currentProvider =
        state.providerDraftSettings.configurations[action.providerId]
      const providerDraftSettings = updateProviderConfiguration(
        state.providerDraftSettings,
        action.providerId,
        {
          ...currentProvider,
          apiKey: action.apiKey,
        },
      )

      return {
        ...state,
        providerDraftSettings,
        hasUnsavedProviderChanges: !areProviderSettingsEqual(
          providerDraftSettings,
          state.providerSettings,
        ),
      }
    }

    case 'provider/model-changed': {
      const currentProvider =
        state.providerDraftSettings.configurations[action.providerId]
      const providerDraftSettings = updateProviderConfiguration(
        state.providerDraftSettings,
        action.providerId,
        {
          ...currentProvider,
          model: action.model,
        },
      )

      return {
        ...state,
        providerDraftSettings,
        hasUnsavedProviderChanges: !areProviderSettingsEqual(
          providerDraftSettings,
          state.providerSettings,
        ),
      }
    }

    case 'provider/saved':
      return {
        ...state,
        providerSettings: state.providerDraftSettings,
        hasUnsavedProviderChanges: false,
      }

    case 'conversation/created': {
      const conversationId = createUniqueId()
      const conversationCount = state.history.length + 1
      const welcomeMessage = createWelcomeMessage()

      return {
        ...state,
        history: [
          ...state.history,
          {
            id: conversationId,
            title: `Thread ${conversationCount}`,
            updatedAtLabel: 'Just now',
          },
        ],
        activeConversationId: conversationId,
        conversationMessages: {
          ...state.conversationMessages,
          [conversationId]: [welcomeMessage],
        },
        messages: [welcomeMessage],
        composerValue: '',
      }
    }

    case 'conversation/selected': {
      const selectedConversationMessages =
        state.conversationMessages[action.conversationId] ?? []

      return {
        ...state,
        activeConversationId: action.conversationId,
        messages: selectedConversationMessages,
      }
    }

    case 'composer/changed':
      return {
        ...state,
        composerValue: action.value,
      }

    case 'message/sending-started': {
      const nextMessages = [...state.messages, action.message]

      return {
        ...state,
        composerValue: '',
        isSending: true,
        messages: nextMessages,
        history: renameThreadFromFirstUserMessage(
          state.history,
          state.activeConversationId,
          action.message.content,
        ),
        conversationMessages: {
          ...state.conversationMessages,
          [state.activeConversationId]: nextMessages,
        },
      }
    }

    case 'message/regeneration-started':
      return {
        ...state,
        isSending: true,
        messages: action.history,
        conversationMessages: {
          ...state.conversationMessages,
          [state.activeConversationId]: action.history,
        },
      }

    case 'message/assistant-stream-started': {
      const nextMessages = [...state.messages, action.message]

      return {
        ...state,
        messages: nextMessages,
        conversationMessages: {
          ...state.conversationMessages,
          [state.activeConversationId]: nextMessages,
        },
      }
    }

    case 'message/assistant-stream-updated': {
      const nextMessages = state.messages.map((message) =>
        message.id === action.messageId
          ? {
              ...message,
              content: action.content,
            }
          : message,
      )

      return {
        ...state,
        messages: nextMessages,
        conversationMessages: {
          ...state.conversationMessages,
          [state.activeConversationId]: nextMessages,
        },
      }
    }

    case 'message/sending-cancelled': {
      if (!state.isSending) {
        return state
      }

      const nextMessages = [...state.messages, action.message]

      return {
        ...state,
        isSending: false,
        messages: nextMessages,
        conversationMessages: {
          ...state.conversationMessages,
          [state.activeConversationId]: nextMessages,
        },
      }
    }

    case 'message/sending-finished':
      return {
        ...state,
        isSending: false,
      }

    default:
      return state
  }
}

interface UseChatWorkspaceResult {
  readonly state: ChatWorkspaceState
  readonly toggleSidebar: () => void
  readonly openSettings: () => void
  readonly closeSettings: () => void
  readonly toggleReadingMode: () => void
  readonly selectReadingScheme: (schemeId: ReadingSchemeId) => void
  readonly selectProvider: (providerId: ProviderId) => void
  readonly changeApiKey: (providerId: ProviderId, apiKey: string) => void
  readonly changeModel: (providerId: ProviderId, model: string) => void
  readonly saveProviderSettings: () => void
  readonly createConversation: () => void
  readonly selectConversation: (conversationId: string) => void
  readonly changeComposerValue: (value: string) => void
  readonly cancelSendMessage: () => void
  readonly canRegenerateLastResponse: boolean
  readonly regenerateLastResponse: () => Promise<void>
  readonly sendMessage: () => Promise<void>
}

export const useChatWorkspace = (
  sendMessageUseCase: SendMessageUseCase,
): UseChatWorkspaceResult => {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const activeRequestAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    saveChatWorkspaceState({
      readingModeSettings: state.readingModeSettings,
      providerSettings: state.providerSettings,
      history: state.history,
      activeConversationId: state.activeConversationId,
      conversationMessages: state.conversationMessages,
    })
  }, [
    state.activeConversationId,
    state.conversationMessages,
    state.history,
    state.providerSettings,
    state.readingModeSettings,
  ])

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'sidebar/toggled' })
  }, [])

  const openSettings = useCallback(() => {
    dispatch({ type: 'settings/opened' })
  }, [])

  const closeSettings = useCallback(() => {
    dispatch({ type: 'settings/closed' })
  }, [])

  const onToggleReadingMode = useCallback(() => {
    dispatch({ type: 'reading-mode/toggled' })
  }, [])

  const selectReadingScheme = useCallback((schemeId: ReadingSchemeId) => {
    dispatch({ type: 'reading-scheme/selected', schemeId })
  }, [])

  const selectProvider = useCallback((providerId: ProviderId) => {
    dispatch({ type: 'provider/selected', providerId })
  }, [])

  const changeApiKey = useCallback((providerId: ProviderId, apiKey: string) => {
    dispatch({
      type: 'provider/api-key-changed',
      providerId,
      apiKey,
    })
  }, [])

  const changeModel = useCallback((providerId: ProviderId, model: string) => {
    dispatch({
      type: 'provider/model-changed',
      providerId,
      model,
    })
  }, [])

  const saveProviderSettings = useCallback(() => {
    dispatch({ type: 'provider/saved' })
  }, [])

  const createConversation = useCallback(() => {
    dispatch({ type: 'conversation/created' })
  }, [])

  const selectConversation = useCallback((conversationId: string) => {
    dispatch({ type: 'conversation/selected', conversationId })
  }, [])

  const changeComposerValue = useCallback((value: string) => {
    dispatch({ type: 'composer/changed', value })
  }, [])

  const cancelSendMessage = useCallback(() => {
    activeRequestAbortControllerRef.current?.abort()
  }, [])

  const streamAssistantMessage = useCallback(
    async (assistantMessage: ChatMessage, signal: AbortSignal) => {
      const placeholderMessage: ChatMessage = {
        ...assistantMessage,
        content: '',
      }

      dispatch({
        type: 'message/assistant-stream-started',
        message: placeholderMessage,
      })

      await streamAssistantResponse({
        text: assistantMessage.content,
        signal,
        onChunk: (content) => {
          dispatch({
            type: 'message/assistant-stream-updated',
            messageId: assistantMessage.id,
            content,
          })
        },
      })
    },
    [],
  )

  const requestAssistantMessage = useCallback(
    async (history: ReadonlyArray<ChatMessage>, abortController: AbortController) => {
      const assistantMessage = await sendMessageUseCase.execute({
        history,
        providerSettings: state.providerSettings,
        signal: abortController.signal,
      })

      await streamAssistantMessage(assistantMessage, abortController.signal)

      dispatch({ type: 'message/sending-finished' })
    },
    [sendMessageUseCase, state.providerSettings, streamAssistantMessage],
  )

  const runWithAbortController = useCallback(
    async (operation: (abortController: AbortController) => Promise<void>) => {
      const abortController = new AbortController()
      activeRequestAbortControllerRef.current = abortController

      try {
        await operation(abortController)
      } catch (error) {
        if (
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          dispatch({
            type: 'message/sending-cancelled',
            message: createAssistantMessage('Response cancelled.'),
          })
        }
      } finally {
        if (activeRequestAbortControllerRef.current === abortController) {
          activeRequestAbortControllerRef.current = null
        }
      }
    },
    [],
  )

  const sendMessage = useCallback(async () => {
    if (state.isSending) {
      return
    }

    const trimmedMessage = state.composerValue.trim()

    if (trimmedMessage.length === 0) {
      return
    }

    const userMessage = createUserMessage(trimmedMessage)
    const history = [...state.messages, userMessage]

    dispatch({
      type: 'message/sending-started',
      message: userMessage,
    })

    await runWithAbortController(async (abortController) => {
      await requestAssistantMessage(history, abortController)
    })
  }, [
    state.composerValue,
    state.isSending,
    state.messages,
    requestAssistantMessage,
    runWithAbortController,
  ])

  const canRegenerateLastResponse =
    !state.isSending && buildRegenerationHistory(state.messages) !== null

  const regenerateLastResponse = useCallback(async () => {
    if (state.isSending) {
      return
    }

    const history = buildRegenerationHistory(state.messages)
    if (!history) {
      return
    }

    dispatch({
      type: 'message/regeneration-started',
      history,
    })

    await runWithAbortController(async (abortController) => {
      await requestAssistantMessage(history, abortController)
    })
  }, [state.isSending, state.messages, runWithAbortController, requestAssistantMessage])

  return {
    state,
    toggleSidebar,
    openSettings,
    closeSettings,
    toggleReadingMode: onToggleReadingMode,
    selectReadingScheme,
    selectProvider,
    changeApiKey,
    changeModel,
    saveProviderSettings,
    createConversation,
    selectConversation,
    changeComposerValue,
    cancelSendMessage,
    canRegenerateLastResponse,
    regenerateLastResponse,
    sendMessage,
  }
}
