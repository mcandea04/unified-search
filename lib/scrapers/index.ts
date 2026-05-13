import { scrapeEmag } from './emag'
import { scrapeBebetei } from './bebetei'
import { scrapeNotino } from './notino'
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
  ])

  return results.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      const sources = ['emag', 'bebetei', 'notino'] as const
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

export { scrapeEmag, scrapeBebetei, scrapeNotino }
