import type { Product, ScraperResponse } from '../types'
import { getCachedProducts, setCachedProducts } from './cache'

const SOURCE = 'realfoods' as const
const BASE_URL = 'https://realfoods.ro'
const SEARCH_API = 'https://realfoods.api.wavegrocery.com/api/v3.1/products/search'
const CACHE_TTL_MS = 60 * 60 * 1000
const MAX_RESULTS = 20

const FETCH_HEADERS: Record<string, string> = {
  accept: 'application/json',
  'accept-language': 'ro-RO,ro;q=0.9,en;q=0.8',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'x-tenant': 'realfoods',
  origin: BASE_URL,
  referer: `${BASE_URL}/`,
}

interface RealfoodsImageVariants {
  variants?: { '1x'?: string }
}

interface RealfoodsImage {
  baseURL?: string
  imageVariants?: RealfoodsImageVariants
}

interface RealfoodsProduct {
  _id?: string
  sku?: string
  slug?: string
  name?: string
  brand?: string
  finalPrice?: number
  primaryImage?: RealfoodsImage
}

interface RealfoodsSearchResponse {
  data?: { products?: RealfoodsProduct[] }
}

export async function scrapeRealfoods(query: string): Promise<ScraperResponse> {
  const cacheKey = `realfoods:${query.trim().toLowerCase()}`
  const cached = getCachedProducts(cacheKey)
  if (cached) {
    console.log(`[realfoods] cache hit for "${query}" (${cached.length} products)`)
    return { source: SOURCE, products: cached, success: true }
  }

  const url = `${SEARCH_API}?term=${encodeURIComponent(query)}&pageNumber=0&pageSize=20`

  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' })
    if (!res.ok) {
      console.warn(`[realfoods] HTTP ${res.status}`)
      return { source: SOURCE, products: [], success: false, error: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as RealfoodsSearchResponse
    const products = (data.data?.products ?? [])
      .map((p, idx) => toProduct(p, idx))
      .filter(isValidProduct)
      .slice(0, MAX_RESULTS)

    console.log(`[realfoods] Parsed ${products.length} products`)
    if (products.length > 0) {
      setCachedProducts(cacheKey, products, CACHE_TTL_MS)
    }

    return { source: SOURCE, products, success: true }
  } catch (error) {
    console.error('[realfoods] scraper error:', error)
    return {
      source: SOURCE,
      products: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function toProduct(raw: RealfoodsProduct, idx: number): Product {
  const price = typeof raw.finalPrice === 'number' ? raw.finalPrice / 100 : 0
  const slug = raw.slug ?? ''
  const productUrl = slug ? `${BASE_URL}/products/${slug}/` : ''
  const img = raw.primaryImage
  const variant1x = img?.imageVariants?.variants?.['1x']
  const imageUrl = img?.baseURL && variant1x ? `${img.baseURL}/${variant1x}` : ''
  const id = raw._id ?? raw.sku ?? String(idx)

  return {
    id: `${SOURCE}-${id}`,
    name: raw.name ?? '',
    price,
    currency: 'RON',
    imageUrl,
    productUrl,
    source: SOURCE,
    brand: raw.brand,
    attributes: { organic: false },
  }
}

function isValidProduct(p: Product): boolean {
  return Boolean(p.name) && p.price > 0 && Boolean(p.productUrl)
}
