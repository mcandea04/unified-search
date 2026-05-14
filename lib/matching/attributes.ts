import type { Product, ProductAttributes } from '../types'

const STOPWORDS = new Set(['de', 'pentru', 'cu', 'din', 'la', 'si', '&', '-'])

const PACK_RE = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i
const COUNT_RE = /(\d{1,4})\s*(buc|bucati|capsule|servetele|tablete|pieces|pcs|pads)\b/i
const ORGANIC_RE = /\b(bio|ecologic[a]?|eco|organic|raw|natural)\b/i
const NR_SIZE_RE = /\bnr\.(\d{1,2})\b/i

const SIZE_CONTEXT = new Set(['nr', 'no', 'numar', 'marime', 'marimea', 'size', 'stage', 'etapa'])
const AGE_RANGE_TOKENS = new Set(['luni', 'luna', 'months', 'month'])

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+,.\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface PackMatch {
  value: number
  unit: 'g' | 'ml'
  original: string
  start: number
  end: number
}

function findPack(normalized: string): PackMatch | null {
  const m = PACK_RE.exec(normalized)
  if (!m) return null
  const start = m.index
  const end = start + m[0].length
  const before = normalized.slice(Math.max(0, start - 5), start)
  const after = normalized.slice(end, end + 5)
  if (/\d+\s*-\s*$/.test(before)) return null
  if (/^\s*-\s*\d/.test(after)) return null
  const next = normalized.slice(end).trim().split(' ')[0] ?? ''
  if (AGE_RANGE_TOKENS.has(next)) return null
  const raw = m[1].replace(',', '.')
  const num = Number.parseFloat(raw)
  if (!Number.isFinite(num)) return null
  const unitRaw = m[2].toLowerCase()
  let unit: 'g' | 'ml'
  let value: number
  if (unitRaw === 'kg') {
    unit = 'g'
    value = Math.round(num * 1000)
  } else if (unitRaw === 'l') {
    unit = 'ml'
    value = Math.round(num * 1000)
  } else if (unitRaw === 'g') {
    unit = 'g'
    value = Math.round(num)
  } else {
    unit = 'ml'
    value = Math.round(num)
  }
  return { value, unit, original: m[0].trim().replace(/\s+/g, ''), start, end }
}

interface CountMatch {
  count: number
  start: number
  end: number
}

function findCount(normalized: string): CountMatch | null {
  const m = COUNT_RE.exec(normalized)
  if (!m) return null
  const num = Number.parseInt(m[1], 10)
  if (!Number.isFinite(num)) return null
  return { count: num, start: m.index, end: m.index + m[0].length }
}

interface DiaperMatch {
  size: string
  spans: Array<{ start: number; end: number }>
}

function findDiaperSize(normalized: string): DiaperMatch | null {
  const nrMatch = NR_SIZE_RE.exec(normalized)
  if (nrMatch) {
    return {
      size: nrMatch[1],
      spans: [{ start: nrMatch.index, end: nrMatch.index + nrMatch[0].length }],
    }
  }

  const tokens = normalized.split(' ')
  const positions: number[] = []
  let cursor = 0
  for (const t of tokens) {
    positions.push(cursor)
    cursor += t.length + 1
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const prev = tokens[i - 1] ?? ''
    const next = tokens[i + 1] ?? ''
    const plus = token.match(/^(\d{1,2})\+$/)
    if (plus) {
      const start = positions[i]
      return { size: `${plus[1]}+`, spans: [{ start, end: start + token.length }] }
    }
    if (!/^\d{1,2}$/.test(token)) continue
    const n = Number(token)
    if (n > 8) continue
    if (SIZE_CONTEXT.has(prev) || SIZE_CONTEXT.has(next)) {
      const start = positions[i]
      return { size: token, spans: [{ start, end: start + token.length }] }
    }
    if (n <= 6 && PACK_RE.test(next)) {
      const start = positions[i]
      return { size: token, spans: [{ start, end: start + token.length }] }
    }
  }
  return null
}

function removeRanges(s: string, ranges: Array<{ start: number; end: number }>): string {
  if (!ranges.length) return s
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const r of sorted) {
    out += s.slice(cursor, r.start)
    cursor = r.end
  }
  out += s.slice(cursor)
  return out.replace(/\s+/g, ' ').trim()
}

function inferBrand(
  working: string,
  jsonLdBrand: string | undefined,
  originalName: string,
): string | undefined {
  if (jsonLdBrand) {
    const norm = normalizeText(jsonLdBrand)
    const first = norm.split(' ').find((t) => t && !STOPWORDS.has(t) && !/^\d+$/.test(t))
    if (first) return first
  }

  const originalTokens = originalName.trim().split(/\s+/)
  for (let i = 1; i < originalTokens.length; i += 1) {
    const tok = originalTokens[i]
    if (!tok) continue
    const firstChar = tok[0]
    if (firstChar && firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
      const lower = normalizeText(tok)
      if (lower && !STOPWORDS.has(lower) && !/^\d+$/.test(lower)) {
        return lower
      }
    }
  }

  const tokens = working.split(' ')
  for (const t of tokens) {
    if (!t) continue
    if (STOPWORDS.has(t)) continue
    if (/^\d+$/.test(t)) continue
    return t
  }
  return undefined
}

function extractVariant(working: string, brand: string | undefined): string | undefined {
  const tokens = working
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t) && !/^\d+\+?$/.test(t) && t !== brand)
  if (!tokens.length) return undefined
  const sorted = [...tokens].sort().slice(0, 3)
  return sorted.join(' ')
}

export function extractAttributes(product: Product): ProductAttributes {
  const normalized = normalizeText(product.name)
  if (!normalized) return { organic: false }

  const consumed: Array<{ start: number; end: number }> = []

  const pack = findPack(normalized)
  if (pack) consumed.push({ start: pack.start, end: pack.end })

  const count = findCount(normalized)
  if (count) consumed.push({ start: count.start, end: count.end })

  const organicMatch = ORGANIC_RE.exec(normalized)
  const organic = Boolean(organicMatch)
  if (organicMatch) {
    consumed.push({ start: organicMatch.index, end: organicMatch.index + organicMatch[0].length })
  }

  const diaper = findDiaperSize(normalized)
  if (diaper) consumed.push(...diaper.spans)

  const working = removeRanges(normalized, consumed)
  const brand = inferBrand(working, product.brand, product.name)
  const variant = extractVariant(working, brand)

  const attrs: ProductAttributes = { organic }
  if (brand) attrs.brand = brand
  if (pack) attrs.pack = { value: pack.value, unit: pack.unit, original: pack.original }
  if (count) attrs.count = count.count
  if (diaper) attrs.diaperSize = diaper.size
  if (variant) attrs.variant = variant
  return attrs
}
