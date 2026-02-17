import { NextResponse } from 'next/server'

const GATEWAY_URL = process.env.GATEWAY_INTERNAL_URL || 'http://127.0.0.1:18789'
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'b05758372fb889f85e2a4c7fe478e61459d3cc91d17fe06a'

interface HealthResponse {
  gateway: {
    pid: number | null
    memoryMB: number
    uptime: string
    mode: string
  }
  channels: Record<string, { status: 'ok' | 'warn' | 'error'; detail: string }>
  browser: {
    renderers: number
    memoryMB: number
  }
  errors: {
    total24h: number
    rate: number
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

async function fetchGatewayHealth(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/health`, {
      headers: { 'Authorization': `Bearer ${GATEWAY_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return res.json()
  } catch {}
  return null
}

async function readModeFile(): Promise<string> {
  try {
    const { readFile } = await import('fs/promises')
    const mode = await readFile('/tmp/openclaw_mode', 'utf-8')
    return mode.trim() || 'FULL'
  } catch {
    return 'FULL'
  }
}

async function getGatewayProcessInfo(): Promise<{ pid: number | null; memoryMB: number; uptime: string }> {
  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // Get PID: prefer PID file, fall back to pgrep, then launchctl
    let pid: number | null = null
    try {
      const { readFile } = await import('fs/promises')
      const pidStr = (await readFile('/tmp/openclaw_gateway.pid', 'utf-8')).trim()
      const parsedPid = parseInt(pidStr, 10)
      if (parsedPid > 0) {
        // Verify the process is alive
        await execAsync(`kill -0 ${parsedPid}`)
        pid = parsedPid
      }
    } catch {}
    if (!pid) {
      try {
        const { stdout: pgrepOut } = await execAsync('pgrep -f "node.*openclaw.*gateway"')
        pid = parseInt(pgrepOut.trim().split('\n')[0], 10) || null
      } catch {}
    }
    if (!pid) {
      try {
        const { stdout: launchOut } = await execAsync('launchctl list 2>/dev/null | grep ai.openclaw.gateway')
        const launchPid = parseInt(launchOut.trim().split(/\s+/)[0], 10)
        if (launchPid > 0) pid = launchPid
      } catch {}
    }

    if (!pid) return { pid: null, memoryMB: 0, uptime: 'down' }

    // Get memory (RSS in KB) and uptime
    const { stdout: psOut } = await execAsync(`ps -o rss=,etime= -p ${pid}`)
    const parts = psOut.trim().split(/\s+/)
    const rssKB = parseInt(parts[0], 10) || 0
    const uptime = parts[1] || 'unknown'

    return { pid, memoryMB: Math.round(rssKB / 1024), uptime }
  } catch {
    return { pid: null, memoryMB: 0, uptime: 'unknown' }
  }
}

async function getBrowserInfo(): Promise<{ renderers: number; memoryMB: number }> {
  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // Count renderers and total memory
    const { stdout } = await execAsync(
      `ps aux | grep "Google Chrome Helper.*Renderer.*openclaw" | grep -v grep | awk '{sum += $6; count++} END {print count " " int(sum/1024)}'`
    )
    const [count, memMB] = stdout.trim().split(' ').map(Number)
    return { renderers: count || 0, memoryMB: memMB || 0 }
  } catch {
    return { renderers: 0, memoryMB: 0 }
  }
}

async function getErrorStats(): Promise<{ total24h: number; rate: number; categories: Record<string, number> }> {
  try {
    const { readFile } = await import('fs/promises')
    const errLog = await readFile('/Users/pepperstarke/.openclaw/logs/gateway.err.log', 'utf-8')
    const lines = errLog.split('\n').filter(l => l.trim())

    // Count by category
    const categories: Record<string, number> = {}
    let recentCount = 0
    const fiveMinAgo = Date.now() - 5 * 60 * 1000

    for (const line of lines) {
      // Parse timestamp
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
      if (tsMatch) {
        const ts = new Date(tsMatch[1]).getTime()
        if (ts > fiveMinAgo) recentCount++
      }

      // Categorize
      const lower = line.toLowerCase()
      if (lower.includes('browser')) categories['Browser'] = (categories['Browser'] || 0) + 1
      else if (lower.includes('lane wait')) categories['Lane Blockage'] = (categories['Lane Blockage'] || 0) + 1
      else if (lower.includes('imsg') || lower.includes('imessage')) categories['iMessage'] = (categories['iMessage'] || 0) + 1
      else if (lower.includes('tool') || lower.includes('exec failed')) categories['Tool Exec'] = (categories['Tool Exec'] || 0) + 1
      else if (lower.includes('telegram')) categories['Telegram'] = (categories['Telegram'] || 0) + 1
      else if (lower.includes('slack')) categories['Slack'] = (categories['Slack'] || 0) + 1
      else if (lower.includes('agent')) categories['Agent'] = (categories['Agent'] || 0) + 1
      else categories['Other'] = (categories['Other'] || 0) + 1
    }

    return {
      total24h: lines.length,
      rate: Math.round(recentCount / 5),
      categories,
    }
  } catch {
    return { total24h: 0, rate: 0, categories: {} }
  }
}

