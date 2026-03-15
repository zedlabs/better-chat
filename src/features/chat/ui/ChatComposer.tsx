import type { FormEvent, KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'

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

  const handleComposerKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) {
      return
    }

    event.preventDefault()
    await onSend()
  }

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <div className="chat-composer__row">
        <textarea
          id="message-composer"
          className="chat-composer__input"
          value={value}
          rows={2}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            void handleComposerKeyDown(event)
          }}
          placeholder="Ask anything…"
          aria-label="Message"
        />
        <div className="chat-composer__actions">
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
            className="primary-button chat-composer__send"
            aria-label="Send message"
            data-shortcut="⌘+Enter"
            disabled={!canSend}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </form>
  )
}
