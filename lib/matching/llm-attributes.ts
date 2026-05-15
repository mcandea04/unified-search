import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'
import type { Product } from '../types'

const LLMAttributeSchema = z.object({
  id: z.string(),
  brand: z.string(),
  kind: z.string(),
  organic: z.boolean(),
  packGrams: z.number().nullable(),
  packMl: z.number().nullable(),
  count: z.number().nullable(),
  variant: z.string(),
})

const LLMResponseSchema = z.array(LLMAttributeSchema)

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      brand: { type: Type.STRING },
      kind: { type: Type.STRING },
      organic: { type: Type.BOOLEAN },
      packGrams: { type: Type.NUMBER, nullable: true },
      packMl: { type: Type.NUMBER, nullable: true },
      count: { type: Type.NUMBER, nullable: true },
      variant: { type: Type.STRING },
    },
    required: ['id', 'brand', 'kind', 'organic', 'packGrams', 'packMl', 'count', 'variant'],
  },
}

function buildPrompt(query: string, products: Product[]): string {
  const list = products.map((p) => JSON.stringify({ id: p.id, name: p.name })).join('\n')
  return `You are categorizing products from a Romanian price-comparison search.
Query: "${query}"

For each product return:
- id: same id as input
- brand: normalized canonical brand spelling (e.g. "Cotanyi" -> "Kotanyi"); empty string if unknown
- kind: short category in English (e.g. "chia seeds", "ground pepper", "diapers", "shampoo")
- organic: true if the name contains bio/organic/eco/ecologic
- packGrams: pack weight in grams as a number, or null
- packMl: pack volume in ml as a number, or null
- count: piece count (e.g. 50 for "50 buc"), or null
- variant: short distinguishing string (size/age/scent/stage), or empty string

Products:
${list}`
}

export async function enrichWithLLM(
  products: Product[],
  query: string,
): Promise<{ products: Product[]; error?: string }> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_API_KEY not set — skipping LLM enrichment')
    return { products, error: 'Categorization unavailable: GOOGLE_API_KEY not configured' }
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildPrompt(query, products),
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    })

    const raw = response.text
    if (!raw) {
      console.error('LLM enrichment: empty response text')
      return { products, error: 'Categorization temporarily unavailable' }
    }

    const parsed = LLMResponseSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.error('LLM enrichment: schema validation failed', parsed.error.message)
      return { products, error: 'Categorization temporarily unavailable' }
    }

    const attributeMap = new Map(parsed.data.map((a) => [a.id, a]))

    return {
      products: products.map((product) => {
        const attrs = attributeMap.get(product.id)
        if (!attrs) return product

        const pack =
          attrs.packGrams != null
            ? { value: attrs.packGrams, unit: 'g' as const, original: `${attrs.packGrams}g` }
            : attrs.packMl != null
              ? { value: attrs.packMl, unit: 'ml' as const, original: `${attrs.packMl}ml` }
              : undefined

        return {
          ...product,
          attributes: {
            ...product.attributes,
            brand: attrs.brand || undefined,
            kind: attrs.kind || undefined,
            organic: attrs.organic,
            pack,
            count: attrs.count ?? undefined,
            variant: attrs.variant || undefined,
          },
        }
      }),
    }
  } catch (err) {
    console.error('LLM enrichment error:', err)
    return { products, error: 'Categorization temporarily unavailable' }
  }
}
