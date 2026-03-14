import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MessageList } from './MessageList'
import type { ChatMessage } from '../domain/chat-message'

const makeMessage = (
  id: string,
  role: 'user' | 'assistant',
  content: string,
  generatedModel?: string,
  isStreaming?: boolean,
): ChatMessage => ({
  id,
  role,
  content,
  createdAtIso: new Date().toISOString(),
  generatedModel,
  isStreaming,
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

  it('shows assistant model label when present', () => {
    render(<MessageList messages={[makeMessage('2', 'assistant', 'Hello', 'gpt-5.4')]} />)

    expect(screen.getByText('Model: gpt-5.4')).toBeInTheDocument()
  })

  it('copies assistant text to clipboard from copy button', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal('navigator', {
      ...window.navigator,
      clipboard: { writeText },
    })

    render(<MessageList messages={[makeMessage('2', 'assistant', 'Copy me', 'gpt-5.4')]} />)

    await user.click(screen.getByRole('button', { name: 'Copy response' }))

    expect(writeText).toHaveBeenCalledWith('Copy me')
    expect(screen.getByRole('button', { name: 'Copy response' }).querySelector('svg')).not.toBeNull()
  })

  it('hides model and copy controls while assistant message is streaming', () => {
    render(<MessageList messages={[makeMessage('2', 'assistant', 'Typing...', 'gpt-5.4', true)]} />)

    expect(screen.queryByText('Model: gpt-5.4')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy response' })).not.toBeInTheDocument()
  })
})
