import { NextRequest, NextResponse } from 'next/server'
import { scrapeAllSites } from '@/lib/scrapers'
import { enrichWithLLM } from '@/lib/matching/llm-attributes'
import { groupProducts } from '@/lib/matching/grouping'
import { filterAndSortByRelevance, sortGroupsByRelevance } from '@/lib/matching/relevance'
import { computePerUnitPrice } from '@/lib/matching/per-unit'
import { findStandoutDeal } from '@/lib/matching/standout'
import { SOURCE_SITES } from '@/lib/types'
import type {
  Product,
  SearchResult,
  SourceSite,
} from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

function applyPerUnitPrice(product: Product): Product {
  const pricePerUnit = computePerUnitPrice(product.price, product.attributes)
  return { ...product, pricePerUnit }
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
    const countBySource = Object.fromEntries(SOURCE_SITES.map((s) => [s, 0])) as Record<SourceSite, number>
    const sourceErrors: Partial<Record<SourceSite, string>> = {}

    for (const result of scraperResults) {
      if (result.success) {
        allProducts.push(...result.products)
        countBySource[result.source] = result.products.length
      } else {
        console.error(`Failed to scrape ${result.source}:`, result.error)
        sourceErrors[result.source] = result.error ?? 'unknown'
      }
    }

    console.log(`Found ${allProducts.length} total products`)
    console.log(`By source:`, countBySource)

    const { products: enriched, error: enrichmentError } = await enrichWithLLM(allProducts, query)
    const withPricePerUnit = enriched.map(applyPerUnitPrice)

    const MIN_RELEVANCE_SCORE = 30
    const relevantProducts = filterAndSortByRelevance(withPricePerUnit, query, MIN_RELEVANCE_SCORE)
    console.log(
      `After relevance filtering: ${relevantProducts.length}/${allProducts.length} products`,
    )

    const { groups, ungrouped } = enrichmentError
      ? { groups: [], ungrouped: relevantProducts }
      : groupProducts(relevantProducts)
    console.log(`Created ${groups.length} groups; ${ungrouped.length} ungrouped`)

    const sortedGroups = sortGroupsByRelevance(groups, query)

    const standoutDeal = enrichmentError ? undefined : findStandoutDeal(sortedGroups, ungrouped)
    const filteredUngrouped = standoutDeal
      ? ungrouped.filter(p => p.id !== standoutDeal.product.id)
      : ungrouped

    const response: SearchResult = {
      query,
      groups: sortedGroups,
      ungrouped: filteredUngrouped,
      rawProducts: allProducts,
      totalProducts: relevantProducts.length,
      countBySource,
      ...(Object.keys(sourceErrors).length > 0 ? { sourceErrors } : {}),
      ...(enrichmentError ? { enrichmentError } : {}),
      ...(standoutDeal ? { standoutDeal } : {}),
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
