import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MessageList } from './MessageList'
import type { ChatMessage } from '../domain/chat-message'

const makeMessage = (id: string, role: 'user' | 'assistant', content: string): ChatMessage => ({
  id,
  role,
  content,
  createdAtIso: new Date().toISOString(),
})

describe('MessageList', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('scrolls to the bottom sentinel when messages are first rendered', () => {
    const messages = [makeMessage('1', 'user', 'Hello')]

    render(<MessageList messages={messages} />)

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('scrolls to the bottom when a new message is added', () => {
    const initial = [makeMessage('1', 'user', 'Hello')]
    const { rerender } = render(<MessageList messages={initial} />)

    vi.clearAllMocks()

    const updated = [
      ...initial,
      makeMessage('2', 'assistant', 'Hi there!'),
    ]
    rerender(<MessageList messages={updated} />)

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('renders a bottom sentinel element for scroll targeting', () => {
    const { container } = render(<MessageList messages={[]} />)
    expect(container.querySelector('[data-scroll-anchor]')).toBeInTheDocument()
  })
})
