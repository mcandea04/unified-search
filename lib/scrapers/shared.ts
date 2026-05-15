const DEFAULT_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'accept-language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-encoding': 'gzip, deflate, br',
  'upgrade-insecure-requests': '1',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
}

export async function fetchHtml(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...DEFAULT_HEADERS, ...(init.headers as Record<string, string> | undefined) }
  return fetch(url, { ...init, headers })
}

export interface FetchResult {
  status: number
  ok: boolean
  text(): Promise<string>
}

// Lazy singleton — defers native .so load until first request (Vercel cold-start).
let tlsSessionPromise: Promise<import('node-tls-client').Session> | null = null

function getTlsSession(): Promise<import('node-tls-client').Session> {
  if (!tlsSessionPromise) {
    tlsSessionPromise = (async () => {
      const { Session, ClientIdentifier, initTLS } = await import('node-tls-client')
      await initTLS()
      return new Session({ clientIdentifier: ClientIdentifier.chrome_131, timeout: 20_000 })
    })()
  }
  return tlsSessionPromise
}

export async function fetchHtmlImpersonated(
  url: string,
  extraHeaders?: Record<string, string>
): Promise<FetchResult> {
  const session = await getTlsSession()
  const headers = { ...DEFAULT_HEADERS, ...extraHeaders }
  const res = await session.get(url, { headers })
  return {
    status: res.status,
    ok: res.ok,
    text: () => Promise.resolve(res.body),
  }
}

const CLOUDFLARE_MARKERS = [
  'cf-browser-verification',
  'challenges.cloudflare.com',
  '__cf_chl_',
  'Just a moment...',
]

export function looksLikeCloudflareChallenge(html: string): boolean {
  if (!html) return false
  const head = html.slice(0, 4000)
  return CLOUDFLARE_MARKERS.some((marker) => head.includes(marker))
}

type JsonLdNode = Record<string, unknown>

export function extractJsonLd(html: string): JsonLdNode[] {
  const results: JsonLdNode[] = []
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(html))) {
    const raw = match[1].trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) results.push(...parsed)
      else results.push(parsed)
    } catch {
      // Ignore invalid JSON-LD blocks
    }
  }
  return results
}

export interface JsonLdProduct {
  '@type'?: string
  name?: string
  url?: string
  image?: string | string[]
  brand?: string | { name?: string }
  gtin13?: string
  gtin?: string
  mpn?: string
  sku?: string
  offers?: JsonLdOffer | JsonLdOffer[]
}

interface JsonLdOffer {
  price?: string | number
  priceCurrency?: string
  availability?: string
}

export function extractProductsFromJsonLd(jsonLdBlocks: JsonLdNode[]): JsonLdProduct[] {
  const products: JsonLdProduct[] = []

  const walk = (node: unknown): void => {
    if (!node) return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node !== 'object') return

    const obj = node as JsonLdNode
    if (obj['@type'] === 'Product') products.push(obj as JsonLdProduct)

    if (obj['@type'] === 'ItemList' && Array.isArray(obj.itemListElement)) {
      for (const entry of obj.itemListElement as unknown[]) {
        const e = entry as { item?: unknown }
        if (e?.item) walk(e.item)
        else walk(entry)
      }
    }

    Object.values(obj).forEach(walk)
  }

  jsonLdBlocks.forEach(walk)
  return products
}

export interface RegexProduct {
  name: string
  url: string
  image: string | null
  price: number | null
  currency: string | null
}

export function extractProductsByRegex(
  html: string,
  options: { urlPatterns: RegExp[]; baseUrl: string; currency?: string }
): RegexProduct[] {
  const { urlPatterns, baseUrl, currency = 'RON' } = options
  const products = new Map<string, RegexProduct>()

  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorRegex.exec(html))) {
    const url = normalizeUrl(match[1], baseUrl)
    if (!url || !urlPatterns.some((p) => p.test(url))) continue

    const name = cleanText(match[2])
    if (!name || name.length < 3) continue

    const windowStart = Math.max(0, match.index - 500)
    const windowEnd = Math.min(html.length, match.index + 1500)
    const windowHtml = html.slice(windowStart, windowEnd)
    const windowText = stripTagsForPrice(windowHtml)

    const priceMatch = windowText.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)(?:[.,]\d{2})?\s*(LEI|RON)/i)
    const price = priceMatch ? normalizePrice(priceMatch[0]) : null

    const imageMatch = windowHtml.match(/<img[^>]+src=["']([^"']+)["']/i)
    const image = imageMatch ? normalizeUrl(imageMatch[1], baseUrl) : null

    const existing = products.get(url)
    const candidate: RegexProduct = {
      name,
      url,
      image,
      price,
      currency: price ? currency : null,
    }
    if (!existing) {
      products.set(url, candidate)
    } else {
      products.set(url, {
        name: name.length > existing.name.length ? name : existing.name,
        url,
        image: existing.image ?? image,
        price: existing.price ?? price,
        currency: existing.currency ?? candidate.currency,
      })
    }
  }

  return Array.from(products.values())
}

export function normalizePrice(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(/,/g, '.')
  const num = Number.parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  if (!href) return null
  if (href.startsWith('//')) return `https:${href}`
  if (href.startsWith('http')) return href
  if (!baseUrl) return href
  if (href.startsWith('/')) return `${baseUrl}${href}`
  return `${baseUrl}/${href}`
}

function cleanText(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTagsForPrice(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&#44;/g, ',')
    .replace(/&#46;/g, '.')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
}
