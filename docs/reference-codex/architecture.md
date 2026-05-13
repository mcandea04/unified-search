# Architecture plan

## Goals
- Search the same product across multiple sites and compare prices.
- Handle different names, variants, and quality grades.
- Support desktop + mobile and be accessible via a public URL.

## High-level system
1) Web UI: search, compare, and share results.
2) API: normalizes and merges results across sources.
3) Connectors: one per site, responsible for fetch + parse.
4) Matching: group listings that represent the same product.
5) Storage + cache: reduce load, speed up repeat queries.

## Data flow
User query -> API -> per-site connectors -> normalized listings -> matching -> grouped results -> UI.

## Data model (normalized listing)
- source: "emag" | "notino" | "bebetei"
- name
- brand
- variant: size/weight/pack/quality
- identifiers: ean/gtin/mpn/sku
- price: amount + currency
- url
- image
- availability
- scraped_at

## Matching strategy
1) Exact: EAN/GTIN/MPN/SKU match.
2) Rules: brand + model + parsed size/pack.
3) Fuzzy: text similarity or embeddings for ambiguous cases.
4) Confidence score + manual overrides.

## Caching
- Cache search results by query + site for 15-60 min.
- Cache product detail pages by URL for 6-24 hours.
- Keep last-known prices for history and deltas.

## Rate limiting
- Token bucket per site.
- Backoff on 429/403.
- Respect robots/ToS; prefer affiliate or official APIs if available.

## Deployment
- API: small container + cron for refresh jobs.
- Web: CDN-backed static hosting.
- Option: single host with reverse proxy.
