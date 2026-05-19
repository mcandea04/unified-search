import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { SearchResult, Product, ProductGroup } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 10

const reportBodySchema = z.object({
  note: z.string().max(2000).optional(),
  userAgent: z.string(),
  viewport: z.object({ w: z.number(), h: z.number() }),
  appVersion: z.string(),
  result: z.object({
    query: z.string(),
    groups: z.array(z.any()),
    ungrouped: z.array(z.any()),
    rawProducts: z.array(z.any()),
    totalProducts: z.number(),
    countBySource: z.record(z.string(), z.number()),
    sourceErrors: z.record(z.string(), z.string()).optional(),
    enrichmentError: z.string().optional(),
    timestamp: z.number(),
  }),
})

type ReportBody = z.infer<typeof reportBodySchema>

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function buildSummaryEmail(payload: ReportBody, issueUrl: string): { text: string; html: string } {
  const { note, result } = payload
  const sources = Object.entries(result.countBySource)
    .map(([s, n]) => `${s}: ${n}`)
    .join(', ')
  const noteShort = note?.trim() ? truncate(note.trim(), 200) : '(none)'

  const lines = [
    'New bug report filed.',
    '',
    `Query:    ${result.query}`,
    `Sources:  ${sources}`,
    `Note:     ${noteShort}`,
    '',
    `Issue:    ${issueUrl}`,
  ]
  const text = lines.join('\n')
  const html = `<html><body><pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-word">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</pre></body></html>`
  return { text, html }
}

function buildEmailBody(payload: ReportBody): { text: string; html: string } {
  const { note, userAgent, viewport, appVersion, result } = payload
  const ts = new Date(result.timestamp)

  const lines: string[] = []

  lines.push('=== HEADER ===')
  lines.push(`App version: ${appVersion}`)
  lines.push(`Timestamp:   ${ts.toISOString()} (${ts.toLocaleString('ro-RO')})`)
  lines.push(`User agent:  ${userAgent}`)
  lines.push(`Viewport:    ${viewport.w}x${viewport.h}`)
  lines.push('')

  lines.push('=== USER NOTE ===')
  lines.push(note?.trim() || '(none provided)')
  lines.push('')

  lines.push('=== QUERY ===')
  lines.push(`Query: ${result.query}`)
  lines.push(`Total products after filtering: ${result.totalProducts}`)
  const sourcesSummary = Object.entries(result.countBySource)
    .map(([s, n]) => `${s}: ${n}`)
    .join(', ')
  lines.push(`By source: ${sourcesSummary}`)
  lines.push('')

  if (result.enrichmentError || (result.sourceErrors && Object.keys(result.sourceErrors).length > 0)) {
    lines.push('=== ERRORS ===')
    if (result.enrichmentError) lines.push(`LLM enrichment: ${result.enrichmentError}`)
    if (result.sourceErrors) {
      for (const [src, err] of Object.entries(result.sourceErrors)) {
        lines.push(`Scraper ${src}: ${err}`)
      }
    }
    lines.push('')
  }

  lines.push('=== FINAL RESULT SHOWN TO USER ===')
  const groups = result.groups as ProductGroup[]
  if (groups.length === 0) {
    lines.push('(no groups — all results ungrouped)')
  } else {
    for (const g of groups) {
      lines.push(`Group: ${g.matchedName} (${g.products.length} sources, best price ${g.bestPrice} RON from ${g.bestPriceSource})`)
      for (const p of g.products) {
        lines.push(`  - [${p.source}] ${p.name} — ${p.price} RON`)
      }
    }
  }
  lines.push('')
  const ungrouped = result.ungrouped as Product[]
  lines.push(`Ungrouped: ${ungrouped.length} products`)
  const first20 = ungrouped.slice(0, 20)
  for (const p of first20) {
    lines.push(`  - [${p.source}] ${p.name} — ${p.price} RON`)
  }
  if (ungrouped.length > 20) lines.push(`  ... and ${ungrouped.length - 20} more`)
  lines.push('')

  lines.push('=== LLM ENRICHMENT (per enriched product) ===')
  const allGroupedProducts = groups.flatMap(g => g.products) as Product[]
  const enrichedProducts = [...allGroupedProducts, ...ungrouped]
  lines.push('name | brand | kind | organic | packGrams | packMl | count | variant')
  for (const p of enrichedProducts) {
    const a = p.attributes
    const pack = a.pack ? (a.pack.unit === 'g' ? a.pack.value : null) : null
    const packMl = a.pack ? (a.pack.unit === 'ml' ? a.pack.value : null) : null
    lines.push(
      `${truncate(p.name, 50)} | ${a.brand ?? ''} | ${a.kind ?? ''} | ${a.organic ? 'yes' : ''} | ${pack ?? ''} | ${packMl ?? ''} | ${a.count ?? ''} | ${a.variant ?? ''}`
    )
  }
  lines.push('')

  lines.push('=== FULL JSON DUMP ===')
  lines.push(JSON.stringify(result, null, 2))

  const text = lines.join('\n')
  const html = `<html><body><pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-word">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`

  return { text, html }
}

