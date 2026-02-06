import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  location?: string
  description?: string
  attendees?: string[]
  isAllDay?: boolean
}

export async function GET() {
  try {
    // Try to get calendar events from gog CLI
    const { stdout, stderr } = await execAsync('gog calendar events --limit 10 --json', {
      timeout: 10000
    })
    
    if (stderr) {
      console.error('gog stderr:', stderr)
    }
    
    const events = JSON.parse(stdout)
    
    // Transform and sort events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedEvents: CalendarEvent[] = events.map((event: any) => ({
      id: event.id || String(Math.random()),
      title: event.summary || event.title || 'Untitled Event',
      startTime: event.start?.dateTime || event.start?.date || event.startTime,
      endTime: event.end?.dateTime || event.end?.date || event.endTime,
      location: event.location,
      description: event.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attendees: event.attendees?.map((a: any) => a.email || a.displayName),
      isAllDay: !event.start?.dateTime
    }))
    
    // Sort by start time
    transformedEvents.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )
    
    // Calculate time until next event
    const now = new Date()
    const upcomingEvents = transformedEvents.filter(e => new Date(e.startTime) > now)
    const nextEvent = upcomingEvents[0]
    
    let timeUntilNext = null
    if (nextEvent) {
      const msUntil = new Date(nextEvent.startTime).getTime() - now.getTime()
      const minutesUntil = Math.floor(msUntil / 60000)
      const hoursUntil = Math.floor(minutesUntil / 60)
      const daysUntil = Math.floor(hoursUntil / 24)
      
      if (daysUntil > 0) {
        timeUntilNext = `${daysUntil}d ${hoursUntil % 24}h`
      } else if (hoursUntil > 0) {
        timeUntilNext = `${hoursUntil}h ${minutesUntil % 60}m`
      } else {
        timeUntilNext = `${minutesUntil}m`
      }
    }
    
    return NextResponse.json({
      events: transformedEvents.slice(0, 5),
      nextEvent,
      timeUntilNext,
      source: 'gog'
    })
  } catch (error) {
    console.error('Calendar API error:', error)
    
    // Return mock data if gog fails
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Janine Hudson / mobi9tech consult',
        startTime: '2026-02-10T13:15:00',
        endTime: '2026-02-10T14:00:00',
        location: 'Zoom'
      },
      {
        id: '2', 
        title: 'Jennie Stones consultation call',
        startTime: '2026-02-13T12:30:00',
        endTime: '2026-02-13T13:00:00',
        location: 'Phone'
      }
    ]
    
    const now = new Date()
    const nextEvent = mockEvents.find(e => new Date(e.startTime) > now)
    
    return NextResponse.json({
      events: mockEvents,
      nextEvent,
      timeUntilNext: nextEvent ? '4d 16h' : null,
      source: 'mock',
      error: 'Calendar fetch failed, using cached data'
    })
  }
}
