# Attribute Extraction + Generic Grouping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `lib/matching/fuzzy-match.ts` with two pure layers — `attributes.ts` (regex-based extractor) and `grouping.ts` (generic key-based bucketer) — and surface organic / pack / per-unit-price in the UI.

**Architecture:** Layer A turns each `Product` into a structured `ProductAttributes` object (brand, organic, pack, count, variant, diaperSize). Layer B groups products on a composite key built from those attributes plus the search query as a `kind` anchor. `route.ts` glues the layers together and computes per-unit price. UI renders attributes on every row, grouped or not.

**Tech Stack:** Next.js 16 (App Router) + React 19, TypeScript, Tailwind v4, Vitest (newly added).

**Spec:** `docs/superpowers/specs/2026-05-14-attribute-extraction-design.md`

**Issue:** [#23](https://github.com/mcandea04/unified-search/issues/23)

---

## File Structure

**Create:**
- `lib/matching/attributes.ts` — Layer A extractor.
- `lib/matching/grouping.ts` — Layer B grouper.
- `lib/matching/__tests__/attributes.test.ts`
- `lib/matching/__tests__/grouping.test.ts`
- `vitest.config.ts` — minimal config.

**Modify:**
- `lib/types.ts` — extend `Product`, `ProductGroup`; add `ProductAttributes`, `PerUnitPrice`.
- `app/api/search/route.ts` — enrich + per-unit-price + new grouping call.
- `app/page.tsx` — pack column, organic badge, per-unit-price subtext, BEST/UNIT pill.
- `package.json` — add Vitest scripts + dev deps.
- `lib/scrapers/index.ts` and per-source scrapers — populate `attributes` field on each `Product` (initialized empty, populated downstream by `extractAttributes`).

**Delete:**
- `lib/matching/fuzzy-match.ts`

---

## Task 1: Add Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

```bash
cd ~/personal/unified-search-23-attribute-extraction
npm install --save-dev vitest @vitest/ui
```

Expected: `package.json` gets `vitest` + `@vitest/ui` under devDependencies.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `scripts` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

So the `scripts` block becomes:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Sanity-check Vitest runs**

Run: `npm test`

Expected: Vitest reports "No test files found" with exit 0 (acceptable until tests exist) OR exits 1 with "No test files found, exiting with code 1". Either is fine — we just want Vitest invocable.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add Vitest for unit tests (#23)"
```

---

## Task 2: Extend types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Replace contents of `lib/types.ts`**

```ts
/**
 * Source website identifier
 */
export type SourceSite = 'emag' | 'bebetei' | 'notino' | 'trendyol'

/**
 * Structured attributes derived from a product name.
 */
export interface ProductAttributes {
  brand?: string
  organic: boolean
  pack?: { value: number; unit: 'g' | 'ml'; original: string }
  count?: number
  variant?: string
  diaperSize?: string
}

/**
 * Per-unit price computed after attribute extraction.
 */
export interface PerUnitPrice {
  /** RON per 100 of `unit` when unit is g/ml; RON per piece when unit is 'piece'. */
  value: number
  unit: 'g' | 'ml' | 'piece'
}

/**
 * Individual product from a single source
 */
export interface Product {
  id: string
  name: string
  price: number
  currency: string
  imageUrl: string
  productUrl: string
  source: SourceSite
  brand?: string
  variant?: string
  attributes: ProductAttributes
  pricePerUnit?: PerUnitPrice
}

/**
 * Confidence level for product matching
 */
export type MatchConfidence = 'high' | 'medium' | 'low'

/**
 * Group of similar products from different sources
 */
export interface ProductGroup {
  id: string
  matchedName: string
  products: Product[]
  bestPrice: number
  bestPriceSource: SourceSite
  matchConfidence: MatchConfidence
  attributes: ProductAttributes
  bestPricePerUnit?: PerUnitPrice
  bestPricePerUnitSource?: SourceSite
}

/**
 * Search result from API
 */
export interface SearchResult {
  query: string
  groups: ProductGroup[]
  ungrouped: Product[]
  totalProducts: number
  countBySource: Record<SourceSite, number>
  sourceErrors?: Partial<Record<SourceSite, string>>
  timestamp: number
}

/**
 * Scraper response from each website
 */
export interface ScraperResponse {
  source: SourceSite
  products: Product[]
  success: boolean
  error?: string
}
```

- [ ] **Step 2: Verify the rest of the codebase still type-checks**

Run: `npx tsc --noEmit`

Expected: errors only in scrapers and matching code that have not yet been updated. The errors should be limited to "Property 'attributes' is missing" on `Product` literals. Note them — Tasks 3-5 fix them.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: extend Product/ProductGroup types with attributes and pricePerUnit (#23)"
```

---

## Task 3: Initialize empty `attributes` in scrapers

Scrapers construct `Product` literals. They must include the new required `attributes` field. Default to `{ organic: false }`. The extractor populates real values later in the pipeline.

**Files:**
- Modify: `lib/scrapers/emag.ts`
- Modify: `lib/scrapers/bebetei.ts`
- Modify: `lib/scrapers/notino.ts`
- Modify: `lib/scrapers/trendyol.ts`

- [ ] **Step 1: For each scraper, find every place a `Product` is built and add `attributes: { organic: false }`**

In `lib/scrapers/emag.ts`, locate the block that constructs the product (search for `source: 'emag'`). Add `attributes: { organic: false },` to the same object literal.

Example pattern (the exact field set varies per scraper — match the existing fields and append `attributes`):

```ts
const product: Product = {
  id: `emag-${id}`,
  name,
  price,
  currency: 'RON',
  imageUrl,
  productUrl,
  source: 'emag',
  brand,
  variant,
  attributes: { organic: false },
}
```

Repeat the same change in `lib/scrapers/bebetei.ts`, `lib/scrapers/notino.ts`, `lib/scrapers/trendyol.ts`. Each scraper has exactly one place where a `Product` is constructed; if your editor finds more than one, update all of them.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: scraper errors gone. Only remaining errors should be in `lib/matching/fuzzy-match.ts` and `app/api/search/route.ts` (those go away in later tasks).

- [ ] **Step 3: Commit**

```bash
git add lib/scrapers/
git commit -m "feat: scrapers populate empty attributes on each Product (#23)"
```

---

## Task 4: Layer A — `attributes.ts` (test first)

Failing tests, then implementation.

**Files:**
- Create: `lib/matching/__tests__/attributes.test.ts`
- Create: `lib/matching/attributes.ts`

- [ ] **Step 1: Write the failing test file**

`lib/matching/__tests__/attributes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { extractAttributes } from '../attributes'
import type { Product } from '../../types'

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 't-1',
    name: '',
    price: 0,
    currency: 'RON',
    imageUrl: '',
    productUrl: '',
    source: 'emag',
    attributes: { organic: false },
    ...overrides,
  }
}

describe('extractAttributes', () => {
  it('extracts brand, organic, and pack from chia seeds', () => {
    const p = makeProduct({ name: 'Seminte de chia bio Driedfruits 200g' })
    expect(extractAttributes(p)).toMatchObject({
      brand: 'driedfruits',
      organic: true,
      pack: { value: 200, unit: 'g', original: '200g' },
    })
  })

  it('does not misread age range as pack on diapers', () => {
    const p = makeProduct({
      name: 'Pampers Premium Care Nr.5 11-16 kg 88 buc',
      brand: 'Pampers',
    })
    const attrs = extractAttributes(p)
    expect(attrs.brand).toBe('pampers')
    expect(attrs.diaperSize).toBe('5')
    expect(attrs.count).toBe(88)
    expect(attrs.pack).toBeUndefined()
  })

  it('extracts pack and stage on infant formula', () => {
    const p = makeProduct({ name: 'Aptamil 2 800g', brand: 'Aptamil' })
    expect(extractAttributes(p)).toMatchObject({
      brand: 'aptamil',
      diaperSize: '2',
      pack: { value: 800, unit: 'g', original: '800g' },
    })
  })

  it('extracts ml pack and organic flag on cosmetics', () => {
    const p = makeProduct({ name: 'Shampoo Loreal 250ml bio', brand: "L'Oreal" })
    const attrs = extractAttributes(p)
    expect(attrs.organic).toBe(true)
    expect(attrs.pack).toEqual({ value: 250, unit: 'ml', original: '250ml' })
  })

  it('parses comma-decimal litres to millilitres', () => {
    const p = makeProduct({ name: 'Lapte ecologic 1,5 l' })
    const attrs = extractAttributes(p)
    expect(attrs.pack?.value).toBe(1500)
    expect(attrs.pack?.unit).toBe('ml')
    expect(attrs.organic).toBe(true)
  })

  it('parses dot-decimal kilograms to grams', () => {
    const p = makeProduct({ name: 'Faina integrala 0.5 kg' })
    const attrs = extractAttributes(p)
    expect(attrs.pack?.value).toBe(500)
    expect(attrs.pack?.unit).toBe('g')
  })

  it('falls back to first non-stopword token when JSON-LD brand missing', () => {
    const p = makeProduct({ name: 'Driedfruits seminte chia 100g' })
    expect(extractAttributes(p).brand).toBe('driedfruits')
  })

  it('returns organic:false and otherwise empty when nothing matches', () => {
    const p = makeProduct({ name: 'de pentru cu' })
    expect(extractAttributes(p)).toEqual({ organic: false })
  })

  it('extracts plus-size diaper notation', () => {
    const p = makeProduct({ name: 'Pampers 5+ Junior 100 buc', brand: 'Pampers' })
    expect(extractAttributes(p).diaperSize).toBe('5+')
  })

  it('caps variant at 3 sorted tokens', () => {
    const p = makeProduct({ name: 'CeraVe foaming gel cleanser fragrance free 236ml' })
    const attrs = extractAttributes(p)
    expect(attrs.variant?.split(' ').length).toBeLessThanOrEqual(3)
    const tokens = attrs.variant?.split(' ') ?? []
    const sorted = [...tokens].sort()
    expect(tokens).toEqual(sorted)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL — `extractAttributes` not exported (file does not exist yet).

- [ ] **Step 3: Implement `lib/matching/attributes.ts`**

```ts
import type { Product, ProductAttributes } from '../types'

const STOPWORDS = new Set(['de', 'pentru', 'cu', 'din', 'la', 'si', '&', '-'])

const PACK_RE = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i
const COUNT_RE = /(\d{1,4})\s*(buc|bucati|capsule|servetele|tablete|pieces|pcs|pads)\b/i
const ORGANIC_RE = /\b(bio|eco|organic|raw|natural)\b/i

const SIZE_CONTEXT = new Set(['nr', 'no', 'numar', 'marime', 'marimea', 'size', 'stage', 'etapa'])
const AGE_RANGE_TOKENS = new Set(['luni', 'luna', 'months', 'month'])

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+,.\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface PackMatch {
  value: number
  unit: 'g' | 'ml'
  original: string
  start: number
  end: number
}

function findPack(normalized: string): PackMatch | null {
  const m = PACK_RE.exec(normalized)
  if (!m) return null
  const start = m.index
  const end = start + m[0].length
  const before = normalized.slice(Math.max(0, start - 5), start)
  const after = normalized.slice(end, end + 5)
  // Age-range guard: "11-16 kg" or "4-8 luni" — kg/g/ml in age range, not pack.
  if (/\d+\s*-\s*$/.test(before)) return null
  if (/^\s*-\s*\d/.test(after)) return null
  const next = normalized.slice(end).trim().split(' ')[0] ?? ''
  if (AGE_RANGE_TOKENS.has(next)) return null
  const raw = m[1].replace(',', '.')
  const num = Number.parseFloat(raw)
  if (!Number.isFinite(num)) return null
  const unitRaw = m[2].toLowerCase()
  let unit: 'g' | 'ml'
  let value: number
  if (unitRaw === 'kg') {
    unit = 'g'
    value = Math.round(num * 1000)
  } else if (unitRaw === 'l') {
    unit = 'ml'
    value = Math.round(num * 1000)
  } else if (unitRaw === 'g') {
    unit = 'g'
    value = Math.round(num)
  } else {
    unit = 'ml'
    value = Math.round(num)
  }
  return { value, unit, original: m[0].trim().replace(/\s+/g, ''), start, end }
}

interface CountMatch {
  count: number
  start: number
  end: number
}

function findCount(normalized: string): CountMatch | null {
  const m = COUNT_RE.exec(normalized)
  if (!m) return null
  const num = Number.parseInt(m[1], 10)
  if (!Number.isFinite(num)) return null
  return { count: num, start: m.index, end: m.index + m[0].length }
}

interface DiaperMatch {
  size: string
  spans: Array<{ start: number; end: number }>
}

function findDiaperSize(normalized: string): DiaperMatch | null {
  const tokens = normalized.split(' ')
  const positions: number[] = []
  let cursor = 0
  for (const t of tokens) {
    positions.push(cursor)
    cursor += t.length + 1
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const prev = tokens[i - 1] ?? ''
    const next = tokens[i + 1] ?? ''
    const plus = token.match(/^(\d{1,2})\+$/)
    if (plus) {
      const start = positions[i]
      return { size: `${plus[1]}+`, spans: [{ start, end: start + token.length }] }
    }
    if (!/^\d{1,2}$/.test(token)) continue
    const n = Number(token)
    if (n > 8) continue
    if (SIZE_CONTEXT.has(prev) || SIZE_CONTEXT.has(next)) {
      const start = positions[i]
      return { size: token, spans: [{ start, end: start + token.length }] }
    }
  }
  return null
}

function removeRanges(s: string, ranges: Array<{ start: number; end: number }>): string {
  if (!ranges.length) return s
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const r of sorted) {
    out += s.slice(cursor, r.start)
    cursor = r.end
  }
  out += s.slice(cursor)
  return out.replace(/\s+/g, ' ').trim()
}

function inferBrand(working: string, jsonLdBrand: string | undefined): string | undefined {
  if (jsonLdBrand) {
    const norm = normalizeText(jsonLdBrand)
    const first = norm.split(' ').find((t) => t && !STOPWORDS.has(t) && !/^\d+$/.test(t))
    if (first) return first
  }
  const tokens = working.split(' ')
  for (const t of tokens) {
    if (!t) continue
    if (STOPWORDS.has(t)) continue
    if (/^\d+$/.test(t)) continue
    return t
  }
  return undefined
}

function extractVariant(working: string, brand: string | undefined): string | undefined {
  const tokens = working
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t) && !/^\d+\+?$/.test(t) && t !== brand)
  if (!tokens.length) return undefined
  const sorted = [...tokens].sort().slice(0, 3)
  return sorted.join(' ')
}

