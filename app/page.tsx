'use client'

import { useEffect, useRef, useState } from 'react'
import type { ProductGroup, Product, PerUnitPrice, SearchResult, SourceSite } from '@/lib/types'

function formatPerUnit(ppu: PerUnitPrice | undefined): string | null {
  if (!ppu) return null
  const v = ppu.value.toFixed(2)
  if (ppu.unit === 'piece') return `${v} RON / buc`
  return `${v} RON / 100${ppu.unit}`
}

function packLabel(product: Product): string {
  if (product.attributes.pack) return product.attributes.pack.original
  if (typeof product.attributes.count === 'number') return `${product.attributes.count} buc`
  return ''
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [ungrouped, setUngrouped] = useState<Product[]>([])
  const [rawProducts, setRawProducts] = useState<Product[]>([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [countBySource, setCountBySource] = useState<Record<SourceSite, number>>({ emag: 0, bebetei: 0, notino: 0, trendyol: 0 })
  const [sourceErrors, setSourceErrors] = useState<Partial<Record<SourceSite, string>> | undefined>()
  const [searchTimestamp, setSearchTimestamp] = useState<number>(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [enrichmentError, setEnrichmentError] = useState<string | undefined>()

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
      setCountBySource(data.countBySource || { emag: 0, bebetei: 0, notino: 0, trendyol: 0 })
      setSourceErrors(data.sourceErrors)
      setSearchTimestamp(data.timestamp || Date.now())
      setEnrichmentError(data.enrichmentError)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen relative">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-12 relative z-10">
        {/* Header */}
        <div className="text-left sm:text-center mb-8 sm:mb-14 fade-in-up max-w-3xl mx-auto">
          <div className="editorial-meta mb-3 sm:mb-4 flex items-center gap-2 justify-start sm:justify-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true"></span>
            <span>Vol 1 · Live price intel · eMAG / BebeTei / Notino / Trendyol</span>
          </div>
          <h1
            className="editorial-display text-text mb-3 sm:mb-4"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4.75rem)' }}
          >
            Unified Search
          </h1>
          <p className="text-text-muted text-base sm:text-lg max-w-xl mx-auto">
            Live price intelligence across four marketplaces, ranked by per-unit value.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-10 sm:mb-14 fade-in-up delay-1">
          <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search…"
              className="flex-1 bg-transparent border-0 border-b-2 border-text px-1 py-3 text-2xl sm:text-3xl font-display italic text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}
            />
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
        {!loading && hasSearched && (groups.length > 0 || ungrouped.length > 0) && (
          <div className="max-w-7xl mx-auto">
            {/* Enrichment error banner */}
            {enrichmentError && (
              <div className="mb-4 px-4 py-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 text-sm">
                ⚠ {enrichmentError} — showing raw results without grouping.
              </div>
            )}

            {/* Stats Bar */}
            <div className="glass-card rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-8 fade-in-up delay-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-400"></div>
                  <span className="text-slate-300 font-medium text-base sm:text-xl">
                    Found <span className="price-display text-cyan-400 text-lg sm:text-2xl">{totalProducts}</span> products
                  </span>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="text-slate-500 text-sm sm:text-lg">Query: <span className="text-slate-300">{query}</span></span>
                  <button
                    onClick={openReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all duration-200 text-rose-400 text-xs sm:text-sm font-medium"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    Report a problem
                  </button>
                </div>
              </div>
            </div>

            {/* Grouped Products */}
            {groups.map((group, idx) => (
              <div
                key={`group-${idx}`}
                className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-8 mb-4 sm:mb-6 fade-in-up"
                style={{ animationDelay: `${0.3 + idx * 0.1}s` }}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between mb-4 sm:mb-6 gap-3">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-100 flex-1 leading-tight">
                    {group.matchedName}
                  </h3>
                  <div className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                    <span className="text-purple-400 text-sm sm:text-lg font-medium">{group.products.length} sources</span>
                  </div>
                </div>

                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/20 rounded-lg mb-2 text-slate-400 text-xs sm:text-sm font-medium uppercase tracking-wider border-b border-slate-700/30">
                  <div className="col-span-1">Image</div>
                  <div className="col-span-6">Product</div>
                  <div className="col-span-3">Merchant</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {/* Table Rows */}
                <div className="space-y-1">
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
                        className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-4 px-4 py-3 bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/60 transition-all duration-200 sm:items-center"
                      >
                        <div className="sm:col-span-1">
                          {product.imageUrl ? (
                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
                              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-800/40 rounded border border-slate-700/50"></div>
                          )}
                        </div>
                        <div className="sm:col-span-6">
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:text-cyan-200 visited:text-cyan-300 hover:visited:text-cyan-200 underline decoration-cyan-500/30 hover:decoration-cyan-500/60 text-sm font-medium transition-colors line-clamp-2"
                          >
                            {product.name || group.matchedName}
                          </a>
                          {product.attributes.organic && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                              bio
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-start w-full sm:contents">
                          <div className="sm:col-span-3">
                            <span className="text-slate-300 text-sm font-medium">{product.source}</span>
                          </div>
                          <div className="sm:col-span-2 flex flex-col sm:items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="price-display text-lg font-semibold text-slate-100">{product.price}</span>
                              <span className="text-slate-400 text-sm">RON</span>
                            </div>
                            {ppuText && <div className="text-slate-500 text-xs mt-0.5">{ppuText}</div>}
                            <div className="flex gap-1 mt-1">
                              {product.price === group.bestPrice && (
                                <span className="px-2 py-0.5 bg-gradient-to-r from-rose-500/20 to-orange-500/20 border border-rose-500/30 rounded text-rose-400 text-[10px] font-bold whitespace-nowrap">
                                  BEST
                                </span>
                              )}
                              {isBestUnit && product.price !== group.bestPrice && (
                                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-amber-300 text-[10px] font-bold whitespace-nowrap">
                                  BEST/UNIT
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
              <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-8 fade-in-up">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-400">Other results</h3>
                  <div className="px-3 py-1 rounded-full bg-slate-700/40 border border-slate-600/30">
                    <span className="text-slate-400 text-sm">{ungrouped.length} products</span>
                  </div>
                </div>
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/20 rounded-lg mb-2 text-slate-400 text-xs sm:text-sm font-medium uppercase tracking-wider border-b border-slate-700/30">
                  <div className="col-span-1">Image</div>
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2">Pack</div>
                  <div className="col-span-2">Merchant</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {/* Table Rows */}
                <div className="space-y-1">
                  {ungrouped.map((product, idx) => {
                    const packText = packLabel(product)
                    return (
                      <div
                        key={`ungrouped-${idx}`}
                        className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-4 px-4 py-3 bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/60 transition-all duration-200 sm:items-center"
                      >
                        <div className="sm:col-span-1">
                          {product.imageUrl ? (
                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded bg-white">
                              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-800/40 rounded border border-slate-700/50"></div>
                          )}
                        </div>
                        <div className="sm:col-span-5">
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:text-cyan-200 visited:text-cyan-300 hover:visited:text-cyan-200 underline decoration-cyan-500/30 hover:decoration-cyan-500/60 text-sm font-medium transition-colors line-clamp-2"
                          >
                            {product.name}
                          </a>
                          {product.attributes.organic && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                              bio
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-between items-start gap-x-3 gap-y-1 w-full sm:contents">
                          {packText && <div className="sm:col-span-2 text-slate-300 text-sm">{packText}</div>}
                          <div className="sm:col-span-2">
                            <span className="text-slate-300 text-sm font-medium">{product.source}</span>
                          </div>
                          <div className="sm:col-span-2 flex flex-col sm:items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="price-display text-lg font-semibold text-slate-100">{product.price}</span>
                              <span className="text-slate-400 text-sm">RON</span>
                            </div>
                            {formatPerUnit(product.pricePerUnit) && (
                              <div className="text-slate-500 text-xs mt-0.5">{formatPerUnit(product.pricePerUnit)}</div>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeReport() }}
        >
          <div className="glass-card rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl">
            {reportStatus === 'sent' ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-100">Thanks! I&apos;ll take a look.</p>
                <p className="text-sm text-slate-400 mt-1">Report sent successfully.</p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-100 mb-1">Report a problem with these results</h2>
                <p className="text-sm text-slate-400 mb-4">Tell me what&apos;s wrong (optional). The current search and results will be attached automatically.</p>
                <textarea
                  ref={textareaRef}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="ex: shows me Pampers when I searched Huggies"
                  className="w-full px-4 py-3 bg-slate-900 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 text-white placeholder:text-slate-500 text-sm resize-none transition-all"
                />
                {reportError && (
                  <p className="mt-2 text-sm text-rose-400">{reportError}</p>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={closeReport}
                    disabled={reportStatus === 'sending'}
                    className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={reportStatus === 'sending'}
                    className="flex items-center gap-2 px-6 py-2.5 text-white bg-gradient-to-r from-cyan-600 to-purple-700 hover:from-cyan-500 hover:to-purple-600 disabled:from-slate-700 disabled:to-slate-600 font-semibold rounded-xl transition-all duration-300 disabled:cursor-not-allowed shadow-lg hover:shadow-cyan-500/25 text-sm"
                  >
                    {reportStatus === 'sending' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
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
