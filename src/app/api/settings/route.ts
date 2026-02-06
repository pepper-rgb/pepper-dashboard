import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/Users/pepperstarke/.openclaw/openclaw.json'
const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789'
const OPENCLAW_PASSWORD = process.env.OPENCLAW_PASSWORD || 'PepperDash2026!'

// Create basic auth header
function getAuthHeader(): string {
  const credentials = Buffer.from(`admin:${OPENCLAW_PASSWORD}`).toString('base64')
  return `Basic ${credentials}`
}

export async function GET() {
  try {
    // Read the config file
    const configContent = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configContent)
    
    // Check gateway health
    let gatewayStatus = 'disconnected'
    try {
      const healthCheck = await fetch(`${OPENCLAW_GATEWAY}/api/health`, {
        headers: { 'Authorization': getAuthHeader() },
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
