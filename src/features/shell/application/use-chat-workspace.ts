import { useCallback, useReducer } from 'react'
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
  readonly history: ReadonlyArray<ConversationSummary>
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
  | { readonly type: 'composer/changed'; readonly value: string }
  | { readonly type: 'message/sending-started'; readonly message: ChatMessage }
  | { readonly type: 'message/sending-finished'; readonly message: ChatMessage }

const initialState: ChatWorkspaceState = {
  isSidebarCollapsed: false,
  isSettingsOpen: false,
  readingModeSettings: defaultReadingModeSettings,
  providerSettings: createDefaultProviderSettings(),
  history: [
    {
      id: createUniqueId(),
      title: 'Welcome thread',
      updatedAtLabel: 'Just now',
    },
  ],
  messages: [
    createAssistantMessage(
      'Welcome to Branch Chat. Add your API key in Settings, then start the conversation.',
    ),
  ],
  composerValue: '',
  isSending: false,
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

    case 'provider/selected':
      return {
        ...state,
        providerSettings: setActiveProvider(state.providerSettings, action.providerId),
      }

    case 'provider/api-key-changed': {
      const currentProvider =
        state.providerSettings.configurations[action.providerId]

      return {
        ...state,
        providerSettings: updateProviderConfiguration(
          state.providerSettings,
          action.providerId,
          {
            ...currentProvider,
            apiKey: action.apiKey,
          },
        ),
      }
    }

    case 'provider/model-changed': {
      const currentProvider =
        state.providerSettings.configurations[action.providerId]

      return {
        ...state,
        providerSettings: updateProviderConfiguration(
          state.providerSettings,
          action.providerId,
          {
            ...currentProvider,
            model: action.model,
          },
        ),
      }
    }

    case 'composer/changed':
      return {
        ...state,
        composerValue: action.value,
      }

    case 'message/sending-started':
      return {
        ...state,
        composerValue: '',
        isSending: true,
        messages: [...state.messages, action.message],
      }

    case 'message/sending-finished':
      return {
        ...state,
        isSending: false,
        messages: [...state.messages, action.message],
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
  readonly changeComposerValue: (value: string) => void
  readonly sendMessage: () => Promise<void>
}

export const useChatWorkspace = (
  sendMessageUseCase: SendMessageUseCase,
): UseChatWorkspaceResult => {
  const [state, dispatch] = useReducer(reducer, initialState)

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

  const changeComposerValue = useCallback((value: string) => {
    dispatch({ type: 'composer/changed', value })
  }, [])

  const sendMessage = useCallback(async () => {
    if (state.isSending) {
      return
    }

    const trimmedMessage = state.composerValue.trim()

    if (trimmedMessage.length === 0) {
      return
    }

    const userMessage = createUserMessage(trimmedMessage)

    dispatch({
      type: 'message/sending-started',
      message: userMessage,
    })

    const assistantMessage = await sendMessageUseCase.execute({
      history: [...state.messages, userMessage],
      providerSettings: state.providerSettings,
    })

    dispatch({
      type: 'message/sending-finished',
      message: assistantMessage,
    })
  }, [
    sendMessageUseCase,
    state.composerValue,
    state.isSending,
    state.messages,
    state.providerSettings,
  ])

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
    changeComposerValue,
    sendMessage,
  }
}
