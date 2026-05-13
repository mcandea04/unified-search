import type { MatchConfidence, Product, ProductGroup, SourceSite } from '../types'

const SIZE_CONTEXT_TOKENS = new Set([
  'nr',
  'no',
  'numar',
  'marime',
  'marimea',
  'size',
  'stage',
  'etapa',
])

const PRODUCT_LINE_STOPWORDS = new Set([
  'scutece',
  'scutec',
  'diapers',
  'buc',
  'bucati',
  'bucăți',
  'bucatile',
  'pachet',
  'pack',
  'jumbo',
  'value',
  'premium',
  'pants',
  'chilotel',
  'chilotei',
  'formula',
  'lapte',
  'praf',
  'de',
  'pentru',
  'inceput',
  'sugari',
  'continuare',
  'speciala',
  'la',
  'din',
  'nr',
  'no',
  'numar',
  'marime',
  'marimea',
  'size',
  'kg',
  'g',
  'ml',
  'luni',
  'luna',
  'nastere',
  'pachet',
])

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const KNOWN_BRANDS = [
  'nan',
  'pampers',
  'huggies',
  'libero',
  'sleepy',
  'muumi',
  'aptamil',
  'hipp',
  'nutrilon',
  'similac',
  'bebelac',
  'cerave',
  'vichy',
  'nivea',
  'garnier',
  'loreal',
  'missha',
  'olaplex',
  'mustela',
  'babydream',
]

function inferBrand(normalized: string, explicit?: string): string {
  const explicitNorm = explicit ? normalizeText(explicit) : ''
  if (explicitNorm) {
    const tokens = explicitNorm.split(' ')
    for (const token of tokens) {
      if (KNOWN_BRANDS.includes(token)) return token
    }
  }

  const tokens = normalized.split(' ')
  for (const token of tokens) {
    if (KNOWN_BRANDS.includes(token)) return token
  }
  if (explicitNorm) return explicitNorm.split(' ')[0]
  for (const token of tokens) {
    if (token.length >= 3 && !/^\d+$/.test(token) && !PRODUCT_LINE_STOPWORDS.has(token)) {
      return token
    }
  }
  return tokens[0] ?? ''
}

const AGE_RANGE_TOKENS = new Set(['luni', 'luna', 'months', 'month', 'kg'])

function isStageCandidate(token: string): boolean {
  return /^\d{1,2}$/.test(token) && Number(token) <= 8
}

function extractSizeStage(normalized: string, brand: string): string {
  const tokens = normalized.split(' ')

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const prev = tokens[i - 1] ?? ''
    const next = tokens[i + 1] ?? ''

    const plusMatch = token.match(/^(\d{1,2})\+$/)
    if (plusMatch) return `${plusMatch[1]}+`

    if (!isStageCandidate(token)) continue

    if (SIZE_CONTEXT_TOKENS.has(prev) || SIZE_CONTEXT_TOKENS.has(next)) return token

    const nextIsRangeSep = /^\d{1,2}$/.test(next) && tokens[i + 2] === 'kg'
    const nextIsKg = AGE_RANGE_TOKENS.has(next)
    if (nextIsRangeSep || nextIsKg) continue

    if (prev === brand && brand) return token
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const prev = tokens[i - 1] ?? ''
    const next = tokens[i + 1] ?? ''
    if (!isStageCandidate(token)) continue

    const nextIsRangeSep = /^\d{1,2}$/.test(next) && tokens[i + 2] === 'kg'
    if (nextIsRangeSep) continue
    if (AGE_RANGE_TOKENS.has(next)) continue
    if (prev === '+') continue
    return token
  }

  return ''
}

const PRODUCT_LINE_KEYWORDS = [
  'optipro',
  'comfortis',
  'supreme',
  'hmo',
  'expert',
  'sensitive',
  'hipoalergen',
  'hypoallergen',
  'kids',
  'junior',
  'total',
  'care',
  'extra',
  'movers',
  'little',
  'swimmers',
  'soft',
  'dry',
  'baby',
  'pure',
  'natural',
]

function extractProductLine(normalized: string, brand: string, sizeStage: string): string {
  const skip = new Set<string>([brand, sizeStage].filter(Boolean))
  for (const word of PRODUCT_LINE_STOPWORDS) skip.add(word)

  const tokens = normalized
    .split(' ')
    .filter((token) => token && !skip.has(token) && !/^\d+\+?$/.test(token))

  const keyword = tokens.find((t) => PRODUCT_LINE_KEYWORDS.includes(t))
  if (keyword) return keyword

  return tokens.slice(0, 2).join(' ')
}

interface ProductKey {
  brand: string
  sizeStage: string
  productLine: string
}

function keyFor(product: Product): ProductKey {
  const normalized = normalizeText(product.name)
  const brand = inferBrand(normalized, product.brand)
  const sizeStage = extractSizeStage(normalized, brand)
  const productLine = extractProductLine(normalized, brand, sizeStage)
  return { brand, sizeStage, productLine }
}

function keyString(key: ProductKey): string {
  return `${key.brand || 'unknown'}|${key.productLine || 'unknown'}|${key.sizeStage}`
}

function pickMatchedName(products: Product[]): string {
  const named = products.filter((p) => p.name)
  if (!named.length) return 'Unnamed product'
  return named.slice().sort((a, b) => a.name.length - b.name.length)[0].name
}

function confidenceFor(sources: Set<SourceSite>, key: ProductKey): MatchConfidence {
  if (sources.size >= 3) return 'high'
  if (sources.size === 2 && key.sizeStage) return 'high'
  if (sources.size === 2) return 'medium'
  return 'low'
}

export function matchProducts(products: Product[]): {
  groups: ProductGroup[]
  ungrouped: Product[]
} {
  console.log(`[Matching] Received ${products.length} products to match`)

  interface Bucket {
    key: ProductKey
    items: Product[]
    sources: Set<SourceSite>
  }

  const buckets = new Map<string, Bucket>()

  for (const product of products) {
    const key = keyFor(product)
    const normalizedName = normalizeText(product.name)
    if (!normalizedName) continue
    const k = keyString(key)
    const bucket = buckets.get(k) ?? { key, items: [], sources: new Set<SourceSite>() }
    bucket.items.push(product)
    bucket.sources.add(product.source)
    buckets.set(k, bucket)
  }

  const groups: ProductGroup[] = []
  const grouped = new Set<string>()

  for (const bucket of buckets.values()) {
    if (bucket.sources.size < 2) continue

    const items = bucket.items
    items.forEach((p) => grouped.add(p.id))
    const prices = items.map((p) => p.price)
    const bestPrice = Math.min(...prices)
    const bestPriceProduct = items.find((p) => p.price === bestPrice) ?? items[0]

    groups.push({
      id: `group-${groups.length}`,
      matchedName: pickMatchedName(items),
      products: items,
      bestPrice,
      bestPriceSource: bestPriceProduct.source,
      matchConfidence: confidenceFor(bucket.sources, bucket.key),
    })
  }

  const ungrouped = products.filter((p) => !grouped.has(p.id))

  console.log(`[Matching] Created ${groups.length} groups, ${ungrouped.length} ungrouped`)

  return { groups, ungrouped }
}
