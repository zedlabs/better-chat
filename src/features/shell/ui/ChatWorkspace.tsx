import { useMemo } from 'react'
import { SendMessageUseCase } from '../../chat/application/send-message-use-case'
import { ChatComposer } from '../../chat/ui/ChatComposer'
import { MessageList } from '../../chat/ui/MessageList'
import { createHttpProviderGatewayRegistry } from '../../providers/infrastructure/http-provider-gateways'
import { SettingsPanel } from '../../settings/ui/SettingsPanel'
import { useChatWorkspace } from '../application/use-chat-workspace'
import { HistorySidebar } from './HistorySidebar'

export const ChatWorkspace = () => {
  const sendMessageUseCase = useMemo(
    () => new SendMessageUseCase(createHttpProviderGatewayRegistry()),
    [],
  )
  const workspace = useChatWorkspace(sendMessageUseCase)

  return (
    <div
      className="app-shell"
      data-testid="app-shell"
      data-reading-mode={workspace.state.readingModeSettings.isEnabled ? 'true' : 'false'}
      data-reading-scheme={workspace.state.readingModeSettings.schemeId}
    >
      <HistorySidebar
        isCollapsed={workspace.state.isSidebarCollapsed}
        history={workspace.state.history}
        activeConversationId={workspace.state.activeConversationId}
        onToggleSidebar={workspace.toggleSidebar}
        onCreateThread={workspace.createConversation}
        onSelectThread={workspace.selectConversation}
        onOpenSettings={workspace.openSettings}
      >
        <SettingsPanel
          isVisible={workspace.state.isSettingsOpen}
          providerSettings={workspace.state.providerDraftSettings}
          readingModeSettings={workspace.state.readingModeSettings}
          onClose={workspace.closeSettings}
          onProviderSelected={workspace.selectProvider}
          onApiKeyChanged={workspace.changeApiKey}
          onModelChanged={workspace.changeModel}
          onSaveProviderSettings={workspace.saveProviderSettings}
          hasUnsavedProviderChanges={workspace.state.hasUnsavedProviderChanges}
          onReadingModeToggled={workspace.toggleReadingMode}
          onReadingSchemeSelected={workspace.selectReadingScheme}
        />
      </HistorySidebar>

      <section className="chat-stage" aria-label="Chat workspace">
        <header className="chat-stage__header">
          <div className="chat-stage__title-row">
            <h1>Better Chat</h1>
            <button
              type="button"
              className="secondary-button chat-stage__regenerate"
              aria-label="Regenerate response"
              onClick={workspace.regenerateLastResponse}
              disabled={!workspace.canRegenerateLastResponse}
            >
              Regenerate
            </button>
          </div>
          {workspace.state.isSending && (
            <p className="chat-stage__status" role="status">
              Assistant is responding...
            </p>
          )}
        </header>

        <MessageList messages={workspace.state.messages} />

        <ChatComposer
          value={workspace.state.composerValue}
          isSending={workspace.state.isSending}
          onChange={workspace.changeComposerValue}
          onSend={workspace.sendMessage}
          onCancel={workspace.cancelSendMessage}
        />
      </section>
    </div>
  )
}
