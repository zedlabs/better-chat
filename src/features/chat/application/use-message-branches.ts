import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createUniqueId } from '../../../shared/domain/unique-id'
import type { ProviderSettings } from '../../settings/domain/provider-settings'
import { createAssistantMessage, createUserMessage } from '../domain/chat-message'
import {
  createMessageBranch,
  type MessageBranch,
} from '../domain/message-branch'
import {
  loadMessageBranches,
  saveMessageBranches,
} from './message-branch-storage'
import { SendMessageUseCase } from './send-message-use-case'

type BranchMap = Record<string, ReadonlyArray<MessageBranch>>

interface UseMessageBranchesResult {
  readonly branches: ReadonlyArray<MessageBranch>
  readonly activeBranch: MessageBranch | null
  readonly activeComposerValue: string
  readonly isSending: boolean
  readonly createBranch: (sourceMessageId: string, quote: string) => void
  readonly openBranch: (branchId: string) => void
  readonly closeBranch: () => void
  readonly deleteActiveBranch: () => void
  readonly updateActiveBranchNotes: (notes: string) => void
  readonly updateActiveComposerValue: (value: string) => void
  readonly sendBranchMessage: () => Promise<void>
  readonly cancelBranchMessage: () => void
}

const updateBranchInMap = (
  branchMap: BranchMap,
  conversationId: string,
  branchId: string,
  mapBranch: (branch: MessageBranch) => MessageBranch,
): BranchMap => ({
  ...branchMap,
  [conversationId]: (branchMap[conversationId] ?? []).map((branch) =>
    branch.id === branchId ? mapBranch(branch) : branch,
  ),
})

export const useMessageBranches = (
  activeConversationId: string,
  sendMessageUseCase: SendMessageUseCase,
  providerSettings: ProviderSettings,
): UseMessageBranchesResult => {
  const [branchesByConversationId, setBranchesByConversationId] = useState<BranchMap>(() =>
    loadMessageBranches(),
  )
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [activeComposerValue, setActiveComposerValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const activeRequestAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    saveMessageBranches(branchesByConversationId)
  }, [branchesByConversationId])

  const branches = branchesByConversationId[activeConversationId] ?? []
  const activeBranch = branches.find((branch) => branch.id === activeBranchId) ?? null

  const createBranch = useCallback(
    (sourceMessageId: string, quote: string) => {
      const trimmedQuote = quote.trim()
      if (trimmedQuote.length === 0) {
        return
      }

      const branch = createMessageBranch(activeConversationId, sourceMessageId, trimmedQuote)

      setBranchesByConversationId((current) => ({
        ...current,
        [activeConversationId]: [...(current[activeConversationId] ?? []), branch],
      }))
      setActiveBranchId(branch.id)
      setActiveComposerValue('')
    },
    [activeConversationId],
  )

  const openBranch = useCallback((branchId: string) => {
    setActiveBranchId(branchId)
    setActiveComposerValue('')
  }, [])

  const closeBranch = useCallback(() => {
    setActiveBranchId(null)
    setActiveComposerValue('')
  }, [])

  const deleteActiveBranch = useCallback(() => {
    if (!activeBranch) {
      return
    }

    setBranchesByConversationId((current) => ({
      ...current,
      [activeConversationId]: (current[activeConversationId] ?? []).filter(
        (branch) => branch.id !== activeBranch.id,
      ),
    }))
    setActiveBranchId(null)
    setActiveComposerValue('')
  }, [activeBranch, activeConversationId])

  const updateActiveBranchNotes = useCallback(
    (notes: string) => {
      if (!activeBranch) {
        return
      }

      setBranchesByConversationId((current) =>
        updateBranchInMap(current, activeConversationId, activeBranch.id, (branch) => ({
          ...branch,
          notes,
        })),
      )
    },
    [activeBranch, activeConversationId],
  )

  const updateActiveComposerValue = useCallback((value: string) => {
    setActiveComposerValue(value)
  }, [])

  const cancelBranchMessage = useCallback(() => {
    activeRequestAbortControllerRef.current?.abort()
  }, [])

  const sendBranchMessage = useCallback(async () => {
    if (!activeBranch || isSending) {
      return
    }

    const trimmedPrompt = activeComposerValue.trim()
    if (trimmedPrompt.length === 0) {
      return
    }

    const userMessage = createUserMessage(trimmedPrompt)
    const contextMessage = createAssistantMessage(
      `Branch context from highlighted text: ${activeBranch.quote}`,
    )
    const requestHistory =
      activeBranch.messages.length === 0
        ? [contextMessage, ...activeBranch.messages, userMessage]
        : [...activeBranch.messages, userMessage]
    const branchHistory = [...activeBranch.messages, userMessage]
    const placeholderId = createUniqueId()

    setBranchesByConversationId((current) =>
      updateBranchInMap(current, activeConversationId, activeBranch.id, (branch) => ({
        ...branch,
        messages: [
          ...branchHistory,
          {
            id: placeholderId,
            role: 'assistant',
            content: '',
            createdAtIso: new Date().toISOString(),
            isStreaming: true,
          },
        ],
      })),
    )
    setActiveComposerValue('')
    setIsSending(true)

    const abortController = new AbortController()
    activeRequestAbortControllerRef.current = abortController

    try {
      const assistantMessage = await sendMessageUseCase.executeStreaming({
        history: requestHistory,
        providerSettings,
        signal: abortController.signal,
        onContent: (content) => {
          setBranchesByConversationId((current) =>
            updateBranchInMap(current, activeConversationId, activeBranch.id, (branch) => ({
              ...branch,
              messages: branch.messages.map((message) =>
                message.id === placeholderId
                  ? {
                      ...message,
                      content,
                    }
                  : message,
              ),
            })),
          )
        },
      })

      setBranchesByConversationId((current) =>
        updateBranchInMap(current, activeConversationId, activeBranch.id, (branch) => ({
          ...branch,
          messages: branch.messages.map((message) =>
            message.id === placeholderId
              ? {
                  ...assistantMessage,
                  id: placeholderId,
                  isStreaming: false,
                }
              : message,
          ),
        })),
      )
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        setBranchesByConversationId((current) =>
          updateBranchInMap(current, activeConversationId, activeBranch.id, (branch) => ({
            ...branch,
            messages: branch.messages.map((message) =>
              message.id === placeholderId
                ? {
                    ...createAssistantMessage('Response cancelled.'),
                    id: placeholderId,
                    isStreaming: false,
                  }
                : message,
            ),
          })),
        )
      }
    } finally {
      setIsSending(false)
      if (activeRequestAbortControllerRef.current === abortController) {
        activeRequestAbortControllerRef.current = null
      }
    }
  }, [
    activeBranch,
    activeComposerValue,
    activeConversationId,
    isSending,
    providerSettings,
    sendMessageUseCase,
  ])

  return useMemo(
    () => ({
      branches,
      activeBranch,
      activeComposerValue,
      isSending,
      createBranch,
      openBranch,
      closeBranch,
      deleteActiveBranch,
      updateActiveBranchNotes,
      updateActiveComposerValue,
      sendBranchMessage,
      cancelBranchMessage,
    }),
    [
      branches,
      activeBranch,
      activeComposerValue,
      isSending,
      createBranch,
      openBranch,
      closeBranch,
      deleteActiveBranch,
      updateActiveBranchNotes,
      updateActiveComposerValue,
      sendBranchMessage,
      cancelBranchMessage,
    ],
  )
}
