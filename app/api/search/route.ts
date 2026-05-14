import { NextRequest, NextResponse } from 'next/server'
import { scrapeAllSites } from '@/lib/scrapers'
import { matchProducts } from '@/lib/matching/fuzzy-match'
import { filterAndSortByRelevance, sortGroupsByRelevance } from '@/lib/matching/relevance'
import type { SearchResult, Product, SourceSite } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    )
  }

  try {
    console.log(`Received search request for: "${query}"`)

    // Scrape all sites in parallel
    const scraperResults = await scrapeAllSites(query)

    // Collect all products
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
        allProducts.push(...result.products)
        countBySource[result.source] = result.products.length
      } else {
        console.error(`Failed to scrape ${result.source}:`, result.error)
        sourceErrors[result.source] = result.error ?? 'unknown'
      }
    }

    console.log(`Found ${allProducts.length} total products`)
    console.log(`By source:`, countBySource)

    // Filter and sort all products by relevance first
    const MIN_RELEVANCE_SCORE = 30
    const relevantProducts = filterAndSortByRelevance(allProducts, query, MIN_RELEVANCE_SCORE)

    console.log(`After relevance filtering: ${relevantProducts.length}/${allProducts.length} products (min score: ${MIN_RELEVANCE_SCORE})`)
    if (relevantProducts.length > 0) {
      console.log(`Top 3 scores: ${relevantProducts.slice(0, 3).map(p => p.relevanceScore).join(', ')}`)
      console.log(`Sample top products:`, relevantProducts.slice(0, 2).map(p => ({ name: p.name, score: p.relevanceScore })))
    }

    // Match and group products (only relevant ones)
    const { groups, ungrouped } = matchProducts(relevantProducts)

    console.log(`Created ${groups.length} product groups`)
    console.log(`${ungrouped.length} products remain ungrouped`)

    // Sort groups by their best relevance score
    const sortedGroups = sortGroupsByRelevance(groups, query)
    console.log(`Sorted ${sortedGroups.length} groups by relevance`)

    // Build response
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
      { status: 500 }
    )
  }
}
