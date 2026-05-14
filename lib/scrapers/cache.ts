import type { Product } from '../types'

interface Entry {
  products: Product[]
  expiresAt: number
}

const cache = new Map<string, Entry>()

export function getCachedProducts(key: string): Product[] | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.products
}

export function setCachedProducts(key: string, products: Product[], ttlMs: number): void {
  if (products.length === 0) return
  cache.set(key, { products, expiresAt: Date.now() + ttlMs })
}
