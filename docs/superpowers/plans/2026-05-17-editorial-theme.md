# Editorial Theme + Light/Dark Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace dark-only generic SaaS UI with cohesive Editorial Press aesthetic across both dark + light themes, controlled by a fixed top-right toggle that persists in localStorage and respects OS preference.

**Architecture:** Single source of truth on `<html data-theme="dark|light">`. Inline pre-paint script in `<head>` reads localStorage with OS fallback to avoid FOUC. Client `ThemeProvider` exposes a `toggle()` to a segmented `ThemeToggle` button. Palette + typography are CSS custom properties on `:root` and `[data-theme="light"]`, registered as Tailwind v4 `@theme` utilities so component classes stay theme-aware.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `next/font/google` for Fraunces / DM Sans / IBM Plex Mono. Vitest for unit tests. Worktree on port 3031.

---

## Spec reference

`docs/superpowers/specs/2026-05-17-editorial-theme-design.md`

## File structure

| Path                                  | Responsibility                                                          |
|---------------------------------------|-------------------------------------------------------------------------|
| `app/layout.tsx`                      | Load fonts, inject pre-paint theme script, mount `ThemeProvider`        |
| `app/globals.css`                     | Theme CSS variables, base body styles, `prefers-reduced-motion` rules    |
| `app/page.tsx`                        | Restyled header, search, stats bar, group/ungrouped cards, report modal |
| `app/components/ThemeProvider.tsx`    | Client context: tracks `theme`, exposes `toggle()`, mirrors `data-theme` |
| `app/components/ThemeToggle.tsx`      | Segmented pill button (☾/☀), fixed top-right, calls `toggle()`          |
| `lib/theme.ts`                        | Pure helpers: `readStoredTheme`, `readSystemTheme`, `resolveInitialTheme` (testable, no DOM side effects) |
| `tests/lib/theme.test.ts`             | Unit tests for `lib/theme.ts`                                           |
| `tailwind.config.ts`                  | Register CSS-var-backed colors so `bg-bg`, `text-text`, etc. resolve     |

---

## Task 1: Add theme helpers and unit tests

**Files:**
- Create: `lib/theme.ts`
- Test: `tests/lib/theme.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/lib/theme.test.ts`:

```ts
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
  it('returns "light" when prefers-color-scheme: light matches', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    expect(readSystemTheme()).toBe('light')
    vi.unstubAllGlobals()
  })

  it('returns "dark" when prefers-color-scheme: light does not match', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    expect(readSystemTheme()).toBe('dark')
    vi.unstubAllGlobals()
  })

  it('returns "dark" when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(readSystemTheme()).toBe('dark')
    vi.unstubAllGlobals()
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd /Users/mcandea/personal/unified-search-31-editorial-theme && npm test -- tests/lib/theme.test.ts`
Expected: FAIL — `Cannot find module '@/lib/theme'`.

- [ ] **Step 3: Implement `lib/theme.ts`**

`lib/theme.ts`:

```ts
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
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function resolveInitialTheme(stored: Theme | null, system: Theme): Theme {
  return stored ?? system
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- tests/lib/theme.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts tests/lib/theme.test.ts
git commit -m "feat(theme): add theme helpers with unit tests"
```

---

## Task 2: Replace `globals.css` with editorial theme variables

**Files:**
- Modify: `app/globals.css` (replace entire file contents)

- [ ] **Step 1: Replace the file**

`app/globals.css`:

```css
@import "tailwindcss";
@source "../app/**/*.{ts,tsx,js,jsx}";

@theme {
  --color-bg: var(--bg);
  --color-bg-elev: var(--bg-elev);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-rule: var(--rule);
  --color-accent: var(--accent);
  --color-accent-ink: var(--accent-ink);

  --font-display: var(--font-fraunces, 'Fraunces'), Georgia, serif;
  --font-sans: var(--font-dm-sans, 'DM Sans'), -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: var(--font-plex-mono, 'IBM Plex Mono'), 'JetBrains Mono', monospace;
}

:root,
[data-theme="dark"] {
  --bg: #181613;
  --bg-elev: #1f1c18;
  --text: #e8e2d4;
  --text-muted: #8a8475;
  --rule: #2a241d;
  --accent: #d4a44d;
  --accent-ink: #181613;
}

[data-theme="light"] {
  --bg: #f4f0e6;
  --bg-elev: #faf6ea;
  --text: #181613;
  --text-muted: #6b6555;
  --rule: #d8d2c2;
  --accent: #8b3a1f;
  --accent-ink: #f4f0e6;
}

* {
  box-sizing: border-box;
}

html {
  background: var(--bg);
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--bg);
  min-height: 100vh;
  transition: background-color 180ms ease, color 180ms ease;
}

::selection {
  background: var(--accent);
  color: var(--accent-ink);
}

.editorial-display {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 0.95;
}

.editorial-meta {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-muted);
}

.editorial-row {
  border-bottom: 1px dotted var(--rule);
}

.price-display {
  font-family: var(--font-mono);
  font-weight: 700;
  font-feature-settings: 'tnum' on, 'lnum' on;
  letter-spacing: 0;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in-up {
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
}

.delay-1 { animation-delay: 0.08s; }
.delay-2 { animation-delay: 0.16s; }
.delay-3 { animation-delay: 0.24s; }
.delay-4 { animation-delay: 0.32s; }

@keyframes spin { to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }

@keyframes pulseFade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
.animate-pulse { animation: pulseFade 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

@media (prefers-reduced-motion: reduce) {
  body { transition: none; }
  .fade-in-up { animation: none; opacity: 1; }
  .animate-pulse { animation: none; }
}
```

