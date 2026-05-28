import { describe, expect, it } from 'vitest'
import { findStandoutDeal } from '../standout'
import type { Product, ProductGroup, SourceSite } from '../../types'

function makeProduct(overrides: Partial<Product> & { name: string; source: SourceSite }): Product {
  return {
    id: `${overrides.source}-${overrides.name}`,
    price: 10,
    currency: 'RON',
    imageUrl: '',
    productUrl: '',
    attributes: { organic: false },
    ...overrides,
  }
}

function makeGroup(kind: string, bestPpuValue: number, unit: 'g' | 'ml' | 'piece' = 'g'): ProductGroup {
  return {
    id: 'g1',
    matchedName: 'Test group',
    products: [],
    bestPrice: 10,
    bestPriceSource: 'emag',
    matchConfidence: 'high',
    attributes: { organic: false, kind },
    bestPricePerUnit: { value: bestPpuValue, unit },
  }
}

describe('findStandoutDeal', () => {
  it('returns standout when savings >= 20%', () => {
    const group = makeGroup('dishwasher salt', 1.0)
    const candidate = makeProduct({
      name: 'Sare 2kg',
      source: 'dm',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.27, unit: 'g' },
    })
    const result = findStandoutDeal([group], [candidate])
    expect(result).toBeDefined()
    expect(result!.product.id).toBe(candidate.id)
    expect(result!.savingsPercent).toBeCloseTo(0.73, 2)
  })

  it('does not return when savings < 20%', () => {
    const group = makeGroup('dishwasher salt', 1.0)
    const candidate = makeProduct({
      name: 'Sare 1.5kg',
      source: 'dm',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.86, unit: 'g' },
    })
    expect(findStandoutDeal([group], [candidate])).toBeUndefined()
  })

  it('returns undefined when savings exactly 19%', () => {
    const group = makeGroup('dishwasher salt', 1.0)
    const candidate = makeProduct({
      name: 'Sare',
      source: 'dm',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.81, unit: 'g' },
    })
    expect(findStandoutDeal([group], [candidate])).toBeUndefined()
  })

  it('returns undefined when no same-kind group exists', () => {
    const group = makeGroup('shampoo', 0.5)
    const candidate = makeProduct({
      name: 'Sare 2kg',
      source: 'dm',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.10, unit: 'g' },
    })
    expect(findStandoutDeal([group], [candidate])).toBeUndefined()
  })

  it('ignores ungrouped products with no pricePerUnit', () => {
    const group = makeGroup('dishwasher salt', 1.0)
    const candidate = makeProduct({
      name: 'Sare 2kg',
      source: 'dm',
      attributes: { organic: false, kind: 'dishwasher salt' },
    })
    expect(findStandoutDeal([group], [candidate])).toBeUndefined()
  })

  it('ignores ungrouped products with no kind', () => {
    const group = makeGroup('dishwasher salt', 1.0)
    const candidate = makeProduct({
      name: 'Unknown',
      source: 'dm',
      attributes: { organic: false },
      pricePerUnit: { value: 0.10, unit: 'g' },
    })
    expect(findStandoutDeal([group], [candidate])).toBeUndefined()
  })

  it('ignores candidates when unit does not match group unit', () => {
    const group = makeGroup('diapers', 2.0, 'piece')
    const candidate = makeProduct({
      name: 'Sare 2kg',
      source: 'dm',
      attributes: { organic: false, kind: 'diapers' },
      pricePerUnit: { value: 0.10, unit: 'g' },
    })
    expect(findStandoutDeal([group], [candidate])).toBeUndefined()
  })

  it('picks candidate with highest savings among multiple', () => {
    const group = makeGroup('dishwasher salt', 1.0)
    const good = makeProduct({
      name: 'Sare 2kg',
      source: 'dm',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.27, unit: 'g' },
    })
    const ok = makeProduct({
      name: 'Sare 1.8kg',
      source: 'realfoods',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.50, unit: 'g' },
    })
    const result = findStandoutDeal([group], [good, ok])
    expect(result!.product.id).toBe(good.id)
  })

  it('breaks savings tie by lower absolute per-unit price', () => {
    const group = makeGroup('dishwasher salt', 1.0)
    const a = makeProduct({
      name: 'Sare A',
      source: 'dm',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.50, unit: 'g' },
    })
    const b = makeProduct({
      name: 'Sare B',
      source: 'realfoods',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.50, unit: 'g' },
    })
    const result = findStandoutDeal([group], [a, b])
    expect(result).toBeDefined()
    expect([a.id, b.id]).toContain(result!.product.id)
  })

  it('compares against cheapest group when multiple same-kind groups exist', () => {
    const expensive = makeGroup('dishwasher salt', 2.0)
    expensive.id = 'g-expensive'
    const cheap = makeGroup('dishwasher salt', 0.90)
    cheap.id = 'g-cheap'
    const candidate = makeProduct({
      name: 'Sare 2kg',
      source: 'dm',
      attributes: { organic: false, kind: 'dishwasher salt' },
      pricePerUnit: { value: 0.70, unit: 'g' },
    })
    // 0.70 vs 0.90 cheapest group → savings = 0.222 ≥ 0.20
    const result = findStandoutDeal([expensive, cheap], [candidate])
    expect(result).toBeDefined()
    expect(result!.beatenGroupBestPpu.value).toBe(0.90)
  })
})
