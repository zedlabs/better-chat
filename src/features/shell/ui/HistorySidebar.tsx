import { type ReactNode } from 'react'

interface ConversationSummary {
  readonly id: string
  readonly title: string
  readonly updatedAtLabel: string
}

interface HistorySidebarProps {
  readonly isCollapsed: boolean
  readonly history: ReadonlyArray<ConversationSummary>
  readonly onToggleSidebar: () => void
  readonly onOpenSettings: () => void
  readonly children?: ReactNode
}

export const HistorySidebar = ({
  isCollapsed,
  history,
  onToggleSidebar,
  onOpenSettings,
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
        className="icon-button"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggleSidebar}
      >
        {isCollapsed ? '>>' : '<<'}
      </button>
      {!isCollapsed && <h2 className="history-sidebar__title">Threads</h2>}
    </div>

    {!isCollapsed && (
      <ol className="history-list">
        {history.map((thread) => (
          <li key={thread.id} className="history-list__item">
            <button type="button" className="history-list__button">
              <span className="history-list__title">{thread.title}</span>
              <span className="history-list__time">{thread.updatedAtLabel}</span>
            </button>
          </li>
        ))}
      </ol>
    )}

    <div className="history-sidebar__footer">
      <button
        type="button"
        className="secondary-button"
        aria-label="Open settings"
        onClick={onOpenSettings}
      >
        {isCollapsed ? 'Set' : 'Settings'}
      </button>
      {children}
    </div>
  </aside>
)
