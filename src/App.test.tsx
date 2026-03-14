import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { clearChatWorkspaceState } from './features/shell/application/chat-workspace-storage'

describe('App shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearChatWorkspaceState()
  })

  it('renders the main chat workspace with history sidebar', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Better Chat' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Chat history' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message composer' })).toBeInTheDocument()
  })

  it('collapses and expands the history sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sidebar = screen.getByTestId('history-sidebar')
    const toggleButton = screen.getByRole('button', { name: 'Collapse sidebar' })

    expect(sidebar).toHaveAttribute('data-collapsed', 'false')

    await user.click(toggleButton)
    expect(screen.getByTestId('history-sidebar')).toHaveAttribute('data-collapsed', 'true')

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByTestId('history-sidebar')).toHaveAttribute('data-collapsed', 'false')
  })

  it('opens and closes settings popup from sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('enables reading mode from settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.click(screen.getByRole('checkbox', { name: 'Enable reading mode' }))

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-reading-mode', 'true')
  })

  it('offers all three providers in settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))

    const providerSelect = screen.getByRole('combobox', { name: 'Provider' })
    expect(providerSelect).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'OpenAI' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Anthropic' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Gemini' })).toBeInTheDocument()

    expect(screen.getByRole('option', { name: 'gpt-5.4' })).toBeInTheDocument()
  })

  it('requires saving provider settings before key is used', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Saved key works' } }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.type(screen.getByLabelText('API key'), 'sk-test-key')

    await user.click(screen.getByRole('button', { name: 'Close settings' }))
    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'first')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText(/Add an API key for OpenAI/i)).toBeInTheDocument()
    })
    expect(fetchSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'second')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
      expect(screen.getByText('Saved key works')).toBeInTheDocument()
    })
  })

  it('shows BYOK guidance when sending without an API key', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Hello there')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    const conversation = screen.getByRole('region', { name: 'Conversation' })
    expect(within(conversation).getByText('Hello there')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Add an API key for OpenAI/i)).toBeInTheDocument()
    })
  })

  it('creates a new thread and focuses it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'New thread' }))

    expect(screen.getAllByRole('button', { name: /Thread \d/ })).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Thread 2/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: /Thread 1/ })).toHaveAttribute(
      'aria-current',
      'false',
    )
    expect(
      screen.getByText(
        'Welcome to Better Chat. Add your API key in Settings, then start the conversation.',
      ),
    ).toBeInTheDocument()
  })

  it('restores each thread messages when switching threads', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Thread one')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    const conversation = screen.getByRole('region', { name: 'Conversation' })
    expect(within(conversation).getByText('Thread one')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New thread' }))
    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Thread two')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(within(conversation).getByText('Thread two')).toBeInTheDocument()
    expect(within(conversation).queryByText('Thread one')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Thread one/ }))
    expect(within(conversation).getByText('Thread one')).toBeInTheDocument()
    expect(within(conversation).queryByText('Thread two')).not.toBeInTheDocument()
  })

  it('rehydrates threads and active conversation from local storage', async () => {
    const user = userEvent.setup()
    const firstMount = render(<App />)

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Thread one')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    await user.click(screen.getByRole('button', { name: 'New thread' }))
    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Thread two')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    const conversation = screen.getByRole('region', { name: 'Conversation' })
    expect(within(conversation).getByText('Thread two')).toBeInTheDocument()

    firstMount.unmount()
    render(<App />)

    expect(screen.getByRole('button', { name: /Thread one/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thread two/ })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Conversation' })).getByText('Thread two')).toBeInTheDocument()
  })

  it('rehydrates saved provider settings and reading mode', async () => {
    const user = userEvent.setup()
    const firstMount = render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Provider' }), 'anthropic')
    await user.type(screen.getByLabelText('API key'), 'anthropic-test-key')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('checkbox', { name: 'Enable reading mode' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-reading-mode', 'true')

    firstMount.unmount()
    render(<App />)

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-reading-mode', 'true')

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByRole('combobox', { name: 'Provider' })).toHaveValue('anthropic')
    expect(screen.getByLabelText('API key')).toHaveValue('anthropic-test-key')
  })

  it('cancels an in-flight provider request', async () => {
    const user = userEvent.setup()
    const observedSignals: AbortSignal[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation((_, init) => {
      const requestSignal = (init as RequestInit | undefined)?.signal as
        | AbortSignal
        | undefined

      if (requestSignal) {
        observedSignals.push(requestSignal)
      }

      return new Promise<Response>((_, reject) => {
        requestSignal?.addEventListener(
          'abort',
          () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          },
          { once: true },
        )
      })
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.type(screen.getByLabelText('API key'), 'sk-live-long-running')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Long request')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(screen.getByRole('button', { name: 'Cancel response' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel response' }))

    await waitFor(() => {
      expect(observedSignals.at(0)?.aborted).toBe(true)
      expect(screen.getByText('Response cancelled.')).toBeInTheDocument()
    })
  })

  it('retries transient provider failures before succeeding', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Service unavailable' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Recovered after retry' } }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.type(screen.getByLabelText('API key'), 'sk-retry-test')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Please recover')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Recovered after retry')).toBeInTheDocument()
    })
  })

  it('regenerates the last assistant response', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'First answer' } }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Improved answer' } }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.type(screen.getByLabelText('API key'), 'sk-regenerate')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Explain this')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText('First answer')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Regenerate response' }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Improved answer')).toBeInTheDocument()
      expect(screen.queryByText('First answer')).not.toBeInTheDocument()
    })
  })

  it('shows a responding status while streaming assistant text', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  'Streaming response from provider with multiple chunks for smoother rendering.',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.type(screen.getByLabelText('API key'), 'sk-streaming')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Stream this')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(screen.getByText('Assistant is responding...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('Assistant is responding...')).not.toBeInTheDocument()
      expect(
        screen.getByText(
          'Streaming response from provider with multiple chunks for smoother rendering.',
        ),
      ).toBeInTheDocument()
    })
  })
})
