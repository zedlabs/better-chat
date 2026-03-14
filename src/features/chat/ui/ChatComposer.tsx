import type { FormEvent } from 'react'

interface ChatComposerProps {
  readonly value: string
  readonly isSending: boolean
  readonly onChange: (value: string) => void
  readonly onSend: () => Promise<void>
}

export const ChatComposer = ({
  value,
  isSending,
  onChange,
  onSend,
}: ChatComposerProps) => {
  const canSend = value.trim().length > 0 && !isSending

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSend()
  }

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <label className="chat-composer__label" htmlFor="message-composer">
        Message composer
      </label>
      <textarea
        id="message-composer"
        className="chat-composer__input"
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask anything..."
      />
      <div className="chat-composer__footer">
        <button
          type="submit"
          className="primary-button"
          aria-label="Send message"
          disabled={!canSend}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  )
}
