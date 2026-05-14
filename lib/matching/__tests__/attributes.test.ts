import { describe, expect, it } from 'vitest'
import { extractAttributes } from '../attributes'
import type { Product } from '../../types'

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 't-1',
    name: '',
    price: 0,
    currency: 'RON',
    imageUrl: '',
    productUrl: '',
    source: 'emag',
    attributes: { organic: false },
    ...overrides,
  }
}

describe('extractAttributes', () => {
  it('extracts brand, organic, and pack from chia seeds', () => {
    const p = makeProduct({ name: 'Seminte de chia bio Driedfruits 200g' })
    expect(extractAttributes(p)).toMatchObject({
      brand: 'driedfruits',
      organic: true,
      pack: { value: 200, unit: 'g', original: '200g' },
    })
  })

  it('does not misread age range as pack on diapers', () => {
    const p = makeProduct({
      name: 'Pampers Premium Care Nr.5 11-16 kg 88 buc',
      brand: 'Pampers',
    })
    const attrs = extractAttributes(p)
    expect(attrs.brand).toBe('pampers')
    expect(attrs.diaperSize).toBe('5')
    expect(attrs.count).toBe(88)
    expect(attrs.pack).toBeUndefined()
  })

  it('extracts pack and stage on infant formula', () => {
    const p = makeProduct({ name: 'Aptamil 2 800g', brand: 'Aptamil' })
    expect(extractAttributes(p)).toMatchObject({
      brand: 'aptamil',
      diaperSize: '2',
      pack: { value: 800, unit: 'g', original: '800g' },
    })
  })

  it('extracts ml pack and organic flag on cosmetics', () => {
    const p = makeProduct({ name: 'Shampoo Loreal 250ml bio', brand: "L'Oreal" })
    const attrs = extractAttributes(p)
    expect(attrs.organic).toBe(true)
    expect(attrs.pack).toEqual({ value: 250, unit: 'ml', original: '250ml' })
  })

  it('parses comma-decimal litres to millilitres', () => {
    const p = makeProduct({ name: 'Lapte ecologic 1,5 l' })
    const attrs = extractAttributes(p)
    expect(attrs.pack?.value).toBe(1500)
    expect(attrs.pack?.unit).toBe('ml')
    expect(attrs.organic).toBe(true)
  })

  it('parses dot-decimal kilograms to grams', () => {
    const p = makeProduct({ name: 'Faina integrala 0.5 kg' })
    const attrs = extractAttributes(p)
    expect(attrs.pack?.value).toBe(500)
    expect(attrs.pack?.unit).toBe('g')
  })

  it('falls back to first non-stopword token when JSON-LD brand missing', () => {
    const p = makeProduct({ name: 'Driedfruits seminte chia 100g' })
    expect(extractAttributes(p).brand).toBe('driedfruits')
  })

  it('returns organic:false and otherwise empty when nothing matches', () => {
    const p = makeProduct({ name: 'de pentru cu' })
    expect(extractAttributes(p)).toEqual({ organic: false })
  })

  it('extracts plus-size diaper notation', () => {
    const p = makeProduct({ name: 'Pampers 5+ Junior 100 buc', brand: 'Pampers' })
    expect(extractAttributes(p).diaperSize).toBe('5+')
  })

  it('caps variant at 3 sorted tokens', () => {
    const p = makeProduct({ name: 'CeraVe foaming gel cleanser fragrance free 236ml' })
    const attrs = extractAttributes(p)
    expect(attrs.variant?.split(' ').length).toBeLessThanOrEqual(3)
    const tokens = attrs.variant?.split(' ') ?? []
    const sorted = [...tokens].sort()
    expect(tokens).toEqual(sorted)
  })
})
