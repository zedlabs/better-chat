import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUserMessage } from '../../chat/domain/chat-message'
import { createHttpProviderGatewayRegistry } from './http-provider-gateways'

const createSseResponse = (events: string[]): Response => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  })
}

const createRequest = () => ({
  apiKey: 'test-key',
  model: 'test-model',
  messages: [createUserMessage('Hello')],
})

describe('http provider streaming gateways', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('streams OpenAI deltas from SSE events', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    const onContent = vi.fn<(content: string) => void>()
    const gateway = createHttpProviderGatewayRegistry().resolve('openai')
    const result = await gateway.stream!(createRequest(), onContent)

    expect(result).toBe('Hello')
    expect(onContent).toHaveBeenNthCalledWith(1, 'Hel')
    expect(onContent).toHaveBeenNthCalledWith(2, 'Hello')

    const body = String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body)
    expect(body).toContain('"stream":true')
  })

  it('streams Anthropic text_delta events', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSseResponse([
        'event: content_block_delta\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
        'event: content_block_delta\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}\n\n',
      ]),
    )

    const onContent = vi.fn<(content: string) => void>()
    const gateway = createHttpProviderGatewayRegistry().resolve('anthropic')
    const result = await gateway.stream!(createRequest(), onContent)

    expect(result).toBe('Hi there')
    expect(onContent).toHaveBeenNthCalledWith(1, 'Hi')
    expect(onContent).toHaveBeenNthCalledWith(2, 'Hi there')
  })

  it('uses Gemini SSE endpoint and x-goog-api-key header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n',
      ]),
    )

    const onContent = vi.fn<(content: string) => void>()
    const gateway = createHttpProviderGatewayRegistry().resolve('gemini')
    const result = await gateway.stream!(createRequest(), onContent)

    expect(result).toBe('Hello')
    expect(onContent).toHaveBeenNthCalledWith(1, 'Hel')
    expect(onContent).toHaveBeenNthCalledWith(2, 'Hello')

    const requestUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '')
    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit

    expect(requestUrl).toContain(':streamGenerateContent?alt=sse')
    expect((requestInit.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key')
  })
})
