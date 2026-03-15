import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { clearChatWorkspaceState } from '../../src/features/shell/application/chat-workspace-storage'

const getComposer = () => screen.getByRole('textbox', { name: 'Message' })

describe('App shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearChatWorkspaceState()
  })

  it('renders the main chat workspace with history sidebar', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'BetterChat' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Chat history' })).toBeInTheDocument()
    expect(getComposer()).toBeInTheDocument()
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

  it('enables reading mode from the sidebar toggle', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('checkbox').at(-1)!)

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-reading-mode', 'true')
  })

  it('keeps the conversation region scrollable in reading mode', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('checkbox').at(-1)!)

    const appShell = screen.getByTestId('app-shell')
    const conversation = screen.getByRole('region', { name: 'Conversation' })

    expect(appShell).toHaveAttribute('data-reading-mode', 'true')
    expect(appShell).toHaveAttribute('data-hide-sidebar', 'true')
    expect(appShell).toHaveAttribute('data-hide-topbar', 'true')
    expect(appShell).toHaveAttribute('data-hide-composer', 'true')

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
      value: 100,
      writable: true,
    })

    fireEvent.scroll(conversation)

    expect(screen.getByRole('button', { name: 'Scroll to bottom' })).toBeInTheDocument()
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
    await user.type(getComposer(), 'first')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText(/Add an API key for OpenAI/i)).toBeInTheDocument()
    })
    expect(fetchSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(getComposer(), 'second')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
      expect(screen.getByText('Saved key works')).toBeInTheDocument()
    })
  })

  it('shows BYOK guidance when sending without an API key', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(getComposer(), 'Hello there')
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
    expect(screen.getByRole('button', { name: /Thread 2/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /Thread 1/ })).toHaveAttribute('aria-current', 'false')
    expect(
      screen.getByText(
        'Welcome to Better Chat. Add your API key in Settings, then start the conversation.',
      ),
    ).toBeInTheDocument()
  })

  it('restores each thread messages when switching threads', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(getComposer(), 'Thread one')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    const conversation = screen.getByRole('region', { name: 'Conversation' })
    expect(within(conversation).getByText('Thread one')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New thread' }))
    await user.type(getComposer(), 'Thread two')
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

    await user.type(getComposer(), 'Thread one')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    await user.click(screen.getByRole('button', { name: 'New thread' }))
    await user.type(getComposer(), 'Thread two')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    const conversation = screen.getByRole('region', { name: 'Conversation' })
    expect(within(conversation).getByText('Thread two')).toBeInTheDocument()

    firstMount.unmount()
    render(<App />)

    expect(screen.getByRole('button', { name: /Thread one/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thread two/ })).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Conversation' })).getByText('Thread two'),
    ).toBeInTheDocument()
  })

  it('rehydrates saved provider settings and reading mode', async () => {
    const user = userEvent.setup()
    const firstMount = render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Provider' }), 'anthropic')
    await user.type(screen.getByLabelText('API key'), 'anthropic-test-key')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getAllByRole('checkbox').at(-1)!)

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-reading-mode', 'true')

    firstMount.unmount()
    render(<App />)

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-reading-mode', 'true')

    await user.click(screen.getAllByRole('checkbox').at(-1)!)
    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByRole('combobox', { name: 'Provider' })).toHaveValue('anthropic')
    expect(screen.getByLabelText('API key')).toHaveValue('anthropic-test-key')
  })

  it('saves global system prompt and sends it in provider requests', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Done' } }],
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
    await user.type(screen.getByLabelText('Global system prompt'), 'Always answer in bullet points.')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(getComposer(), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    const requestBody = String((fetchSpy.mock.calls.at(-1)?.[1] as RequestInit).body)
    expect(requestBody).toContain('Always answer in bullet points.')
  })

  it('cancels an in-flight provider request', async () => {
    const user = userEvent.setup()
    const observedSignals: AbortSignal[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation((_, init) => {
      const requestSignal = (init as RequestInit | undefined)?.signal as AbortSignal | undefined

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

    await user.type(getComposer(), 'Long request')
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

    await user.type(getComposer(), 'Please recover')
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

    await user.type(getComposer(), 'Explain this')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText('First answer')).toBeInTheDocument()
    })

    screen.getByRole('button', { name: 'Regenerate response' }).click()

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Improved answer')).toBeInTheDocument()
      expect(screen.queryByText('First answer')).not.toBeInTheDocument()
    })
  })

  it('shows a responding status while streaming assistant text', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(
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
          }, 120)
        }),
    )

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.type(screen.getByLabelText('API key'), 'sk-streaming')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(getComposer(), 'Stream this')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(screen.getByText(/Responding/)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText(/Responding/)).not.toBeInTheDocument()
      expect(
        screen.getByText(
          'Streaming response from provider with multiple chunks for smoother rendering.',
        ),
      ).toBeInTheDocument()
    })
  })

  it('streams Gemini responses from provider SSE endpoint', async () => {
    const user = userEvent.setup()
    const encoder = new TextEncoder()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\n',
            ),
          )

          setTimeout(() => {
            controller.enqueue(
              encoder.encode(
                'data: {"candidates":[{"content":{"parts":[{"text":"lo"}]}}]}\n\n',
              ),
            )
            controller.close()
          }, 25)
        },
      })

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Provider' }), 'gemini')
    await user.type(screen.getByLabelText('API key'), 'gemini-stream-key')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    await user.type(getComposer(), 'Say hello')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText('Hel')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })

    const requestUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '')
    expect(requestUrl).toContain(':streamGenerateContent')
  })

  it('creates, reopens, and deletes a text-selection branch', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Branch reply' } }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.type(screen.getByLabelText('API key'), 'sk-branch-key')
    await user.click(screen.getByRole('button', { name: 'Save provider settings' }))
    await user.click(screen.getByRole('button', { name: 'Close settings' }))

    const assistantMessage = screen.getByText(/Welcome to Better Chat/i)
    const selectedText = 'Better Chat'

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => selectedText,
      anchorNode: assistantMessage.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({
          top: 30,
          left: 30,
          width: 20,
          height: 20,
          right: 50,
          bottom: 50,
          x: 30,
          y: 30,
          toJSON: () => ({}),
        }),
      }),
    } as unknown as Selection)

    fireEvent.mouseUp(assistantMessage)

    await user.click(screen.getByRole('button', { name: '+ Create New Branch Here' }))

    const branchDialog = screen.getByRole('dialog', { name: 'Branch details' })
    expect(branchDialog).toBeInTheDocument()
    expect(
      within(branchDialog).getByText(/Branch context from highlighted text/i),
    ).toBeInTheDocument()
    expect(within(branchDialog).getByText(new RegExp(selectedText, 'i'))).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Branch notes' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Toggle branch notes' }))
    expect(screen.getByRole('textbox', { name: 'Branch notes' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand branch' }))
    expect(screen.getByRole('button', { name: 'Collapse branch' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse branch' }))

    await user.type(screen.getByRole('textbox', { name: 'Branch message' }), 'Branch prompt')
    await user.click(screen.getByRole('button', { name: 'Send branch message' }))

    await waitFor(() => {
      expect(screen.getByText('Branch reply')).toBeInTheDocument()
      expect(fetchSpy).toHaveBeenCalled()
    })

    await user.type(screen.getByRole('textbox', { name: 'Branch notes' }), 'My saved note')

    await user.click(screen.getByRole('button', { name: 'Close branch' }))
    expect(screen.queryByRole('dialog', { name: 'Branch details' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Open branch/i }))
    expect(screen.getByRole('dialog', { name: 'Branch details' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Toggle branch notes' }))
    expect(screen.getByRole('textbox', { name: 'Branch notes' })).toHaveValue('My saved note')
    expect(screen.getByText('Branch reply')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete branch' }))
    expect(screen.queryByRole('dialog', { name: 'Branch details' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open branch/i })).not.toBeInTheDocument()
  })
})
