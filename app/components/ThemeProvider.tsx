'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Theme } from '@/lib/theme'

type ThemeContextValue = {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readDomTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readDomTheme)

  useEffect(() => {
    setTheme(readDomTheme())
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem('theme', next)
      } catch {
        // Safari private mode — silent fallback, theme still applies in-session.
      }
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
