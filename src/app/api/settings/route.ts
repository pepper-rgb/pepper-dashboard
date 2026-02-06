import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/Users/pepperstarke/.openclaw/openclaw.json'
const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789'
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || 'b05758372fb889f85e2a4c7fe478e61459d3cc91d17fe06a'

export async function GET() {
  try {
    // Read the config file
    const configContent = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configContent)
    
    // Check gateway health
    let gatewayStatus = 'disconnected'
    try {
      const healthCheck = await fetch(`${OPENCLAW_GATEWAY}/api/health`, {
        headers: { 'Authorization': `Bearer ${OPENCLAW_TOKEN}` },
        signal: AbortSignal.timeout(3000)
      })
      gatewayStatus = healthCheck.ok ? 'connected' : 'disconnected'
    } catch {
      gatewayStatus = 'disconnected'
    }

    // Extract relevant settings
    const imessageConfig = config.channels?.imessage || {}
    const gatewayConfig = config.gateway || {}
    const tailscaleConfig = gatewayConfig.tailscale || {}

    return NextResponse.json({
      status: 'success',
      settings: {
        imessage: {
          enabled: imessageConfig.enabled || false,
          dmPolicy: imessageConfig.dmPolicy || 'allowlist',
          allowFrom: imessageConfig.allowFrom || [],
          groupPolicy: imessageConfig.groupPolicy || 'allowlist'
        },
        gateway: {
          status: gatewayStatus,
          url: `http://localhost:${gatewayConfig.port || 18789}`,
          port: gatewayConfig.port || 18789,
          mode: gatewayConfig.mode || 'local',
          bind: gatewayConfig.bind || 'loopback'
        },
        tailscale: {
          mode: tailscaleConfig.mode || 'off',
          enabled: tailscaleConfig.mode !== 'off'
        }
      }
    })
  } catch (error) {
    console.error('Failed to read settings:', error)
    return NextResponse.json(
      { status: 'error', error: 'Failed to read settings' },
      { status: 500 }
    )
  }
}