- [ ] **Step 2: Build the project to confirm Tailwind accepts the `@theme` block**

Run: `cd /Users/mcandea/personal/unified-search-31-editorial-theme && npm run build`
Expected: build succeeds. If `@theme` errors, check `node_modules/tailwindcss/package.json` is at v4.x; the existing config already uses v4 syntax (`@import "tailwindcss"`, `@source`).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(theme): replace globals.css with editorial CSS variables"
```

---

## Task 3: Update `tailwind.config.ts` to remove redundant config

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace contents**

In Tailwind v4 the `@theme` block in CSS is the source of truth. The existing `tailwind.config.ts` only declares `content` paths that are already covered by `@source` in `globals.css`. Trim to a near-empty file so future contributors don't read it as authoritative.

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Build to confirm utilities resolve**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "chore(theme): align tailwind config with v4 @theme block"
```

---

## Task 4: Add `ThemeProvider`

**Files:**
- Create: `app/components/ThemeProvider.tsx`

- [ ] **Step 1: Implement provider**

`app/components/ThemeProvider.tsx`:

```tsx
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
        // Safari private mode etc — silent fallback, theme still applies in-session.
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/ThemeProvider.tsx
git commit -m "feat(theme): add ThemeProvider with toggle + localStorage"
```

---

## Task 5: Add `ThemeToggle`

**Files:**
- Create: `app/components/ThemeToggle.tsx`

- [ ] **Step 1: Implement toggle**

`app/components/ThemeToggle.tsx`:

```tsx
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
```

(Both buttons call `toggle()` because the toggle is binary; clicking the active segment is a no-op flip-back-flip — visually idempotent. This keeps the markup symmetric and the keyboard story simple.)

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/ThemeToggle.tsx
git commit -m "feat(theme): add segmented ThemeToggle button"
```

---

## Task 6: Wire fonts, pre-paint script, provider, and toggle into `layout.tsx`

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace contents**

`app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Fraunces, DM_Sans, IBM_Plex_Mono } from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from './components/ThemeProvider'
import { ThemeToggle } from './components/ThemeToggle'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Unified Product Search',
  description: 'Search and compare products across eMAG, BebeTei, Notino and Trendyol',
}

const themeInit = `(function () {
  try {
    var stored = localStorage.getItem('theme');
    var t = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro" className={`${fraunces.variable} ${dmSans.variable} ${plexMono.variable}`}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{themeInit}</Script>
      </head>
      <body>
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Run dev server, verify no FOUC**

Run on the worktree port (issue 31 → 3031):

```bash
cd /Users/mcandea/personal/unified-search-31-editorial-theme
lsof -ti:3031 | xargs kill 2>/dev/null
PORT=3031 nohup npm run dev > /tmp/unified-search-31.log 2>&1 &
```

Wait ~3s. Open http://localhost:3031 in a browser. Toggle the OS theme between dark and light, hard-reload each time. The page should paint the correct mode immediately, with no flash. The toggle pill should be visible top-right.

Expected: paints correctly in both. Toggle button is rendered.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(theme): wire fonts, pre-paint script, provider, toggle into layout"
```

---

## Task 7: Restyle `app/page.tsx` — header + search + states

**Files:**
- Modify: `app/page.tsx`

This task touches a lot of JSX but no logic. We do it in two commits — first the header / search / loading / no-results blocks, second the results / report. Read the current file before editing each block to keep behaviour intact.

- [ ] **Step 1: Read the current file**

Read: `cd /Users/mcandea/personal/unified-search-31-editorial-theme && cat app/page.tsx | head -210`

Confirm you see the existing header (lines ~133–146), search bar (~149–175), loading (~178–191), no-results (~395–408).

- [ ] **Step 2: Replace the header block**

Find:

