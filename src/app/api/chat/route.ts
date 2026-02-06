import { NextRequest, NextResponse } from 'next/server'

// Stub API route for OpenClaw integration
// In production, this would connect to the OpenClaw gateway
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

    // TODO: Integrate with OpenClaw gateway
    // Example integration:
    // const response = await fetch('http://localhost:3333/api/chat', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ message, channel: 'dashboard' })
    // })

    // For now, return a simulated response
    const simulatedResponses = [
      "I'm on it! Let me check that for you.",
      "Got it! I'll have that ready shortly.",
      "Understood. Working on it now.",
      "Sure thing! Give me just a moment.",
      "I'll take care of that right away.",
    ]

    const randomResponse = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)]

    // Simulate a slight delay like a real AI would have
    await new Promise(resolve => setTimeout(resolve, 500))

    return NextResponse.json({
      response: randomResponse,
      timestamp: new Date().toISOString(),
      status: 'success'
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'Pepper Chat API',
    version: '1.0.0',
    openclawIntegration: false // Set to true when connected
  })
}
