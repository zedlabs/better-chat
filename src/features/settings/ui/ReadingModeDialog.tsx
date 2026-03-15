import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import {
  readingSchemeCatalog,
  type ReadingModeSettings,
  type ReadingSchemeId,
} from '../domain/reading-mode-settings'

interface ReadingModeDialogProps {
  readonly isVisible: boolean
  readonly readingModeSettings: ReadingModeSettings
  readonly onClose: () => void
  readonly onReadingSchemeSelected: (schemeId: ReadingSchemeId) => void
  readonly onHideTopBarToggled: () => void
  readonly onHideSidebarToggled: () => void
  readonly onHideComposerToggled: () => void
  readonly onHideUserMessagesToggled: () => void
}

export const ReadingModeDialog = ({
  isVisible,
  readingModeSettings,
  onClose,
  onReadingSchemeSelected,
  onHideTopBarToggled,
  onHideSidebarToggled,
  onHideComposerToggled,
  onHideUserMessagesToggled,
}: ReadingModeDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isVisible, onClose])

  useEffect(() => {
    if (!isVisible) return
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div className="reading-mode-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Reading mode settings">
      <div className="reading-mode-dialog__header">
        <span className="reading-mode-dialog__title">Reading mode settings</span>
        <button type="button" className="icon-button reading-mode-dialog__close" aria-label="Close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <label className="field-group" htmlFor="reading-scheme-selector">
        <span>Theme</span>
        <select
          id="reading-scheme-selector"
          value={readingModeSettings.schemeId}
          onChange={(event) => onReadingSchemeSelected(event.target.value as ReadingSchemeId)}
        >
          {readingSchemeCatalog.map((scheme) => (
            <option key={scheme.id} value={scheme.id}>
              {scheme.label}
            </option>
          ))}
        </select>
      </label>

      <div className="reading-mode-dialog__hide-section">
        <p className="reading-mode-dialog__section-label">Hide when active</p>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={readingModeSettings.hideTopBar}
            onChange={onHideTopBarToggled}
          />
          <span>Top bar</span>
        </label>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={readingModeSettings.hideSidebar}
            onChange={onHideSidebarToggled}
          />
          <span>Sidebar</span>
        </label>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={readingModeSettings.hideComposer}
            onChange={onHideComposerToggled}
          />
          <span>Message composer</span>
        </label>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={readingModeSettings.hideUserMessages}
            onChange={onHideUserMessagesToggled}
          />
          <span>Hide your messages</span>
        </label>
      </div>
    </div>
  )
}