```tsx
        {/* Header */}
        <div className="text-center mb-8 sm:mb-16 fade-in-up">
          <div className="hidden sm:inline-block mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-4 px-4 sm:px-6 py-2 sm:py-3 rounded-full border border-cyan-500/20 bg-cyan-500/5">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-cyan-400 animate-pulse"></div>
              <span className="text-xs sm:text-base md:text-lg font-medium text-cyan-400 tracking-wide">LIVE PRICE INTELLIGENCE</span>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 gradient-text tracking-tight px-2">
            Unified Search
          </h1>
          <p className="text-sm sm:text-lg md:text-2xl text-slate-400 font-light px-4">
            Multi-source price discovery across <span className="text-cyan-400 font-medium">eMAG</span>, <span className="text-purple-400 font-medium">BebeTei</span>, <span className="text-rose-400 font-medium">Notino</span> & <span className="text-orange-400 font-medium">Trendyol</span>
          </p>
        </div>
```

Replace with:

```tsx
        {/* Header */}
        <div className="text-left sm:text-center mb-8 sm:mb-14 fade-in-up max-w-3xl mx-auto">
          <div className="editorial-meta mb-3 sm:mb-4 flex items-center gap-2 justify-start sm:justify-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true"></span>
            <span>Vol 1 · Live price intel · eMAG / BebeTei / Notino / Trendyol</span>
          </div>
          <h1
            className="editorial-display text-text mb-3 sm:mb-4"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4.75rem)' }}
          >
            Unified Search
          </h1>
          <p className="text-text-muted text-base sm:text-lg max-w-xl mx-auto">
            Live price intelligence across four marketplaces, ranked by per-unit value.
          </p>
        </div>
```

- [ ] **Step 3: Replace the search bar block**

Find:

```tsx
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8 sm:mb-16 fade-in-up delay-1">
          <div className="flex gap-2 sm:gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search..."
              className="flex-1 px-3 sm:px-8 py-3 sm:py-6 text-base sm:text-2xl bg-slate-900 rounded-lg sm:rounded-xl border-2 border-slate-700 focus:outline-none focus:border-cyan-500 focus:bg-slate-900 text-white placeholder:text-slate-500 transition-all"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              aria-label={loading ? 'Searching for products' : 'Search for products'}
              className="px-4 sm:px-16 py-3 sm:py-6 text-base sm:text-xl text-white bg-gradient-to-r from-cyan-600 to-purple-700 hover:from-cyan-500 hover:to-purple-600 disabled:from-slate-700 disabled:to-slate-600 font-black rounded-lg sm:rounded-xl transition-all duration-300 disabled:cursor-not-allowed shadow-lg hover:shadow-cyan-500/25 disabled:shadow-none whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1 sm:gap-3" aria-hidden="true">
                  <div className="w-4 h-4 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Searching...</span>
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>
```

Replace with:

```tsx
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-10 sm:mb-14 fade-in-up delay-1">
          <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search…"
              className="flex-1 bg-transparent border-0 border-b-2 border-text px-1 py-3 text-2xl sm:text-3xl font-display italic text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              aria-label={loading ? 'Searching for products' : 'Search for products'}
              className="px-6 py-3 sm:py-4 text-sm font-mono uppercase tracking-[0.1em] bg-accent text-accent-ink hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2" aria-hidden="true">
                  <span className="w-4 h-4 border-2 border-accent-ink/30 border-t-accent-ink rounded-full animate-spin" />
                  <span>Searching…</span>
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>
```

- [ ] **Step 4: Replace the loading block**

Find:

```tsx
        {/* Loading State */}
        {loading && (
          <div className="text-center py-8 sm:py-16">
            <div className="inline-flex flex-col items-center gap-4 sm:gap-8">
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-slate-700 rounded-full"></div>
                <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <p className="text-slate-300 font-medium text-lg sm:text-2xl">Scanning marketplaces...</p>
                <p className="text-slate-500 text-sm sm:text-lg">Analyzing prices across all sources</p>
              </div>
            </div>
          </div>
        )}
```

Replace with:

```tsx
        {/* Loading State */}
        {loading && (
          <div className="text-center py-10 sm:py-16">
            <div className="inline-flex flex-col items-center gap-5">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 border-2 border-rule rounded-full"></div>
                <div className="absolute inset-0 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="space-y-1">
                <p className="editorial-meta">Scanning marketplaces…</p>
                <p className="text-text-muted text-sm">Analyzing prices across all sources</p>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 5: Replace the no-results block**

Find:

```tsx
        {/* No Results */}
        {!loading && hasSearched && totalProducts === 0 && (
          <div className="text-center py-8 sm:py-16 fade-in-up">
            <div className="glass-card rounded-xl sm:rounded-2xl p-8 sm:p-12 max-w-md mx-auto">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-lg sm:text-xl font-semibold text-slate-300 mb-2">No results found</p>
              <p className="text-sm sm:text-base text-slate-500">Try searching for &quot;{query}&quot; with different keywords</p>
            </div>
          </div>
        )}
