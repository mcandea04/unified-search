# Unified Product Search

Web app that searches three Romanian e-commerce sites (eMAG, BebeTei, Notino) in parallel and compares prices for matching products.

## Features

- Parallel server-side search across eMAG.ro, BebeTei.ro, and Notino.ro
- Fuzzy product matching to group the same item from different sites
- Best-price highlighting per group
- Relevance scoring to keep results focused on the query
- Mobile + desktop responsive UI

## Tech Stack

- Next.js 16 (App Router) + React 19
- TypeScript, Tailwind CSS v4
- Server-side HTML fetch + JSON-LD parsing (no headless browser)
- Gemini Flash for LLM-based product categorization and brand normalization

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in your Gemini API key:

```bash
cp .env.example .env.local
# edit .env.local and set GOOGLE_API_KEY=<your key>
```

Get a free key at https://aistudio.google.com/apikey (250 req/day, no billing needed).
Restrict the key to "Generative Language API" only.

2. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and search.

> Without `GOOGLE_API_KEY`, the app still works but products won't be grouped by brand/category.

## How it Works

1. `GET /api/search?q=<query>` runs four parallel `fetch` calls to eMAG, BebeTei, Notino, and Trendyol.
2. Each connector extracts products from JSON-LD `@type: Product` blocks, with a regex anchor-scan fallback.
3. A single Gemini Flash batch call enriches all products with brand, kind, pack size, organic flag, and count.
4. Products are scored for relevance and filtered below a minimum score.
5. Remaining products are grouped by `brand + kind + pack + organic` across sources; the lowest price in each group gets a "BEST" badge.

## Project Structure

```
app/
  page.tsx              # Search UI
  layout.tsx
  globals.css
  api/search/route.ts   # GET /api/search?q=...
lib/
  types.ts              # Product, ProductGroup, SearchResult types
  scrapers/
    shared.ts           # fetch + JSON-LD + regex helpers
    emag.ts             # eMAG connector
    bebetei.ts          # BebeTei connector
    notino.ts           # Notino connector
    index.ts            # Parallel orchestrator
  matching/
    relevance.ts        # 0-100 scoring + sort
    llm-attributes.ts   # Gemini Flash batch enrichment
    grouping.ts         # Brand/kind/pack bucket grouping
```

## API

`GET /api/search?q=<query>` returns:

```json
{
  "query": "huggies 5",
  "groups": [
    {
      "id": "group-0",
      "matchedName": "Scutece Huggies...",
      "products": [{ "source": "emag", "price": 134.99, "...": "..." }],
      "bestPrice": 134.99,
      "bestPriceSource": "emag",
      "matchConfidence": "high"
    }
  ],
  "ungrouped": [],
  "totalProducts": 45,
  "countBySource": { "emag": 20, "bebetei": 15, "notino": 10 },
  "timestamp": 1706810000000
}
```

## Deploy on Vercel

This app runs on Vercel's Node.js runtime. The `/api/search` route has `maxDuration = 30` for Pro accounts; Hobby caps at 10s.

1. Push this repo to GitHub.
2. Import the repo in the Vercel dashboard (framework: Next.js, no env vars needed).
3. Deploy.

Or via CLI:

```bash
npx vercel --prod
```

## Limitations

- Sites can change markup; JSON-LD is the happy path, regex fallback covers some cases but not all.
- Some sites may rate-limit or block scraping. Connectors degrade to `{ success: false, error }` so the UI still renders partial results.
- No caching layer yet - every search hits all three sites.
- Matching is name-based fuzzy only; no EAN/GTIN lookup.

## Legal

For educational/personal use. Scraping may violate site ToS. Respect robots.txt, rate-limit aggressively, and prefer official APIs when available.

## License

MIT
