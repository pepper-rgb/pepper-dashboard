'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { OpenClawClient } from '@/lib/openclaw-client'
import { FRIDAY_URL } from '@/lib/constants'

// --- Types ---

interface FridayHealth {
  timestamp: string
  gateway: {
    pid: number | null
    memoryMB: number
    uptime: string
    mode: string
  }
  browser: { renderers: number; memoryMB: number }
  errors: {
    total24h: number
    rate: number
    categories: Record<string, number>
  }
  lanes: { maxWaitMs: number; blockedCount: number }
  briefing: { lastRun: string | null; status: string; durationMs: number }
  watchdog: { status: string; issues: string[] }
}

interface ChannelProbe {
  name: string
  status: 'ok' | 'warn' | 'error'
  detail: string
}

interface SessionInfo {
  sessionId?: string
  model?: string
  tokensUsed?: number
  tokenLimit?: number
  contextWindow?: number
}

interface SparkPoint {
  time: number
  value: number
}

// --- Sub-components ---

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

function SourceBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
      {label}
    </span>
  )
}

// --- Main Component ---

export default function HealthTab({ client }: { client: OpenClawClient | null }) {
  const [friday, setFriday] = useState<FridayHealth | null>(null)
  const [fridayOk, setFridayOk] = useState(false)
  const [channels, setChannels] = useState<ChannelProbe[]>([])
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [gatewayOk, setGatewayOk] = useState(false)
  const [memoryHistory, setMemoryHistory] = useState<SparkPoint[]>([])
  const [errorHistory, setErrorHistory] = useState<SparkPoint[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const fridayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gatewayRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- FRIDAY fetch (system metrics, 30s) ---
  const fetchFriday = useCallback(async () => {
    try {
      const res = await fetch(`${FRIDAY_URL}/health`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const data: FridayHealth = await res.json()
        setFriday(data)
        setFridayOk(true)
        setLoading(false)

        const now = Date.now()
        setMemoryHistory(prev => [...prev.slice(-59), { time: now, value: data.gateway?.memoryMB || 0 }])
        setErrorHistory(prev => [...prev.slice(-59), { time: now, value: data.errors?.rate || 0 }])
      } else {
        setFridayOk(false)
      }
    } catch {
      setFridayOk(false)
      setLoading(false)
    }
  }, [])

  // --- Gateway WebSocket fetch (channels + session, 15s) ---
  const fetchGateway = useCallback(async () => {
    if (!client || client.connectionState !== 'connected') {
      setGatewayOk(false)
      return
    }

    try {
      const [healthResult, statusResult] = await Promise.all([
        client.call<Record<string, unknown>>('health', { probe: true }).catch(() => null),
        client.call<Record<string, unknown>>('status', {}).catch(() => null),
      ])

      setGatewayOk(true)

      // Parse channel probes
      if (healthResult) {
        const probes: ChannelProbe[] = []
        const ch = healthResult.channels as Record<string, { status?: string; detail?: string; error?: string }> | undefined
        if (ch) {
          for (const [name, info] of Object.entries(ch)) {
            const status = info.error ? 'error' : (info.status === 'ok' || info.status === 'connected') ? 'ok' : 'warn'
            probes.push({ name, status, detail: info.detail || info.error || info.status || 'unknown' })
          }
        }
        if (probes.length > 0) setChannels(probes)
      }

      // Parse session/status
      if (statusResult) {
        const s = statusResult as Record<string, unknown>
        const sess: SessionInfo = {}
        if (s.sessionId) sess.sessionId = String(s.sessionId)
        if (s.model) sess.model = String(s.model)
        if (typeof s.tokensUsed === 'number') sess.tokensUsed = s.tokensUsed
        if (typeof s.tokenLimit === 'number') sess.tokenLimit = s.tokenLimit
        if (typeof s.contextWindow === 'number') sess.contextWindow = s.contextWindow
        // Also check nested session object
        const inner = s.session as Record<string, unknown> | undefined
        if (inner) {
          if (inner.id) sess.sessionId = String(inner.id)
          if (inner.model) sess.model = String(inner.model)
          if (typeof inner.tokensUsed === 'number') sess.tokensUsed = inner.tokensUsed
          if (typeof inner.tokenLimit === 'number') sess.tokenLimit = inner.tokenLimit
          if (typeof inner.contextWindow === 'number') sess.contextWindow = inner.contextWindow
        }
        setSession(sess)
      }

      setLastUpdated(new Date().toLocaleTimeString())
    } catch {
      setGatewayOk(false)
    }
  }, [client])

  // --- Lifecycle ---
  useEffect(() => {
    fetchFriday()
    fetchGateway()
    fridayRef.current = setInterval(fetchFriday, 30000)
    gatewayRef.current = setInterval(fetchGateway, 15000)
    return () => {
      if (fridayRef.current) clearInterval(fridayRef.current)
      if (gatewayRef.current) clearInterval(gatewayRef.current)
    }
  }, [fetchFriday, fetchGateway])

  // Re-fetch gateway data when connection state changes
  useEffect(() => {
    if (client?.connectionState === 'connected') {
      fetchGateway()
    }
  }, [client?.connectionState, fetchGateway])

  if (loading && !friday && channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-pepper-muted animate-pulse">Connecting to data sources...</div>
      </div>
    )
  }

  const memoryMB = friday?.gateway.memoryMB ?? 0
  const memoryPct = Math.round((memoryMB / 1536) * 100)

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-pepper-text">Gateway Health</h2>
          <div className="flex items-center gap-2 mt-1">
            <SourceBadge label="WS" ok={gatewayOk} />
            <SourceBadge label="FRIDAY" ok={fridayOk} />
            {lastUpdated && <span className="text-xs text-pepper-muted">Updated {lastUpdated}</span>}
          </div>
        </div>
        <ModeIndicator mode={friday?.gateway.mode ?? 'FULL'} />
      </div>

      {/* Top-level metrics (from FRIDAY) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Memory" value={friday ? `${memoryMB}MB` : '--'} subtitle={friday ? `of 1536MB (${memoryPct}%)` : 'FRIDAY unreachable'}>
          {friday && (
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
          )}
        </MetricCard>

        <MetricCard
          title="Error Rate"
          value={friday ? `${friday.errors.rate}/min` : '--'}
          subtitle={friday ? `${friday.errors.total24h} in 24h` : ''}
        >
          {friday && (
            <div className="mt-2">
              <Sparkline data={errorHistory} color={friday.errors.rate > 10 ? '#ef4444' : '#8b5cf6'} />
            </div>
          )}
        </MetricCard>

        <MetricCard
          title="Lane Wait"
          value={friday
            ? friday.lanes.maxWaitMs > 1000
              ? `${(friday.lanes.maxWaitMs / 1000).toFixed(1)}s`
              : `${friday.lanes.maxWaitMs}ms`
            : '--'
          }
          subtitle={friday ? `${friday.lanes.blockedCount} blocks (15min)` : ''}
        />

        <MetricCard
          title="Uptime"
          value={friday?.gateway.uptime ?? '--'}
          subtitle={friday?.gateway.pid ? `PID ${friday.gateway.pid}` : 'unknown'}
        />
      </div>

      {/* Live Channel Probes (from Gateway WebSocket) */}
      <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-pepper-text uppercase tracking-wider">Live Channel Probes</h3>
          <SourceBadge label="WS" ok={gatewayOk} />
        </div>
        {channels.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {channels.map(ch => (
              <div key={ch.name} className="flex items-center gap-2">
                <StatusDot status={ch.status} />
                <div>
                  <div className="text-sm font-medium text-pepper-text capitalize">{ch.name}</div>
                  <div className="text-xs text-pepper-muted">{ch.detail}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-pepper-muted">
            {gatewayOk ? 'No channel data available' : 'Gateway WebSocket not connected'}
          </div>
        )}
      </div>

      {/* Agent Sessions (from Gateway WebSocket) */}
      {session && (
        <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-pepper-text uppercase tracking-wider">Agent Session</h3>
            <SourceBadge label="WS" ok={gatewayOk} />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {session.model && (
              <span className="px-2 py-1 bg-pepper-accent/20 text-pepper-accent rounded text-xs font-mono">
                {session.model}
              </span>
            )}
            {session.tokensUsed != null && session.tokenLimit != null && (
              <div className="flex-1 min-w-[200px]">
                <div className="flex justify-between text-xs text-pepper-muted mb-1">
                  <span>{session.tokensUsed.toLocaleString()} tokens</span>
                  <span>{session.tokenLimit.toLocaleString()} limit</span>
                </div>
                <div className="w-full bg-pepper-tertiary/50 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-pepper-accent/70 transition-all duration-500"
                    style={{ width: `${Math.min((session.tokensUsed / session.tokenLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {session.sessionId && (
              <span className="text-xs text-pepper-muted font-mono truncate max-w-[180px]" title={session.sessionId}>
                {session.sessionId.slice(0, 12)}...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Browser Status (from FRIDAY) */}
      {friday && (
        <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-pepper-text uppercase tracking-wider">Browser Control</h3>
            <SourceBadge label="FRIDAY" ok={fridayOk} />
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-2xl font-semibold text-pepper-text">{friday.browser.renderers}</div>
              <div className="text-xs text-pepper-muted">Renderers</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-pepper-text">{friday.browser.memoryMB}MB</div>
              <div className="text-xs text-pepper-muted">Memory</div>
            </div>
          </div>
        </div>
      )}

      {/* Last Briefing (from FRIDAY) */}
      {friday && (
        <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-pepper-text uppercase tracking-wider">Last Briefing</h3>
            <SourceBadge label="FRIDAY" ok={fridayOk} />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <StatusDot status={friday.briefing.status === 'ok' ? 'ok' : friday.briefing.status === 'error' ? 'error' : 'warn'} />
              <div>
                <div className="text-sm font-medium text-pepper-text">
                  {friday.briefing.lastRun
                    ? new Date(friday.briefing.lastRun).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Never'}
                </div>
                <div className="text-xs text-pepper-muted">
                  {friday.briefing.status === 'ok' ? 'Delivered' : friday.briefing.status === 'skipped' ? 'Skipped (quiet hours)' : friday.briefing.status}
                </div>
              </div>
            </div>
            {friday.briefing.durationMs > 0 && (
              <div>
                <div className="text-sm font-medium text-pepper-text">{(friday.briefing.durationMs / 1000).toFixed(1)}s</div>
                <div className="text-xs text-pepper-muted">Duration</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Watchdog (from FRIDAY) */}
      {friday && friday.watchdog.status !== 'UNKNOWN' && (
        <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-pepper-text uppercase tracking-wider">Watchdog</h3>
            <SourceBadge label="FRIDAY" ok={fridayOk} />
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status={friday.watchdog.status === 'HEALTHY' ? 'ok' : 'error'} />
            <span className="text-sm font-medium text-pepper-text">{friday.watchdog.status}</span>
          </div>
          {friday.watchdog.issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {friday.watchdog.issues.map((issue, i) => (
                <li key={i} className="text-xs text-red-400">- {issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Error Categories (from FRIDAY) */}
      {friday && Object.keys(friday.errors.categories).length > 0 && (
        <div className="bg-pepper-secondary/80 backdrop-blur-sm border border-pepper-light/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-pepper-text mb-3 uppercase tracking-wider">Error Breakdown (24h)</h3>
          <div className="space-y-2">
            {Object.entries(friday.errors.categories)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => {
                const pct = friday.errors.total24h > 0 ? (count / friday.errors.total24h) * 100 : 0
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
