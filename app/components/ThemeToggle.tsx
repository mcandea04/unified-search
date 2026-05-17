'use client'

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div
      className="fixed top-3 right-3 z-50 inline-flex items-center rounded-full border border-rule bg-bg-elev p-0.5 sm:top-4 sm:right-4"
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={toggle}
        aria-label="Switch to dark mode"
        aria-pressed={isDark}
        className={`min-w-[44px] min-h-[36px] sm:min-h-[32px] px-3 py-1.5 rounded-full text-sm font-mono transition-colors ${
          isDark ? 'bg-accent text-accent-ink' : 'text-text-muted hover:text-text'
        }`}
      >
        <span aria-hidden="true">☾</span>
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-label="Switch to light mode"
        aria-pressed={!isDark}
        className={`min-w-[44px] min-h-[36px] sm:min-h-[32px] px-3 py-1.5 rounded-full text-sm font-mono transition-colors ${
          !isDark ? 'bg-accent text-accent-ink' : 'text-text-muted hover:text-text'
        }`}
      >
        <span aria-hidden="true">☀</span>
      </button>
    </div>
  )
}
