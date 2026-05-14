# Attribute Extraction + Generic Grouping

Issue: [mcandea04/unified-search#23](https://github.com/mcandea04/unified-search/issues/23)
Date: 2026-05-14

## Problem

`lib/matching/fuzzy-match.ts` is overfit to diapers and infant formula. The composite bucket key (`brand | productLine | sizeStage`) and the supporting heuristics (hardcoded brand list, diaper/formula stopwords, integer-only size extraction) work for queries like `pampers 5` but break for everything else.

Concrete failure: a search for `seminte chia` returns rows where the user cannot tell organic from non-organic, cannot compare pack sizes, and cannot reason about price per unit. Current code never extracts grams or millilitres, has no concept of organic, and the brand-detection fallback (first token of the name) produces inconsistent buckets across sources.

## Goal

Make categorization generic across verticals. Replace the single tangled grouping module with two pure layers:

1. A deterministic attribute extractor that turns a product name into a structured `ProductAttributes` object.
2. A generic grouping function that uses those attributes plus the search query as a kind anchor.

Display the extracted attributes (organic flag, pack size, per-unit price) in the UI on every row, grouped or not.

## Non-goals

- LLM-based extraction. All parsing stays regex + token rules.
- Backwards compatibility shims. The existing `KNOWN_BRANDS` list and the diaper/formula vocabulary lists are deleted.
- Feature flags. Single replacement PR.
- Cross-pack grouping. Two products with different pack sizes stay in separate groups; per-unit price gives the user a way to compare.
- Brand normalization across stores (e.g. mapping `Driedfruits` and `Dried Fruits Co.` to one canonical name).

## Architecture

```
lib/matching/
  attributes.ts     # Layer A: Product -> ProductAttributes (pure, deterministic)
  grouping.ts       # Layer B: (Product[], query) -> { groups, ungrouped }
  relevance.ts      # unchanged
```

`fuzzy-match.ts` is deleted.

`app/api/search/route.ts` runs the pipeline:

1. Scrape all sources in parallel (unchanged).
2. For each product, call `extractAttributes(product)` and attach the result as `product.attributes`.
3. Compute per-unit price for each product where `pack` or `count` is known. Done in `route.ts`, not in the extractor, since price lives on `Product` and the extractor takes only the name + JSON-LD brand.
4. Filter and sort by relevance (unchanged).
5. Call `groupProducts(relevantProducts, query)`.
6. Sort groups by best relevance (unchanged).

## Type changes (`lib/types.ts`)

```ts
export interface ProductAttributes {
  brand?: string
  organic: boolean
  pack?: { value: number; unit: 'g' | 'ml'; original: string }
  count?: number
  variant?: string
  diaperSize?: string
}

export interface PerUnitPrice {
  value: number
  unit: 'g' | 'ml' | 'piece'
}

export interface Product {
  // existing fields unchanged
  attributes: ProductAttributes
  pricePerUnit?: PerUnitPrice
}

export interface ProductGroup {
  // existing fields unchanged
  attributes: ProductAttributes
  bestPricePerUnit?: PerUnitPrice
  bestPricePerUnitSource?: SourceSite
}
```

`attributes` on `ProductGroup` holds the values shared by every product in the group (brand, pack, organic, diaperSize). Variant may differ across products in the same group when the variant token list is empty for some.

## Layer A: attribute extraction (`attributes.ts`)

Single export:

```ts
export function extractAttributes(product: Product): ProductAttributes
```

The function operates on a normalized form of `product.name`:

```
lowercase -> NFD normalize -> strip diacritics -> collapse whitespace
```

It then runs ordered passes. Each pass that matches consumes its tokens from the working string so later passes do not re-extract the same characters.

### Pass order

1. **Pack weight** — regex `/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i`.
   Decimal comma is normalized to `.`. `kg` and `l` multiply value by 1000. The `original` field stores the matched span (`"500g"`, `"1.5 kg"`) for display.
2. **Pack count** — regex `/(\d{1,4})\s*(buc|bucati|bucati|capsule|servetele|tablete|pieces|pcs|pads)\b/i`. Integer.
3. **Organic flag** — regex `/\b(bio|eco|organic|raw|natural)\b/i`. Boolean.
4. **Diaper size** — port the existing extraction logic from `fuzzy-match.ts` (digits 1-8 with context tokens `nr`/`marime`/`size`/`etapa`, plus the `5+` pattern). The age-range guard (`11-16 kg`, `4-8 luni`) stays so age ranges do not get misread as size.
5. **Brand** — `product.brand` from JSON-LD when present and non-empty after normalization. Otherwise first token of the name after stripping the minimal stopword list, numbers, and any token already consumed by passes 1-4.
6. **Variant** — remaining non-stopword tokens, capped at 3. Sorted alphabetically before joining so two scrapers with the same variant words in different order produce the same string.

### Stopwords

Minimal list, language-agnostic enough to keep:

```
de, pentru, cu, din, la, si, &, -
```

The diaper/formula stopword list (`scutece`, `chilotel`, `lapte`, `praf`, `sugari`, `nastere`, `luni`, ...) is deleted.

### Returned shape

`organic` always returns `true` or `false`. `brand`, `pack`, `count`, `variant`, `diaperSize` are optional and only present when extraction matched.

## Per-unit price computation (`route.ts`)

After `extractAttributes` runs, compute:

- If `pack` is present: `pricePerUnit = { value: price / (pack.value / 100), unit: pack.unit }`. Stored as RON per 100g or per 100ml.
- Else if `count` is present: `pricePerUnit = { value: price / count, unit: 'piece' }`.
- Else: `pricePerUnit` stays undefined.

Per-group `bestPricePerUnit` is the minimum across the group, recorded with the source for display.

## Layer B: grouping (`grouping.ts`)

Single export:

```ts
export function groupProducts(
  products: Array<Product & { attributes: ProductAttributes }>,
  query: string,
): { groups: ProductGroup[]; ungrouped: Product[] }
```

### Bucket key

Pipe-joined string built per product:

```
brand | kind | packSignature | diaperSize | organic | variant
```

- `brand`: `attributes.brand` or `unknown`.
- `kind`: query normalized (lowercase, diacritics stripped, stopwords removed, tokens sorted, joined with space). All products in one search share the same kind, so kind never separates products from one search; it is included for completeness and to keep keys self-describing in logs.
- `packSignature`: when `pack` present, `${value}${unit}` (e.g. `500g`). Else when `count` present, `${count}pcs`. Else empty string. Empty pack signatures only group with other empty pack signatures.
- `diaperSize`: `attributes.diaperSize` or empty string.
- `organic`: literal `bio` when `attributes.organic === true`, else `nonbio`.
- `variant`: `attributes.variant` or empty string.

### Bucket to group rule

A bucket becomes a group when it contains products from at least 2 distinct sources. Otherwise its products go to `ungrouped`. Same threshold as today.

### Match confidence

Same rule as today, just expressed against the new key:

- 3+ sources: `high`.
- 2 sources + non-empty `diaperSize`: `high`.
- 2 sources, no diaper size: `medium`.
- 1 source: `low` (only reachable for ungrouped, but included for type completeness).

### `matchedName`

Unchanged: shortest non-empty product name in the bucket.

### Group attribute aggregation

Group `attributes` are derived from the bucket key components: brand, organic flag, pack, diaperSize are identical for every product in the group by construction. Variant is the bucket variant string. The aggregated object is constructed once per group.

## UI changes (`app/page.tsx`)

Row layout for grouped and ungrouped products redistributes the 12-column grid:

| Cols | Content |
| ---: | --- |
| 1 | Image |
| 5 | Product name + organic badge |
| 2 | Pack (weight or count) |
| 2 | Merchant |
| 2 | Price (top) + per-unit price (subtext) + BEST / BEST/UNIT badges |

Mobile layout stacks pack and per-unit subtext under the name.

Group header surfaces `attributes.brand`, `attributes.pack.original`, and the organic badge when applicable, so the user sees the shared characterization once instead of repeated on every row.

`BEST` stays on the minimum-price row. A second `BEST/UNIT` pill is added on the minimum per-unit-price row when that is a different row.

## Tests

Located at `lib/matching/__tests__/`. Pure functions, no mocks, no fixtures beyond inline product literals.

### `attributes.test.ts`

Table-driven cases:

- `Seminte de chia bio Driedfruits 200g` -> `{ brand: 'driedfruits', organic: true, pack: { value: 200, unit: 'g', original: '200g' } }`.
- `Pampers Premium Care Nr.5 11-16 kg 88 buc` -> `{ brand: 'pampers', diaperSize: '5', count: 88 }` and crucially **no** `pack` (the `11-16 kg` is an age-range, not a pack weight).
- `Aptamil 2 800g` -> `{ brand: 'aptamil', diaperSize: '2', pack: { value: 800, unit: 'g', original: '800g' } }`.
- `Shampoo Loreal 250ml bio` -> `{ brand: 'loreal', organic: true, pack: { value: 250, unit: 'ml', original: '250ml' } }`.
- Edge: `Lapte ecologic 1,5 l` parses comma-decimal correctly: `pack.value === 1500`, `pack.unit === 'ml'`.
- Edge: `0.5 kg` -> 500g.
- Edge: missing JSON-LD brand falls back to first token after numbers and stopwords.
- Edge: name with only stopwords yields `attributes` with `organic: false` and everything else undefined.

### `grouping.test.ts`

Table-driven cases:

- Three sources return `Seminte chia bio 200g` with consistent brand -> 1 group, organic and conventional kept separate.
- `Pampers Active Baby 4 50 buc` and `Pampers Active Baby 4 100 buc` from the same source -> 2 separate buckets (different `packSignature`); when each appears on 2 sources, 2 groups are produced.
- Same brand, same kind, mixed organic and non-organic -> 2 groups.
- A product with no extractable pack and a product from another source with `200g` do not group together (empty pack signature does not match `200g`).
- A single-source product remains in `ungrouped`.

## Migration

One PR, no fallback path:

1. Add `lib/matching/attributes.ts` and unit tests.
2. Add `lib/matching/grouping.ts` and unit tests.
3. Delete `lib/matching/fuzzy-match.ts`.
4. Extend `lib/types.ts` with `ProductAttributes`, `PerUnitPrice`, and the new fields on `Product` / `ProductGroup`.
5. Update `app/api/search/route.ts` to enrich products with attributes, compute per-unit prices, and call `groupProducts(products, query)`.
6. Update `app/page.tsx` for the new row layout, badges, pack column, and per-unit price subtext.
7. Manual smoke from the dev server: `seminte chia`, `pampers 5`, `aptamil 2`, `cerave cleanser`, `huggies 4`. Each query should produce sensible groups, an organic badge where applicable, a pack value, and a per-unit price.

## Risk

- Per-unit price math is meaningful only when the unit type matches across the group. The implementation only sets `bestPricePerUnit` when at least 2 products in the group share the same per-unit unit (`g`, `ml`, or `piece`).
- Variant aggregation can over-split: the same product with `lemon` mentioned once and not the other time will land in two buckets. Acceptable for a first pass; the cap-at-3-sorted-tokens rule keeps this contained.
- Stopword list is intentionally minimal. Romanian/English noise words may leak into brand or variant slots. Test cases exercise the worst examples seen in the existing scrape output.
