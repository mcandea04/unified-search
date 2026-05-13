import Fuse from 'fuse.js'
import type { Product, ProductGroup, MatchConfidence } from '../types'

/**
 * Extracts key attributes from product name for better matching
 */
function extractAttributes(name: string) {
  const normalized = name.toLowerCase()

  // Extract brand (common brands)
  const brandPatterns = [
    /huggies|pampers|libero|sleepy|mustar\s+galben|bebetei|bebe\s+tei/i,
    /cerave|vichy|roc|lancome|kiehl|missha|nivea|garnier|loreal/i,
    /mixa|revuele|olaplex|sol\s+de\s+janeiro|beauty\s+of\s+joseon/i,
  ]
  let brand = ''
  for (const pattern of brandPatterns) {
    const match = name.match(pattern)
    if (match) {
      brand = match[0]
      break
    }
  }

  // Extract size/number (e.g., "Nr. 5", "Size 5", "5")
  const sizeMatch = name.match(/nr\.?\s*(\d+)|size\s*(\d+)|marimea?\s*(\d+)/i)
  const size = sizeMatch ? sizeMatch[1] || sizeMatch[2] || sizeMatch[3] : ''

  // Extract quantity (e.g., "84 buc", "88 bucăți")
  const quantityMatch = name.match(/(\d+)\s*(buc|bucati|bucăți|pieces|pcs)/i)
  const quantity = quantityMatch ? quantityMatch[1] : ''

  // Extract weight range (e.g., "12-22 kg", "11-16kg")
  const weightMatch = name.match(/(\d+)\s*-\s*(\d+)\s*kg/i)
  const weightRange = weightMatch ? `${weightMatch[1]}-${weightMatch[2]}kg` : ''

  // Extract volume (e.g., "100ml", "50 ml")
  const volumeMatch = name.match(/(\d+)\s*ml/i)
  const volume = volumeMatch ? volumeMatch[1] + 'ml' : ''

  return {
    brand,
    size,
    quantity,
    weightRange,
    volume,
    normalized,
  }
}

/**
 * Calculates similarity score between two products
 */
function calculateSimilarity(p1: Product, p2: Product): number {
  const attr1 = extractAttributes(p1.name)
  const attr2 = extractAttributes(p2.name)

  let score = 0
  let totalWeight = 0

  // Brand match (weight: 30)
  if (attr1.brand && attr2.brand && attr1.brand === attr2.brand) {
    score += 30
  }
  totalWeight += 30

  // Size match (weight: 20)
  if (attr1.size && attr2.size && attr1.size === attr2.size) {
    score += 20
  }
  totalWeight += 20

  // Quantity match (weight: 15)
  if (attr1.quantity && attr2.quantity && attr1.quantity === attr2.quantity) {
    score += 15
  }
  totalWeight += 15

  // Weight range match (weight: 15)
  if (attr1.weightRange && attr2.weightRange && attr1.weightRange === attr2.weightRange) {
    score += 15
  }
  totalWeight += 15

  // Volume match (weight: 10)
  if (attr1.volume && attr2.volume && attr1.volume === attr2.volume) {
    score += 10
  }
  totalWeight += 10

  // Text similarity using Fuse.js (weight: 10)
  const fuse = new Fuse([p1.name], {
    threshold: 0.4,
    includeScore: true,
  })
  const result = fuse.search(p2.name)
  if (result.length > 0 && result[0].score !== undefined) {
    const textSimilarity = (1 - result[0].score) * 10
    score += textSimilarity
  }
  totalWeight += 10

  return (score / totalWeight) * 100
}

/**
 * Determines match confidence based on similarity score
 */
function getMatchConfidence(score: number): MatchConfidence {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}

/**
 * Groups similar products together
 */
export function matchProducts(products: Product[]): {
  groups: ProductGroup[]
  ungrouped: Product[]
} {
  console.log(`[Matching] Received ${products.length} products to match`)

  const groups: ProductGroup[] = []
  const grouped = new Set<string>()
  const SIMILARITY_THRESHOLD = 70

  // Sort products by source to ensure consistent grouping
  const sortedProducts = [...products].sort((a, b) => a.source.localeCompare(b.source))
  console.log(`[Matching] Sorted ${sortedProducts.length} products`)

  for (const product of sortedProducts) {
    if (grouped.has(product.id)) continue

    // Find similar products
    const similarProducts = [product]

    for (const other of sortedProducts) {
      if (grouped.has(other.id) || product.id === other.id) continue
      if (product.source === other.source) continue // Don't match products from same source

      const similarity = calculateSimilarity(product, other)
      if (similarity >= SIMILARITY_THRESHOLD) {
        similarProducts.push(other)
      }
    }

    // Only create a group if we have multiple products
    if (similarProducts.length > 1) {
      // Mark all products in this group as grouped
      similarProducts.forEach(p => grouped.add(p.id))
      const prices = similarProducts.map((p) => p.price)
      const bestPrice = Math.min(...prices)
      const bestPriceProduct = similarProducts.find((p) => p.price === bestPrice)!

      // Create a normalized name (use the shortest name as it's usually cleaner)
      const matchedName = similarProducts
        .map((p) => p.name)
        .sort((a, b) => a.length - b.length)[0]

      const avgSimilarity =
        similarProducts.reduce((sum, p) => {
          if (p === product) return sum
          return sum + calculateSimilarity(product, p)
        }, 0) /
        (similarProducts.length - 1)

      groups.push({
        id: `group-${groups.length}`,
        matchedName,
        products: similarProducts,
        bestPrice,
        bestPriceSource: bestPriceProduct.source,
        matchConfidence: getMatchConfidence(avgSimilarity),
      })
    }
  }

  // Find ungrouped products
  const ungrouped = products.filter((p) => !grouped.has(p.id))

  console.log(`[Matching] Created ${groups.length} groups, ${ungrouped.length} ungrouped`)
  console.log(`[Matching] Sample ungrouped:`, ungrouped.slice(0, 2).map(p => ({ name: p.name, source: p.source })))

  return { groups, ungrouped }
}
