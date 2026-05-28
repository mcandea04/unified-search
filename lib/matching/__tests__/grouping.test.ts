import { describe, expect, it } from 'vitest'
import { groupProducts } from '../grouping'
import type { Product, SourceSite } from '../../types'

function makeProduct(
  overrides: Partial<Product> & { name: string; source: SourceSite },
): Product {
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

describe('groupProducts', () => {
  it('groups same kind + pack + organic across sources regardless of brand', () => {
    const products = [
      makeProduct({
        name: 'Seminte chia bio Driedfruits 200g',
        source: 'emag',
        price: 20,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: true, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Solaris chia bio 200g',
        source: 'bebetei',
        price: 22,
        attributes: { brand: 'Solaris', kind: 'chia seeds', organic: true, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'notino',
        price: 18,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
    ]
    const { groups, ungrouped } = groupProducts(products)
    const bio = groups.find((g) => g.attributes.organic)
    expect(bio?.products).toHaveLength(2)
    expect(ungrouped).toHaveLength(1)
    expect(ungrouped[0].source).toBe('notino')
  })

  it('keeps different pack sizes in separate groups', () => {
    const products = [
      makeProduct({
        name: 'Pampers Active Baby Nr.4 50 buc',
        source: 'emag',
        price: 60,
        attributes: { brand: 'Pampers', kind: 'diapers', organic: false, diaperSize: '4', count: 50 },
      }),
      makeProduct({
        name: 'Pampers Active Baby Nr.4 50 buc',
        source: 'bebetei',
        price: 65,
        attributes: { brand: 'Pampers', kind: 'diapers', organic: false, diaperSize: '4', count: 50 },
      }),
      makeProduct({
        name: 'Pampers Active Baby Nr.4 100 buc',
        source: 'emag',
        price: 110,
        attributes: { brand: 'Pampers', kind: 'diapers', organic: false, diaperSize: '4', count: 100 },
      }),
      makeProduct({
        name: 'Pampers Active Baby Nr.4 100 buc',
        source: 'bebetei',
        price: 120,
        attributes: { brand: 'Pampers', kind: 'diapers', organic: false, diaperSize: '4', count: 100 },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups).toHaveLength(2)
    const sizes = groups.map((g) => g.products[0].attributes.count).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(sizes).toEqual([50, 100])
  })

  it('separates organic from conventional', () => {
    const products = [
      makeProduct({
        name: 'Driedfruits chia bio 200g',
        source: 'emag',
        price: 25,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: true, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia bio 200g',
        source: 'bebetei',
        price: 27,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: true, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'emag',
        price: 18,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'bebetei',
        price: 20,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups).toHaveLength(2)
    const flags = groups.map((g) => g.attributes.organic).sort()
    expect(flags).toEqual([false, true])
  })

  it('does not match empty pack signature with sized pack', () => {
    const products = [
      makeProduct({
        name: 'Driedfruits chia',
        source: 'emag',
        price: 18,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'bebetei',
        price: 20,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
    ]
    const { groups, ungrouped } = groupProducts(products)
    expect(groups).toHaveLength(0)
    expect(ungrouped).toHaveLength(2)
  })

  it('leaves single-source product in ungrouped', () => {
    const products = [
      makeProduct({
        name: 'Lonely product 100g',
        source: 'emag',
        price: 5,
        attributes: { brand: 'Brand', kind: 'misc', organic: false, pack: { value: 100, unit: 'g', original: '100g' } },
      }),
    ]
    const { groups, ungrouped } = groupProducts(products)
    expect(groups).toHaveLength(0)
    expect(ungrouped).toHaveLength(1)
  })

  it('marks bestPrice and bestPriceSource on group', () => {
    const products = [
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'emag',
        price: 25,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'bebetei',
        price: 18,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups[0].bestPrice).toBe(18)
    expect(groups[0].bestPriceSource).toBe('bebetei')
  })

  it('upgrades confidence to high when 3+ sources', () => {
    const products = [
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'emag',
        price: 25,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'bebetei',
        price: 18,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'notino',
        price: 22,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups[0].matchConfidence).toBe('high')
  })

  it('sorts products in a group by per-unit price ascending', () => {
    const products = [
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'emag',
        price: 25,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
        pricePerUnit: { value: 12.5, unit: 'g' },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'bebetei',
        price: 18,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
        pricePerUnit: { value: 9.0, unit: 'g' },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'notino',
        price: 22,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
        pricePerUnit: { value: 11.0, unit: 'g' },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups[0].products.map((p) => p.source)).toEqual(['bebetei', 'notino', 'emag'])
  })

  it('breaks per-unit ties by price ascending', () => {
    const products = [
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'emag',
        price: 25,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
        pricePerUnit: { value: 10, unit: 'g' },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'bebetei',
        price: 20,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
        pricePerUnit: { value: 10, unit: 'g' },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups[0].products.map((p) => p.source)).toEqual(['bebetei', 'emag'])
  })

  it('falls back to price ascending when per-unit prices are absent', () => {
    const products = [
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'emag',
        price: 25,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'bebetei',
        price: 18,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
      makeProduct({
        name: 'Driedfruits chia 200g',
        source: 'notino',
        price: 22,
        attributes: { brand: 'Driedfruits', kind: 'chia seeds', organic: false, pack: { value: 200, unit: 'g', original: '200g' } },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups[0].products.map((p) => p.source)).toEqual(['bebetei', 'notino', 'emag'])
  })

  it('separates single-pack from multi-pack of same unit weight', () => {
    const products = [
      makeProduct({
        name: 'Finish Sare 1.5 kg',
        source: 'emag',
        price: 13,
        attributes: { brand: 'Finish', kind: 'dishwasher salt', organic: false, pack: { value: 1500, unit: 'g', original: '1500g' } },
      }),
      makeProduct({
        name: 'Finish Sare 1.5 kg',
        source: 'bebetei',
        price: 14,
        attributes: { brand: 'Finish', kind: 'dishwasher salt', organic: false, pack: { value: 1500, unit: 'g', original: '1500g' } },
      }),
      makeProduct({
        name: 'Finish Set 2x Sare 1.5 kg',
        source: 'emag',
        price: 23.5,
        attributes: { brand: 'Finish', kind: 'dishwasher salt', organic: false, pack: { value: 1500, unit: 'g', original: '1500g' }, count: 2 },
      }),
      makeProduct({
        name: 'Finish Set 2x Sare 1.5 kg',
        source: 'trendyol',
        price: 25,
        attributes: { brand: 'Finish', kind: 'dishwasher salt', organic: false, pack: { value: 1500, unit: 'g', original: '1500g' }, count: 2 },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups).toHaveLength(2)
    const counts = groups.map((g) => g.products[0].attributes.count ?? 1).sort((a, b) => a - b)
    expect(counts).toEqual([1, 2])
  })

  it('propagates kind to aggregated group attributes', () => {
    const products = [
      makeProduct({
        name: 'Finish Sare 1.5 kg',
        source: 'emag',
        price: 13,
        attributes: { brand: 'Finish', kind: 'dishwasher salt', organic: false, pack: { value: 1500, unit: 'g', original: '1500g' } },
      }),
      makeProduct({
        name: 'Somat Sare 1.5 kg',
        source: 'bebetei',
        price: 14,
        attributes: { brand: 'Somat', kind: 'dishwasher salt', organic: false, pack: { value: 1500, unit: 'g', original: '1500g' } },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups).toHaveLength(1)
    expect(groups[0].attributes.kind).toBe('dishwasher salt')
  })

  it('separates products with different kinds into different buckets', () => {
    const products = [
      makeProduct({
        name: 'Piper negru boabe 50g',
        source: 'emag',
        price: 8,
        attributes: { brand: 'Kamis', kind: 'whole peppercorn', organic: false, pack: { value: 50, unit: 'g', original: '50g' } },
      }),
      makeProduct({
        name: 'Piper negru boabe 50g',
        source: 'bebetei',
        price: 9,
        attributes: { brand: 'Kamis', kind: 'whole peppercorn', organic: false, pack: { value: 50, unit: 'g', original: '50g' } },
      }),
      makeProduct({
        name: 'Piper negru macinat 50g',
        source: 'emag',
        price: 7,
        attributes: { brand: 'Kamis', kind: 'ground pepper', organic: false, pack: { value: 50, unit: 'g', original: '50g' } },
      }),
      makeProduct({
        name: 'Piper negru macinat 50g',
        source: 'bebetei',
        price: 7,
        attributes: { brand: 'Kamis', kind: 'ground pepper', organic: false, pack: { value: 50, unit: 'g', original: '50g' } },
      }),
    ]
    const { groups } = groupProducts(products)
    expect(groups).toHaveLength(2)
    const kinds = groups.map((g) => g.products[0].attributes.kind).sort()
    expect(kinds).toEqual(['ground pepper', 'whole peppercorn'])
  })
})
