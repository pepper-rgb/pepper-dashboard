'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { OpenClawClient } from '@/lib/openclaw-client'

interface HealthMetrics {
  gateway: {
    pid: number | null
    memoryMB: number
    uptime: string
    mode: string  // FULL, DEGRADED, ESSENTIAL
  }
  channels: {
    imessage: { status: 'ok' | 'warn' | 'error'; detail: string }
    telegram: { status: 'ok' | 'warn' | 'error'; detail: string }
    slack: { status: 'ok' | 'warn' | 'error'; detail: string }
    email: { status: 'ok' | 'warn' | 'error'; detail: string }
  }
  browser: {
    renderers: number
    memoryMB: number
  }
  errors: {
    total24h: number
    rate: number  // per minute
    categories: Record<string, number>
  }
  lanes: {
    maxWaitMs: number
    blockedCount: number
  }
  briefing: {
    lastRun: string | null
    status: string
    durationMs: number
  }
}

interface SparkPoint {
  time: number
  value: number
}

function Sparkline({ data, color = '#8b5cf6', height = 32, width = 120 }: { data: SparkPoint[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return <div style={{ width, height }} className="bg-pepper-tertiary/30 rounded" />

  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values) || 1
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d.value - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'error' }) {
  const colors = {
    ok: 'bg-green-500',
    warn: 'bg-yellow-500',
    error: 'bg-red-500'
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status]} ${status !== 'ok' ? 'animate-pulse' : ''}`} />
  )
}

function MetricCard({ title, value, subtitle, children, className = '' }: {
  title: string; value: string | number; subtitle?: string; children?: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4 ${className}`}>
      <div className="text-xs text-pepper-muted uppercase tracking-wider mb-1">{title}</div>
      <div className="text-2xl font-semibold text-pepper-text">{value}</div>
      {subtitle && <div className="text-xs text-pepper-muted mt-1">{subtitle}</div>}
      {children}
    </div>
  )
}

function ModeIndicator({ mode }: { mode: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    FULL: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'All Systems Operational' },
    DEGRADED: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Reduced Capacity' },
    ESSENTIAL: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Essential Only' },
  }
  const c = config[mode] || config.FULL

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${c.bg}`}>
      <span className={`text-sm font-bold ${c.color}`}>{mode}</span>
      <span className="text-xs text-pepper-muted">{c.label}</span>
    </div>
  )
}

export default function HealthTab({ client }: { client: OpenClawClient | null }) {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)
  const [memoryHistory, setMemoryHistory] = useState<SparkPoint[]>([])
  const [errorHistory, setErrorHistory] = useState<SparkPoint[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/health')
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
        setLastUpdated(new Date().toLocaleTimeString())
        setLoading(false)

        // Track history for sparklines
        const now = Date.now()
        setMemoryHistory(prev => [...prev.slice(-59), { time: now, value: data.gateway?.memoryMB || 0 }])
        setErrorHistory(prev => [...prev.slice(-59), { time: now, value: data.errors?.rate || 0 }])
      }
    } catch (e) {
      console.error('Failed to fetch health metrics:', e)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    intervalRef.current = setInterval(fetchMetrics, 15000) // Poll every 15s
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchMetrics])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-pepper-muted animate-pulse">Loading health metrics...</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-pepper-muted">Unable to fetch health metrics. Gateway may be unreachable.</div>
      </div>
    )
  }

  const memoryPct = Math.round((metrics.gateway.memoryMB / 1536) * 100)
  const memoryColor = memoryPct > 80 ? 'text-red-400' : memoryPct > 60 ? 'text-yellow-400' : 'text-green-400'

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-pepper-text">Gateway Health</h2>
          <p className="text-xs text-pepper-muted">Last updated: {lastUpdated}</p>
        </div>
        <ModeIndicator mode={metrics.gateway.mode} />
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Memory" value={`${metrics.gateway.memoryMB}MB`} subtitle={`of 1536MB (${memoryPct}%)`}>
          <div className="mt-2">
            <div className="w-full bg-pepper-tertiary/50 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  memoryPct > 80 ? 'bg-red-500' : memoryPct > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(memoryPct, 100)}%` }}
              />
            </div>
            <div className="mt-1">
              <Sparkline data={memoryHistory} color={memoryPct > 60 ? '#f59e0b' : '#22c55e'} />
            </div>
          </div>
        </MetricCard>

        <MetricCard title="Error Rate" value={`${metrics.errors.rate}/min`} subtitle={`${metrics.errors.total24h} in 24h`}>
          <div className="mt-2">
            <Sparkline data={errorHistory} color={metrics.errors.rate > 10 ? '#ef4444' : '#8b5cf6'} />
          </div>
        </MetricCard>

        <MetricCard title="Lane Wait" value={metrics.lanes.maxWaitMs > 1000 ? `${(metrics.lanes.maxWaitMs / 1000).toFixed(1)}s` : `${metrics.lanes.maxWaitMs}ms`} subtitle={`${metrics.lanes.blockedCount} blocks (15min)`} />

        <MetricCard title="Uptime" value={metrics.gateway.uptime} subtitle={`PID ${metrics.gateway.pid}`} />
      </div>

      {/* Channel Status */}
      <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-pepper-text mb-3 uppercase tracking-wider">Channels</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(metrics.channels).map(([name, ch]) => (
            <div key={name} className="flex items-center gap-2">
              <StatusDot status={ch.status} />
              <div>
                <div className="text-sm font-medium text-pepper-text capitalize">{name}</div>
                <div className="text-xs text-pepper-muted">{ch.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Browser Status */}
      <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-pepper-text mb-3 uppercase tracking-wider">Browser Control</h3>
        <div className="flex items-center gap-6">
          <div>
            <div className="text-2xl font-semibold text-pepper-text">{metrics.browser.renderers}</div>
            <div className="text-xs text-pepper-muted">Renderers</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-pepper-text">{metrics.browser.memoryMB}MB</div>
            <div className="text-xs text-pepper-muted">Memory</div>
          </div>
        </div>
      </div>

      {/* Last Briefing */}
      <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-pepper-text mb-3 uppercase tracking-wider">Last Briefing</h3>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <StatusDot status={metrics.briefing.status === 'ok' ? 'ok' : metrics.briefing.status === 'error' ? 'error' : 'warn'} />
            <div>
              <div className="text-sm font-medium text-pepper-text">
                {metrics.briefing.lastRun
                  ? new Date(metrics.briefing.lastRun).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </div>
              <div className="text-xs text-pepper-muted">
                {metrics.briefing.status === 'ok' ? 'Delivered' : metrics.briefing.status === 'skipped' ? 'Skipped (quiet hours)' : metrics.briefing.status}
              </div>
            </div>
          </div>
          {metrics.briefing.durationMs > 0 && (
            <div>
              <div className="text-sm font-medium text-pepper-text">{(metrics.briefing.durationMs / 1000).toFixed(1)}s</div>
              <div className="text-xs text-pepper-muted">Duration</div>
            </div>
          )}
        </div>
      </div>

      {/* Error Categories */}
      {Object.keys(metrics.errors.categories).length > 0 && (
        <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-pepper-text mb-3 uppercase tracking-wider">Error Breakdown (24h)</h3>
          <div className="space-y-2">
            {Object.entries(metrics.errors.categories)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => {
                const pct = metrics.errors.total24h > 0 ? (count / metrics.errors.total24h) * 100 : 0
                return (
                  <div key={category} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-pepper-muted truncate">{category}</div>
                    <div className="flex-1 bg-pepper-tertiary/30 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-pepper-accent/60"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="w-12 text-xs text-pepper-muted text-right">{count}</div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