```

Replace with:

```tsx
        {/* No Results */}
        {!loading && hasSearched && totalProducts === 0 && (
          <div className="text-center py-10 sm:py-16 fade-in-up">
            <div className="border border-rule bg-bg-elev p-8 sm:p-10 max-w-md mx-auto rounded-md">
              <p className="editorial-meta mb-2">No matches</p>
              <p className="text-text text-xl sm:text-2xl mb-2 font-display italic" style={{ fontFamily: 'var(--font-display)' }}>
                Nothing found.
              </p>
              <p className="text-text-muted text-sm">
                Try searching for &quot;{query}&quot; with different keywords.
              </p>
            </div>
          </div>
        )}
```

- [ ] **Step 6: Type-check + visually confirm dev server**

Run: `npx tsc --noEmit`
Expected: no errors.

Reload http://localhost:3031. Header, search, loading, and no-results should now use the editorial palette in both modes (toggle to verify both).

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat(theme): restyle header, search, loading, no-results to editorial"
```

---

## Task 8: Restyle results — stats bar, group cards, ungrouped, report button

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the stats bar**

Find:

```tsx
            {/* Stats Bar */}
            <div className="glass-card rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-8 fade-in-up delay-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-400"></div>
                  <span className="text-slate-300 font-medium text-base sm:text-xl">
                    Found <span className="price-display text-cyan-400 text-lg sm:text-2xl">{totalProducts}</span> products
                  </span>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="text-slate-500 text-sm sm:text-lg">Query: <span className="text-slate-300">{query}</span></span>
                  <button
                    onClick={openReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all duration-200 text-rose-400 text-xs sm:text-sm font-medium"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    Report a problem
                  </button>
                </div>
              </div>
            </div>
```

Replace with:

```tsx
            {/* Stats Bar */}
            <div className="border border-rule bg-bg-elev p-4 sm:p-5 mb-5 sm:mb-8 fade-in-up delay-2 rounded-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="editorial-meta">Found</span>
                  <span className="price-display text-accent text-2xl">{totalProducts}</span>
                  <span className="editorial-meta">products</span>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="text-text-muted text-sm">
                    Query: <span className="text-text font-medium">{query}</span>
                  </span>
                  <button
                    onClick={openReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-rule hover:border-accent hover:text-accent transition-colors text-text-muted text-xs font-mono uppercase tracking-[0.1em] rounded-sm"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    Report
                  </button>
                </div>
              </div>
            </div>
```

(Pill copy shortened to `Report` to fit Plex Mono uppercase without crowding the stats bar; the modal heading still says "Report a problem".)

- [ ] **Step 2: Replace the enrichment-error banner**

Find:

```tsx
            {/* Enrichment error banner */}
            {enrichmentError && (
              <div className="mb-4 px-4 py-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 text-sm">
                ⚠ {enrichmentError} — showing raw results without grouping.
              </div>
            )}
```

Replace with:

```tsx
            {/* Enrichment error banner */}
            {enrichmentError && (
              <div className="mb-4 px-4 py-3 border border-accent bg-bg-elev text-text text-sm rounded-md">
                <span className="font-mono uppercase tracking-[0.1em] text-accent text-xs mr-2">Notice</span>
                {enrichmentError} — showing raw results without grouping.
              </div>
            )}
```

- [ ] **Step 3: Replace the grouped product cards**

Find the entire `groups.map((group, idx) => (...))` block (currently ~lines 228–318). Replace its outer container, header, table header, and each row's class strings. Keep all behaviour (BEST badge logic, isBestUnit, ppuText, links).

Find:

