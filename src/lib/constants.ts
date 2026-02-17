// Shared gateway configuration for OpenClaw WebSocket client

export const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'wss://peppers-mac-mini.tailb86ab5.ts.net'
export const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_GATEWAY_TOKEN || 'b05758372fb889f85e2a4c7fe478e61459d3cc91d17fe06a'
export const GATEWAY_PASSWORD = process.env.NEXT_PUBLIC_GATEWAY_PASSWORD || 'PepperDash2026!'

// FRIDAY system telemetry endpoint (runs on Mac Mini, exposed via Tailscale funnel)
export const FRIDAY_URL = process.env.NEXT_PUBLIC_FRIDAY_URL
  || 'https://peppers-mac-mini.tailb86ab5.ts.net:10443'

// Pre-paired dashboard device identity — avoids per-browser pairing through Tailscale funnel
export const DASHBOARD_DEVICE = {
  deviceId: 'e96171661269075aa73b204ba5778a076ba7cfa921bd077e528e07a82d425b89',
  publicKey: 'HYc1cj3W0aSuOotFIMLozneJl6rhKqKLxurowVajHT4',
  privateKey: 'PLy3ZpeGGDnn1mYSVcQgNoKHAZUZ6CO3-AW4qzg8E2E',
}
