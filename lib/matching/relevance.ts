import Fuse from 'fuse.js'
import type { Product, ProductGroup } from '../types'

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Remove diacritics
    .replace(/\bspf\s*(\d+)\+?/g, 'spf$1') // Normalize "SPF 50+" / "SPF50+" -> "spf50"
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
}

function splitWords(normalizedText: string): string[] {
  return normalizedText.split(' ').filter(w => w.length > 2)
}

function levenshteinDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  const current = Array.from({ length: b.length + 1 }, () => 0)

  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[b.length]
}

function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 6 || b.length < 6 || a[0] !== b[0]) return 0

  const maxLength = Math.max(a.length, b.length)
  return 1 - levenshteinDistance(a, b) / maxLength
}

function bestWordSimilarity(queryWord: string, haystackWords: Iterable<string>): number {
  let best = 0
  for (const haystackWord of haystackWords) {
    best = Math.max(best, wordSimilarity(queryWord, haystackWord))
  }
  return best >= 0.78 ? best : 0
}

function urlSlug(url: string): string {
  const segments = (() => {
    try {
      return new URL(url).pathname.split('/')
    } catch {
      return url.split('/')
    }
  })()
  return segments.filter(Boolean).pop() ?? ''
}

function buildSearchableText(product: Product): string {
  return [
    product.name,
    product.brand,
    urlSlug(product.productUrl ?? '').replace(/[-_]/g, ' '),
    product.attributes.brand,
    product.attributes.kind,
    product.attributes.variant,
  ].filter(Boolean).join(' ')
}

/**
 * Calculates relevance score for a product against a search query
 * Returns a score from 0-100
 */
export function calculateRelevance(product: Product, query: string): number {
  const normalizedQuery = normalizeText(query)
  const normalizedName = normalizeText(product.name)
  const normalizedHaystack = normalizeText(buildSearchableText(product))

  const queryWords = [...new Set(splitWords(normalizedQuery))]
  const haystackWordList = splitWords(normalizedHaystack)
  const haystackWords = new Set(haystackWordList)

  let score = 0

  // 1. Exact match on name (40 points) - highest priority
  if (normalizedName === normalizedQuery) {
    score += 40
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 30
  } else if (normalizedQuery.includes(normalizedName)) {
    score += 25
  }

  // 2. Query words matched across full haystack (30 points)
  if (queryWords.length > 0) {
    const matchedWordScore = queryWords.reduce((sum, word) => {
      if (haystackWords.has(word)) return sum + 1
      return sum + bestWordSimilarity(word, haystackWords)
    }, 0)
    score += (matchedWordScore / queryWords.length) * 30
  }

  // 3. Word order similarity in haystack (15 points)
  if (queryWords.length > 0) {
    let lastIndex = -1
    let orderMatchScore = 0
    for (const word of queryWords) {
      const index = haystackWordList.findIndex((haystackWord, i) => {
        if (i <= lastIndex) return false
        return haystackWord === word || bestWordSimilarity(word, [haystackWord]) > 0
      })
      if (index > lastIndex) {
        const haystackWord = haystackWordList[index]
        orderMatchScore += haystackWord === word ? 1 : bestWordSimilarity(word, [haystackWord])
        lastIndex = index
      }
    }
    score += (orderMatchScore / queryWords.length) * 15
  }

  // 4. Fuzzy text similarity on name (15 points)
  const fuse = new Fuse([normalizedName], {
    threshold: 0.6,
    includeScore: true,
  })
  const fuzzyResult = fuse.search(normalizedQuery)
  if (fuzzyResult.length > 0 && fuzzyResult[0].score !== undefined) {
    const fuzzySimilarity = 1 - fuzzyResult[0].score
    score += fuzzySimilarity * 15
  }

  return Math.min(100, Math.round(score))
}

/**
 * Filters and sorts products by relevance to query
 */
export function filterAndSortByRelevance(
  products: Product[],
  query: string,
  minScore: number = 30
): Array<Product & { relevanceScore: number }> {
  const scoredProducts = products.map(product => ({
    ...product,
    relevanceScore: calculateRelevance(product, query)
  }))

  const filtered = scoredProducts.filter(p => p.relevanceScore >= minScore)

  filtered.sort((a, b) => b.relevanceScore - a.relevanceScore)

  return filtered
}

/**
 * Sorts product groups by their best relevance score
 */
export function sortGroupsByRelevance(
  groups: ProductGroup[],
  query: string
): Array<ProductGroup & { bestRelevanceScore: number }> {
  const scoredGroups = groups.map(group => {
    const scores = group.products.map(p => calculateRelevance(p, query))
    const bestScore = Math.max(...scores)

    return {
      ...group,
      bestRelevanceScore: bestScore
    }
  })

  scoredGroups.sort((a, b) => b.bestRelevanceScore - a.bestRelevanceScore)

  return scoredGroups
}
