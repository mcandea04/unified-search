export type Theme = 'dark' | 'light'

export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem('theme')
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

export function readSystemTheme(): Theme {
  if (typeof globalThis.matchMedia !== 'function') return 'dark'
  return globalThis.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function resolveInitialTheme(stored: Theme | null, system: Theme): Theme {
  return stored ?? system
}
