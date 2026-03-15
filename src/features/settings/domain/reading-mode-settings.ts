export const readingSchemeIds = ['light', 'dark', 'system'] as const

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
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Follow System' },
]

export const defaultReadingModeSettings: ReadingModeSettings = {
  isEnabled: false,
  schemeId: 'light',
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
