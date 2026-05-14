import type {
  MatchConfidence,
  Product,
  ProductAttributes,
  ProductGroup,
  SourceSite,
} from '../types'

const STOPWORDS = new Set(['de', 'pentru', 'cu', 'din', 'la', 'si', '&', '-'])

function normalizeQuery(query: string): string {
  const tokens = String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
  return tokens.sort().join(' ')
}

function packSignature(attrs: ProductAttributes): string {
  if (attrs.pack) return `${attrs.pack.value}${attrs.pack.unit}`
  if (typeof attrs.count === 'number') return `${attrs.count}pcs`
  return ''
}

function bucketKey(attrs: ProductAttributes, kind: string): string {
  return [
    attrs.brand ?? 'unknown',
    kind,
    packSignature(attrs),
    attrs.diaperSize ?? '',
    attrs.organic ? 'bio' : 'nonbio',
  ].join('|')
}

function pickMatchedName(products: Product[]): string {
  const named = products.filter((p) => p.name)
  if (!named.length) return 'Unnamed product'
  return named.slice().sort((a, b) => a.name.length - b.name.length)[0].name
}

function confidenceFor(sources: Set<SourceSite>, attrs: ProductAttributes): MatchConfidence {
  if (sources.size >= 3) return 'high'
  if (sources.size === 2 && attrs.diaperSize) return 'high'
  if (sources.size === 2) return 'medium'
  return 'low'
}

function aggregateAttributes(products: Product[]): ProductAttributes {
  const head = products[0].attributes
  const out: ProductAttributes = { organic: head.organic }
  if (head.brand) out.brand = head.brand
  if (head.pack) out.pack = head.pack
  if (typeof head.count === 'number') out.count = head.count
  if (head.diaperSize) out.diaperSize = head.diaperSize
  const variants = new Set(products.map((p) => p.attributes.variant ?? '').filter(Boolean))
  if (variants.size === 1) out.variant = [...variants][0]
  return out
}

function bestPerUnit(products: Product[]): {
  best?: Product['pricePerUnit']
  source?: SourceSite
} {
  let bestVal = Infinity
  let bestUnit: 'g' | 'ml' | 'piece' | undefined
  let bestSrc: SourceSite | undefined
  const units = new Set(products.map((p) => p.pricePerUnit?.unit).filter(Boolean) as string[])
  if (units.size !== 1) return {}
  for (const p of products) {
    const ppu = p.pricePerUnit
    if (!ppu) continue
    if (ppu.value < bestVal) {
      bestVal = ppu.value
      bestUnit = ppu.unit
      bestSrc = p.source
    }
  }
  if (!bestUnit) return {}
  return { best: { value: bestVal, unit: bestUnit }, source: bestSrc }
}

interface Bucket {
  items: Product[]
  sources: Set<SourceSite>
}

export function groupProducts(
  products: Array<Product & { attributes: ProductAttributes }>,
  query: string,
): { groups: ProductGroup[]; ungrouped: Product[] } {
  const kind = normalizeQuery(query)
  const buckets = new Map<string, Bucket>()
  for (const product of products) {
    if (!product.name) continue
    const key = bucketKey(product.attributes, kind)
    const bucket = buckets.get(key) ?? { items: [], sources: new Set<SourceSite>() }
    bucket.items.push(product)
    bucket.sources.add(product.source)
    buckets.set(key, bucket)
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
    const aggregated = aggregateAttributes(items)
    const { best, source } = bestPerUnit(items)
    groups.push({
      id: `group-${groups.length}`,
      matchedName: pickMatchedName(items),
      products: items,
      bestPrice,
      bestPriceSource: bestPriceProduct.source,
      matchConfidence: confidenceFor(bucket.sources, aggregated),
      attributes: aggregated,
      bestPricePerUnit: best,
      bestPricePerUnitSource: source,
    })
  }

  const ungrouped = products.filter((p) => !grouped.has(p.id))
  return { groups, ungrouped }
}
