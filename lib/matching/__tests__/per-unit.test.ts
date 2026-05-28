import { describe, expect, it } from 'vitest'
import { computePerUnitPrice } from '../per-unit'
import type { ProductAttributes } from '../../types'

const pack200g: ProductAttributes['pack'] = { value: 200, unit: 'g', original: '200g' }
const pack1500g: ProductAttributes['pack'] = { value: 1500, unit: 'g', original: '1500g' }
const pack500ml: ProductAttributes['pack'] = { value: 500, unit: 'ml', original: '500ml' }

describe('computePerUnitPrice', () => {
  it('returns per-100g when only pack present', () => {
    const result = computePerUnitPrice(20, { organic: false, pack: pack200g })
    expect(result).toEqual({ value: 10, unit: 'g' })
  })

  it('returns per-piece when only count present', () => {
    const result = computePerUnitPrice(60, { organic: false, count: 30 })
    expect(result).toEqual({ value: 2, unit: 'piece' })
  })

  it('returns per-100g of single pack when count is 1', () => {
    const result = computePerUnitPrice(20, { organic: false, pack: pack200g, count: 1 })
    expect(result).toEqual({ value: 10, unit: 'g' })
  })

  it('divides by total weight when pack + count > 1 (regression #43)', () => {
    // 2x1500g pack at 23.5 RON → total 3000g → 23.5 / 30 ≈ 0.7833 RON/100g
    const result = computePerUnitPrice(23.5, { organic: false, pack: pack1500g, count: 2 })
    expect(result?.unit).toBe('g')
    expect(result?.value).toBeCloseTo(23.5 / 30, 5)
  })

  it('handles ml packs correctly with multi-count', () => {
    // 2x500ml at 30 RON → total 1000ml → 30 / 10 = 3 RON/100ml
    const result = computePerUnitPrice(30, { organic: false, pack: pack500ml, count: 2 })
    expect(result).toEqual({ value: 3, unit: 'ml' })
  })

  it('returns undefined when neither pack nor count present', () => {
    const result = computePerUnitPrice(10, { organic: false })
    expect(result).toBeUndefined()
  })
})
