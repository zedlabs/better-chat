const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_TIMEOUT_MS = 20000

interface ExecuteWithResilienceInput<T> {
  readonly operation: (signal: AbortSignal) => Promise<T>
  readonly shouldRetry: (result: T) => boolean
  readonly signal?: AbortSignal
  readonly maxAttempts?: number
  readonly timeoutMs?: number
}

interface MergedSignalController {
  readonly signal: AbortSignal
  readonly didTimeout: () => boolean
  cleanup: () => void
}

const isAbortError = (error: unknown): boolean =>
  (error instanceof DOMException && error.name === 'AbortError') ||
  (error instanceof Error && error.name === 'AbortError')

const isRetryableError = (error: unknown): boolean =>
  error instanceof TypeError ||
  (error instanceof Error && error.message.toLowerCase().includes('network'))

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

const createMergedSignal = (
  userSignal: AbortSignal | undefined,
  timeoutMs: number,
): MergedSignalController => {
  const controller = new AbortController()
  let didTimeout = false

  const timeoutId = setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  const onUserAbort = () => {
    controller.abort()
  }

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort()
    } else {
      userSignal.addEventListener('abort', onUserAbort)
    }
  }

  const cleanup = () => {
    clearTimeout(timeoutId)
    userSignal?.removeEventListener('abort', onUserAbort)
  }

  return {
    signal: controller.signal,
    didTimeout: () => didTimeout,
    cleanup,
  }
}

export const executeWithResilience = async <T>(
  input: ExecuteWithResilienceInput<T>,
): Promise<T> => {
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let latestResult: T | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const mergedSignal = createMergedSignal(input.signal, timeoutMs)

    try {
      const result = await input.operation(mergedSignal.signal)
      latestResult = result

      if (!input.shouldRetry(result)) {
        return result
      }
    } catch (error) {
      if (isAbortError(error)) {
        if (mergedSignal.didTimeout() && !input.signal?.aborted) {
          throw new Error(`Request timed out after ${timeoutMs}ms.`)
        }

        throw error
      }

      if (attempt >= maxAttempts || !isRetryableError(error)) {
        throw error
      }

      await delay(Math.min(200 * 2 ** (attempt - 1), 1000))
      continue
    } finally {
      mergedSignal.cleanup()
    }

    if (attempt < maxAttempts) {
      await delay(Math.min(200 * 2 ** (attempt - 1), 1000))
      continue
    }

    break
  }

  if (latestResult) {
    return latestResult
  }

  throw new Error('Request failed after retries.')
}
