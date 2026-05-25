import { describe, it, expect } from 'vitest'
import { calculateRelevance, filterAndSortByRelevance } from '../relevance'
import type { Product } from '../../types'

function makeProduct(overrides: Partial<Product> & { name: string }): Product {
  return {
    id: 'test-1',
    price: 100,
    currency: 'RON',
    imageUrl: '',
    productUrl: '',
    source: 'dm',
    ...overrides,
    attributes: { organic: false, ...overrides.attributes },
  }
}

const RIEMANN_P20_QUERY = 'p20 spf50'

describe('calculateRelevance', () => {
  describe('SPF token normalization', () => {
    it('matches "SPF50" and "SPF 50+" as the same token against query "spf50"', () => {
      const withSpace = makeProduct({ name: 'Cremă cu SPF 50+ față' })
      const withoutSpace = makeProduct({ name: 'Cremă cu SPF50+ față' })
      expect(calculateRelevance(withSpace, 'spf50')).toBe(calculateRelevance(withoutSpace, 'spf50'))
    })

    it('dm "Urban Shield SPF 50+" scores >= 30 against query "p20 spf50"', () => {
      const product = makeProduct({
        name: 'Cremă de față cu protecție solară SPF 50+ Urban Shield, 50 ml',
        brand: 'RIEMANN P20',
        productUrl: 'https://www.dm.ro/p/d/2633835/riemann-p20-crema-de-fata-cu-protectie-solara-spf-50-urban-shield',
      })
      expect(calculateRelevance(product, RIEMANN_P20_QUERY)).toBeGreaterThanOrEqual(30)
    })
  })

  describe('URL slug fallback for brand discovery', () => {
    it('bebetei product with "riemann-p20" in URL but missing brand/name tokens scores >= 30', () => {
      const product = makeProduct({
        name: 'Crema pentru copii cu protectie solara SPF50+, 100 ml',
        source: 'bebetei',
        productUrl: 'https://comenzi.bebetei.ro/ingrijire-personala/ingrijire-corp/protectie-solara/crema-pentru-copii-cu-protectie-solara-spf50-100-ml-riemann-p20-p384741',
      })
      expect(calculateRelevance(product, RIEMANN_P20_QUERY)).toBeGreaterThanOrEqual(30)
    })
  })

  describe('enriched attributes brand fallback', () => {
    it('uses attributes.brand when top-level brand is missing', () => {
      const product = makeProduct({
        name: 'Crema copii SPF50+',
        attributes: { organic: false, brand: 'P20', kind: 'sunscreen' },
      })
      expect(calculateRelevance(product, RIEMANN_P20_QUERY)).toBeGreaterThanOrEqual(30)
    })
  })

  describe('no regression for unrelated products', () => {
    it('unrelated product scores below 30', () => {
      const product = makeProduct({
        name: 'Șampon par normal 400ml',
        brand: 'Pantene',
        productUrl: 'https://example.com/sampon-pantene',
        attributes: { organic: false, kind: 'shampoo' },
      })
      expect(calculateRelevance(product, RIEMANN_P20_QUERY)).toBeLessThan(30)
    })
  })
})

describe('filterAndSortByRelevance', () => {
  it('keeps all 6 Riemann P20 products from the bug report', () => {
    const products: Product[] = [
      makeProduct({
        id: 'bebetei-r0',
        name: 'Crema pentru copii cu protectie solara SPF50+, 100 ml',
        source: 'bebetei',
        productUrl: 'https://comenzi.bebetei.ro/ingrijire-personala/ingrijire-corp/protectie-solara/crema-pentru-copii-cu-protectie-solara-spf50-100-ml-riemann-p20-p384741',
      }),
      makeProduct({
        id: 'bebetei-r1',
        name: 'Crema pentru copii cu protectie solara SPF50+, 200 ml',
        source: 'bebetei',
        productUrl: 'https://comenzi.bebetei.ro/ingrijire-personala/ingrijire-corp/protectie-solara/crema-pentru-copii-cu-protectie-solara-spf50-200-ml-riemann-p20-p384740',
      }),
      makeProduct({
        id: 'trendyol-1',
        name: 'Riemann Spray transparent de protecție solară P20 Sun Protection SPF50 Original, 85 ml',
        brand: 'Riemann',
        source: 'trendyol',
        productUrl: 'https://www.trendyol.com/ro/riemann/spray-transparent-de-protectie-solara-p20-sun-protection-spf50-original-85-ml-p-991358911',
      }),
      makeProduct({
        id: 'dm-sensitive',
        name: 'Cremă senzitivă pentru față cu SPF50+, 50 ml',
        brand: 'RIEMANN P20',
        productUrl: 'https://www.dm.ro/p/d/2630455/riemann-p20-crema-senzitiva-pentru-fata-cu-spf50',
      }),
      makeProduct({
        id: 'dm-urban',
        name: 'Cremă de față cu protecție solară SPF 50+ Urban Shield, 50 ml',
        brand: 'RIEMANN P20',
        productUrl: 'https://www.dm.ro/p/d/2633835/riemann-p20-crema-de-fata-cu-protectie-solara-spf-50-urban-shield',
      }),
      makeProduct({
        id: 'dm-hyper',
        name: 'Cremă de față cu protecție solară SPF 50+ Hyperpigmentation Defence, 50 ml',
        brand: 'RIEMANN P20',
        productUrl: 'https://www.dm.ro/p/d/2633836/riemann-p20-crema-de-fata-cu-protectie-solara-spf-50-hyperpigmentation-defence',
      }),
    ]

    const result = filterAndSortByRelevance(products, RIEMANN_P20_QUERY, 30)
    expect(result).toHaveLength(6)
  })
})
