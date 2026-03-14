import { describe, expect, it, vi } from 'vitest'
import { streamAssistantResponse } from './assistant-response-stream'

describe('streamAssistantResponse', () => {
  it('emits cumulative content over multiple chunks', async () => {
    vi.useFakeTimers()

    const chunks: string[] = []
    const streamPromise = streamAssistantResponse({
      text: 'chunked response text',
      onChunk: (content) => {
        chunks.push(content)
      },
      chunkSize: 7,
      chunkDelayMs: 20,
    })

    await vi.runAllTimersAsync()
    await streamPromise

    expect(chunks).toEqual([
      'chunked',
      'chunked respon',
      'chunked response text',
    ])

    vi.useRealTimers()
  })

  it('throws abort error when cancelled mid-stream', async () => {
    vi.useFakeTimers()

    const abortController = new AbortController()
    const chunks: string[] = []

    const streamPromise = streamAssistantResponse({
      text: 'cancel me please',
      onChunk: (content) => {
        chunks.push(content)
        if (chunks.length === 1) {
          abortController.abort()
        }
      },
      signal: abortController.signal,
      chunkSize: 4,
      chunkDelayMs: 15,
    })

    const abortExpectation = expect(streamPromise).rejects.toMatchObject({
      name: 'AbortError',
    })

    await vi.runAllTimersAsync()
    await abortExpectation

    expect(chunks).toEqual(['canc'])

    vi.useRealTimers()
  })
})
