import type { Product, ProductGroup, StandoutDeal } from '../types'

const STANDOUT_THRESHOLD = 0.20

export function findStandoutDeal(
  groups: ProductGroup[],
  ungrouped: Product[],
): StandoutDeal | undefined {
  let best: StandoutDeal | undefined

  for (const product of ungrouped) {
    const ppu = product.pricePerUnit
    const kind = product.attributes.kind
    if (!ppu || !kind) continue

    const comparableGroup = groups
      .filter(g => g.attributes.kind === kind && g.bestPricePerUnit?.unit === ppu.unit)
      .reduce<ProductGroup | undefined>((cheapest, g) => {
        if (!cheapest) return g
        const cv = cheapest.bestPricePerUnit!.value
        const gv = g.bestPricePerUnit!.value
        return gv < cv ? g : cheapest
      }, undefined)

    if (!comparableGroup?.bestPricePerUnit) continue

    const savings = 1 - ppu.value / comparableGroup.bestPricePerUnit.value
    if (savings < STANDOUT_THRESHOLD) continue

    if (!best || savings > best.savingsPercent ||
        (savings === best.savingsPercent && ppu.value < best.product.pricePerUnit!.value)) {
      best = { product, beatenGroupBestPpu: comparableGroup.bestPricePerUnit, savingsPercent: savings }
    }
  }

  return best
}
