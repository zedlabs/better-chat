import { useCallback, useEffect, useReducer, useRef } from 'react'
import { SendMessageUseCase } from '../../chat/application/send-message-use-case'
import {
  createAssistantMessage,
  createUserMessage,
  type ChatMessage,
} from '../../chat/domain/chat-message'
import {
  defaultAppThemeId,
  type AppThemeId,
} from '../../settings/domain/app-theme-settings'
import {
  defaultReadingModeSettings,
  setReadingScheme,
  toggleReadingMode,
  type ReadingModeSettings,
  type ReadingSchemeId,
} from '../../settings/domain/reading-mode-settings'
import {
  createDefaultProviderSettings,
  setGlobalSystemPrompt,
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

interface ConversationSummary {
  readonly id: string
  readonly title: string
  readonly updatedAtLabel: string
}

interface ChatWorkspaceState {
  readonly isSidebarCollapsed: boolean
  readonly isSettingsOpen: boolean
  readonly appThemeId: AppThemeId
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
  | { readonly type: 'app-theme/selected'; readonly appThemeId: AppThemeId }
  | { readonly type: 'reading-mode/toggled' }
  | { readonly type: 'reading-mode/hide-top-bar-toggled' }
  | { readonly type: 'reading-mode/hide-sidebar-toggled' }
  | { readonly type: 'reading-mode/hide-composer-toggled' }
  | { readonly type: 'reading-mode/hide-user-messages-toggled' }
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
  | {
      readonly type: 'provider/global-system-prompt-changed'
      readonly value: string
    }
  | { readonly type: 'provider/saved' }
  | { readonly type: 'conversation/created' }
  | { readonly type: 'conversation/deleted'; readonly conversationId: string }
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
  | {
      readonly type: 'message/assistant-stream-finished'
      readonly messageId: string
      readonly content: string
      readonly generatedModel?: string
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
    appThemeId: defaultAppThemeId,
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
    appThemeId: persistedState.appThemeId,
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

const deleteConversationFromState = (
  state: ChatWorkspaceState,
  conversationId: string,
): ChatWorkspaceState => {
  if (!Object.hasOwn(state.conversationMessages, conversationId)) {
    return state
  }

  const nextHistory = state.history.filter((conversation) => conversation.id !== conversationId)
  const nextConversationMessages = { ...state.conversationMessages }
  delete nextConversationMessages[conversationId]

  if (nextHistory.length === 0) {
    const replacementConversationId = createUniqueId()
    const welcomeMessage = createWelcomeMessage()

    return {
      ...state,
      history: [
        {
          id: replacementConversationId,
          title: 'Thread 1',
          updatedAtLabel: 'Just now',
        },
      ],
      activeConversationId: replacementConversationId,
      conversationMessages: {
        [replacementConversationId]: [welcomeMessage],
      },
      messages: [welcomeMessage],
      composerValue: '',
    }
  }

  if (state.activeConversationId !== conversationId) {
    return {
      ...state,
      history: nextHistory,
      conversationMessages: nextConversationMessages,
    }
  }

  const nextActiveConversationId = nextHistory.at(-1)?.id ?? state.activeConversationId
  const nextMessages = nextConversationMessages[nextActiveConversationId] ?? []

  return {
    ...state,
    history: nextHistory,
    conversationMessages: nextConversationMessages,
    activeConversationId: nextActiveConversationId,
    messages: nextMessages,
    composerValue: '',
  }
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

    case 'app-theme/selected':
      return {
        ...state,
        appThemeId: action.appThemeId,
      }

    case 'reading-mode/toggled':
      return {
        ...state,
        readingModeSettings: toggleReadingMode(state.readingModeSettings),
      }

    case 'reading-mode/hide-top-bar-toggled':
      return {
        ...state,
        readingModeSettings: {
          ...state.readingModeSettings,
          hideTopBar: !state.readingModeSettings.hideTopBar,
        },
      }

    case 'reading-mode/hide-sidebar-toggled':
      return {
        ...state,
        readingModeSettings: {
          ...state.readingModeSettings,
          hideSidebar: !state.readingModeSettings.hideSidebar,
        },
      }

    case 'reading-mode/hide-composer-toggled':
      return {
        ...state,
        readingModeSettings: {
          ...state.readingModeSettings,
          hideComposer: !state.readingModeSettings.hideComposer,
        },
      }

    case 'reading-mode/hide-user-messages-toggled':
      return {
        ...state,
        readingModeSettings: {
          ...state.readingModeSettings,
          hideUserMessages: !state.readingModeSettings.hideUserMessages,
        },
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

    case 'provider/global-system-prompt-changed': {
      const providerDraftSettings = setGlobalSystemPrompt(
        state.providerDraftSettings,
        action.value,
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

    case 'conversation/deleted':
      return deleteConversationFromState(state, action.conversationId)

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

    case 'message/assistant-stream-finished': {
      const nextMessages = state.messages.map((message) =>
        message.id === action.messageId
          ? {
              ...message,
              content: action.content,
              generatedModel: action.generatedModel,
              isStreaming: false,
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
  readonly selectAppTheme: (appThemeId: AppThemeId) => void
  readonly toggleReadingMode: () => void
  readonly selectReadingScheme: (schemeId: ReadingSchemeId) => void
  readonly toggleReadingHideTopBar: () => void
  readonly toggleReadingHideSidebar: () => void
  readonly toggleReadingHideComposer: () => void
  readonly toggleReadingHideUserMessages: () => void
  readonly selectProvider: (providerId: ProviderId) => void
  readonly changeApiKey: (providerId: ProviderId, apiKey: string) => void
  readonly changeModel: (providerId: ProviderId, model: string) => void
  readonly changeGlobalSystemPrompt: (value: string) => void
  readonly saveProviderSettings: () => void
  readonly createConversation: () => void
  readonly selectConversation: (conversationId: string) => void
  readonly deleteConversation: (conversationId: string) => void
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
      appThemeId: state.appThemeId,
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
    state.appThemeId,
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

  const selectAppTheme = useCallback((appThemeId: AppThemeId) => {
    dispatch({ type: 'app-theme/selected', appThemeId })
  }, [])

  const onToggleReadingMode = useCallback(() => {
    dispatch({ type: 'reading-mode/toggled' })
  }, [])

  const onToggleReadingHideTopBar = useCallback(() => {
    dispatch({ type: 'reading-mode/hide-top-bar-toggled' })
  }, [])

  const onToggleReadingHideSidebar = useCallback(() => {
    dispatch({ type: 'reading-mode/hide-sidebar-toggled' })
  }, [])

  const onToggleReadingHideComposer = useCallback(() => {
    dispatch({ type: 'reading-mode/hide-composer-toggled' })
  }, [])

  const onToggleReadingHideUserMessages = useCallback(() => {
    dispatch({ type: 'reading-mode/hide-user-messages-toggled' })
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

  const changeGlobalSystemPrompt = useCallback((value: string) => {
    dispatch({ type: 'provider/global-system-prompt-changed', value })
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

  const deleteConversation = useCallback((conversationId: string) => {
    dispatch({ type: 'conversation/deleted', conversationId })
  }, [])

  const changeComposerValue = useCallback((value: string) => {
    dispatch({ type: 'composer/changed', value })
  }, [])

  const cancelSendMessage = useCallback(() => {
    activeRequestAbortControllerRef.current?.abort()
  }, [])

  const streamAssistantMessage = useCallback(
    async (
      buildAssistantMessage: (onContent: (content: string) => void) => Promise<ChatMessage>,
    ) => {
      const assistantMessageId = createUniqueId()
      const placeholderMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAtIso: new Date().toISOString(),
        isStreaming: true,
      }

      dispatch({
        type: 'message/assistant-stream-started',
        message: placeholderMessage,
      })

      const assistantMessage = await buildAssistantMessage((content) => {
        dispatch({
          type: 'message/assistant-stream-updated',
          messageId: assistantMessageId,
          content,
        })
      })

      dispatch({
        type: 'message/assistant-stream-finished',
        messageId: assistantMessageId,
        content: assistantMessage.content,
        generatedModel: assistantMessage.generatedModel,
      })
    },
    [],
  )

  const requestAssistantMessage = useCallback(
    async (history: ReadonlyArray<ChatMessage>, abortController: AbortController) => {
      await streamAssistantMessage((onContent) =>
        sendMessageUseCase.executeStreaming({
          history,
          providerSettings: state.providerSettings,
          signal: abortController.signal,
          onContent,
        }),
      )

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
    selectAppTheme,
    toggleReadingMode: onToggleReadingMode,
    selectReadingScheme,
    toggleReadingHideTopBar: onToggleReadingHideTopBar,
    toggleReadingHideSidebar: onToggleReadingHideSidebar,
    toggleReadingHideComposer: onToggleReadingHideComposer,
    toggleReadingHideUserMessages: onToggleReadingHideUserMessages,
    selectProvider,
    changeApiKey,
    changeModel,
    changeGlobalSystemPrompt,
    saveProviderSettings,
    createConversation,
    selectConversation,
    deleteConversation,
    changeComposerValue,
    cancelSendMessage,
    canRegenerateLastResponse,
    regenerateLastResponse,
    sendMessage,
  }
}
