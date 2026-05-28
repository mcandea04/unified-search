import type { PerUnitPrice, ProductAttributes } from '../types'

export function computePerUnitPrice(price: number, attrs: ProductAttributes): PerUnitPrice | undefined {
  if (attrs.pack && attrs.pack.value > 0) {
    const totalPackValue = attrs.pack.value * (attrs.count && attrs.count > 1 ? attrs.count : 1)
    return { value: price / (totalPackValue / 100), unit: attrs.pack.unit }
  }
  if (typeof attrs.count === 'number' && attrs.count > 0) {
    return { value: price / attrs.count, unit: 'piece' }
  }
  return undefined
}
