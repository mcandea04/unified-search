# Editorial theme + light/dark switch — design

**Issue:** [#31](https://github.com/mcandea04/unified-search/issues/31)
**Date:** 2026-05-17
**Branch:** `31-editorial-theme`

## Summary

Add a light/dark theme switch and re-haul the visual identity. Current UI is dark-only and reads as generic AI-generated SaaS (neon cyan/purple gradients, glass cards, animated grid, gradient buttons). Replace it with a cohesive **Editorial Press** aesthetic that works symmetrically across both modes.

## Goals

1. Toggle between light and dark themes; persist user choice; respect OS preference on first visit.
2. New visual identity that is distinctive, type-driven, density-friendly, and ages well.
3. No flash of wrong theme on first paint.
4. Mobile layout (375px) works without regressions.

## Non-goals

- No dynamic per-component theming (single global switch).
- No system-following mode after the user has explicitly toggled (localStorage wins).
- No third theme (e.g. sepia, high-contrast). Just dark and light.
- No copy or layout changes beyond what the visual rehaul requires.

## Visual identity — Editorial Press

Newspaper masthead energy. Italic display serif, monospace numerals, dotted rules between rows, density over decoration. No decorative gradients, no glassmorphism, no animated background grid.

### Typography

| Role    | Font                            | Weights      | Used for                                         |
|---------|---------------------------------|--------------|--------------------------------------------------|
| Display | Fraunces (italic)               | 900          | Title "Unified Search", group headings           |
| Body    | DM Sans                         | 400, 500, 600| All running text, labels, buttons                |
| Mono    | IBM Plex Mono                   | 400, 700     | Prices, meta strips ("VOL 1 · LIVE"), badges     |

Loaded via Google Fonts in `app/layout.tsx` using `next/font/google` for self-hosting + correct preload.

### Palette

CSS custom properties on `:root` (default = dark) and `[data-theme="light"]`:

```css
:root, [data-theme="dark"] {
  --bg: #181613;          /* espresso */
  --bg-elev: #1f1c18;     /* card surface, slightly lifted */
  --text: #e8e2d4;        /* cream */
  --text-muted: #8a8475;  /* meta, captions */
  --rule: #2a241d;        /* dotted dividers, hairlines */
  --accent: #d4a44d;      /* brass — prices, BEST, focus rings */
  --accent-ink: #181613;  /* foreground when sitting on accent */
}

[data-theme="light"] {
  --bg: #f4f0e6;          /* paper */
  --bg-elev: #faf6ea;     /* card surface */
  --text: #181613;        /* espresso */
  --text-muted: #6b6555;  /* meta */
  --rule: #d8d2c2;        /* dotted dividers */
  --accent: #8b3a1f;      /* oxblood — prices, BEST */
  --accent-ink: #f4f0e6;  /* foreground when sitting on accent */
}
```

Tailwind v4 maps these via `@theme` so utilities like `bg-bg`, `text-text`, `border-rule`, `text-accent` are available — preferring utilities over arbitrary `var(--…)` strings.

### Layout patterns

- **Title:** `font-size: clamp(2.25rem, 8vw, 4.75rem)`, italic Fraunces 900, letter-spacing -0.02em.
- **Meta strip:** above title — `IBM Plex Mono`, 0.7rem, uppercase, tracking +0.15em, opacity 0.55. Reads "VOL 1 · LIVE PRICE INTEL · EMAG / BEBETEI / NOTINO / TRENDYOL".
- **Search input:** transparent background, 2px bottom border (`var(--text)`), italic Fraunces, no other chrome. Submit on Enter, button to its right.
- **Search button:** filled with `var(--accent)`, foreground `var(--accent-ink)`, IBM Plex Mono, uppercase, tracking +0.05em.
- **Group cards:** `var(--bg-elev)` background, 1px solid `var(--rule)` border, no blur, no shadow, no rounded-2xl — soft `border-radius: 6px` only.
- **Rows:** dotted-bottom (`border-bottom: 1px dotted var(--rule)`), no per-row background. Hover: row background tints to `color-mix(in srgb, var(--accent) 6%, transparent)`.
- **BEST badge:** filled `var(--accent)`, IBM Plex Mono, uppercase, tracking +0.1em. No gradient, no glow.
- **No animated grid background; no glass-card blur; no gradient text.** Body background is plain `var(--bg)`.

### Theme toggle

- Fixed top-right (`position: fixed; top: 1rem; right: 1rem; z-index: 50;`).
- Segmented pill: 1px border `var(--rule)`, two segments — moon (☾) on left, sun (☀) on right. Active segment fills with `var(--accent)`, foreground `var(--accent-ink)`.
- 44px min tap target on mobile (each segment ≥ 44×44 padding-box).
- Smaller on `sm:` and up.
- Click toggles between dark and light. Updates `<html data-theme="...">` and persists to `localStorage["theme"]`.

## Architecture

### Theme state

Single source of truth: `<html data-theme="dark|light">` attribute. Set:

1. **Pre-paint** by an inline script in `app/layout.tsx` `<head>` (blocking, before body renders) that reads `localStorage["theme"]` then falls back to `window.matchMedia("(prefers-color-scheme: light)").matches`. This avoids FOUC.
2. **At runtime** by a `ThemeProvider` client context that exposes `theme` and `toggle`. The toggle button calls `toggle()`, which writes to localStorage and updates the `data-theme` attribute.

The provider does NOT do the initial read — the inline script already did. The provider only mirrors state for React.

```
app/layout.tsx
├── <Script strategy="beforeInteractive"> // sets data-theme pre-paint
├── <ThemeProvider>                       // reads current data-theme, exposes toggle
│   └── {children}
```

### Component changes

- `app/layout.tsx` — load Fraunces / DM Sans / IBM Plex Mono via `next/font/google`; inject theme-init inline script; wrap children in `ThemeProvider`.
- `app/globals.css` — replace existing `:root` palette + body styles + `glass-card` + animated grid with new editorial CSS variables and base styles. Drop `gradient-text`, `glow-cyan`, `glow-purple`, animated `body::before`, hard-coded `input[type="text"]` overrides.
- `app/page.tsx` — strip Tailwind classes that hardcode slate / cyan / purple values. Replace with theme-aware utilities (`bg-bg`, `text-text`, `border-rule`, `text-accent`, `text-muted`). Title becomes Fraunces; meta strip uses Plex Mono; rows get dotted dividers.
- `tailwind.config.ts` — register theme variables under `@theme` so utilities resolve to `var(--…)`.
- New: `app/components/ThemeToggle.tsx` — segmented pill button. Client component.
- New: `app/components/ThemeProvider.tsx` — context provider. Client component.

### File-by-file diff scope

| File                                | Change                                                              |
|-------------------------------------|---------------------------------------------------------------------|
| `app/layout.tsx`                    | Add fonts, init script, provider, lang stays `ro`                   |
| `app/globals.css`                   | Replace ~140 lines: new vars, drop animations + glassmorphism       |
| `app/page.tsx`                      | Replace ~30 className strings; restructure header block             |
| `app/components/ThemeProvider.tsx`  | New ~30 lines                                                        |
| `app/components/ThemeToggle.tsx`    | New ~40 lines                                                        |
| `tailwind.config.ts`                | Switch to `@theme` block exposing CSS-var-backed colors             |

## Behaviour details

### First-visit decision tree

```
localStorage["theme"] set?
├── yes → use that value
└── no  → matchMedia "(prefers-color-scheme: light)" matches?
         ├── yes → "light"
         └── no  → "dark"
```

### Toggle interaction

- Click moon segment when in light → switch to dark; click sun when in dark → switch to light.
- Click currently-active segment: no-op (or toggle anyway, harmless).
- Updates `data-theme` attribute immediately; CSS transitions on `background-color` and `color` (≤180ms ease) keep the swap from being jarring but not laggy.

### Reduced motion

- `prefers-reduced-motion: reduce` disables the color transition on `<html>` and disables the existing `fade-in-up` stagger.

### Accessibility

- Toggle is a `<button>` with `aria-label="Switch to light mode"` / `"Switch to dark mode"` (label updates with state).
- Toggle has visible focus ring (`outline: 2px solid var(--accent); outline-offset: 2px`).
- Both palettes pass WCAG AA for body text on background:
  - Dark: `#e8e2d4` on `#181613` ≈ 12.4:1 ✓
  - Light: `#181613` on `#f4f0e6` ≈ 14.5:1 ✓
  - Brass `#d4a44d` on `#181613` ≈ 7.6:1 ✓ (AA large + small)
  - Oxblood `#8b3a1f` on `#f4f0e6` ≈ 7.0:1 ✓
- BEST badge text on accent fill verified for AA.

### No-FOUC strategy

Inline pre-paint script:

```js
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var t = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
```

Renders before React hydrates, so first paint already has the right palette. The `try/catch` covers Safari private mode where localStorage throws.

## Testing

### Manual scenarios (run on the dev server, port 3031)

1. Fresh visit, OS in dark mode → page paints dark, no flash.
2. Fresh visit, OS in light mode → page paints light, no flash.
3. Click sun segment in dark mode → instant switch to light, localStorage = "light".
4. Reload → page stays light (localStorage wins over OS).
5. Clear localStorage, reload → reverts to OS preference.
6. Search "lapte praf aptamil" in each mode → results render, BEST badge visible, prices in accent color, dotted dividers between rows.
7. iPhone 12 viewport (390px): toggle visible top-right, title scales, rows stack, no horizontal scroll.
8. Tab order: search input → search button → toggle (top-right gets last in source order but visible).
9. `prefers-reduced-motion: reduce`: theme swap has no transition.

### Automated

Existing Vitest + Playwright suite stays green. No new tests required for this change — it is purely visual + state.

## Risks & open decisions

- **Risk:** Tailwind v4 `@theme` syntax for CSS-var-backed colors. Already supported (`tailwindcss` 4.x). If we discover incompatibility we fall back to declaring vars in `globals.css` and using arbitrary classes (`bg-[color:var(--bg)]`).
- **Risk:** Existing `glass-card` selector is referenced in `app/page.tsx` ~6 times. Need to grep all usages and replace deliberately, not via blind find/replace.
- **Risk:** Romanian-language assumption — `<html lang="ro">` stays. No copy strings change.
- **Open:** Keep the `fade-in-up` stagger animation? Yes — it does not clash with editorial direction; just keep it short.
- **Open:** Should the search button stay full width on mobile or shrink to icon? Stay full width; the editorial direction wants generous, label-first chrome.

## Out of scope (future)

- Sepia / reading mode.
- Per-source theming (e.g. eMAG yellow, Notino pink) — current direction explicitly avoids per-merchant brand colors.
- Theme-aware product images (e.g. white vs cream image background).
