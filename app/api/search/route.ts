import { NextRequest, NextResponse } from 'next/server'
import { scrapeAllSites } from '@/lib/scrapers'
import { extractAttributes } from '@/lib/matching/attributes'
import { groupProducts } from '@/lib/matching/grouping'
import { filterAndSortByRelevance, sortGroupsByRelevance } from '@/lib/matching/relevance'
import type {
  PerUnitPrice,
  Product,
  ProductAttributes,
  SearchResult,
  SourceSite,
} from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

function computePerUnitPrice(price: number, attrs: ProductAttributes): PerUnitPrice | undefined {
  if (attrs.pack && attrs.pack.value > 0) {
    return { value: price / (attrs.pack.value / 100), unit: attrs.pack.unit }
  }
  if (typeof attrs.count === 'number' && attrs.count > 0) {
    return { value: price / attrs.count, unit: 'piece' }
  }
  return undefined
}

function enrich(product: Product): Product {
  const attributes = extractAttributes(product)
  const pricePerUnit = computePerUnitPrice(product.price, attributes)
  return { ...product, attributes, pricePerUnit }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  try {
    console.log(`Received search request for: "${query}"`)
    const scraperResults = await scrapeAllSites(query)

    const allProducts: Product[] = []
    const countBySource: Record<SourceSite, number> = {
      emag: 0,
      bebetei: 0,
      notino: 0,
      trendyol: 0,
    }
    const sourceErrors: Partial<Record<SourceSite, string>> = {}

    for (const result of scraperResults) {
      if (result.success) {
        const enriched = result.products.map(enrich)
        allProducts.push(...enriched)
        countBySource[result.source] = enriched.length
      } else {
        console.error(`Failed to scrape ${result.source}:`, result.error)
        sourceErrors[result.source] = result.error ?? 'unknown'
      }
    }

    console.log(`Found ${allProducts.length} total products`)
    console.log(`By source:`, countBySource)

    const MIN_RELEVANCE_SCORE = 30
    const relevantProducts = filterAndSortByRelevance(allProducts, query, MIN_RELEVANCE_SCORE)
    console.log(
      `After relevance filtering: ${relevantProducts.length}/${allProducts.length} products`,
    )

    const { groups, ungrouped } = groupProducts(relevantProducts, query)
    console.log(`Created ${groups.length} groups; ${ungrouped.length} ungrouped`)

    const sortedGroups = sortGroupsByRelevance(groups, query)

    const response: SearchResult = {
      query,
      groups: sortedGroups,
      ungrouped,
      totalProducts: relevantProducts.length,
      countBySource,
      ...(Object.keys(sourceErrors).length > 0 ? { sourceErrors } : {}),
      timestamp: Date.now(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to perform search',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
