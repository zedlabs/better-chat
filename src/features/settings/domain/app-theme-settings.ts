export const appThemeIds = [
  'light',
  'dark',
  'system',
  'dracula',
  'monokai',
  'nord',
  'solarized-dark',
  'github-dark',
] as const

export type AppThemeId = (typeof appThemeIds)[number]

export interface AppTheme {
  readonly id: AppThemeId
  readonly label: string
}

export const appThemeCatalog: ReadonlyArray<AppTheme> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Follow System' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'nord', label: 'Nord' },
  { id: 'solarized-dark', label: 'Solarized Dark' },
  { id: 'github-dark', label: 'GitHub Dark' },
]

export const defaultAppThemeId: AppThemeId = 'light'
