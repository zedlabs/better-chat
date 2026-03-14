import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../domain/chat-message'

interface MessageListProps {
  readonly messages: ReadonlyArray<ChatMessage>
}

export const MessageList = ({ messages }: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
              <p className="message-inline">{message.content}</p>
            )}
          </li>
        ))}
      </ul>
      <div ref={bottomRef} data-scroll-anchor aria-hidden="true" />
    </section>
  )
}