export async function POST(request: NextRequest) {
  let body: ReportBody
  try {
    const raw = await request.json()
    body = reportBodySchema.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid report payload.' }, { status: 400 })
  }

  const query = truncate(body.result.query, 80)
  const subject = `[unified-search] Bug report: "${query}"`
  const resendApiKey = process.env.RESEND_API_KEY
  const emailTo = process.env.REPORT_EMAIL_TO

  let fullBody: { text: string; html: string }
  try {
    fullBody = buildEmailBody(body)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid report payload.' }, { status: 400 })
  }

  const issueRes = await createGitHubIssue(query, fullBody.text)
  if (!issueRes.ok) {
    console.error('GitHub issue creation failed:', issueRes.error)
  }

  if (!resendApiKey || !emailTo) {
    const fallbackTo = process.env.REPORT_FALLBACK_EMAIL_TO || 'support@example.com'
    const mailto = `mailto:${fallbackTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody.text)}`
    return NextResponse.json({ ok: true, fallback: 'mailto', mailto })
  }

  const { text: emailText, html: emailHtml } = issueRes.ok
    ? buildSummaryEmail(body, issueRes.url)
    : {
        text: `⚠ GitHub issue could not be filed — full payload below.\n\n${fullBody.text}`,
        html: fullBody.html.replace('<pre', '<p style="color:#b45309">⚠ GitHub issue could not be filed — full payload below.</p><pre'),
      }

  const emailFrom = process.env.REPORT_EMAIL_FROM || 'onboarding@resend.dev'

  // Send via Resend HTTP API — no SDK needed, keeps dependencies unchanged.
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: emailFrom, to: [emailTo], subject, text: emailText, html: emailHtml }),
  })

  if (!resendRes.ok) {
    const detail = await resendRes.text().catch(() => '')
    console.error('Resend API error:', detail)
    return NextResponse.json(
      { ok: false, error: 'Could not send report. Try again later.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, ...(issueRes.ok ? { issueUrl: issueRes.url } : {}) })
}

async function createGitHubIssue(
  query: string,
  text: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER || 'mcandea04'
  const repo = process.env.GITHUB_REPO || 'unified-search'
  if (!token) return { ok: false, error: 'GITHUB_TOKEN not configured' }

  const body = [
    text,
    '',
    '---',
    '_Filed automatically by the in-app "Report a problem" button._',
  ].join('\n')

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Search bug: "${query}"`,
      body,
      labels: ['bug', 'user-report'],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { ok: false, error: `GitHub API ${res.status}: ${detail}` }
  }
  const json = (await res.json()) as { html_url: string }
  return { ok: true, url: json.html_url }
}
