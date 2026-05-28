'use client'

import { useEffect, useRef, useState } from 'react'
import { SOURCE_SITES } from '@/lib/types'
import type { ProductGroup, Product, PerUnitPrice, SearchResult, SourceSite, StandoutDeal } from '@/lib/types'

function formatPerUnit(ppu: PerUnitPrice | undefined): string | null {
  if (!ppu) return null
  const v = ppu.value.toFixed(2)
  if (ppu.unit === 'piece') return `${v} RON / buc`
  return `${v} RON / 100${ppu.unit}`
}

function packLabel(product: Product): string {
  const { pack, count } = product.attributes
  if (pack) return count && count > 1 ? `${count} x ${pack.original}` : pack.original
  if (typeof count === 'number') return `${count} buc`
  return ''
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [ungrouped, setUngrouped] = useState<Product[]>([])
  const [rawProducts, setRawProducts] = useState<Product[]>([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [countBySource, setCountBySource] = useState<Record<SourceSite, number>>(
    () => Object.fromEntries(SOURCE_SITES.map((s) => [s, 0])) as Record<SourceSite, number>
  )
  const [sourceErrors, setSourceErrors] = useState<Partial<Record<SourceSite, string>> | undefined>()
  const [searchTimestamp, setSearchTimestamp] = useState<number>(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [enrichmentError, setEnrichmentError] = useState<string | undefined>()
  const [standoutDeal, setStandoutDeal] = useState<StandoutDeal | undefined>()

  const [reportOpen, setReportOpen] = useState(false)
  const [reportNote, setReportNote] = useState('')
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [reportError, setReportError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (reportOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [reportOpen])

  useEffect(() => {
    if (!reportOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeReport()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reportOpen])

  function openReport() {
    setReportNote('')
    setReportStatus('idle')
    setReportError(null)
    setReportOpen(true)
  }

  function closeReport() {
    if (reportStatus === 'sending') return
    setReportOpen(false)
  }

  async function submitReport() {
    setReportStatus('sending')
    setReportError(null)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          note: reportNote,
          userAgent: navigator.userAgent,
          viewport: { w: window.innerWidth, h: window.innerHeight },
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'dev',
          result: {
            query,
            groups,
            ungrouped,
            rawProducts,
            totalProducts,
            countBySource,
            sourceErrors,
            enrichmentError,
            timestamp: searchTimestamp,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setReportStatus('error')
        setReportError(data.error || 'Something went wrong. Try again.')
        return
      }
      setReportStatus('sent')
      setTimeout(() => setReportOpen(false), 3000)
    } catch {
      setReportStatus('error')
      setReportError('Could not reach the server. Try again.')
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setHasSearched(true)
    setEnrichmentError(undefined)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data: SearchResult = await response.json()
      setGroups(data.groups || [])
      setUngrouped(data.ungrouped || [])
      setRawProducts(data.rawProducts || [])
      setTotalProducts(data.totalProducts || 0)
      setCountBySource(data.countBySource || Object.fromEntries(SOURCE_SITES.map((s) => [s, 0])) as Record<SourceSite, number>)
      setSourceErrors(data.sourceErrors)
      setSearchTimestamp(data.timestamp || Date.now())
      setEnrichmentError(data.enrichmentError)
      setStandoutDeal(data.standoutDeal)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  function clearSearch() {
    setQuery('')
    setGroups([])
    setUngrouped([])
    setRawProducts([])
    setTotalProducts(0)
    setSourceErrors(undefined)
    setSearchTimestamp(0)
    setHasSearched(false)
    setEnrichmentError(undefined)
    setStandoutDeal(undefined)
  }

  return (
    <main className="min-h-screen relative">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-12 relative z-10">
        {/* Header */}
        <div className="text-left sm:text-center mb-8 sm:mb-14 fade-in-up max-w-3xl mx-auto">
          <div className="editorial-meta mb-3 sm:mb-4 flex items-center gap-2 justify-start sm:justify-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true"></span>
            <span>Vol 1 · Live price intel · eMAG / BebeTei / Notino / Trendyol / DM / Real Foods / Sezamo</span>
          </div>
          <h1
            className="editorial-display text-text mb-3 sm:mb-4"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4.75rem)' }}
          >
            Unified Search
          </h1>
          <p className="text-text-muted text-base sm:text-lg max-w-xl mx-auto">
            Live price intelligence across {SOURCE_SITES.length} marketplaces, ranked by per-unit value.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-10 sm:mb-14 fade-in-up delay-1">
          <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search…"
                className="w-full bg-transparent border-0 border-b-2 border-text px-1 py-3 pr-8 text-2xl sm:text-3xl font-display italic text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                style={{ fontFamily: 'var(--font-display)' }}
              />
              {query.length > 0 && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-1 text-text-muted hover:text-text transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              aria-label={loading ? 'Searching for products' : 'Search for products'}
              className="px-6 py-3 sm:py-4 text-sm font-mono uppercase tracking-[0.1em] bg-accent text-accent-ink hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2" aria-hidden="true">
                  <span className="w-4 h-4 border-2 border-accent-ink/30 border-t-accent-ink rounded-full animate-spin" />
                  <span>Searching…</span>
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-10 sm:py-16">
            <div className="inline-flex flex-col items-center gap-5">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 border-2 border-rule rounded-full"></div>
                <div className="absolute inset-0 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="space-y-1">
                <p className="editorial-meta">Scanning marketplaces…</p>
                <p className="text-text-muted text-sm">Analyzing prices across all sources</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && hasSearched && (groups.length > 0 || ungrouped.length > 0 || standoutDeal) && (
          <div className="max-w-7xl mx-auto">
            {/* Enrichment error banner */}
            {enrichmentError && (
              <div className="mb-4 px-4 py-3 border border-accent bg-bg-elev text-text text-sm rounded-md">
                <span className="font-mono uppercase tracking-[0.1em] text-accent text-xs mr-2">Notice</span>
                {enrichmentError} — showing raw results without grouping.
              </div>
            )}

            {/* Stats Bar */}
            <div className="border border-rule bg-bg-elev p-4 sm:p-5 mb-5 sm:mb-8 fade-in-up delay-2 rounded-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="editorial-meta">Found</span>
                  <span className="price-display text-accent text-2xl">{totalProducts}</span>
                  <span className="editorial-meta">products</span>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="text-text-muted text-sm">
                    Query: <span className="text-text font-medium">{query}</span>
                  </span>
                  <button
                    onClick={openReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-rule hover:border-accent hover:text-accent transition-colors text-text-muted text-xs font-mono uppercase tracking-[0.1em] rounded-sm"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    Report
                  </button>
                </div>
              </div>
            </div>

            {/* Best Value Hero */}
            {standoutDeal && (
              <div className="border-2 border-accent bg-bg-elev rounded-md p-5 sm:p-7 mb-5 sm:mb-8 fade-in-up delay-2">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span className="font-mono uppercase tracking-[0.1em] text-accent text-xs font-bold">Best value</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  {standoutDeal.product.imageUrl && (
                    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center overflow-hidden rounded bg-white">
                      <img src={standoutDeal.product.imageUrl} alt={standoutDeal.product.name} className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <a
                      href={standoutDeal.product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-display italic text-text hover:text-accent underline decoration-rule hover:decoration-accent transition-colors leading-tight block mb-1"
                      style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: 900 }}
                    >
                      {standoutDeal.product.name}
                    </a>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-text-muted text-sm font-mono uppercase tracking-[0.05em]">{standoutDeal.product.source}</span>
                      <span className="price-display text-lg text-accent">{standoutDeal.product.price} <span className="text-text-muted text-xs font-mono">RON</span></span>
                      {standoutDeal.product.pricePerUnit && (
                        <span className="text-text-muted text-xs font-mono">{formatPerUnit(standoutDeal.product.pricePerUnit)}</span>
                      )}
                    </div>
                    <p className="text-text-muted text-xs mt-1">
                      {Math.round(standoutDeal.savingsPercent * 100)}% cheaper per unit than the next best group ({formatPerUnit(standoutDeal.beatenGroupBestPpu)})
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grouped Products */}
            {groups.map((group, idx) => (
              <div
                key={`group-${idx}`}
                className="border border-rule bg-bg-elev rounded-md p-5 sm:p-7 mb-5 sm:mb-6 fade-in-up"
                style={{ animationDelay: `${0.24 + idx * 0.08}s` }}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between mb-4 sm:mb-5 gap-3 pb-4 border-b border-rule">
                  <h3
                    className="font-display italic text-text flex-1 leading-tight"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 900 }}
                  >
                    {group.matchedName}
                  </h3>
                  <span className="editorial-meta whitespace-nowrap pt-1">
                    {group.products.length} sources
                  </span>
                </div>

                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-1 py-2 editorial-meta">
                  <div className="col-span-1">Image</div>
                  <div className="col-span-6">Product</div>
                  <div className="col-span-3">Merchant</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {/* Table Rows */}
                <div>
                  {group.products.map((product, pIdx) => {
                    const isBestUnit =
                      product.pricePerUnit &&
                      group.bestPricePerUnit &&
                      product.pricePerUnit.value === group.bestPricePerUnit.value &&
                      product.pricePerUnit.unit === group.bestPricePerUnit.unit
                    const ppuText = formatPerUnit(product.pricePerUnit)
                    return (
                      <div
                        key={pIdx}
                        className="editorial-row flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-4 px-1 py-3 sm:items-center hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] transition-colors"
                      >
                        <div className="sm:col-span-1">
                          {product.imageUrl ? (
                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
                              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-bg rounded border border-rule"></div>
                          )}
                        </div>
                        <div className="sm:col-span-6">
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text hover:text-accent underline decoration-rule hover:decoration-accent text-sm font-medium transition-colors line-clamp-2"
                          >
                            {product.name || group.matchedName}
                          </a>
                          {product.attributes.organic && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] border border-accent text-accent rounded-sm">
                              bio
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-start w-full sm:contents">
                          <div className="sm:col-span-3">
                            <span className="text-text-muted text-sm font-mono uppercase tracking-[0.05em]">{product.source}</span>
                          </div>
                          <div className="sm:col-span-2 flex flex-col sm:items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="price-display text-lg text-accent">{product.price}</span>
                              <span className="text-text-muted text-xs font-mono">RON</span>
                            </div>
                            {ppuText && <div className="text-text-muted text-xs mt-0.5 font-mono">{ppuText}</div>}
                            <div className="flex gap-1 mt-1">
                              {product.price === group.bestPrice && (
                                <span className="px-2 py-0.5 bg-accent text-accent-ink rounded-sm text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap font-mono">
                                  Best
                                </span>
                              )}
                              {isBestUnit && product.price !== group.bestPrice && (
                                <span className="px-2 py-0.5 border border-accent text-accent rounded-sm text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap font-mono">
                                  Best/unit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Ungrouped Products */}
            {ungrouped.length > 0 && (
              <div className="border border-rule bg-bg-elev rounded-md p-5 sm:p-7 fade-in-up">
                <div className="flex items-center justify-between mb-4 sm:mb-5 pb-4 border-b border-rule">
                  <h3
                    className="font-display italic text-text-muted"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 900 }}
                  >
                    Other results
                  </h3>
                  <span className="editorial-meta">{ungrouped.length} products</span>
                </div>
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-1 py-2 editorial-meta">
                  <div className="col-span-1">Image</div>
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2">Pack</div>
                  <div className="col-span-2">Merchant</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {/* Table Rows */}
                <div>
                  {ungrouped.map((product, idx) => {
                    const packText = packLabel(product)
                    return (
                      <div
                        key={`ungrouped-${idx}`}
                        className="editorial-row flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-4 px-1 py-3 sm:items-center hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] transition-colors"
                      >
                        <div className="sm:col-span-1">
                          {product.imageUrl ? (
                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
                              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-bg rounded border border-rule"></div>
                          )}
                        </div>
                        <div className="sm:col-span-5">
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text hover:text-accent underline decoration-rule hover:decoration-accent text-sm font-medium transition-colors line-clamp-2"
                          >
                            {product.name}
                          </a>
                          {product.attributes.organic && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] border border-accent text-accent rounded-sm">
                              bio
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-between items-start gap-x-3 gap-y-1 w-full sm:contents">
                          {packText && <div className="sm:col-span-2 text-text text-sm">{packText}</div>}
                          <div className="sm:col-span-2">
                            <span className="text-text-muted text-sm font-mono uppercase tracking-[0.05em]">{product.source}</span>
                          </div>
                          <div className="sm:col-span-2 flex flex-col sm:items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="price-display text-lg text-accent">{product.price}</span>
                              <span className="text-text-muted text-xs font-mono">RON</span>
                            </div>
                            {formatPerUnit(product.pricePerUnit) && (
                              <div className="text-text-muted text-xs mt-0.5 font-mono">{formatPerUnit(product.pricePerUnit)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {!loading && hasSearched && totalProducts === 0 && (
          <div className="text-center py-10 sm:py-16 fade-in-up">
            <div className="border border-rule bg-bg-elev p-8 sm:p-10 max-w-md mx-auto rounded-md">
              <p className="editorial-meta mb-2">No matches</p>
              <p className="text-text text-xl sm:text-2xl mb-2 font-display italic" style={{ fontFamily: 'var(--font-display)' }}>
                Nothing found.
              </p>
              <p className="text-text-muted text-sm">
                Try searching for &quot;{query}&quot; with different keywords.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeReport() }}
        >
          <div
            className="border border-rule bg-bg-elev rounded-md p-6 sm:p-8 w-full max-w-lg"
            style={{ boxShadow: '0 20px 50px -12px rgba(0,0,0,0.35)' }}
          >
            {reportStatus === 'sent' ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-accent flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p
                  className="font-display italic text-text"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900 }}
                >
                  Thanks!
                </p>
                <p className="text-sm text-text-muted mt-1">Report sent. I&apos;ll take a look.</p>
              </div>
            ) : (
              <>
                <h2
                  className="font-display italic text-text mb-2"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900 }}
                >
                  Report a problem
                </h2>
                <p className="text-sm text-text-muted mb-4">
                  Tell me what&apos;s wrong (optional). The current search and results will be attached automatically.
                </p>
                <textarea
                  ref={textareaRef}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="ex: shows me Pampers when I searched Huggies"
                  className="w-full px-3 py-2 bg-transparent border border-rule rounded-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted text-sm resize-none transition-colors"
                />
                {reportError && (
                  <p className="mt-2 text-sm text-accent">{reportError}</p>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={closeReport}
                    disabled={reportStatus === 'sending'}
                    className="px-4 py-2 text-text-muted hover:text-text transition-colors text-xs font-mono uppercase tracking-[0.1em] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={reportStatus === 'sending'}
                    className="flex items-center gap-2 px-5 py-2 bg-accent text-accent-ink hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-mono uppercase tracking-[0.1em] text-xs transition-opacity"
                  >
                    {reportStatus === 'sending' ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-accent-ink/30 border-t-accent-ink rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
