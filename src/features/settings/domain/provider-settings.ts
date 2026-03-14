export const providerIds = ['openai', 'anthropic', 'gemini'] as const

export type ProviderId = (typeof providerIds)[number]

export interface ProviderMetadata {
  readonly id: ProviderId
  readonly label: string
  readonly defaultModel: string
}

export interface ProviderConfiguration {
  readonly apiKey: string
  readonly model: string
}

export interface ProviderSettings {
  readonly activeProvider: ProviderId
  readonly configurations: Record<ProviderId, ProviderConfiguration>
}

const providerMetadataById: Record<ProviderId, ProviderMetadata> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-3-5-sonnet-latest',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    defaultModel: 'gemini-2.0-flash',
  },
}

export const providerCatalog = providerIds.map((providerId) =>
  providerMetadataById[providerId],
)

export const createDefaultProviderSettings = (): ProviderSettings => ({
  activeProvider: 'openai',
  configurations: {
    openai: {
      apiKey: '',
      model: providerMetadataById.openai.defaultModel,
    },
    anthropic: {
      apiKey: '',
      model: providerMetadataById.anthropic.defaultModel,
    },
    gemini: {
      apiKey: '',
      model: providerMetadataById.gemini.defaultModel,
    },
  },
})

export const getProviderMetadata = (providerId: ProviderId): ProviderMetadata =>
  providerMetadataById[providerId]

export const setActiveProvider = (
  providerSettings: ProviderSettings,
  providerId: ProviderId,
): ProviderSettings => ({
  ...providerSettings,
  activeProvider: providerId,
})

export const updateProviderConfiguration = (
  providerSettings: ProviderSettings,
  providerId: ProviderId,
  nextConfiguration: ProviderConfiguration,
): ProviderSettings => ({
  ...providerSettings,
  configurations: {
    ...providerSettings.configurations,
    [providerId]: nextConfiguration,
  },
})
