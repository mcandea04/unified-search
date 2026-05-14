import type { Product, ScraperResponse } from '../types'
import { fetchHtml, normalizePrice } from './shared'

const SOURCE = 'trendyol' as const
const BASE_URL = 'https://www.trendyol.com'

interface TrendyolPrice {
  current?: number
  discountedPrice?: number
  originalPrice?: number
  currency?: string
}

interface TrendyolProduct {
  id?: number | string
  name?: string
  brand?: string
  url?: string
  image?: string
  images?: string[]
  price?: TrendyolPrice
}

export async function scrapeTrendyol(query: string): Promise<ScraperResponse> {
  const url = `${BASE_URL}/ro/sr?q=${encodeURIComponent(query)}`

  try {
    const res = await fetchHtml(url, {
      headers: {
        referer: `${BASE_URL}/ro/`,
        'accept-language': 'ro-RO,ro;q=0.9,en;q=0.7',
      },
    })
    if (!res.ok) {
      return { source: SOURCE, products: [], success: false, error: `HTTP ${res.status}` }
    }

    const html = await res.text()
    const products = parseResults(html)
    console.log(`[Trendyol] Parsed ${products.length} products`)

    return { source: SOURCE, products: products.slice(0, 20), success: true }
  } catch (error) {
    console.error('Trendyol scraper error:', error)
    return {
      source: SOURCE,
      products: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function parseResults(html: string): Product[] {
  const raw = extractProductsArray(html)
  if (!raw) return []

  return raw
    .map((p, idx) => toProduct(p, idx))
    .filter(isValidProduct)
}

function extractProductsArray(html: string): TrendyolProduct[] | null {
  const marker = '"products":['
  const start = html.indexOf(marker)
  if (start === -1) return null

  const arrayStart = start + marker.length - 1
  const end = findMatchingBracket(html, arrayStart)
  if (end === -1) return null

  const slice = html.slice(arrayStart, end + 1)
  try {
    const parsed = JSON.parse(slice)
    return Array.isArray(parsed) ? (parsed as TrendyolProduct[]) : null
  } catch {
    return null
  }
}

function findMatchingBracket(html: string, openIndex: number): number {
  let depth = 0
  let inString = false
  let escape = false

  for (let i = openIndex; i < html.length; i++) {
    const ch = html[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function toProduct(p: TrendyolProduct, idx: number): Product {
  const sellingPrice =
    normalizePrice(p.price?.discountedPrice) ??
    normalizePrice(p.price?.current) ??
    normalizePrice(p.price?.originalPrice) ??
    0

  const relativeUrl = p.url ?? ''
  const productUrl = relativeUrl.startsWith('http')
    ? relativeUrl
    : `${BASE_URL}${relativeUrl}`

  const imageUrl = p.images?.[0] ?? p.image ?? ''
  const name = [p.brand, p.name].filter(Boolean).join(' ').trim()

  return {
    id: `${SOURCE}-${p.id ?? idx}-${Date.now()}`,
    name,
    price: sellingPrice,
    currency: 'RON',
    imageUrl,
    productUrl,
    source: SOURCE,
    brand: p.brand,
  }
}

function isValidProduct(p: Product): boolean {
  return Boolean(p.name) && p.price > 0 && Boolean(p.productUrl)
}
