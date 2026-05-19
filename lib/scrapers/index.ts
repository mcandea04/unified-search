import { scrapeEmag } from './emag'
import { scrapeBebetei } from './bebetei'
import { scrapeNotino } from './notino'
import { scrapeTrendyol } from './trendyol'
import { scrapeDm } from './dm'
import type { ScraperResponse } from '../types'

/**
 * Runs all scrapers in parallel for a given query
 */
export async function scrapeAllSites(query: string): Promise<ScraperResponse[]> {
  console.log(`Starting parallel scraping for query: "${query}"`)

  const results = await Promise.allSettled([
    scrapeEmag(query),
    scrapeBebetei(query),
    scrapeNotino(query),
    scrapeTrendyol(query),
    scrapeDm(query),
  ])

  return results.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      const sources = ['emag', 'bebetei', 'notino', 'trendyol', 'dm'] as const
      console.error(`Scraper ${sources[idx]} failed:`, result.reason)
      return {
        source: sources[idx],
        products: [],
        success: false,
        error: result.reason?.message || 'Unknown error',
      }
    }
  })
}

export { scrapeEmag, scrapeBebetei, scrapeNotino, scrapeTrendyol, scrapeDm }
