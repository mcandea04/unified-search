import Fuse from 'fuse.js'
import type { Product, ProductGroup } from '../types'

/**
 * Normalizes text for comparison (lowercase, remove accents, etc.)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
}

/**
 * Extracts words from a string
 */
function extractWords(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter(w => w.length > 2))
}

/**
 * Calculates relevance score for a product against a search query
 * Returns a score from 0-100
 */
export function calculateRelevance(product: Product, query: string): number {
  const normalizedQuery = normalizeText(query)
  const normalizedName = normalizeText(product.name)
  const normalizedBrand = normalizeText(product.brand || '')

  const queryWords = extractWords(query)
  const nameWords = extractWords(product.name)
  const brandWords = extractWords(product.brand || '')

  let score = 0

  // 1. Exact match (40 points) - highest priority
  if (normalizedName === normalizedQuery) {
    score += 40
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 30
  } else if (normalizedQuery.includes(normalizedName)) {
    score += 25
  }

  // 2. All query words present in name (30 points)
  let matchedWords = 0
  for (const word of queryWords) {
    if (nameWords.has(word) || brandWords.has(word)) {
      matchedWords++
    }
  }
  if (queryWords.size > 0) {
    const wordMatchRatio = matchedWords / queryWords.size
    score += wordMatchRatio * 30
  }

  // 3. Word order similarity (15 points)
  // Check if query words appear in the same order in the product name
  const queryWordArray = Array.from(queryWords)
  const nameText = normalizedName + ' ' + normalizedBrand
  let lastIndex = -1
  let orderMatches = 0

  for (const word of queryWordArray) {
    const index = nameText.indexOf(word, lastIndex + 1)
    if (index > lastIndex) {
      orderMatches++
      lastIndex = index
    }
  }

  if (queryWordArray.length > 0) {
    score += (orderMatches / queryWordArray.length) * 15
  }

  // 4. Fuzzy text similarity (15 points)
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
  // Calculate relevance scores
  const scoredProducts = products.map(product => ({
    ...product,
    relevanceScore: calculateRelevance(product, query)
  }))

  // Filter by minimum score
  const filtered = scoredProducts.filter(p => p.relevanceScore >= minScore)

  // Sort by relevance (highest first)
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
    // Find the best relevance score in the group
    const scores = group.products.map(p => calculateRelevance(p, query))
    const bestScore = Math.max(...scores)

    return {
      ...group,
      bestRelevanceScore: bestScore
    }
  })

  // Sort by best score
  scoredGroups.sort((a, b) => b.bestRelevanceScore - a.bestRelevanceScore)

  return scoredGroups
}
