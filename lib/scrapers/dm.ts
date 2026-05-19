import type { Product, ScraperResponse } from '../types'
import { normalizePrice } from './shared'
import { getCachedProducts, setCachedProducts } from './cache'

const SOURCE = 'dm' as const
const BASE_URL = 'https://www.dm.ro'
const SEARCH_API = 'https://product-search.services.dmtech.com/ro/search/crawl'
const CACHE_TTL_MS = 60 * 60 * 1000
const MAX_RESULTS = 20

const FETCH_HEADERS: Record<string, string> = {
  accept: 'application/json',
  'accept-language': 'ro-RO,ro;q=0.9,en;q=0.8',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  origin: BASE_URL,
  referer: `${BASE_URL}/`,
}

interface DmImage {
  alt?: string
  tileSrc?: string
}

interface DmPrice {
  current?: { value?: string }
}

interface DmTileData {
  brand?: { name?: string }
  images?: DmImage[]
  price?: { price?: DmPrice }
  self?: string
  title?: { tileHeadline?: string; tileHeadlineLong?: string }
  trackingData?: {
    brand?: string
    currency?: string
    price?: number
  }
}

interface DmProduct {
  gtin?: number | string
  dan?: number | string
  brandName?: string
  title?: string
  tileData?: DmTileData
}

interface DmSearchResponse {
  products?: DmProduct[]
}

export async function scrapeDm(query: string): Promise<ScraperResponse> {
  const cacheKey = `dm:${query.trim().toLowerCase()}`
  const cached = getCachedProducts(cacheKey)
  if (cached) {
    console.log(`[dm] cache hit for "${query}" (${cached.length} products)`)
    return { source: SOURCE, products: cached, success: true }
  }

  const url = `${SEARCH_API}?query=${encodeURIComponent(query)}`

  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' })
    if (!res.ok) {
      console.warn(`[dm] HTTP ${res.status}`)
      return { source: SOURCE, products: [], success: false, error: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as DmSearchResponse
    const products = (data.products ?? [])
      .map((p, idx) => toProduct(p, idx))
      .filter(isValidProduct)
      .slice(0, MAX_RESULTS)

    console.log(`[dm] Parsed ${products.length} products`)
    if (products.length > 0) {
      setCachedProducts(cacheKey, products, CACHE_TTL_MS)
    }

    return { source: SOURCE, products, success: true }
  } catch (error) {
    console.error('[dm] scraper error:', error)
    return {
      source: SOURCE,
      products: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function toProduct(raw: DmProduct, idx: number): Product {
  const tile = raw.tileData ?? {}
  const trackingPrice = tile.trackingData?.price
  const displayPrice = tile.price?.price?.current?.value
  const price =
    typeof trackingPrice === 'number' && trackingPrice > 0
      ? trackingPrice
      : normalizePrice(displayPrice) ?? 0

  const brand = raw.brandName ?? tile.brand?.name ?? tile.trackingData?.brand
  const title = raw.title ?? tile.title?.tileHeadline ?? tile.title?.tileHeadlineLong ?? ''
  const path = tile.self ?? ''
  const productUrl = path ? `${BASE_URL}${path}` : ''
  const imageUrl = tile.images?.[0]?.tileSrc ?? ''
  const currency = tile.trackingData?.currency ?? 'RON'
  const dan = raw.dan ?? raw.gtin ?? idx

  return {
    id: `${SOURCE}-${dan}`,
    name: title,
    price,
    currency,
    imageUrl,
    productUrl,
    source: SOURCE,
    brand,
    attributes: { organic: false },
  }
}

function isValidProduct(p: Product): boolean {
  return Boolean(p.name) && p.price > 0 && Boolean(p.productUrl)
}