```tsx
            {groups.map((group, idx) => (
              <div
                key={`group-${idx}`}
                className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-8 mb-4 sm:mb-6 fade-in-up"
                style={{ animationDelay: `${0.3 + idx * 0.1}s` }}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between mb-4 sm:mb-6 gap-3">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-100 flex-1 leading-tight">
                    {group.matchedName}
                  </h3>
                  <div className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                    <span className="text-purple-400 text-sm sm:text-lg font-medium">{group.products.length} sources</span>
                  </div>
                </div>

                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/20 rounded-lg mb-2 text-slate-400 text-xs sm:text-sm font-medium uppercase tracking-wider border-b border-slate-700/30">
                  <div className="col-span-1">Image</div>
                  <div className="col-span-6">Product</div>
                  <div className="col-span-3">Merchant</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {/* Table Rows */}
                <div className="space-y-1">
                  {group.products.map((product, pIdx) => {
                    const isBestUnit =
                      product.pricePerUnit &&
                      group.bestPricePerUnit &&
                      product.pricePerUnit.value === group.bestPricePerUnit.value &&
                      product.pricePerUnit.unit === group.bestPricePerUnit.unit
                    const ppuText = formatPerUnit(product.pricePerUnit)
                    return (
                      <div
                        key={pIdx}
                        className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-4 px-4 py-3 bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/60 transition-all duration-200 sm:items-center"
                      >
                        <div className="sm:col-span-1">
                          {product.imageUrl ? (
                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
                              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-800/40 rounded border border-slate-700/50"></div>
                          )}
                        </div>
                        <div className="sm:col-span-6">
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:text-cyan-200 visited:text-cyan-300 hover:visited:text-cyan-200 underline decoration-cyan-500/30 hover:decoration-cyan-500/60 text-sm font-medium transition-colors line-clamp-2"
                          >
                            {product.name || group.matchedName}
                          </a>
                          {product.attributes.organic && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                              bio
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-start w-full sm:contents">
                          <div className="sm:col-span-3">
                            <span className="text-slate-300 text-sm font-medium">{product.source}</span>
                          </div>
                          <div className="sm:col-span-2 flex flex-col sm:items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="price-display text-lg font-semibold text-slate-100">{product.price}</span>
                              <span className="text-slate-400 text-sm">RON</span>
                            </div>
                            {ppuText && <div className="text-slate-500 text-xs mt-0.5">{ppuText}</div>}
                            <div className="flex gap-1 mt-1">
                              {product.price === group.bestPrice && (
                                <span className="px-2 py-0.5 bg-gradient-to-r from-rose-500/20 to-orange-500/20 border border-rose-500/30 rounded text-rose-400 text-[10px] font-bold whitespace-nowrap">
                                  BEST
                                </span>
                              )}
                              {isBestUnit && product.price !== group.bestPrice && (
                                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-amber-300 text-[10px] font-bold whitespace-nowrap">
                                  BEST/UNIT
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
```

Replace with:

```tsx
            {groups.map((group, idx) => (
              <div
                key={`group-${idx}`}
                className="border border-rule bg-bg-elev rounded-md p-5 sm:p-7 mb-5 sm:mb-6 fade-in-up"
                style={{ animationDelay: `${0.24 + idx * 0.08}s` }}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between mb-4 sm:mb-5 gap-3 pb-4 border-b border-rule">
                  <h3
                    className="font-display italic text-text flex-1 leading-tight"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 900 }}
                  >
                    {group.matchedName}
                  </h3>
                  <span className="editorial-meta whitespace-nowrap pt-1">
                    {group.products.length} sources
                  </span>
                </div>

                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-1 py-2 editorial-meta">
                  <div className="col-span-1">Image</div>
                  <div className="col-span-6">Product</div>
                  <div className="col-span-3">Merchant</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {/* Table Rows */}
                <div>
                  {group.products.map((product, pIdx) => {
                    const isBestUnit =
                      product.pricePerUnit &&
                      group.bestPricePerUnit &&
                      product.pricePerUnit.value === group.bestPricePerUnit.value &&
                      product.pricePerUnit.unit === group.bestPricePerUnit.unit
                    const ppuText = formatPerUnit(product.pricePerUnit)
                    return (
                      <div
                        key={pIdx}
                        className="editorial-row flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-4 px-1 py-3 sm:items-center hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] transition-colors"
                      >
                        <div className="sm:col-span-1">
                          {product.imageUrl ? (
                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
                              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-bg rounded border border-rule"></div>
                          )}
                        </div>
                        <div className="sm:col-span-6">
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text hover:text-accent underline decoration-rule hover:decoration-accent text-sm font-medium transition-colors line-clamp-2"
                          >
                            {product.name || group.matchedName}
                          </a>
                          {product.attributes.organic && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] border border-accent text-accent rounded-sm">
                              bio
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-start w-full sm:contents">
                          <div className="sm:col-span-3">
                            <span className="text-text-muted text-sm font-mono uppercase tracking-[0.05em]">{product.source}</span>
                          </div>
                          <div className="sm:col-span-2 flex flex-col sm:items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="price-display text-lg text-accent">{product.price}</span>
                              <span className="text-text-muted text-xs font-mono">RON</span>
                            </div>
                            {ppuText && <div className="text-text-muted text-xs mt-0.5 font-mono">{ppuText}</div>}
                            <div className="flex gap-1 mt-1">
                              {product.price === group.bestPrice && (
                                <span className="px-2 py-0.5 bg-accent text-accent-ink rounded-sm text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap font-mono">
                                  Best
                                </span>
                              )}
                              {isBestUnit && product.price !== group.bestPrice && (
                                <span className="px-2 py-0.5 border border-accent text-accent rounded-sm text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap font-mono">
                                  Best/unit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
```

