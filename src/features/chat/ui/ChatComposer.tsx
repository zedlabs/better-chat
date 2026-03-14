import type { FormEvent } from 'react'

interface ChatComposerProps {
  readonly value: string
  readonly isSending: boolean
  readonly onChange: (value: string) => void
  readonly onSend: () => Promise<void>
  readonly onCancel: () => void
}

export const ChatComposer = ({
  value,
  isSending,
  onChange,
  onSend,
  onCancel,
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
        {isSending && (
          <button
            type="button"
            className="secondary-button chat-composer__cancel"
            aria-label="Cancel response"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
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
