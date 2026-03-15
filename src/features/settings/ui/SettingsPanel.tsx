import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import {
  getProviderMetadata,
  providerCatalog,
  type ProviderId,
  type ProviderSettings,
} from '../domain/provider-settings'

interface SettingsPanelProps {
  readonly isVisible: boolean
  readonly providerSettings: ProviderSettings
  readonly onClose: () => void
  readonly onProviderSelected: (providerId: ProviderId) => void
  readonly onApiKeyChanged: (providerId: ProviderId, apiKey: string) => void
  readonly onModelChanged: (providerId: ProviderId, model: string) => void
  readonly onGlobalSystemPromptChanged: (value: string) => void
  readonly onSaveProviderSettings: () => void
  readonly hasUnsavedProviderChanges: boolean
}

export const SettingsPanel = ({
  isVisible,
  providerSettings,
  onClose,
  onProviderSelected,
  onApiKeyChanged,
  onModelChanged,
  onGlobalSystemPromptChanged,
  onSaveProviderSettings,
  hasUnsavedProviderChanges,
}: SettingsPanelProps) => {
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (!isVisible) {
      return
    }

    firstFieldRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isVisible, onClose])

  if (!isVisible) {
    return null
  }

  const activeProviderId = providerSettings.activeProvider
  const activeProvider = getProviderMetadata(activeProviderId)
  const activeProviderConfiguration =
    providerSettings.configurations[activeProviderId]

  return (
    <section
      className="settings-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="settings-panel__header">
        <h2>Settings</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close settings"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      <label className="field-group" htmlFor="provider-selector">
        <span>Provider</span>
        <select
          id="provider-selector"
          ref={firstFieldRef}
          value={activeProviderId}
          onChange={(event) => onProviderSelected(event.target.value as ProviderId)}
        >
          {providerCatalog.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group" htmlFor="provider-model">
        <span>Model</span>
        <select
          id="provider-model"
          value={activeProviderConfiguration.model}
          onChange={(event) =>
            onModelChanged(activeProviderId, event.target.value)
          }
        >
          {activeProvider.models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group" htmlFor="provider-api-key">
        <span>API key</span>
        <input
          id="provider-api-key"
          type="password"
          value={activeProviderConfiguration.apiKey}
          onChange={(event) =>
            onApiKeyChanged(activeProviderId, event.target.value)
          }
          placeholder="Paste provider key"
        />
      </label>

      <label className="field-group" htmlFor="global-system-prompt">
        <span>Global system prompt</span>
        <textarea
          id="global-system-prompt"
          value={providerSettings.globalSystemPrompt}
          rows={4}
          onChange={(event) => onGlobalSystemPromptChanged(event.target.value)}
          placeholder="Optional global behavior instructions"
        />
      </label>

      <div className="settings-panel__provider-actions">
        <button
          type="button"
          className="primary-button"
          aria-label="Save provider settings"
          onClick={onSaveProviderSettings}
          disabled={!hasUnsavedProviderChanges}
        >
          Save provider settings
        </button>
        <p className="settings-panel__provider-status" role="status">
          {hasUnsavedProviderChanges
            ? 'You have unsaved provider changes.'
            : 'Provider settings are saved.'}
        </p>
      </div>
    </section>
  )
}
