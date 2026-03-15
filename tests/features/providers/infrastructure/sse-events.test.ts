import { describe, expect, it } from 'vitest'
import {
  readSseEvents,
  type SseEvent,
} from '../../../../src/features/providers/infrastructure/sse-events'

const createSseResponse = (chunks: string[]): Response => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
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

describe('readSseEvents', () => {
  it('parses event and data lines across chunks', async () => {
    const events: SseEvent[] = []

    await readSseEvents(
      createSseResponse([
        'event: first\n',
        'data: one\n\n',
        'event: second\n',
        'data: two',
        '\n\n',
      ]),
      (event) => {
        events.push(event)
      },
    )

    expect(events).toEqual([
      { event: 'first', data: 'one' },
      { event: 'second', data: 'two' },
    ])
  })

  it('joins multiline data blocks and ignores comments', async () => {
    const events: SseEvent[] = []

    await readSseEvents(
      createSseResponse([
        ': keepalive\n',
        'event: msg\n',
        'data: hello\n',
        'data: world\n\n',
      ]),
      (event) => {
        events.push(event)
      },
    )

    expect(events).toEqual([{ event: 'msg', data: 'hello\nworld' }])
  })
})
