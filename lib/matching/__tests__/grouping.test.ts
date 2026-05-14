import { describe, expect, it } from 'vitest'
import { groupProducts } from '../grouping'
import { extractAttributes } from '../attributes'
import type { Product, SourceSite } from '../../types'

function makeProduct(overrides: Partial<Product> & { name: string; source: SourceSite }): Product {
  const base: Product = {
    id: `${overrides.source}-${overrides.name}`,
    price: overrides.price ?? 10,
    currency: 'RON',
    imageUrl: '',
    productUrl: '',
    attributes: { organic: false },
    ...overrides,
  }
  base.attributes = extractAttributes(base)
  return base
}

describe('groupProducts', () => {
  it('groups same brand + pack + organic across sources', () => {
    const products = [
      makeProduct({ name: 'Seminte chia bio Driedfruits 200g', source: 'emag', price: 20 }),
      makeProduct({ name: 'Driedfruits chia bio 200g', source: 'bebetei', price: 22 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'notino', price: 18 }),
    ]
    const { groups, ungrouped } = groupProducts(products, 'seminte chia')
    const bio = groups.find((g) => g.attributes.organic)
    expect(bio?.products).toHaveLength(2)
    expect(ungrouped).toHaveLength(1)
    expect(ungrouped[0].source).toBe('notino')
  })

  it('keeps different pack sizes in separate groups', () => {
    const products = [
      makeProduct({ name: 'Pampers Active Baby Nr.4 50 buc', source: 'emag', price: 60 }),
      makeProduct({ name: 'Pampers Active Baby Nr.4 50 buc', source: 'bebetei', price: 65 }),
      makeProduct({ name: 'Pampers Active Baby Nr.4 100 buc', source: 'emag', price: 110 }),
      makeProduct({ name: 'Pampers Active Baby Nr.4 100 buc', source: 'bebetei', price: 120 }),
    ]
    const { groups } = groupProducts(products, 'pampers 4')
    expect(groups).toHaveLength(2)
    const sizes = groups.map((g) => g.products[0].attributes.count).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(sizes).toEqual([50, 100])
  })

  it('separates organic from conventional', () => {
    const products = [
      makeProduct({ name: 'Driedfruits chia bio 200g', source: 'emag', price: 25 }),
      makeProduct({ name: 'Driedfruits chia bio 200g', source: 'bebetei', price: 27 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'emag', price: 18 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'bebetei', price: 20 }),
    ]
    const { groups } = groupProducts(products, 'chia')
    expect(groups).toHaveLength(2)
    const flags = groups.map((g) => g.attributes.organic).sort()
    expect(flags).toEqual([false, true])
  })

  it('does not match empty pack signature with sized pack', () => {
    const products = [
      makeProduct({ name: 'Driedfruits chia', source: 'emag', price: 18 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'bebetei', price: 20 }),
    ]
    const { groups, ungrouped } = groupProducts(products, 'chia')
    expect(groups).toHaveLength(0)
    expect(ungrouped).toHaveLength(2)
  })

  it('leaves single-source product in ungrouped', () => {
    const products = [
      makeProduct({ name: 'Lonely product 100g', source: 'emag', price: 5 }),
    ]
    const { groups, ungrouped } = groupProducts(products, 'lonely')
    expect(groups).toHaveLength(0)
    expect(ungrouped).toHaveLength(1)
  })

  it('marks bestPrice and bestPriceSource on group', () => {
    const products = [
      makeProduct({ name: 'Driedfruits chia 200g', source: 'emag', price: 25 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'bebetei', price: 18 }),
    ]
    const { groups } = groupProducts(products, 'chia')
    expect(groups[0].bestPrice).toBe(18)
    expect(groups[0].bestPriceSource).toBe('bebetei')
  })

  it('upgrades confidence to high when 3+ sources', () => {
    const products = [
      makeProduct({ name: 'Driedfruits chia 200g', source: 'emag', price: 25 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'bebetei', price: 18 }),
      makeProduct({ name: 'Driedfruits chia 200g', source: 'notino', price: 22 }),
    ]
    const { groups } = groupProducts(products, 'chia')
    expect(groups[0].matchConfidence).toBe('high')
  })
})
