import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Product } from '../../types'
import fixture from './fixtures/gemini-response.json'

const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return { models: { generateContent: mockGenerateContent } }
  }),
  Type: {
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
    NULL: 'NULL',
  },
}))

import { enrichWithLLM } from '../llm-attributes'

function makeProduct(id: string, name: string): Product {
  return {
    id,
    name,
    price: 20,
    currency: 'RON',
    imageUrl: '',
    productUrl: '',
    source: 'emag',
    attributes: { organic: false },
  }
}

const FIXTURE_PRODUCTS = [
  makeProduct('emag-driedfruits-chia-200g', 'Seminte chia Driedfruits 200g'),
  makeProduct('bebetei-driedfruits-chia-bio-200g', 'Driedfruits chia bio 200g'),
  makeProduct('notino-solaris-chia-500g', 'Solaris seminte chia 500g'),
]

const OLD_ENV = process.env

beforeEach(() => {
  process.env = { ...OLD_ENV, GOOGLE_API_KEY: 'test-key' }
  mockGenerateContent.mockReset()
})

afterEach(() => {
  process.env = OLD_ENV
})

describe('enrichWithLLM', () => {
  it('maps LLM attributes onto matching products', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(fixture) })

    const { products, error } = await enrichWithLLM(FIXTURE_PRODUCTS, 'seminte chia')

    expect(error).toBeUndefined()
    const driedfruits = products.find((p) => p.id === 'emag-driedfruits-chia-200g')
    expect(driedfruits?.attributes.brand).toBe('Driedfruits')
    expect(driedfruits?.attributes.kind).toBe('chia seeds')
    expect(driedfruits?.attributes.organic).toBe(false)
    expect(driedfruits?.attributes.pack).toEqual({ value: 200, unit: 'g', original: '200g' })

    const bio = products.find((p) => p.id === 'bebetei-driedfruits-chia-bio-200g')
    expect(bio?.attributes.organic).toBe(true)

    const solaris = products.find((p) => p.id === 'notino-solaris-chia-500g')
    expect(solaris?.attributes.brand).toBe('Solaris')
    expect(solaris?.attributes.pack).toEqual({ value: 500, unit: 'g', original: '500g' })
  })

  it('returns products unchanged when a product id is missing from the LLM response', async () => {
    const partial = fixture.slice(0, 2)
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(partial) })

    const { products, error } = await enrichWithLLM(FIXTURE_PRODUCTS, 'seminte chia')

    expect(error).toBeUndefined()
    const solaris = products.find((p) => p.id === 'notino-solaris-chia-500g')
    expect(solaris?.attributes).toEqual({ organic: false })
  })

  it('returns products unchanged and sets error on schema validation failure', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify([{ bad: 'schema' }]) })

    const { products, error } = await enrichWithLLM(FIXTURE_PRODUCTS, 'seminte chia')

    expect(error).toBeDefined()
    expect(products[0].attributes).toEqual({ organic: false })
  })

  it('returns products unchanged and sets error on API error', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('quota exceeded'))

    const { products, error } = await enrichWithLLM(FIXTURE_PRODUCTS, 'seminte chia')

    expect(error).toBeDefined()
    expect(products).toHaveLength(3)
    expect(products[0].attributes).toEqual({ organic: false })
  })

  it('returns products unchanged and sets error when GOOGLE_API_KEY is missing', async () => {
    delete process.env.GOOGLE_API_KEY

    const { products, error } = await enrichWithLLM(FIXTURE_PRODUCTS, 'seminte chia')

    expect(error).toBeDefined()
    expect(products[0].attributes).toEqual({ organic: false })
  })
})