export function extractAttributes(product: Product): ProductAttributes {
  const normalized = normalizeText(product.name)
  if (!normalized) return { organic: false }

  const consumed: Array<{ start: number; end: number }> = []

  const pack = findPack(normalized)
  if (pack) consumed.push({ start: pack.start, end: pack.end })

  const count = findCount(normalized)
  if (count) consumed.push({ start: count.start, end: count.end })

  const organicMatch = ORGANIC_RE.exec(normalized)
  const organic = Boolean(organicMatch)
  if (organicMatch) {
    consumed.push({ start: organicMatch.index, end: organicMatch.index + organicMatch[0].length })
  }

  const diaper = findDiaperSize(normalized)
  if (diaper) consumed.push(...diaper.spans)

  const working = removeRanges(normalized, consumed)
  const brand = inferBrand(working, product.brand)
  const variant = extractVariant(working, brand)

  const attrs: ProductAttributes = { organic }
  if (brand) attrs.brand = brand
  if (pack) attrs.pack = { value: pack.value, unit: pack.unit, original: pack.original }
  if (count) attrs.count = count.count
  if (diaper) attrs.diaperSize = diaper.size
  if (variant) attrs.variant = variant
  return attrs
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all tests in `attributes.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/matching/attributes.ts lib/matching/__tests__/attributes.test.ts
git commit -m "feat(matching): add Layer A attribute extractor (#23)"
```

---

## Task 5: Layer B — `grouping.ts` (test first)

**Files:**
- Create: `lib/matching/__tests__/grouping.test.ts`
- Create: `lib/matching/grouping.ts`

- [ ] **Step 1: Write the failing test file**

`lib/matching/__tests__/grouping.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { groupProducts } from '../grouping'
import { extractAttributes } from '../attributes'
import type { Product, SourceSite } from '../../types'

function makeProduct(overrides: Partial<Product> & { name: string; source: SourceSite }): Product {
  const base: Product = {
    id: `${overrides.source}-${overrides.name}`,
    name: overrides.name,
    price: overrides.price ?? 10,
    currency: 'RON',
    imageUrl: '',
    productUrl: '',
    source: overrides.source,
    attributes: { organic: false },
    ...overrides,
  }
  base.attributes = extractAttributes(base)
  return base
}

describe('groupProducts', () => {
  it('groups same brand + pack + organic across sources', () => {
    const products = [
      makeProduct({ name: 'Seminte chia bio Driedfruits 200g', source: 'emag', price: 20 }),
      makeProduct({ name: 'Driedfruits chia bio 200g', source: 'bebetei', price: 22 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'notino', price: 18 }),
    ]
    const { groups, ungrouped } = groupProducts(products, 'seminte chia')
    const bio = groups.find((g) => g.attributes.organic)
    expect(bio?.products).toHaveLength(2)
    expect(ungrouped).toHaveLength(1)
    expect(ungrouped[0].source).toBe('notino')
  })

  it('keeps different pack sizes in separate groups', () => {
    const products = [
      makeProduct({ name: 'Pampers Active Baby Nr.4 50 buc', source: 'emag', price: 60 }),
      makeProduct({ name: 'Pampers Active Baby Nr.4 50 buc', source: 'bebetei', price: 65 }),
      makeProduct({ name: 'Pampers Active Baby Nr.4 100 buc', source: 'emag', price: 110 }),
      makeProduct({ name: 'Pampers Active Baby Nr.4 100 buc', source: 'bebetei', price: 120 }),
    ]
    const { groups } = groupProducts(products, 'pampers 4')
    expect(groups).toHaveLength(2)
    const sizes = groups.map((g) => g.products[0].attributes.count).sort()
    expect(sizes).toEqual([50, 100])
  })

  it('separates organic from conventional', () => {
    const products = [
      makeProduct({ name: 'Driedfruits chia bio 200g', source: 'emag', price: 25 }),
      makeProduct({ name: 'Driedfruits chia bio 200g', source: 'bebetei', price: 27 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'emag', price: 18 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'bebetei', price: 20 }),
    ]
    const { groups } = groupProducts(products, 'chia')
    expect(groups).toHaveLength(2)
    const flags = groups.map((g) => g.attributes.organic).sort()
    expect(flags).toEqual([false, true])
  })

  it('does not match empty pack signature with sized pack', () => {
    const products = [
      makeProduct({ name: 'Driedfruits chia', source: 'emag', price: 18 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'bebetei', price: 20 }),
    ]
    const { groups, ungrouped } = groupProducts(products, 'chia')
    expect(groups).toHaveLength(0)
    expect(ungrouped).toHaveLength(2)
  })

  it('leaves single-source product in ungrouped', () => {
    const products = [
      makeProduct({ name: 'Lonely product 100g', source: 'emag', price: 5 }),
    ]
    const { groups, ungrouped } = groupProducts(products, 'lonely')
    expect(groups).toHaveLength(0)
    expect(ungrouped).toHaveLength(1)
  })

  it('marks bestPrice and bestPriceSource on group', () => {
    const products = [
      makeProduct({ name: 'Driedfruits chia 200g', source: 'emag', price: 25 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'bebetei', price: 18 }),
    ]
    const { groups } = groupProducts(products, 'chia')
    expect(groups[0].bestPrice).toBe(18)
    expect(groups[0].bestPriceSource).toBe('bebetei')
  })

  it('upgrades confidence to high when 3+ sources', () => {
    const products = [
      makeProduct({ name: 'Driedfruits chia 200g', source: 'emag', price: 25 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'bebetei', price: 18 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'notino', price: 22 }),
    ]
    const { groups } = groupProducts(products, 'chia')
    expect(groups[0].matchConfidence).toBe('high')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL — `groupProducts` not exported.

- [ ] **Step 3: Implement `lib/matching/grouping.ts`**

```ts
import type {
  MatchConfidence,
  Product,
  ProductAttributes,
  ProductGroup,
  SourceSite,
} from '../types'

const STOPWORDS = new Set(['de', 'pentru', 'cu', 'din', 'la', 'si', '&', '-'])

function normalizeQuery(query: string): string {
  const tokens = String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
  return tokens.sort().join(' ')
}

function packSignature(attrs: ProductAttributes): string {
  if (attrs.pack) return `${attrs.pack.value}${attrs.pack.unit}`
  if (typeof attrs.count === 'number') return `${attrs.count}pcs`
  return ''
}

function bucketKey(attrs: ProductAttributes, kind: string): string {
  return [
    attrs.brand ?? 'unknown',
    kind,
    packSignature(attrs),
    attrs.diaperSize ?? '',
    attrs.organic ? 'bio' : 'nonbio',
    attrs.variant ?? '',
  ].join('|')
}

function pickMatchedName(products: Product[]): string {
  const named = products.filter((p) => p.name)
  if (!named.length) return 'Unnamed product'
  return named.slice().sort((a, b) => a.name.length - b.name.length)[0].name
}

function confidenceFor(sources: Set<SourceSite>, attrs: ProductAttributes): MatchConfidence {
  if (sources.size >= 3) return 'high'
  if (sources.size === 2 && attrs.diaperSize) return 'high'
  if (sources.size === 2) return 'medium'
  return 'low'
}

function aggregateAttributes(products: Product[]): ProductAttributes {
  const head = products[0].attributes
  const out: ProductAttributes = { organic: head.organic }
  if (head.brand) out.brand = head.brand
  if (head.pack) out.pack = head.pack
  if (typeof head.count === 'number') out.count = head.count
  if (head.diaperSize) out.diaperSize = head.diaperSize
  const variants = new Set(products.map((p) => p.attributes.variant ?? '').filter(Boolean))
  if (variants.size === 1) out.variant = [...variants][0]
  return out
}

function bestPerUnit(products: Product[]): {
  best?: Product['pricePerUnit']
  source?: SourceSite
} {
  let bestVal = Infinity
  let bestUnit: 'g' | 'ml' | 'piece' | undefined
  let bestSrc: SourceSite | undefined
  const units = new Set(products.map((p) => p.pricePerUnit?.unit).filter(Boolean) as string[])
  if (units.size !== 1) return {}
  for (const p of products) {
    const ppu = p.pricePerUnit
    if (!ppu) continue
    if (ppu.value < bestVal) {
      bestVal = ppu.value
      bestUnit = ppu.unit
      bestSrc = p.source
    }
  }
  if (!bestUnit) return {}
  return { best: { value: bestVal, unit: bestUnit }, source: bestSrc }
}

interface Bucket {
  items: Product[]
  sources: Set<SourceSite>
}

export function groupProducts(
  products: Array<Product & { attributes: ProductAttributes }>,
  query: string,
): { groups: ProductGroup[]; ungrouped: Product[] } {
  const kind = normalizeQuery(query)
  const buckets = new Map<string, Bucket>()
  for (const product of products) {
    if (!product.name) continue
    const key = bucketKey(product.attributes, kind)
    const bucket = buckets.get(key) ?? { items: [], sources: new Set<SourceSite>() }
    bucket.items.push(product)
    bucket.sources.add(product.source)
    buckets.set(key, bucket)
  }

  const groups: ProductGroup[] = []
  const grouped = new Set<string>()
  for (const bucket of buckets.values()) {
    if (bucket.sources.size < 2) continue
    const items = bucket.items
    items.forEach((p) => grouped.add(p.id))
    const prices = items.map((p) => p.price)
    const bestPrice = Math.min(...prices)
    const bestPriceProduct = items.find((p) => p.price === bestPrice) ?? items[0]
    const aggregated = aggregateAttributes(items)
    const { best, source } = bestPerUnit(items)
    groups.push({
      id: `group-${groups.length}`,
      matchedName: pickMatchedName(items),
      products: items,
      bestPrice,
      bestPriceSource: bestPriceProduct.source,
      matchConfidence: confidenceFor(bucket.sources, aggregated),
      attributes: aggregated,
      bestPricePerUnit: best,
      bestPricePerUnitSource: source,
    })
  }

  const ungrouped = products.filter((p) => !grouped.has(p.id))
  return { groups, ungrouped }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all tests pass (both `attributes.test.ts` and `grouping.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/matching/grouping.ts lib/matching/__tests__/grouping.test.ts
git commit -m "feat(matching): add Layer B generic grouping (#23)"
```

---

## Task 6: Wire `route.ts` to new pipeline + delete `fuzzy-match.ts`

**Files:**
- Modify: `app/api/search/route.ts`
- Delete: `lib/matching/fuzzy-match.ts`

- [ ] **Step 1: Replace contents of `app/api/search/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { scrapeAllSites } from '@/lib/scrapers'
import { extractAttributes } from '@/lib/matching/attributes'
import { groupProducts } from '@/lib/matching/grouping'
import { filterAndSortByRelevance, sortGroupsByRelevance } from '@/lib/matching/relevance'
import type {
  PerUnitPrice,
  Product,
  ProductAttributes,
  SearchResult,
  SourceSite,
} from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

function computePerUnitPrice(price: number, attrs: ProductAttributes): PerUnitPrice | undefined {
  if (attrs.pack && attrs.pack.value > 0) {
    return { value: price / (attrs.pack.value / 100), unit: attrs.pack.unit }
  }
  if (typeof attrs.count === 'number' && attrs.count > 0) {
    return { value: price / attrs.count, unit: 'piece' }
  }
  return undefined
}

function enrich(product: Product): Product {
  const attributes = extractAttributes(product)
  const pricePerUnit = computePerUnitPrice(product.price, attributes)
  return { ...product, attributes, pricePerUnit }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  try {
    console.log(`Received search request for: "${query}"`)
    const scraperResults = await scrapeAllSites(query)

    const allProducts: Product[] = []
    const countBySource: Record<SourceSite, number> = {
      emag: 0,
      bebetei: 0,
      notino: 0,
      trendyol: 0,
    }
    const sourceErrors: Partial<Record<SourceSite, string>> = {}

    for (const result of scraperResults) {
      if (result.success) {
        const enriched = result.products.map(enrich)
        allProducts.push(...enriched)
        countBySource[result.source] = enriched.length
      } else {
        console.error(`Failed to scrape ${result.source}:`, result.error)
        sourceErrors[result.source] = result.error ?? 'unknown'
      }
    }

    console.log(`Found ${allProducts.length} total products`)
    console.log(`By source:`, countBySource)

    const MIN_RELEVANCE_SCORE = 30
    const relevantProducts = filterAndSortByRelevance(allProducts, query, MIN_RELEVANCE_SCORE)
    console.log(
      `After relevance filtering: ${relevantProducts.length}/${allProducts.length} products`,
    )

    const { groups, ungrouped } = groupProducts(relevantProducts, query)
    console.log(`Created ${groups.length} groups; ${ungrouped.length} ungrouped`)

    const sortedGroups = sortGroupsByRelevance(groups, query)

    const response: SearchResult = {
      query,
      groups: sortedGroups,
      ungrouped,
      totalProducts: relevantProducts.length,
      countBySource,
      ...(Object.keys(sourceErrors).length > 0 ? { sourceErrors } : {}),
      timestamp: Date.now(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to perform search',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Delete `lib/matching/fuzzy-match.ts`**

```bash
rm lib/matching/fuzzy-match.ts
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/search/route.ts lib/matching/fuzzy-match.ts
git commit -m "feat(api): wire new attributes + grouping pipeline; remove fuzzy-match (#23)"
```

---

## Task 7: UI — pack column, organic badge, per-unit price

**Files:**
- Modify: `app/page.tsx`

The current grid is `grid-cols-12` with: image (1), product (5), merchant (3), price (3). Redistribute to: image (1), product+badges (5), pack (2), merchant (2), price+per-unit (2). Apply identical layout to grouped and ungrouped sections.

- [ ] **Step 1: Update `useState` types and renderers**

Replace `useState<any[]>` declarations with typed state:

```tsx
import type { ProductGroup, Product, PerUnitPrice } from '@/lib/types'
```

Then:

```tsx
const [groups, setGroups] = useState<ProductGroup[]>([])
const [ungrouped, setUngrouped] = useState<Product[]>([])
```

Remove the cast in `data.groups || []` calls — types now flow.

- [ ] **Step 2: Add formatting helpers near the top of the file (above `Home`)**

```tsx
function formatPerUnit(ppu: PerUnitPrice | undefined): string | null {
  if (!ppu) return null
  const v = ppu.value.toFixed(2)
  if (ppu.unit === 'piece') return `${v} RON / buc`
  return `${v} RON / 100${ppu.unit}`
}

function packLabel(product: Product): string {
  if (product.attributes.pack) return product.attributes.pack.original
  if (typeof product.attributes.count === 'number') return `${product.attributes.count} buc`
  return ''
}
```

- [ ] **Step 3: Update grouped table header**

Replace:

```tsx
<div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/20 rounded-lg mb-2 text-slate-400 text-xs sm:text-sm font-medium uppercase tracking-wider border-b border-slate-700/30">
  <div className="col-span-1">Image</div>
  <div className="col-span-5">Product</div>
  <div className="col-span-3">Merchant</div>
  <div className="col-span-3 text-right">Price</div>
</div>
```

With:

```tsx
<div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/20 rounded-lg mb-2 text-slate-400 text-xs sm:text-sm font-medium uppercase tracking-wider border-b border-slate-700/30">
  <div className="col-span-1">Image</div>
  <div className="col-span-5">Product</div>
  <div className="col-span-2">Pack</div>
  <div className="col-span-2">Merchant</div>
  <div className="col-span-2 text-right">Price</div>
</div>
```

Apply the same change to the ungrouped header further down.

- [ ] **Step 4: Update grouped row body**

Replace the grouped row block:

```tsx
{group.products.map((product: any, pIdx: number) => (
  <div ...>
    {/* Image */} {/* Product Name */} {/* Merchant */} {/* Price */}
  </div>
))}
```

With:

```tsx
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
      className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/60 transition-all duration-200 items-center"
    >
      <div className="col-span-1">
        {product.imageUrl ? (
          <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
            <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <div className="w-12 h-12 bg-slate-800/40 rounded border border-slate-700/50"></div>
        )}
      </div>
      <div className="col-span-5">
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
      <div className="col-span-2 text-slate-300 text-sm">{packLabel(product)}</div>
      <div className="col-span-2">
        <span className="text-slate-300 text-sm font-medium">{product.source}</span>
      </div>
      <div className="col-span-2 flex flex-col items-end">
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
  )
})}
```

- [ ] **Step 5: Update ungrouped row body the same way**

Replace the ungrouped row:

```tsx
{ungrouped.map((product, idx) => (
  <div
    key={`ungrouped-${idx}`}
    className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/60 transition-all duration-200 items-center"
  >
    <div className="col-span-1">
      {product.imageUrl ? (
        <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
          <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
        </div>
      ) : (
        <div className="w-12 h-12 bg-slate-800/40 rounded border border-slate-700/50"></div>
      )}
    </div>
    <div className="col-span-5">
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
    <div className="col-span-2 text-slate-300 text-sm">{packLabel(product)}</div>
    <div className="col-span-2">
      <span className="text-slate-300 text-sm font-medium">{product.source}</span>
    </div>
    <div className="col-span-2 flex flex-col items-end">
      <div className="flex items-baseline gap-1">
        <span className="price-display text-lg font-semibold text-slate-100">{product.price}</span>
        <span className="text-slate-400 text-sm">RON</span>
      </div>
      {formatPerUnit(product.pricePerUnit) && (
        <div className="text-slate-500 text-xs mt-0.5">{formatPerUnit(product.pricePerUnit)}</div>
      )}
    </div>
  </div>
))}
```

- [ ] **Step 6: Type-check + tests**

Run: `npx tsc --noEmit && npm test`

Expected: no errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): show pack, organic badge, per-unit price (#23)"
```

