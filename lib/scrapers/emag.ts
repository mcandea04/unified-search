import type { Product, ScraperResponse } from '../types'
import {
  extractJsonLd,
  extractProductsFromJsonLd,
  fetchHtml,
  normalizePrice,
  type JsonLdProduct,
} from './shared'

const SOURCE = 'emag' as const
const BASE_URL = 'https://www.emag.ro'

export async function scrapeEmag(query: string): Promise<ScraperResponse> {
  const url = `${BASE_URL}/search/${encodeURIComponent(query)}?ref=effective_search`

  try {
    const res = await fetchHtml(url)
    if (!res.ok) {
      return { source: SOURCE, products: [], success: false, error: `HTTP ${res.status}` }
    }

    const html = await res.text()
    const products = parseResults(html)
    console.log(`[eMAG] Parsed ${products.length} products`)

    return { source: SOURCE, products: products.slice(0, 20), success: true }
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
  const cardRegex = /data-product-id="\d+"([^>]*?)>/gi
  const cardStarts: number[] = []
  for (const m of html.matchAll(/data-product-id="\d+"/gi)) {
    if (m.index !== undefined) cardStarts.push(m.index)
  }
  let match: RegExpExecArray | null
  let idx = 0

  while ((match = cardRegex.exec(html))) {
    const attrs = match[1]
    const nameMatch = attrs.match(/data-name="([^"]+)"/)
    const urlMatch = attrs.match(/data-url="([^"]+\/pd\/([A-Z0-9]+)\/[^"]*)"/)
    if (!nameMatch || !urlMatch) continue

    const pnk = urlMatch[2]
    if (products.has(pnk)) continue

    const name = decodeHtmlEntities(nameMatch[1])
    const rawUrl = urlMatch[1]
    const url = rawUrl.startsWith('http') ? rawUrl : `${BASE_URL}${rawUrl}`

    const cardEnd = cardStarts.find((s) => s > match!.index) ?? html.length
    const priceWindow = html.slice(match.index, cardEnd)
    const priceMatch = priceWindow.match(/product-new-price[^>]*>([\s\S]{0,200})/i)
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

    const imageUrl = findCardImage(html, match.index, priceWindow)

    products.set(pnk, {
      id: `${SOURCE}-${idx++}-${Date.now()}`,
      name,
      price,
      currency: 'RON',
      imageUrl,
      productUrl: url,
      source: SOURCE,
    })
  }

  return Array.from(products.values())
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
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

const IMG_URL_REGEX = /<img[^>]+(?:data-src|src)=["']([^"']+)["']/i
const IMG_LOOKBACK = 3000

function findCardImage(html: string, anchorIndex: number, forwardWindow: string): string {
  const forward = forwardWindow.match(IMG_URL_REGEX)
  if (forward) return forward[1]

  const backStart = Math.max(0, anchorIndex - IMG_LOOKBACK)
  const backWindow = html.slice(backStart, anchorIndex)
  const backMatches = [...backWindow.matchAll(new RegExp(IMG_URL_REGEX, 'gi'))]
  const last = backMatches[backMatches.length - 1]
  return last?.[1] ?? ''
}

function isValidProduct(p: Product): boolean {
  return Boolean(p.name) && p.price > 0 && Boolean(p.productUrl)
}
