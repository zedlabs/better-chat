export const readingSchemeIds = ['original', 'paper', 'sepia', 'high-contrast'] as const

export type ReadingSchemeId = (typeof readingSchemeIds)[number]

export interface ReadingScheme {
  readonly id: ReadingSchemeId
  readonly label: string
}

export interface ReadingModeSettings {
  readonly isEnabled: boolean
  readonly schemeId: ReadingSchemeId
}

export const readingSchemeCatalog: ReadonlyArray<ReadingScheme> = [
  { id: 'original', label: 'Original Theme' },
  { id: 'paper', label: 'Paper Light' },
  { id: 'sepia', label: 'Warm Sepia' },
  { id: 'high-contrast', label: 'High Contrast' },
]

export const defaultReadingModeSettings: ReadingModeSettings = {
  isEnabled: false,
  schemeId: 'original',
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