---

## Task 8: Smoke test from dev server

- [ ] **Step 1: Start dev server**

```bash
cd ~/personal/unified-search-23-attribute-extraction
lsof -ti:3023 | xargs kill 2>/dev/null
PORT=3023 nohup npm run dev > /tmp/unified-search-23.log 2>&1 &
```

Wait ~5s for boot. Check log:

```bash
tail -20 /tmp/unified-search-23.log
```

Expected: "Ready in" line.

- [ ] **Step 2: Smoke each query**

For each query in `seminte chia`, `pampers 5`, `aptamil 2`, `cerave cleanser`, `huggies 4`:

```bash
curl -s "http://localhost:3023/api/search?q=seminte+chia" | jq '.groups[0:2], .totalProducts'
```

Verify in the JSON:
- `attributes.organic` boolean visible on at least some products.
- `attributes.pack.original` non-empty when name contained `g`/`kg`/`ml`/`l`.
- `pricePerUnit` populated when `pack` or `count` is set.
- `groups[].attributes` matches the products inside.

Note in `.artifacts/23-attribute-extraction/smoke.txt` what each query returned (counts + a sample group).

- [ ] **Step 3: Browser check**

Open `http://localhost:3023` and run each query in the search bar. Confirm visually:
- Pack column shows `200g` / `88 buc` etc.
- `bio` badge appears next to organic products.
- Per-unit price subtext under each price.
- `BEST` and `BEST/UNIT` badges render.

