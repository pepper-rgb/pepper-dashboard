'use client'

import { useState, useEffect } from 'react'

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  location?: string
  isAllDay?: boolean
}

interface CalendarData {
  events: CalendarEvent[]
  nextEvent?: CalendarEvent
  timeUntilNext?: string
  source: string
}

export default function CalendarWidget() {
  const [data, setData] = useState<CalendarData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const response = await fetch('/api/calendar')
        const result = await response.json()
        setData(result)
        if (result.error) {
          setError(result.error)
        }
      } catch (err) {
        setError('Failed to load calendar')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCalendar()
    // Refresh every 5 minutes
    const interval = setInterval(fetchCalendar, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatEventTime = (startTime: string, isAllDay?: boolean) => {
    if (isAllDay) return 'All day'
    
    const date = new Date(startTime)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString()
    
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    
    if (isToday) return `Today @ ${timeStr}`
    if (isTomorrow) return `Tomorrow @ ${timeStr}`
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getEventIcon = (title: string) => {
    const lower = title.toLowerCase()
    if (lower.includes('call') || lower.includes('phone')) return '📞'
    if (lower.includes('meeting') || lower.includes('consult')) return '🤝'
    if (lower.includes('interview')) return '💼'
    if (lower.includes('deadline') || lower.includes('due')) return '⏰'
    if (lower.includes('lunch') || lower.includes('dinner')) return '🍽️'
    return '📅'
  }

  if (isLoading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 w-32 bg-pepper-light/30 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 bg-pepper-light/30 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-pepper-light/30 rounded w-3/4" />
                <div className="h-3 bg-pepper-light/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 animate-slide-up">
      <h2 className="card-header">
        <span>📅</span> Upcoming Events
        {data?.timeUntilNext && (
          <span className="ml-auto text-sm font-normal text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
            Next in {data.timeUntilNext}
          </span>
        )}
      </h2>

      {error && (
        <div className="mb-3 text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {data?.events && data.events.length > 0 ? (
        <ul className="space-y-3">
          {data.events.map((event) => (
            <li 
              key={event.id} 
              className="list-item flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pepper-accent/20 to-transparent flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                {getEventIcon(event.title)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-pepper-text truncate">{event.title}</div>
                <div className="text-sm text-pepper-accent mt-0.5">
                  {formatEventTime(event.startTime, event.isAllDay)}
                </div>
                {event.location && (
                  <div className="text-xs text-pepper-muted mt-0.5 truncate">
                    📍 {event.location}
                  </div>
                )}
              </div>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity text-pepper-muted hover:text-pepper-accent">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 4l6 6-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-8 text-pepper-muted">
          <p className="text-4xl mb-2">🎉</p>
          <p>No upcoming events</p>
          <p className="text-xs mt-1">Your schedule is clear!</p>
        </div>
      )}

      {data?.source === 'mock' && (
        <p className="text-xs text-pepper-muted/60 mt-4 text-center">
          📝 Using cached calendar data
        </p>
      )}
    </div>
  )
}
