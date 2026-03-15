import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Check, ChevronDown, Copy, RefreshCw } from 'lucide-react'
import type { ChatMessage } from '../domain/chat-message'
import { AssistantMarkdown } from './AssistantMarkdown'
import type { MessageBranch } from '../domain/message-branch'

interface BranchSelection {
  readonly messageId: string
  readonly quote: string
  readonly top: number
  readonly left: number
}

interface MessageListProps {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly canRegenerateLastResponse: boolean
  readonly onRegenerate: () => Promise<void>
  readonly hideUserMessages: boolean
  readonly branches: ReadonlyArray<MessageBranch>
  readonly onCreateBranch: (messageId: string, quote: string) => void
  readonly onOpenBranch: (branchId: string) => void
}

const AUTO_SCROLL_THRESHOLD_PX = 120

export const MessageList = ({
  messages,
  canRegenerateLastResponse,
  onRegenerate,
  hideUserMessages,
  branches,
  onCreateBranch,
  onOpenBranch,
}: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [pendingBranchSelection, setPendingBranchSelection] =
    useState<BranchSelection | null>(null)

  const visibleMessages = useMemo(
    () =>
      hideUserMessages
        ? messages.filter((message) => message.role !== 'user')
        : messages,
    [hideUserMessages, messages],
  )
  const lastUserMessageId = visibleMessages.findLast((m) => m.role === 'user')?.id ?? null
  const lastVisibleMessage = visibleMessages.at(-1)
  const hasStreamingMessage = visibleMessages.some((message) => message.isStreaming)
  const visibleMessagesKey = `${visibleMessages.length}:${lastVisibleMessage?.id ?? 'none'}:${lastVisibleMessage?.content ?? ''}`

  useEffect(() => {
    if (hasStreamingMessage) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
      shouldStickToBottomRef.current = true
      return
    }

    if (!shouldStickToBottomRef.current && visibleMessages.length > 0) {
      return
    }

    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [hasStreamingMessage, visibleMessages.length, visibleMessagesKey])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      const isNearBottom = distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX
      shouldStickToBottomRef.current = isNearBottom
      setShowScrollDown(!isNearBottom)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const copyMessage = async (message: ChatMessage) => {
    if (!navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(message.content)
    setCopiedMessageId(message.id)
  }

  const handleSelectionCapture = (event: MouseEvent<HTMLElement>) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setPendingBranchSelection(null)
      return
    }

    const selectedText = selection.toString().trim()
    if (selectedText.length === 0) {
      setPendingBranchSelection(null)
      return
    }

    const anchorNode = selection.anchorNode
    if (!anchorNode) {
      setPendingBranchSelection(null)
      return
    }

    const anchorElement =
      anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as Element)

    const messageElement = anchorElement?.closest<HTMLLIElement>('[data-message-id]')
    if (!messageElement || !event.currentTarget.contains(messageElement)) {
      setPendingBranchSelection(null)
      return
    }

    const messageId = messageElement.dataset.messageId ?? ''
    if (messageId.length === 0) {
      setPendingBranchSelection(null)
      return
    }

    const selectionRect =
      typeof selection.getRangeAt === 'function'
        ? selection.getRangeAt(0).getBoundingClientRect()
        : messageElement.getBoundingClientRect()
    const containerRect = event.currentTarget.getBoundingClientRect()

    setPendingBranchSelection({
      messageId,
      quote: selectedText,
      top: selectionRect.top - containerRect.top + event.currentTarget.scrollTop - 36,
      left: selectionRect.left - containerRect.left + event.currentTarget.scrollLeft,
    })
  }

  const branchesByMessageId = branches.reduce<Record<string, MessageBranch[]>>(
    (acc, branch) => {
      if (!acc[branch.sourceMessageId]) {
        acc[branch.sourceMessageId] = []
      }

      acc[branch.sourceMessageId].push(branch)
      return acc
    },
    {},
  )

  return (
    <section
      className="message-list"
      aria-label="Conversation"
      ref={scrollRef}
      onMouseUp={handleSelectionCapture}
    >
      <ul className="message-list__items">
        {visibleMessages.map((message) => (
          <li
            key={message.id}
            className="message-list__item"
            data-role={message.role}
            data-message-id={message.id}
          >
            {message.role === 'user' ? (
              <div className="message-user-wrap">
                <p className="message-bubble message-bubble--user">{message.content}</p>
                {message.id === lastUserMessageId && canRegenerateLastResponse && (
                  <button
                    type="button"
                    className="message-regenerate-btn"
                    aria-label="Regenerate response"
                    onClick={() => { void onRegenerate() }}
                  >
                    <RefreshCw size={13} />
                  </button>
                )}
              </div>
            ) : (
              <div className="message-inline-wrap">
                {message.isStreaming ? (
                  <p className="message-inline message-inline--streaming">{message.content}</p>
                ) : (
                  <AssistantMarkdown content={message.content} />
                )}
                {!message.isStreaming && message.generatedModel && (
                  <div className="message-inline__footer">
                    <span className="message-inline__model">
                      Model: {message.generatedModel}
                    </span>
                    <button
                      type="button"
                      className="message-inline__copy"
                      aria-label="Copy response"
                      onClick={() => {
                        void copyMessage(message)
                      }}
                    >
                      {copiedMessageId === message.id
                        ? <Check size={13} />
                        : <Copy size={13} />
                      }
                    </button>
                  </div>
                )}

                {(branchesByMessageId[message.id] ?? []).map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    className="message-branch-chip"
                    aria-label={`Open branch ${branch.quote}`}
                    onClick={() => onOpenBranch(branch.id)}
                  >
                    {branch.quote}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div ref={bottomRef} data-scroll-anchor aria-hidden="true" />

      {pendingBranchSelection && (
        <button
          type="button"
          className="message-branch-create message-branch-create--floating"
          style={{
            top: `${Math.max(8, pendingBranchSelection.top)}px`,
            left: `${Math.max(8, pendingBranchSelection.left)}px`,
          }}
          onClick={() => {
            onCreateBranch(
              pendingBranchSelection.messageId,
              pendingBranchSelection.quote,
            )
            setPendingBranchSelection(null)
          }}
        >
          + Create New Branch Here
        </button>
      )}

      {showScrollDown && (
        <button
          type="button"
          className="scroll-to-bottom-btn"
          aria-label="Scroll to bottom"
          onClick={scrollToBottom}
        >
          <ChevronDown size={16} />
        </button>
      )}
    </section>
  )
}
