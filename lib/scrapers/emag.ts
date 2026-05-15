import type { Product, ScraperResponse } from '../types'
import {
  extractJsonLd,
  extractProductsFromJsonLd,
  normalizePrice,
  type JsonLdProduct,
} from './shared'
import { getCachedProducts, setCachedProducts } from './cache'

const SOURCE = 'emag' as const
const BASE_URL = 'https://www.emag.ro'
const CACHE_TTL_MS = 60 * 60 * 1000

const FETCH_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'accept-language': 'ro-RO,ro;q=0.9,en;q=0.8',
}

export async function scrapeEmag(query: string): Promise<ScraperResponse> {
  const cacheKey = `emag:${query.trim().toLowerCase()}`
  const cached = getCachedProducts(cacheKey)
  if (cached) {
    console.log(`[eMAG] cache hit for "${query}" (${cached.length} products)`)
    return { source: SOURCE, products: cached, success: true }
  }

  const url = `${BASE_URL}/search/${encodeURIComponent(query)}?ref=effective_search`

  try {
    const res = await fetch(url, { headers: FETCH_HEADERS })
    if (!res.ok) {
      return { source: SOURCE, products: [], success: false, error: `HTTP ${res.status}` }
    }

    const html = await res.text()
    if (looksLikeAntiBot(html)) {
      console.log(`[eMAG] soft-block detected for "${query}" (html len=${html.length})`)
      return { source: SOURCE, products: [], success: false, error: 'blocked-by-emag' }
    }

    const products = parseResults(html).slice(0, 20)
    console.log(`[eMAG] Parsed ${products.length} products`)
    if (products.length > 0) {
      setCachedProducts(cacheKey, products, CACHE_TTL_MS)
    }

    return { source: SOURCE, products, success: true }
  } catch (error) {
    console.error('eMAG scraper error:', error)
    return {
      source: SOURCE,
      products: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function looksLikeAntiBot(html: string): boolean {
  if (!html) return true
  const hasCards = /data-zone="card"/.test(html) || /data-product-id="\d+"/.test(html)
  if (hasCards) return false
  const head = html.slice(0, 4000).toLowerCase()
  return (
    head.includes('captcha') ||
    head.includes('access denied') ||
    head.includes('forbidden') ||
    head.includes('cf-browser-verification') ||
    html.length < 5000
  )
}

function parseResults(html: string): Product[] {
  const jsonLdProducts = extractProductsFromJsonLd(extractJsonLd(html))
  const fromJsonLd = jsonLdProducts
    .map((p, idx) => jsonLdToProduct(p, idx))
    .filter(isValidProduct)

  if (fromJsonLd.length) return fromJsonLd

  return parseCardLayout(html)
}

function parseCardLayout(html: string): Product[] {
  const products = new Map<string, Product>()
  const segments = html.split('data-zone="card"').slice(1)
  let idx = 0

  for (const seg of segments) {
    const card = seg.slice(0, 12000)
    const dataUrl = card.match(/data-url="([^"]+)"/)?.[1]
    if (!dataUrl) continue

    const pnkMatch = dataUrl.match(/\/pd\/([A-Z0-9]+)\//)
    if (!pnkMatch) continue
    const pnk = pnkMatch[1]
    if (products.has(pnk)) continue

    const name = extractCardName(card)
    if (!name || name.length < 5) continue

    const priceMatch = card.match(/product-new-price[^>]*>([\s\S]{0,200})/i)
    if (!priceMatch) continue

    const priceText = priceMatch[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&#44;/g, ',')
      .replace(/&#46;/g, '.')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const priceNumMatch = priceText.match(/(\d+[,.]?\d*)\s*(Lei|RON)/i)
    if (!priceNumMatch) continue

    const price = normalizePrice(priceNumMatch[1]) ?? 0
    if (price <= 0) continue

    const imageUrl = findProductImage(card)
    const url = dataUrl.startsWith('http') ? dataUrl : `${BASE_URL}${dataUrl}`

    products.set(pnk, {
      id: `${SOURCE}-${idx++}-${Date.now()}`,
      name,
      price,
      currency: 'RON',
      imageUrl,
      productUrl: url,
      source: SOURCE,
      attributes: { organic: false },
    })
  }

  return Array.from(products.values())
}

function extractCardName(card: string): string {
  const fromDataProduct = parseDataProductName(card)
  if (fromDataProduct) return fromDataProduct

  const titleAnchor = card.match(
    /class="[^"]*card-v2-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
  )?.[1]
  if (titleAnchor) return cleanAnchorText(titleAnchor)

  const ariaLabel = card.match(/aria-label="([^"]+)"[^>]*class="[^"]*card-v2-thumb/i)?.[1]
  if (ariaLabel) return cleanAnchorText(ariaLabel)

  return ''
}

function parseDataProductName(card: string): string {
  const raw = card.match(/data-product="([^"]+)"/)?.[1]
  if (!raw) return ''
  const decoded = decodeHtmlAttribute(raw)
  try {
    const parsed = JSON.parse(decoded) as { product_name?: unknown }
    if (typeof parsed.product_name === 'string') {
      return parsed.product_name.replace(/\s+/g, ' ').trim()
    }
  } catch {
    // Fall through to empty so the title/aria fallbacks run
  }
  return ''
}

function decodeHtmlAttribute(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

const PRODUCT_IMG_REGEX =
  /(?:src|data-src)=["'](https:\/\/s\d+emagst\.akamaized\.net\/products\/[^"']+)["']/i

function findProductImage(card: string): string {
  const match = card.match(PRODUCT_IMG_REGEX)
  if (!match) return ''
  return match[1].replace(/&amp;/g, '&')
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
    attributes: { organic: false },
  }
}

function cleanAnchorText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function isValidProduct(p: Product): boolean {
  return Boolean(p.name) && p.price > 0 && Boolean(p.productUrl)
}
