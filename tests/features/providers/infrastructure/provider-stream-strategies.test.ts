import { describe, expect, it } from 'vitest'
import {
  anthropicStreamStrategy,
  mergeStreamText,
  openAiStreamStrategy,
} from '../../../../src/features/providers/infrastructure/provider-stream-strategies'

describe('provider stream strategies', () => {
  it('ignores OpenAI [DONE] stream events', () => {
    const payload = openAiStreamStrategy.parseEventPayload({
      event: null,
      data: '[DONE]',
    })

    expect(payload).toBeNull()
  })

  it('extracts Anthropic text delta events', () => {
    const payload = anthropicStreamStrategy.parseEventPayload({
      event: 'content_block_delta',
      data: JSON.stringify({
        type: 'content_block_delta',
        delta: {
          type: 'text_delta',
          text: 'Hello',
        },
      }),
    })

    expect(payload).not.toBeNull()
    expect(anthropicStreamStrategy.extractText(payload!)).toBe('Hello')
  })

  it('merges prefix-aware chunks without duplicating text', () => {
    let content = ''

    content = mergeStreamText(content, 'Hel', 'prefix-aware')
    content = mergeStreamText(content, 'Hello', 'prefix-aware')

    expect(content).toBe('Hello')
  })
})