Take 2 screenshots (one for `seminte chia`, one for `pampers 5`) to `.artifacts/23-attribute-extraction/`:

```bash
npx playwright screenshot "http://localhost:3023/?q=seminte+chia" \
  ~/personal/unified-search/.artifacts/23-attribute-extraction/seminte-chia-after.png \
  --wait-for-selector "text=Found"
```

(Repeat for `pampers 5` after typing in the box manually if the page does not parse the query string — the screenshot is for evidence only.)

- [ ] **Step 4: Stop the dev server only when handing off**

Leave it running for user testing per `CLAUDE.local.md` worktree handoff policy.

- [ ] **Step 5: Final commit if any artefacts changed**

If `.artifacts/23-attribute-extraction/smoke.txt` was updated, leave it untracked (it lives outside the repo via symlink). Nothing else should be staged.

---

## Self-Review

- **Spec coverage:** Architecture (Task 6), types (Task 2), Layer A (Task 4), per-unit price (Task 6), Layer B (Task 5), UI (Task 7), tests (Tasks 4 + 5), migration order matches spec section 11. ✓
- **Placeholders:** none.
- **Type consistency:** `ProductAttributes`, `PerUnitPrice`, `groupProducts`, `extractAttributes` names match across tasks. `attributes.original` field on pack used consistently.
- **Risks acknowledged:** per-unit price unit-mismatch handled by `bestPerUnit` returning empty when units differ.
