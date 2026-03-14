export const providerIds = ['openai', 'anthropic', 'gemini'] as const

export type ProviderId = (typeof providerIds)[number]

export interface ProviderMetadata {
  readonly id: ProviderId
  readonly label: string
  readonly defaultModel: string
  readonly models: ReadonlyArray<string>
  readonly bestPractices: ReadonlyArray<string>
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
    defaultModel: 'gpt-5.4',
    models: ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5-mini', 'gpt-5-nano'],
    bestPractices: [
      'Create restricted API keys and never commit keys to source control.',
      'Use retries with exponential backoff for 429 and transient 5xx errors.',
      'Start with smaller GPT-5 variants for latency-sensitive and cost-sensitive flows.',
    ],
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    bestPractices: [
      'Scope keys to the minimum permissions and rotate credentials regularly.',
      'Handle rate limits with bounded retries and idempotent request design.',
      'Use concise, explicit prompts with clear output constraints for stability.',
    ],
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    defaultModel: 'gemini-3-flash-preview',
    models: [
      'gemini-3.1-pro-preview',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
    ],
    bestPractices: [
      'Apply key restrictions by API and referrer or app identity where possible.',
      'Implement jittered exponential backoff for quota and transient failures.',
      'Prefer Flash-tier models for lower-latency interactive chat experiences.',
    ],
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
