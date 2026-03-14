import {
  providerCatalog,
  type ProviderId,
  type ProviderSettings,
} from '../domain/provider-settings'
import {
  readingSchemeCatalog,
  type ReadingModeSettings,
  type ReadingSchemeId,
} from '../domain/reading-mode-settings'

interface SettingsPanelProps {
  readonly isVisible: boolean
  readonly providerSettings: ProviderSettings
  readonly readingModeSettings: ReadingModeSettings
  readonly onClose: () => void
  readonly onProviderSelected: (providerId: ProviderId) => void
  readonly onApiKeyChanged: (providerId: ProviderId, apiKey: string) => void
  readonly onModelChanged: (providerId: ProviderId, model: string) => void
  readonly onReadingModeToggled: () => void
  readonly onReadingSchemeSelected: (schemeId: ReadingSchemeId) => void
}

export const SettingsPanel = ({
  isVisible,
  providerSettings,
  readingModeSettings,
  onClose,
  onProviderSelected,
  onApiKeyChanged,
  onModelChanged,
  onReadingModeToggled,
  onReadingSchemeSelected,
}: SettingsPanelProps) => {
  if (!isVisible) {
    return null
  }

  const activeProviderId = providerSettings.activeProvider
  const activeProviderConfiguration =
    providerSettings.configurations[activeProviderId]

  return (
    <section className="settings-panel" role="dialog" aria-label="Settings">
      <div className="settings-panel__header">
        <h2>Settings</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close settings"
          onClick={onClose}
        >
          x
        </button>
      </div>

      <label className="field-group" htmlFor="provider-selector">
        <span>Provider</span>
        <select
          id="provider-selector"
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
        <input
          id="provider-model"
          type="text"
          value={activeProviderConfiguration.model}
          onChange={(event) =>
            onModelChanged(activeProviderId, event.target.value)
          }
        />
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

      <label className="toggle-field" htmlFor="reading-mode-toggle">
        <input
          id="reading-mode-toggle"
          type="checkbox"
          checked={readingModeSettings.isEnabled}
          onChange={onReadingModeToggled}
        />
        <span>Enable reading mode</span>
      </label>

      <label className="field-group" htmlFor="reading-scheme-selector">
        <span>Reading color scheme</span>
        <select
          id="reading-scheme-selector"
          value={readingModeSettings.schemeId}
          onChange={(event) =>
            onReadingSchemeSelected(event.target.value as ReadingSchemeId)
          }
        >
          {readingSchemeCatalog.map((scheme) => (
            <option key={scheme.id} value={scheme.id}>
              {scheme.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
