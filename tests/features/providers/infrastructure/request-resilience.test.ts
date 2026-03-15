import { describe, expect, it, vi } from 'vitest'
import { executeWithResilience } from '../../../../src/features/providers/infrastructure/request-resilience'

describe('executeWithResilience', () => {
  it('retries retryable responses until success', async () => {
    const operation = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))

    const result = await executeWithResilience({
      operation: () => operation(),
      shouldRetry: (response: Response) => !response.ok && response.status === 503,
      maxAttempts: 2,
      timeoutMs: 1000,
    })

    expect(result.status).toBe(200)
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('throws a timeout error when attempt exceeds timeout window', async () => {
    vi.useFakeTimers()

    const operation = vi.fn((signal: AbortSignal) =>
      new Promise<Response>((_, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Operation timed out', 'AbortError')),
          { once: true },
        )
      }),
    )

    const pendingRequest = executeWithResilience({
      operation,
      shouldRetry: () => false,
      timeoutMs: 250,
      maxAttempts: 1,
    })

    const timeoutAssertion = expect(pendingRequest).rejects.toThrow(
      'Request timed out after 250ms.',
    )

    await vi.advanceTimersByTimeAsync(251)

    await timeoutAssertion
    expect(operation).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('propagates user cancellation as AbortError', async () => {
    const abortController = new AbortController()
    const operation = vi.fn((signal: AbortSignal) =>
      new Promise<Response>((_, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        )
      }),
    )

    const pendingRequest = executeWithResilience({
      operation,
      shouldRetry: () => false,
      signal: abortController.signal,
      timeoutMs: 1000,
      maxAttempts: 1,
    })

    abortController.abort()

    await expect(pendingRequest).rejects.toMatchObject({ name: 'AbortError' })
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
