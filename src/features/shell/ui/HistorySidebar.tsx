import { type ReactNode } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Plus, Settings, X } from 'lucide-react'
import { ReadingModeDialog } from '../../settings/ui/ReadingModeDialog'
import type { ReadingModeSettings, ReadingSchemeId } from '../../settings/domain/reading-mode-settings'

interface ConversationSummary {
  readonly id: string
  readonly title: string
  readonly updatedAtLabel: string
}

interface HistorySidebarProps {
  readonly isCollapsed: boolean
  readonly isMobile: boolean
  readonly history: ReadonlyArray<ConversationSummary>
  readonly activeConversationId: string
  readonly onToggleSidebar: () => void
  readonly onCreateThread: () => void
  readonly onSelectThread: (conversationId: string) => void
  readonly onOpenSettings: () => void
  readonly readingModeSettings: ReadingModeSettings
  readonly isReadingModeDialogOpen: boolean
  readonly onToggleReadingMode: () => void
  readonly onOpenReadingModeDialog: () => void
  readonly onCloseReadingModeDialog: () => void
  readonly onReadingSchemeSelected: (schemeId: ReadingSchemeId) => void
  readonly onHideTopBarToggled: () => void
  readonly onHideSidebarToggled: () => void
  readonly onHideComposerToggled: () => void
  readonly onHideUserMessagesToggled: () => void
  readonly children?: ReactNode
}

export const HistorySidebar = ({
  isCollapsed,
  isMobile,
  history,
  activeConversationId,
  onToggleSidebar,
  onCreateThread,
  onSelectThread,
  onOpenSettings,
  readingModeSettings,
  isReadingModeDialogOpen,
  onToggleReadingMode,
  onOpenReadingModeDialog,
  onCloseReadingModeDialog,
  onReadingSchemeSelected,
  onHideTopBarToggled,
  onHideSidebarToggled,
  onHideComposerToggled,
  onHideUserMessagesToggled,
  children,
}: HistorySidebarProps) => (
  <aside
    className="history-sidebar"
    data-testid="history-sidebar"
    data-collapsed={isCollapsed ? 'true' : 'false'}
    aria-label="Chat history"
  >
    <div className="history-sidebar__header">
      <button
        type="button"
        className="icon-button history-sidebar__toggle"
        aria-label={isCollapsed ? 'Expand sidebar' : isMobile ? 'Close sidebar' : 'Collapse sidebar'}
        onClick={onToggleSidebar}
      >
        {isCollapsed ? <ChevronRight size={16} /> : isMobile ? <X size={16} /> : <ChevronLeft size={16} />}
      </button>
      {!isCollapsed && <h2 className="history-sidebar__title">Threads</h2>}
    </div>

    <button
      type="button"
      className="primary-button history-sidebar__new-thread"
      aria-label="New thread"
      onClick={onCreateThread}
    >
      <Plus size={15} />
      {!isCollapsed && <span>New thread</span>}
    </button>

    {!isCollapsed && (
      <ol className="history-list">
        {history.map((thread) => (
          <li key={thread.id} className="history-list__item">
            <button
              type="button"
              className="history-list__button"
              aria-current={thread.id === activeConversationId ? 'true' : 'false'}
              onClick={() => onSelectThread(thread.id)}
            >
              <span className="history-list__title">{thread.title}</span>
            </button>
          </li>
        ))}
      </ol>
    )}

    <div className="history-sidebar__footer">
      {/* Reading mode pill */}
      <div className="reading-mode-row">
        <div className="reading-mode-pill">
          {!isCollapsed && (
            <div className="reading-mode-pill__info">
              <BookOpen size={14} />
              <span className="reading-mode-row__label">Reading mode</span>
            </div>
          )}
          <div className="reading-mode-row__controls">
          {isCollapsed ? (
            <button
              type="button"
              className={`icon-button reading-mode-icon-btn${readingModeSettings.isEnabled ? ' reading-mode-icon-btn--active' : ''}`}
              aria-label="Toggle reading mode"
              onClick={onToggleReadingMode}
            >
              <BookOpen size={15} />
            </button>
          ) : (
            <label className="reading-mode-switch" aria-label="Toggle reading mode">
              <input
                type="checkbox"
                checked={readingModeSettings.isEnabled}
                onChange={onToggleReadingMode}
              />
              <span className="reading-mode-switch__track" />
            </label>
          )}
          <div className="reading-mode-trigger">
            <button
              type="button"
              className="icon-button reading-mode-settings-btn"
              aria-label="Reading mode settings"
              onClick={onOpenReadingModeDialog}
            >
              <Settings size={14} />
            </button>
            <ReadingModeDialog
              isVisible={isReadingModeDialogOpen}
              readingModeSettings={readingModeSettings}
              onClose={onCloseReadingModeDialog}
              onReadingSchemeSelected={onReadingSchemeSelected}
              onHideTopBarToggled={onHideTopBarToggled}
              onHideSidebarToggled={onHideSidebarToggled}
              onHideComposerToggled={onHideComposerToggled}
              onHideUserMessagesToggled={onHideUserMessagesToggled}
            />
          </div>
        </div>
        </div>
      </div>

      <button
        type="button"
        className="secondary-button history-sidebar__settings-btn"
        aria-label="Open settings"
        onClick={onOpenSettings}
      >
        <Settings size={15} />
        {!isCollapsed && <span>Settings</span>}
      </button>
      {children}
    </div>
  </aside>
)
