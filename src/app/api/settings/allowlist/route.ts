import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'

const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/Users/pepperstarke/.openclaw/openclaw.json'

interface AllowlistRequest {
  action: 'add' | 'remove'
  phoneNumber: string
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  const hasPlus = phone.startsWith('+')
  const digits = phone.replace(/\D/g, '')
  
  // If it's a 10-digit US number, add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }
  
  // If it already has country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  // Return with + if it had one, or add it
  return hasPlus ? `+${digits}` : `+${digits}`
}

// Validate phone number format
function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone)
  // Must be E.164 format with 10-15 digits
  return /^\+\d{10,15}$/.test(formatted)
}

export async function POST(request: NextRequest) {
  try {
    const body: AllowlistRequest = await request.json()
    const { action, phoneNumber } = body

    if (!action || !phoneNumber) {
      return NextResponse.json(
        { status: 'error', error: 'Action and phoneNumber are required' },
        { status: 400 }
      )
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { status: 'error', error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    const formattedNumber = formatPhoneNumber(phoneNumber)

    // Read current config
    const configContent = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configContent)

    // Ensure the path exists
    if (!config.channels) config.channels = {}
    if (!config.channels.imessage) config.channels.imessage = {}
    if (!config.channels.imessage.allowFrom) config.channels.imessage.allowFrom = []

    const allowFrom: string[] = config.channels.imessage.allowFrom

    if (action === 'add') {
      // Check if already exists
      if (allowFrom.includes(formattedNumber)) {
        return NextResponse.json({
          status: 'success',
          message: 'Phone number already in allowlist',
          allowFrom
        })
      }
      
      // Add the number
      allowFrom.push(formattedNumber)
      config.channels.imessage.allowFrom = allowFrom
    } else if (action === 'remove') {
      // Remove the number
      const index = allowFrom.indexOf(formattedNumber)
      if (index === -1) {
        return NextResponse.json({
          status: 'success',
          message: 'Phone number not found in allowlist',
          allowFrom
        })
      }
      
      allowFrom.splice(index, 1)
      config.channels.imessage.allowFrom = allowFrom
    } else {
      return NextResponse.json(
        { status: 'error', error: 'Invalid action. Use "add" or "remove"' },
        { status: 400 }
      )
    }

    // Update the touched timestamp
    if (!config.meta) config.meta = {}
    config.meta.lastTouchedAt = new Date().toISOString()

    // Write back to file
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')

    return NextResponse.json({
      status: 'success',
      message: `Phone number ${action === 'add' ? 'added to' : 'removed from'} allowlist`,
      allowFrom: config.channels.imessage.allowFrom
    })
  } catch (error) {
    console.error('Failed to update allowlist:', error)
    return NextResponse.json(
      { status: 'error', error: 'Failed to update allowlist' },
      { status: 500 }
    )
  }
}
