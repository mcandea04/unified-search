/**
 * Source website identifier
 */
export type SourceSite = 'emag' | 'bebetei' | 'notino'

/**
 * Individual product from a single source
 */
export interface Product {
  /** Unique identifier (combination of source + product id) */
  id: string
  /** Product name as shown on the source website */
  name: string
  /** Price in Romanian Lei (RON) */
  price: number
  /** Currency code (always 'RON') */
  currency: string
  /** URL to product image */
  imageUrl: string
  /** URL to the product page on the source website */
  productUrl: string
  /** Source website where product was found */
  source: SourceSite
  /** Brand name (if detected) */
  brand?: string
  /** Product variant/size info (e.g., "84 buc", "Nr. 5", "12-22 kg") */
  variant?: string
}

/**
 * Confidence level for product matching
 */
export type MatchConfidence = 'high' | 'medium' | 'low'

/**
 * Group of similar products from different sources
 */
export interface ProductGroup {
  /** Unique group identifier */
  id: string
  /** Normalized/matched product name */
  matchedName: string
  /** Array of products from different sources */
  products: Product[]
  /** Lowest price among all products in the group */
  bestPrice: number
  /** Source website with the best price */
  bestPriceSource: SourceSite
  /** Confidence level of the product matching */
  matchConfidence: MatchConfidence
}

/**
 * Search result from API
 */
export interface SearchResult {
  /** Search query */
  query: string
  /** Array of product groups (matched products) */
  groups: ProductGroup[]
  /** Array of ungrouped products (couldn't be matched) */
  ungrouped: Product[]
  /** Total number of products found */
  totalProducts: number
  /** Number of products found per source */
  countBySource: Record<SourceSite, number>
  /** Per-source error descriptors for sources that failed */
  sourceErrors?: Partial<Record<SourceSite, string>>
  /** Timestamp of search */
  timestamp: number
}

/**
 * Scraper response from each website
 */
export interface ScraperResponse {
  /** Source website */
  source: SourceSite
  /** Array of products found */
  products: Product[]
  /** Success flag */
  success: boolean
  /** Error message if scraping failed */
  error?: string
}
