import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const VARIANTS: Array<{ name: string; url: string; headers: Record<string, string> }> = [
  {
    name: 'default-desktop',
    url: 'https://www.emag.ro/search/lego',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'accept-language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  },
  {
    name: 'mobile-safari',
    url: 'https://www.emag.ro/search/lego',
    headers: {
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      'accept-language': 'ro-RO,ro;q=0.9',
    },
  },
  {
    name: 'minimal-curl',
    url: 'https://www.emag.ro/search/lego',
    headers: { 'user-agent': 'curl/8.4.0' },
  },
  {
    name: 'm-emag',
    url: 'https://m.emag.ro/search/lego',
    headers: {
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    },
  },
  {
    name: 'googlebot',
    url: 'https://www.emag.ro/search/lego',
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  },
]

export async function GET(): Promise<NextResponse> {
  const results = await Promise.all(
    VARIANTS.map(async (v) => {
      try {
        const res = await fetch(v.url, { headers: v.headers, redirect: 'manual' })
        const text = res.status === 200 ? await res.text() : ''
        return {
          name: v.name,
          url: v.url,
          status: res.status,
          location: res.headers.get('location'),
          contentType: res.headers.get('content-type'),
          length: text.length,
          hasCards: /data-zone="card"/.test(text) || /data-product-id="\d+"/.test(text),
          headSnippet: text.slice(0, 200).replace(/\s+/g, ' '),
        }
      } catch (error) {
        return {
          name: v.name,
          url: v.url,
          error: error instanceof Error ? error.message : 'Unknown',
        }
      }
    }),
  )
  return NextResponse.json({ results })
}
