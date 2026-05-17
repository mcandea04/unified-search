import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readStoredTheme, readSystemTheme, resolveInitialTheme } from '@/lib/theme'

describe('readStoredTheme', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('returns null when nothing stored', () => {
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
    expect(readStoredTheme()).toBeNull()
  })

  it('returns "dark" when stored value is "dark"', () => {
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('returns "light" when stored value is "light"', () => {
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
    expect(readStoredTheme()).toBe('light')
  })

  it('returns null for invalid stored value', () => {
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('sepia')
    expect(readStoredTheme()).toBeNull()
  })

  it('returns null when localStorage throws', () => {
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readStoredTheme()).toBeNull()
  })
})

describe('readSystemTheme', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns "light" when prefers-color-scheme: light matches', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    expect(readSystemTheme()).toBe('light')
  })

  it('returns "dark" when prefers-color-scheme: light does not match', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    expect(readSystemTheme()).toBe('dark')
  })

  it('returns "dark" when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(readSystemTheme()).toBe('dark')
  })
})

describe('resolveInitialTheme', () => {
  it('prefers stored over system', () => {
    expect(resolveInitialTheme('light', 'dark')).toBe('light')
    expect(resolveInitialTheme('dark', 'light')).toBe('dark')
  })

  it('falls back to system when stored is null', () => {
    expect(resolveInitialTheme(null, 'light')).toBe('light')
    expect(resolveInitialTheme(null, 'dark')).toBe('dark')
  })
})
