import type { FormEvent, KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Expand, Minimize2, NotepadText, Trash2, X } from 'lucide-react'
import type { MessageBranch } from '../domain/message-branch'
import { AssistantMarkdown } from './AssistantMarkdown'

interface BranchDialogProps {
  readonly branch: MessageBranch | null
  readonly composerValue: string
  readonly isSending: boolean
  readonly onComposerChanged: (value: string) => void
  readonly onSend: () => Promise<void>
  readonly onCancel: () => void
  readonly onClose: () => void
  readonly onDelete: () => void
  readonly onNotesChanged: (notes: string) => void
}

export const BranchDialog = ({
  branch,
  composerValue,
  isSending,
  onComposerChanged,
  onSend,
  onCancel,
  onClose,
  onDelete,
  onNotesChanged,
}: BranchDialogProps) => {
  const [isFullPage, setIsFullPage] = useState(false)
  const [isNotesVisible, setIsNotesVisible] = useState(false)
  const scrollRef = useRef<HTMLElement>(null)

  const branchMessagesKey = useMemo(
    () =>
      branch
        ? `${branch.messages.length}:${branch.messages.at(-1)?.id ?? 'none'}:${branch.messages.at(-1)?.content ?? ''}`
        : 'none',
    [branch],
  )

  useEffect(() => {
    if (!branch) {
      setIsFullPage(false)
      setIsNotesVisible(false)
    }
  }, [branch])

  useEffect(() => {
    if (!branch || !scrollRef.current) {
      return
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [branch, branchMessagesKey])

  if (!branch) {
    return null
  }

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
    <section
      className={`branch-dialog${isFullPage ? ' branch-dialog--full-page' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Branch details"
    >
      <header className="branch-dialog__header branch-dialog__header--compact">
        <p className="branch-dialog__context-line" title={branch.quote}>
          Branch context from highlighted text: {branch.quote}
        </p>

        <div className="branch-dialog__actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Toggle branch notes"
            onClick={() => setIsNotesVisible((value) => !value)}
          >
            <NotepadText size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={isFullPage ? 'Collapse branch' : 'Expand branch'}
            onClick={() => setIsFullPage((value) => !value)}
          >
            {isFullPage ? <Minimize2 size={14} /> : <Expand size={14} />}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Delete branch"
            onClick={onDelete}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close branch"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <section
        ref={scrollRef}
        className="branch-dialog__messages message-list"
        aria-label="Branch conversation"
      >
        {branch.messages.length === 0 ? (
          <p className="branch-dialog__empty">No branch messages yet.</p>
        ) : (
          <ul className="branch-dialog__message-list message-list__items">
            {branch.messages.map((message) => (
              <li key={message.id} data-role={message.role}>
                {message.role === 'user' ? (
                  <p className="message-bubble message-bubble--user">{message.content}</p>
                ) : (
                  <div className="branch-dialog__assistant">
                    <AssistantMarkdown content={message.content} />
                    {message.isStreaming && <span className="branch-dialog__streaming">Streaming…</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="chat-composer branch-dialog__composer" onSubmit={handleSubmit}>
        <div className="chat-composer__row">
          <textarea
            id="branch-message"
            aria-label="Branch message"
            className="chat-composer__input"
            value={composerValue}
            rows={2}
            onChange={(event) => onComposerChanged(event.target.value)}
            onKeyDown={(event) => {
              void handleComposerKeyDown(event)
            }}
            placeholder="Ask within this branch"
          />
          <div className="chat-composer__actions">
            {isSending && (
              <button
                type="button"
                className="secondary-button"
                aria-label="Cancel branch response"
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="primary-button chat-composer__send"
              aria-label="Send branch message"
              data-shortcut="⌘+Enter"
              disabled={isSending || composerValue.trim().length === 0}
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </form>

      {isNotesVisible && (
        <label className="field-group branch-dialog__notes" htmlFor="branch-notes">
          <span>Branch notes</span>
          <textarea
            id="branch-notes"
            aria-label="Branch notes"
            value={branch.notes}
            rows={4}
            onChange={(event) => onNotesChanged(event.target.value)}
            placeholder="Optional notes"
          />
        </label>
      )}
    </section>
  )
}
