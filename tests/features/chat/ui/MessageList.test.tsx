import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../../../../src/features/chat/domain/chat-message'
import { MessageList } from '../../../../src/features/chat/ui/MessageList'

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

const defaultBranchProps = {
  branches: [],
  onCreateBranch: vi.fn<(messageId: string, quote: string) => void>(),
  onOpenBranch: vi.fn<(branchId: string) => void>(),
}

describe('MessageList', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('scrolls to the bottom sentinel when messages are first rendered', () => {
    const messages = [makeMessage('1', 'user', 'Hello')]

    render(
      <MessageList
        messages={messages}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        {...defaultBranchProps}
      />,
    )

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
    })
  })

  it('scrolls to the bottom when a new message is added', () => {
    const initial = [makeMessage('1', 'user', 'Hello')]
    const { rerender } = render(
      <MessageList
        messages={initial}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        {...defaultBranchProps}
      />,
    )

    vi.clearAllMocks()

    const updated = [...initial, makeMessage('2', 'assistant', 'Hi there!')]
    rerender(
      <MessageList
        messages={updated}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        {...defaultBranchProps}
      />,
    )

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
    })
  })

  it('does not force-scroll back to bottom after the user scrolls up', () => {
    const initialMessages = [makeMessage('1', 'assistant', 'First response', 'gpt-5.4')]
    const { rerender } = render(
      <MessageList
        messages={initialMessages}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages
        {...defaultBranchProps}
      />,
    )

    const conversation = screen.getByRole('region', { name: 'Conversation' })

    Object.defineProperty(conversation, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(conversation, 'clientHeight', {
      configurable: true,
      value: 500,
    })
    Object.defineProperty(conversation, 'scrollTop', {
      configurable: true,
      value: 0,
      writable: true,
    })

    fireEvent.scroll(conversation)
    expect(screen.getByRole('button', { name: 'Scroll to bottom' })).toBeInTheDocument()

    vi.clearAllMocks()

    rerender(
      <MessageList
        messages={[
          ...initialMessages,
          makeMessage('2', 'assistant', 'Second response', 'gpt-5.4'),
        ]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages
        {...defaultBranchProps}
      />,
    )

    expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it('renders a bottom sentinel element for scroll targeting', () => {
    const { container } = render(
      <MessageList
        messages={[]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        {...defaultBranchProps}
      />,
    )
    expect(container.querySelector('[data-scroll-anchor]')).toBeInTheDocument()
  })

  it('shows assistant model label when present', () => {
    render(
      <MessageList
        messages={[makeMessage('2', 'assistant', 'Hello', 'gpt-5.4')]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        {...defaultBranchProps}
      />,
    )

    expect(screen.getByText('Model: gpt-5.4')).toBeInTheDocument()
  })

  it('copies assistant text to clipboard from copy button', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal('navigator', {
      ...window.navigator,
      clipboard: { writeText },
    })

    render(
      <MessageList
        messages={[makeMessage('2', 'assistant', 'Copy me', 'gpt-5.4')]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        {...defaultBranchProps}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Copy response' }))

    expect(writeText).toHaveBeenCalledWith('Copy me')
    expect(
      screen.getByRole('button', { name: 'Copy response' }).querySelector('svg'),
    ).not.toBeNull()
  })

  it('hides model and copy controls while assistant message is streaming', () => {
    render(
      <MessageList
        messages={[makeMessage('2', 'assistant', 'Typing...', 'gpt-5.4', true)]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        {...defaultBranchProps}
      />,
    )

    expect(screen.queryByText('Model: gpt-5.4')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy response' })).not.toBeInTheDocument()
  })

  it('renders assistant markdown content safely', () => {
    const { container } = render(
      <MessageList
        messages={[
          makeMessage(
            '2',
            'assistant',
            '**Bold**\n\n- One\n\n```ts\nconst x = 1\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n$E=mc^2$\n\n<script>alert(1)</script>',
            'gpt-5.4',
          ),
        ]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        {...defaultBranchProps}
      />,
    )

    expect(screen.getByText('Bold').tagName).toBe('STRONG')
    expect(screen.getByText('One').tagName).toBe('LI')
    expect(container.querySelector('code')?.textContent).toContain('const x = 1')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('hides user messages when reading mode requests it', () => {
    render(
      <MessageList
        messages={[
          makeMessage('1', 'user', 'Hide me'),
          makeMessage('2', 'assistant', 'Keep me', 'gpt-5.4'),
        ]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages
        {...defaultBranchProps}
      />,
    )

    expect(screen.queryByText('Hide me')).not.toBeInTheDocument()
    expect(screen.getByText('Keep me')).toBeInTheDocument()
  })

  it('creates a branch from selected text', async () => {
    const user = userEvent.setup()
    const onCreateBranch = vi.fn<(messageId: string, quote: string) => void>()

    render(
      <MessageList
        messages={[makeMessage('2', 'assistant', 'Welcome to Better Chat', 'gpt-5.4')]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        branches={[]}
        onCreateBranch={onCreateBranch}
        onOpenBranch={vi.fn()}
      />,
    )

    const assistantText = screen.getByText('Welcome to Better Chat')
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'Better Chat',
      anchorNode: assistantText.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({
          top: 20,
          left: 20,
          width: 15,
          height: 15,
          right: 35,
          bottom: 35,
          x: 20,
          y: 20,
          toJSON: () => ({}),
        }),
      }),
    } as unknown as Selection)

    fireEvent.mouseUp(assistantText)
    await user.click(screen.getByRole('button', { name: '+ Create New Branch Here' }))

    expect(onCreateBranch).toHaveBeenCalledWith('2', 'Better Chat')
  })

  it('renders branch chip and opens branch dialog callback', async () => {
    const user = userEvent.setup()
    const onOpenBranch = vi.fn<(branchId: string) => void>()

    render(
      <MessageList
        messages={[makeMessage('2', 'assistant', 'Welcome to Better Chat', 'gpt-5.4')]}
        canRegenerateLastResponse={false}
        onRegenerate={vi.fn()}
        hideUserMessages={false}
        branches={[
          {
            id: 'branch-1',
            conversationId: 'conversation-1',
            sourceMessageId: '2',
            quote: 'Better Chat',
            notes: '',
            messages: [],
          },
        ]}
        onCreateBranch={vi.fn()}
        onOpenBranch={onOpenBranch}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Open branch Better Chat/i }))

    expect(onOpenBranch).toHaveBeenCalledWith('branch-1')
  })
})
