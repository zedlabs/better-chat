export interface SseEvent {
  readonly event: string | null
  readonly data: string
}

type OnSseEvent = (event: SseEvent) => void

const splitEventBlocks = (buffer: string): { readonly blocks: string[]; readonly rest: string } => {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const blocks = normalized.split('\n\n')

  return {
    blocks: blocks.slice(0, -1),
    rest: blocks.at(-1) ?? '',
  }
}

const parseSseEventBlock = (block: string): SseEvent | null => {
  const lines = block.split('\n')
  const dataLines: string[] = []
  let eventName: string | null = null

  for (const line of lines) {
    if (line.startsWith(':')) {
      continue
    }

    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() || null
      continue
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  return {
    event: eventName,
    data: dataLines.join('\n'),
  }
}

export const readSseEvents = async (response: Response, onEvent: OnSseEvent): Promise<void> => {
  if (!response.body) {
    throw new Error('Streaming response body was not available.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const readResult = await reader.read()

    if (readResult.done) {
      break
    }

    buffer += decoder.decode(readResult.value, { stream: true })
    const split = splitEventBlocks(buffer)
    buffer = split.rest

    for (const block of split.blocks) {
      const event = parseSseEventBlock(block)
      if (event) {
        onEvent(event)
      }
    }
  }

  buffer += decoder.decode()

  const finalEvent = parseSseEventBlock(buffer)
  if (finalEvent) {
    onEvent(finalEvent)
  }
}
