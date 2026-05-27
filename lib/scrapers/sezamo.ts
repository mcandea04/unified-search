import type { Product, ScraperResponse } from '../types'
import { getCachedProducts, setCachedProducts } from './cache'

const SOURCE = 'sezamo' as const
const BASE_URL = 'https://www.sezamo.ro'
const CDN_URL = 'https://www.sezamo.ro'
const SEARCH_API = `${BASE_URL}/services/frontend-service/search-metadata`
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

interface SezamoPrice {
  full?: number
  currency?: string
}

interface SezamoSale {
  price?: SezamoPrice
}

interface SezamoCategory {
  nameId?: string
}

interface SezamoProduct {
  productId?: number | string
  productName?: string
  brand?: string
  imgPath?: string
  baseLink?: string
  categories?: SezamoCategory[]
  price?: SezamoPrice
  sales?: SezamoSale[]
}

interface SezamoSearchResponse {
  data?: { productList?: SezamoProduct[] }
}

export async function scrapeSezamo(query: string): Promise<ScraperResponse> {
  const cacheKey = `sezamo:${query.trim().toLowerCase()}`
  const cached = getCachedProducts(cacheKey)
  if (cached) {
    console.log(`[sezamo] cache hit for "${query}" (${cached.length} products)`)
    return { source: SOURCE, products: cached, success: true }
  }

  const url = `${SEARCH_API}?search=${encodeURIComponent(query)}&companyId=5500&offset=0&limit=20`

  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' })
    if (!res.ok) {
      console.warn(`[sezamo] HTTP ${res.status}`)
      return { source: SOURCE, products: [], success: false, error: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as SezamoSearchResponse
    const products = (data.data?.productList ?? [])
      .map((p, idx) => toProduct(p, idx))
      .filter(isValidProduct)
      .slice(0, MAX_RESULTS)

    console.log(`[sezamo] Parsed ${products.length} products`)
    if (products.length > 0) {
      setCachedProducts(cacheKey, products, CACHE_TTL_MS)
    }

    return { source: SOURCE, products, success: true }
  } catch (error) {
    console.error('[sezamo] scraper error:', error)
    return {
      source: SOURCE,
      products: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function toProduct(raw: SezamoProduct, idx: number): Product {
  const salePrice = raw.sales?.[0]?.price?.full
  const regularPrice = raw.price?.full ?? 0
  const price = typeof salePrice === 'number' && salePrice > 0 ? salePrice : regularPrice

  const categorySlug = raw.categories?.[0]?.nameId ?? ''
  const baseLink = raw.baseLink ?? ''
  const productUrl =
    categorySlug && baseLink ? `${BASE_URL}/${categorySlug}/${baseLink}` : ''

  const imageUrl = raw.imgPath ? `${CDN_URL}${raw.imgPath}` : ''
  const id = raw.productId ?? idx

  return {
    id: `${SOURCE}-${id}`,
    name: raw.productName ?? '',
    price,
    currency: raw.price?.currency ?? 'RON',
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