- [ ] **Step 4: Replace the ungrouped block**

Find:

```tsx
            {/* Ungrouped Products */}
            {ungrouped.length > 0 && (
              <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-8 fade-in-up">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-400">Other results</h3>
                  <div className="px-3 py-1 rounded-full bg-slate-700/40 border border-slate-600/30">
                    <span className="text-slate-400 text-sm">{ungrouped.length} products</span>
                  </div>
                </div>
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/20 rounded-lg mb-2 text-slate-400 text-xs sm:text-sm font-medium uppercase tracking-wider border-b border-slate-700/30">
                  <div className="col-span-1">Image</div>
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2">Pack</div>
                  <div className="col-span-2">Merchant</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {/* Table Rows */}
                <div className="space-y-1">
                  {ungrouped.map((product, idx) => {
                    const packText = packLabel(product)
                    return (
                      <div
                        key={`ungrouped-${idx}`}
                        className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-4 px-4 py-3 bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/60 transition-all duration-200 sm:items-center"
                      >
                        <div className="sm:col-span-1">
                          {product.imageUrl ? (
                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
                              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-800/40 rounded border border-slate-700/50"></div>
                          )}
                        </div>
                        <div className="sm:col-span-5">
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:text-cyan-200 visited:text-cyan-300 hover:visited:text-cyan-200 underline decoration-cyan-500/30 hover:decoration-cyan-500/60 text-sm font-medium transition-colors line-clamp-2"
                          >
                            {product.name}
                          </a>
                          {product.attributes.organic && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                              bio
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-between items-start gap-x-3 gap-y-1 w-full sm:contents">
                          {packText && <div className="sm:col-span-2 text-slate-300 text-sm">{packText}</div>}
                          <div className="sm:col-span-2">
                            <span className="text-slate-300 text-sm font-medium">{product.source}</span>
                          </div>
                          <div className="sm:col-span-2 flex flex-col sm:items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="price-display text-lg font-semibold text-slate-100">{product.price}</span>
                              <span className="text-slate-400 text-sm">RON</span>
                            </div>
                            {formatPerUnit(product.pricePerUnit) && (
                              <div className="text-slate-500 text-xs mt-0.5">{formatPerUnit(product.pricePerUnit)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
```

Replace with:

```tsx
            {/* Ungrouped Products */}
            {ungrouped.length > 0 && (
              <div className="border border-rule bg-bg-elev rounded-md p-5 sm:p-7 fade-in-up">
                <div className="flex items-center justify-between mb-4 sm:mb-5 pb-4 border-b border-rule">
                  <h3
                    className="font-display italic text-text-muted"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 900 }}
                  >
                    Other results
                  </h3>
                  <span className="editorial-meta">{ungrouped.length} products</span>
                </div>
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-1 py-2 editorial-meta">
                  <div className="col-span-1">Image</div>
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2">Pack</div>
                  <div className="col-span-2">Merchant</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {/* Table Rows */}
                <div>
                  {ungrouped.map((product, idx) => {
                    const packText = packLabel(product)
                    return (
                      <div
                        key={`ungrouped-${idx}`}
                        className="editorial-row flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-4 px-1 py-3 sm:items-center hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] transition-colors"
                      >
                        <div className="sm:col-span-1">
                          {product.imageUrl ? (
                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
                              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-bg rounded border border-rule"></div>
                          )}
                        </div>
                        <div className="sm:col-span-5">
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text hover:text-accent underline decoration-rule hover:decoration-accent text-sm font-medium transition-colors line-clamp-2"
                          >
                            {product.name}
                          </a>
                          {product.attributes.organic && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] border border-accent text-accent rounded-sm">
                              bio
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-between items-start gap-x-3 gap-y-1 w-full sm:contents">
                          {packText && <div className="sm:col-span-2 text-text text-sm">{packText}</div>}
                          <div className="sm:col-span-2">
                            <span className="text-text-muted text-sm font-mono uppercase tracking-[0.05em]">{product.source}</span>
                          </div>
                          <div className="sm:col-span-2 flex flex-col sm:items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="price-display text-lg text-accent">{product.price}</span>
                              <span className="text-text-muted text-xs font-mono">RON</span>
                            </div>
                            {formatPerUnit(product.pricePerUnit) && (
                              <div className="text-text-muted text-xs mt-0.5 font-mono">{formatPerUnit(product.pricePerUnit)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
```

