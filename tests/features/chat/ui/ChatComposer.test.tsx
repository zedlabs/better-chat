import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposer } from '../../../../src/features/chat/ui/ChatComposer'

describe('ChatComposer', () => {
  it('sends message on Cmd/Ctrl + Enter shortcut', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)

    render(
      <ChatComposer
        value="Hello"
        isSending={false}
        onChange={() => undefined}
        onSend={onSend}
        onCancel={() => undefined}
      />,
    )

    await user.click(screen.getByRole('textbox', { name: 'Message' }))
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
