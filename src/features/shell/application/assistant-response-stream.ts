const DEFAULT_CHUNK_SIZE = 14
const DEFAULT_CHUNK_DELAY_MS = 18

interface StreamAssistantResponseInput {
  readonly text: string
  readonly onChunk: (content: string) => void
  readonly signal?: AbortSignal
  readonly chunkSize?: number
  readonly chunkDelayMs?: number
}

const createAbortError = (): DOMException =>
  new DOMException('The operation was aborted.', 'AbortError')

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

export const streamAssistantResponse = async ({
  text,
  onChunk,
  signal,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkDelayMs = DEFAULT_CHUNK_DELAY_MS,
}: StreamAssistantResponseInput): Promise<void> => {
  const normalizedText = text.trim()

  if (normalizedText.length === 0) {
    onChunk('')
    return
  }

  let offset = 0
  while (offset < normalizedText.length) {
    if (signal?.aborted) {
      throw createAbortError()
    }

    offset = Math.min(offset + chunkSize, normalizedText.length)
    onChunk(normalizedText.slice(0, offset))

    if (offset < normalizedText.length) {
      await wait(chunkDelayMs)
    }
  }
}
