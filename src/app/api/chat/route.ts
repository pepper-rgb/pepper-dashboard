import { NextRequest, NextResponse } from 'next/server'

const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789'
const OPENCLAW_PASSWORD = process.env.OPENCLAW_PASSWORD || 'PepperDash2026!'

// Create basic auth header
function getAuthHeader(): string {
  const credentials = Buffer.from(`admin:${OPENCLAW_PASSWORD}`).toString('base64')
  return `Basic ${credentials}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Send message to OpenClaw gateway
    const response = await fetch(`${OPENCLAW_GATEWAY}/api/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({ 
        message,
        channel: 'dashboard',
        sessionId: 'main'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenClaw error:', response.status, errorText)
      
      // Fallback to simulated response if gateway fails
      return NextResponse.json({
        response: "I received your message but I'm having trouble connecting to my backend. Give me a moment.",
        timestamp: new Date().toISOString(),
        status: 'fallback'
      })
    }

    const data = await response.json()

    return NextResponse.json({
      response: data.response || data.message || "Message sent successfully.",
      timestamp: new Date().toISOString(),
      status: 'success'
    })
  } catch (error) {
    console.error('Chat API error:', error)
    
    // Return a friendly fallback
    return NextResponse.json({
      response: "I'm having trouble connecting right now. Please try again in a moment.",
      timestamp: new Date().toISOString(),
      status: 'error'
    })
  }
}

// Stream endpoint for real-time responses
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('sessionId') || 'main'

  try {
    // Check gateway health
    const healthCheck = await fetch(`${OPENCLAW_GATEWAY}/api/health`, {
      headers: { 'Authorization': getAuthHeader() }
    }).catch(() => null)

    return NextResponse.json({
      status: healthCheck?.ok ? 'connected' : 'disconnected',
      service: 'Pepper Chat API',
      version: '2.0.0',
      gateway: OPENCLAW_GATEWAY,
      sessionId,
      openclawIntegration: healthCheck?.ok || false
    })
  } catch {
    return NextResponse.json({
      status: 'disconnected',
      service: 'Pepper Chat API',
      version: '2.0.0',
      openclawIntegration: false
    })
  }
}
