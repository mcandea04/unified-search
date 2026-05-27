/**
 * Source website identifier
 */
export const SOURCE_SITES = ['emag', 'bebetei', 'notino', 'trendyol', 'dm', 'realfoods'] as const
export type SourceSite = (typeof SOURCE_SITES)[number]

/**
 * Structured attributes derived from a product name.
 */
export interface ProductAttributes {
  brand?: string
  kind?: string
  organic: boolean
  pack?: { value: number; unit: 'g' | 'ml'; original: string }
  count?: number
  variant?: string
  diaperSize?: string
}

/**
 * Per-unit price computed after attribute extraction.
 */
export interface PerUnitPrice {
  /** RON per 100 of `unit` when unit is g/ml; RON per piece when unit is 'piece'. */
  value: number
  unit: 'g' | 'ml' | 'piece'
}

/**
 * Individual product from a single source
 */
export interface Product {
  id: string
  name: string
  price: number
  currency: string
  imageUrl: string
  productUrl: string
  source: SourceSite
  brand?: string
  variant?: string
  attributes: ProductAttributes
  pricePerUnit?: PerUnitPrice
}

/**
 * Confidence level for product matching
 */
export type MatchConfidence = 'high' | 'medium' | 'low'

/**
 * Group of similar products from different sources
 */
export interface ProductGroup {
  id: string
  matchedName: string
  products: Product[]
  bestPrice: number
  bestPriceSource: SourceSite
  matchConfidence: MatchConfidence
  attributes: ProductAttributes
  bestPricePerUnit?: PerUnitPrice
  bestPricePerUnitSource?: SourceSite
}

/**
 * Search result from API
 */
export interface SearchResult {
  query: string
  groups: ProductGroup[]
  ungrouped: Product[]
  rawProducts: Product[]
  totalProducts: number
  countBySource: Record<SourceSite, number>
  sourceErrors?: Partial<Record<SourceSite, string>>
  enrichmentError?: string
  timestamp: number
}

/**
 * Scraper response from each website
 */
export interface ScraperResponse {
  source: SourceSite
  products: Product[]
  success: boolean
  error?: string
}