async function getLaneStats(): Promise<{ maxWaitMs: number; blockedCount: number }> {
  try {
    const { readFile } = await import('fs/promises')
    const errLog = await readFile('/Users/pepperstarke/.openclaw/logs/gateway.err.log', 'utf-8')
    const lines = errLog.split('\n')

    const fifteenMinAgo = Date.now() - 15 * 60 * 1000
    let maxWait = 0
    let blockCount = 0

    for (const line of lines) {
      if (!line.includes('lane wait exceeded')) continue
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
      const waitMatch = line.match(/waitedMs=(\d+)/)
      if (tsMatch && waitMatch) {
        const ts = new Date(tsMatch[1]).getTime()
        const waitMs = parseInt(waitMatch[1], 10)
        if (ts > fifteenMinAgo) {
          if (waitMs > maxWait) maxWait = waitMs
          if (waitMs > 120000) blockCount++
        }
      }
    }

    return { maxWaitMs: maxWait, blockedCount: blockCount }
  } catch {
    return { maxWaitMs: 0, blockedCount: 0 }
  }
}

async function getBriefingInfo(): Promise<{ lastRun: string | null; status: string; durationMs: number }> {
  try {
    const { readdir, readFile } = await import('fs/promises')
    const cronDir = '/Users/pepperstarke/.openclaw/cron/runs'
    const files = await readdir(cronDir)
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))

    let latestBriefing: { lastRun: string | null; status: string; durationMs: number } = { lastRun: null, status: 'unknown', durationMs: 0 }
    let latestTs = 0

    for (const file of jsonlFiles) {
      const content = await readFile(`${cronDir}/${file}`, 'utf-8')
      const lines = content.split('\n').filter(l => l.trim())
      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          const summary = (entry.summary || '').toLowerCase()
          if (summary.includes('briefing') || summary.includes('morning') || summary.includes('daily')) {
            const ts = entry.ts || 0
            if (ts > latestTs) {
              latestTs = ts
              latestBriefing = {
                lastRun: new Date(ts).toISOString(),
                status: entry.status || 'unknown',
                durationMs: entry.durationMs || 0,
              }
            }
          }
        } catch {}
      }
    }

    return latestBriefing
  } catch {
    return { lastRun: null, status: 'unknown', durationMs: 0 }
  }
}

async function getChannelStatus(): Promise<Record<string, { status: 'ok' | 'warn' | 'error'; detail: string }>> {
  // Check process-level indicators for each channel
  const channels: Record<string, { status: 'ok' | 'warn' | 'error'; detail: string }> = {
    imessage: { status: 'ok', detail: 'Connected' },
    telegram: { status: 'ok', detail: 'Connected' },
    slack: { status: 'ok', detail: 'Connected' },
    email: { status: 'ok', detail: 'Healthy' },
  }

  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // Check imsg rpc
    try {
      await execAsync('pgrep -f "imsg rpc"')
    } catch {
      channels.imessage = { status: 'error', detail: 'RPC not running' }
    }

    // Check recent errors for each channel
    const { readFile } = await import('fs/promises')
    const errLog = await readFile('/Users/pepperstarke/.openclaw/logs/gateway.err.log', 'utf-8')
    const recentLines = errLog.split('\n').slice(-100)

    const telegramErrors = recentLines.filter(l => l.includes('telegram')).length
    const slackErrors = recentLines.filter(l => l.includes('slack') || l.includes('pong')).length
    const emailErrors = recentLines.filter(l => l.includes('himalaya') || l.includes('email')).length

    if (telegramErrors > 5) channels.telegram = { status: 'warn', detail: `${telegramErrors} recent errors` }
    if (slackErrors > 5) channels.slack = { status: 'warn', detail: `${slackErrors} recent errors` }
    if (emailErrors > 3) channels.email = { status: 'warn', detail: `${emailErrors} recent errors` }
  } catch {}

  return channels
}

export async function GET() {
  const [processInfo, mode, browserInfo, errorStats, laneStats, channelStatus, briefingInfo] = await Promise.all([
    getGatewayProcessInfo(),
    readModeFile(),
    getBrowserInfo(),
    getErrorStats(),
    getLaneStats(),
    getChannelStatus(),
    getBriefingInfo(),
  ])

  const response: HealthResponse = {
    gateway: { ...processInfo, mode },
    channels: channelStatus,
    browser: browserInfo,
    errors: errorStats,
    lanes: laneStats,
    briefing: briefingInfo,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
