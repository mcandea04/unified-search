import type { Product, ScraperResponse } from '../types'
import {
  extractJsonLd,
  extractProductsByRegex,
  extractProductsFromJsonLd,
  fetchHtml,
  looksLikeCloudflareChallenge,
  normalizePrice,
  type JsonLdProduct,
} from './shared'

const SOURCE = 'notino' as const
const BASE_URL = 'https://www.notino.ro'

export async function scrapeNotino(query: string): Promise<ScraperResponse> {
  const url = `${BASE_URL}/search.asp?exps=${encodeURIComponent(query)}`

  try {
    const res = await fetchHtml(url, {
      headers: {
        referer: `${BASE_URL}/`,
      },
    })
    const html = await res.text()

    if (looksLikeCloudflareChallenge(html)) {
      console.warn(
        `[Notino] Cloudflare challenge returned (status=${res.status}, size=${html.length})`
      )
      return {
        source: SOURCE,
        products: [],
        success: false,
        error: 'cloudflare-challenge',
      }
    }

    if (!res.ok) {
      console.warn(`[Notino] HTTP ${res.status} (size=${html.length})`)
      return { source: SOURCE, products: [], success: false, error: `HTTP ${res.status}` }
    }

    const products = parseResults(html)
    console.log(`[Notino] Parsed ${products.length} products`)

    return { source: SOURCE, products: products.slice(0, 20), success: true }
  } catch (error) {
    console.error('Notino scraper error:', error)
    return {
      source: SOURCE,
      products: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function parseResults(html: string): Product[] {
  const jsonLdProducts = extractProductsFromJsonLd(extractJsonLd(html))
  const fromJsonLd = jsonLdProducts
    .map((p, idx) => jsonLdToProduct(p, idx))
    .filter(isValidProduct)

  if (fromJsonLd.length) return fromJsonLd

  const regexItems = extractProductsByRegex(html, {
    baseUrl: BASE_URL,
    urlPatterns: [
      /https?:\/\/www\.notino\.ro\/[a-z0-9-]+\/[a-z0-9-]+\/?/i,
      /^\/[^/]+\/[^/]+\/?/i,
    ],
    currency: 'RON',
  }).filter((item) => !item.url.includes('search.asp'))

  return regexItems
    .map((item, idx) => ({
      id: `${SOURCE}-r${idx}-${Date.now()}`,
      name: item.name,
      price: item.price ?? 0,
      currency: item.currency ?? 'RON',
      imageUrl: item.image ?? '',
      productUrl: item.url,
      source: SOURCE,
    }))
    .filter(isValidProduct)
}

function jsonLdToProduct(product: JsonLdProduct, idx: number): Product {
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers
  const image = Array.isArray(product.image) ? product.image[0] : product.image
  const brandName =
    typeof product.brand === 'string' ? product.brand : product.brand?.name

  return {
    id: `${SOURCE}-${idx}-${Date.now()}`,
    name: product.name ?? '',
    price: normalizePrice(offer?.price) ?? 0,
    currency: offer?.priceCurrency ?? 'RON',
    imageUrl: image ?? '',
    productUrl: product.url ?? '',
    source: SOURCE,
    brand: brandName,
  }
}

function isValidProduct(p: Product): boolean {
  return Boolean(p.name) && p.price > 0 && Boolean(p.productUrl)
}
