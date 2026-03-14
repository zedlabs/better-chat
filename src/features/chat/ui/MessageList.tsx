import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../domain/chat-message'

interface MessageListProps {
  readonly messages: ReadonlyArray<ChatMessage>
}

export const MessageList = ({ messages }: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const copyMessage = async (message: ChatMessage) => {
    if (!navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(message.content)
    setCopiedMessageId(message.id)
  }

  const CopyGlyph = ({ copied }: { readonly copied: boolean }) =>
    copied ? (
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          d="M6.2 11.1L3.4 8.3l-1 1 3.8 3.8 7.4-7.4-1-1z"
          fill="currentColor"
        />
      </svg>
    ) : (
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="5" y="2" width="7" height="9" rx="1" fill="none" stroke="currentColor" />
        <path d="M3 4.5V13h7" fill="none" stroke="currentColor" strokeLinecap="round" />
      </svg>
    )

  return (
    <section className="message-list" aria-label="Conversation">
      <ul className="message-list__items">
        {messages.map((message) => (
          <li
            key={message.id}
            className="message-list__item"
            data-role={message.role}
          >
            {message.role === 'user' ? (
              <p className="message-bubble message-bubble--user">{message.content}</p>
            ) : (
              <div className="message-inline-wrap">
                <p className="message-inline">{message.content}</p>
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
                      <CopyGlyph copied={copiedMessageId === message.id} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div ref={bottomRef} data-scroll-anchor aria-hidden="true" />
    </section>
  )
}
