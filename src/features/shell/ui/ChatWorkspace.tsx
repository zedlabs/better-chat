import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, PanelLeft, Settings } from 'lucide-react'
import { SendMessageUseCase } from '../../chat/application/send-message-use-case'
import { useMessageBranches } from '../../chat/application/use-message-branches'
import { BranchDialog } from '../../chat/ui/BranchDialog'
import { ChatComposer } from '../../chat/ui/ChatComposer'
import { MessageList } from '../../chat/ui/MessageList'
import { createHttpProviderGatewayRegistry } from '../../providers/infrastructure/http-provider-gateways'
import { ReadingModeDialog } from '../../settings/ui/ReadingModeDialog'
import { SettingsPanel } from '../../settings/ui/SettingsPanel'
import { useChatWorkspace } from '../application/use-chat-workspace'
import { HistorySidebar } from './HistorySidebar'

export const ChatWorkspace = () => {
  const sendMessageUseCase = useMemo(
    () => new SendMessageUseCase(createHttpProviderGatewayRegistry()),
    [],
  )
  const workspace = useChatWorkspace(sendMessageUseCase)
  const [isReadingModeDialogOpen, setIsReadingModeDialogOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const hasAutoCollapsedForMobileRef = useRef(false)
  const branches = useMessageBranches(
    workspace.state.activeConversationId,
    sendMessageUseCase,
    workspace.state.providerSettings,
  )

  const rm = workspace.state.readingModeSettings
  const isReading = rm.isEnabled
  const hideTopBar = isReading && rm.hideTopBar
  const hideSidebar = isReading && rm.hideSidebar
  const hideComposer = isReading && rm.hideComposer

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 920px)')

    const applyState = () => {
      setIsMobile(mediaQuery.matches)
    }

    applyState()
    mediaQuery.addEventListener('change', applyState)

    return () => {
      mediaQuery.removeEventListener('change', applyState)
    }
  }, [])

  useEffect(() => {
    if (!isMobile) {
      hasAutoCollapsedForMobileRef.current = false
      return
    }

    if (!workspace.state.isSidebarCollapsed && !hasAutoCollapsedForMobileRef.current) {
      workspace.toggleSidebar()
      hasAutoCollapsedForMobileRef.current = true
    }
  }, [isMobile, workspace.state.isSidebarCollapsed, workspace.toggleSidebar])

  return (
    <div
      className="app-shell"
      data-testid="app-shell"
      data-reading-mode={isReading ? 'true' : 'false'}
      data-reading-scheme={rm.schemeId}
      data-hide-sidebar={hideSidebar ? 'true' : 'false'}
      data-sidebar-collapsed={workspace.state.isSidebarCollapsed ? 'true' : 'false'}
      data-hide-topbar={hideTopBar ? 'true' : 'false'}
      data-hide-composer={hideComposer ? 'true' : 'false'}
    >
      <HistorySidebar
        isCollapsed={workspace.state.isSidebarCollapsed}
        isMobile={isMobile}
        history={workspace.state.history}
        activeConversationId={workspace.state.activeConversationId}
        onToggleSidebar={workspace.toggleSidebar}
        onCreateThread={workspace.createConversation}
        onSelectThread={workspace.selectConversation}
        onOpenSettings={workspace.openSettings}
        readingModeSettings={rm}
        isReadingModeDialogOpen={isReadingModeDialogOpen}
        onToggleReadingMode={workspace.toggleReadingMode}
        onOpenReadingModeDialog={() => setIsReadingModeDialogOpen(true)}
        onCloseReadingModeDialog={() => setIsReadingModeDialogOpen(false)}
        onReadingSchemeSelected={workspace.selectReadingScheme}
        onHideTopBarToggled={workspace.toggleReadingHideTopBar}
        onHideSidebarToggled={workspace.toggleReadingHideSidebar}
        onHideComposerToggled={workspace.toggleReadingHideComposer}
          onHideUserMessagesToggled={workspace.toggleReadingHideUserMessages}
      >
        <SettingsPanel
          isVisible={workspace.state.isSettingsOpen}
          providerSettings={workspace.state.providerDraftSettings}
          onClose={workspace.closeSettings}
          onProviderSelected={workspace.selectProvider}
          onApiKeyChanged={workspace.changeApiKey}
          onModelChanged={workspace.changeModel}
          onGlobalSystemPromptChanged={workspace.changeGlobalSystemPrompt}
          onSaveProviderSettings={workspace.saveProviderSettings}
          hasUnsavedProviderChanges={workspace.state.hasUnsavedProviderChanges}
        />
      </HistorySidebar>

      <section className="chat-stage" aria-label="Chat workspace">
        {!hideTopBar && (
          <header className="chat-stage__header">
            <div className="chat-stage__title-row">
              {isMobile && workspace.state.isSidebarCollapsed && !hideSidebar && (
                <button
                  type="button"
                  className="icon-button chat-stage__sidebar-open"
                  aria-label="Open sidebar"
                  onClick={workspace.toggleSidebar}
                >
                  <PanelLeft size={16} />
                </button>
              )}
              <h1>BetterChat</h1>
              {workspace.state.isSending && (
                <p className="chat-stage__status" role="status">
                  Responding…
                </p>
              )}
            </div>
          </header>
        )}

        <MessageList
          messages={workspace.state.messages}
          canRegenerateLastResponse={workspace.canRegenerateLastResponse}
          onRegenerate={workspace.regenerateLastResponse}
          hideUserMessages={isReading && rm.hideUserMessages}
          branches={branches.branches}
          onCreateBranch={branches.createBranch}
          onOpenBranch={branches.openBranch}
        />

        {!hideComposer && (
          <ChatComposer
            value={workspace.state.composerValue}
            isSending={workspace.state.isSending}
            onChange={workspace.changeComposerValue}
            onSend={workspace.sendMessage}
            onCancel={workspace.cancelSendMessage}
          />
        )}

        <BranchDialog
          branch={branches.activeBranch}
          composerValue={branches.activeComposerValue}
          isSending={branches.isSending}
          onComposerChanged={branches.updateActiveComposerValue}
          onSend={branches.sendBranchMessage}
          onCancel={branches.cancelBranchMessage}
          onClose={branches.closeBranch}
          onDelete={branches.deleteActiveBranch}
          onNotesChanged={branches.updateActiveBranchNotes}
        />
      </section>

      {hideSidebar && (
        <div className="reading-mode-floating">
          <div className="reading-mode-pill">
            <div className="reading-mode-pill__info">
              <BookOpen size={14} />
              <span className="reading-mode-row__label">Reading mode</span>
            </div>
            <div className="reading-mode-row__controls">
              <label className="reading-mode-switch" aria-label="Toggle reading mode">
                <input
                  type="checkbox"
                  checked={isReading}
                  onChange={workspace.toggleReadingMode}
                />
                <span className="reading-mode-switch__track" />
              </label>
              <div className="reading-mode-trigger">
                <button
                  type="button"
                  className="icon-button reading-mode-settings-btn"
                  aria-label="Reading mode settings"
                  onClick={() => setIsReadingModeDialogOpen(true)}
                >
                  <Settings size={14} />
                </button>
                <ReadingModeDialog
                  isVisible={isReadingModeDialogOpen}
                  readingModeSettings={rm}
                  onClose={() => setIsReadingModeDialogOpen(false)}
                  onReadingSchemeSelected={workspace.selectReadingScheme}
                  onHideTopBarToggled={workspace.toggleReadingHideTopBar}
                  onHideSidebarToggled={workspace.toggleReadingHideSidebar}
                  onHideComposerToggled={workspace.toggleReadingHideComposer}
                  onHideUserMessagesToggled={workspace.toggleReadingHideUserMessages}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
