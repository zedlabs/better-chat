export const readingSchemeIds = [
  'paper',
  'warm-sepia',
  'soft-gray',
  'sage',
  'night',
] as const

export type ReadingSchemeId = (typeof readingSchemeIds)[number]

export interface ReadingScheme {
  readonly id: ReadingSchemeId
  readonly label: string
}

export interface ReadingModeSettings {
  readonly isEnabled: boolean
  readonly schemeId: ReadingSchemeId
  readonly hideTopBar: boolean
  readonly hideSidebar: boolean
  readonly hideComposer: boolean
  readonly hideUserMessages: boolean
}

export const readingSchemeCatalog: ReadonlyArray<ReadingScheme> = [
  { id: 'paper', label: 'Paper (high contrast)' },
  { id: 'warm-sepia', label: 'Warm Sepia (reduced glare)' },
  { id: 'soft-gray', label: 'Soft Gray (balanced contrast)' },
  { id: 'sage', label: 'Muted Sage (low blue intensity)' },
  { id: 'night', label: 'Night Charcoal (dim environments)' },
]

export const defaultReadingModeSettings: ReadingModeSettings = {
  isEnabled: false,
  schemeId: 'paper',
  hideTopBar: true,
  hideSidebar: true,
  hideComposer: true,
  hideUserMessages: false,
}

export const toggleReadingMode = (
  readingModeSettings: ReadingModeSettings,
): ReadingModeSettings => ({
  ...readingModeSettings,
  isEnabled: !readingModeSettings.isEnabled,
})

export const setReadingScheme = (
  readingModeSettings: ReadingModeSettings,
  schemeId: ReadingSchemeId,
): ReadingModeSettings => ({
  ...readingModeSettings,
  schemeId,
})