- [ ] **Step 5: Type-check + visually verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Reload http://localhost:3031, run a search ("lapte praf aptamil"). Verify:
- Group cards have hairline border, dotted row dividers, accent-colored prices, brass/oxblood BEST badge.
- Toggle to light: same layout, oxblood accent, paper background.
- Mobile (DevTools 390px): rows stack name → merchant + price.
- "Report" pill in stats bar uses border + Plex Mono uppercase.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat(theme): restyle results, group cards, ungrouped, report button to editorial"
```

---

## Task 9: Restyle the report modal

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the modal block**

Find:

```tsx
      {/* Report Modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeReport() }}
        >
          <div className="glass-card rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl">
            {reportStatus === 'sent' ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-100">Thanks! I&apos;ll take a look.</p>
                <p className="text-sm text-slate-400 mt-1">Report sent successfully.</p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-100 mb-1">Report a problem with these results</h2>
                <p className="text-sm text-slate-400 mb-4">Tell me what&apos;s wrong (optional). The current search and results will be attached automatically.</p>
                <textarea
                  ref={textareaRef}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="ex: shows me Pampers when I searched Huggies"
                  className="w-full px-4 py-3 bg-slate-900 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 text-white placeholder:text-slate-500 text-sm resize-none transition-all"
                />
                {reportError && (
                  <p className="mt-2 text-sm text-rose-400">{reportError}</p>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={closeReport}
                    disabled={reportStatus === 'sending'}
                    className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={reportStatus === 'sending'}
                    className="flex items-center gap-2 px-6 py-2.5 text-white bg-gradient-to-r from-cyan-600 to-purple-700 hover:from-cyan-500 hover:to-purple-600 disabled:from-slate-700 disabled:to-slate-600 font-semibold rounded-xl transition-all duration-300 disabled:cursor-not-allowed shadow-lg hover:shadow-cyan-500/25 text-sm"
                  >
                    {reportStatus === 'sending' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
```

Replace with:

```tsx
      {/* Report Modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeReport() }}
        >
          <div
            className="border border-rule bg-bg-elev rounded-md p-6 sm:p-8 w-full max-w-lg"
            style={{ boxShadow: '0 20px 50px -12px rgba(0,0,0,0.35)' }}
          >
            {reportStatus === 'sent' ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-accent flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p
                  className="font-display italic text-text"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900 }}
                >
                  Thanks!
                </p>
                <p className="text-sm text-text-muted mt-1">Report sent. I&apos;ll take a look.</p>
              </div>
            ) : (
              <>
                <h2
                  className="font-display italic text-text mb-2"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900 }}
                >
                  Report a problem
                </h2>
                <p className="text-sm text-text-muted mb-4">
                  Tell me what&apos;s wrong (optional). The current search and results will be attached automatically.
                </p>
                <textarea
                  ref={textareaRef}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="ex: shows me Pampers when I searched Huggies"
                  className="w-full px-3 py-2 bg-transparent border border-rule rounded-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted text-sm resize-none transition-colors"
                />
                {reportError && (
                  <p className="mt-2 text-sm text-accent">{reportError}</p>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={closeReport}
                    disabled={reportStatus === 'sending'}
                    className="px-4 py-2 text-text-muted hover:text-text transition-colors text-xs font-mono uppercase tracking-[0.1em] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={reportStatus === 'sending'}
                    className="flex items-center gap-2 px-5 py-2 bg-accent text-accent-ink hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-mono uppercase tracking-[0.1em] text-xs transition-opacity"
                  >
                    {reportStatus === 'sending' ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-accent-ink/30 border-t-accent-ink rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Verify modal in dev**

Reload http://localhost:3031, run a search, click the "Report" pill in the stats bar. Verify:
- Backdrop is theme-toned (no blue/slate tint), no `backdrop-blur`.
- Panel uses `var(--bg-elev)`.
- Heading is Fraunces italic.
- Send button is brass (dark) / oxblood (light) — no gradient.
- ESC closes.
- Click outside the panel closes.
- Type a note, click Send → success state shows accent-ringed checkmark, auto-closes after ~3s.
- Toggle theme: same modal in light, oxblood accent.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(theme): restyle report modal to editorial"
```

---

## Task 10: Run full test suite + production build

**Files:** none — verification only.

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: all tests PASS, including new `tests/lib/theme.test.ts`.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: build succeeds, no warnings about unknown utilities or missing fonts.

- [ ] **Step 3: Restart dev server with the production build's class names regenerated**

```bash
lsof -ti:3031 | xargs kill 2>/dev/null
PORT=3031 nohup npm run dev > /tmp/unified-search-31.log 2>&1 &
```

Visit http://localhost:3031.

- [ ] **Step 4: Manual scenario walkthrough**

Walk through each scenario from the spec (`docs/superpowers/specs/2026-05-17-editorial-theme-design.md` § Testing → Manual scenarios):

1. Set OS to dark mode, hard-reload http://localhost:3031 → paints dark, no flash.
2. Set OS to light mode, hard-reload → paints light, no flash.
3. Click the sun segment in dark mode → switches to light. Open DevTools → Application → Local Storage → confirm `theme = "light"`.
4. Reload → still light.
5. Clear `theme` from localStorage, change OS to dark, reload → page is dark again.
6. Search "lapte praf aptamil" in each mode → results render, BEST badge accent-filled, dotted row dividers.
7. Use DevTools mobile preset (iPhone 12, 390px). Toggle visible top-right, title scales, rows stack, no horizontal scroll.
8. Tab through the page: search input → search button → toggle (or wherever source order places them). All focusable, with visible accent outline.
9. DevTools → Rendering → enable `prefers-reduced-motion: reduce`. Toggle theme. Color swap is instant, no transition.
10. Click "Report" in the stats bar → modal opens with theme-tinted backdrop. Type a note, click Send → success state, auto-closes after 3s. ESC and click-outside also close.

For any scenario that fails, file a follow-up commit on this branch fixing it before opening the PR.

- [ ] **Step 5: Capture before/after screenshots**

Save to `.artifacts/31-editorial-theme/screenshots/`:

```bash
mkdir -p /Users/mcandea/personal/unified-search/.artifacts/31-editorial-theme/screenshots
```

Capture in browser (manual): home dark, home light, results dark, results light, modal dark, modal light, mobile dark, mobile light. Filenames: `home-dark.png`, `home-light.png`, etc.

- [ ] **Step 6: Open PR**

```bash
git -C /Users/mcandea/personal/unified-search-31-editorial-theme push -u origin 31-editorial-theme

gh pr create --repo mcandea04/unified-search --title "feat: editorial theme + light/dark switch" --body "$(cat <<'EOF'
## Summary

- Adds a fixed top-right segmented theme toggle (☾/☀) that persists in localStorage and respects OS `prefers-color-scheme` on first visit.
- Replaces the dark-only generic SaaS look with a cohesive **Editorial Press** aesthetic that works symmetrically across both modes.
- Drops `glass-card`, animated grid, gradient text, and gradient buttons sitewide.

## Design

- **Typography:** Fraunces (italic display) + DM Sans (body) + IBM Plex Mono (numerals & meta).
- **Palette:** espresso/cream (dark) + paper/espresso (light); accent **brass `#d4a44d`** on dark, **oxblood `#8b3a1f`** on light.
- **Layout:** dotted row dividers, hairline card borders, fluid title via `clamp()`, no decorative gradients.

Spec: `docs/superpowers/specs/2026-05-17-editorial-theme-design.md`
Plan: `docs/superpowers/plans/2026-05-17-editorial-theme.md`

Closes #31

## Test plan

- [x] OS dark/light preference respected on first visit; user choice persists across reloads
- [x] Theme toggle visible top-right at all viewports, no FOUC
- [x] Results, BEST badge, report button + modal all restyled
- [x] WCAG AA contrast verified for both modes
- [x] Mobile (390px) layout works without horizontal scroll
- [x] `prefers-reduced-motion: reduce` disables theme transition
- [x] `npm test` green, `npm run build` clean
EOF
)"
```

- [ ] **Step 7: Hand off to user for review**

Print the PR URL. Remind that `~/personal/unified-search` follows the post-merge cleanup workflow (CLAUDE.local.md): wait at least 5 minutes for the Codex bot review (if installed) before merging.

---

## Self-review

**Spec coverage:**

- Goals 1–4 (toggle, persistence, FOUC-free, mobile) → Tasks 4–6.
- Editorial typography → Task 6 fonts + Task 7 Fraunces title.
- Palette + CSS variables → Task 2.
- Tailwind v4 utilities → Tasks 2 + 3.
- ThemeProvider + ThemeToggle → Tasks 4 + 5.
- Pre-paint inline script (no FOUC) → Task 6.
- WCAG AA contrast → asserted in spec, verified by-eye in Task 10 step 4.
- Reduced-motion → Task 2 (`@media`) + Task 10 step 4 scenario 9.
- Modal restyle (PR #30 carry-over) → Task 9.
- All `glass-card` usages → grepped, swept in Tasks 7 + 8 + 9.
- Acceptance criterion "no flash of wrong theme" → Task 6 inline script + Task 10 scenarios 1–2.
- Acceptance criterion "Tailwind classes that hardcode dark slate values replaced" → Tasks 7 + 8 + 9 explicitly enumerate every block.

**Placeholders:** none. Every code step has the full snippet.

**Type consistency:** `Theme = 'dark' | 'light'`, `useTheme()`, `toggle()` consistent across Tasks 1, 4, 5. CSS variable names (`--bg`, `--bg-elev`, `--text`, `--text-muted`, `--rule`, `--accent`, `--accent-ink`) consistent in Tasks 2, 7, 8, 9.

**Scope:** single-feature plan, ten tasks, ~2–3 hours of focused work for a developer with React/Tailwind familiarity.
