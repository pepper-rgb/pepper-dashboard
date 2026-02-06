'use client'

import { useState, useEffect } from 'react'

interface Todo {
  id: string
  text: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  details?: string
}

interface PendingResponse {
  id: string
  person: string
  topic: string
  since: string
  avatar?: string
}

interface UpcomingEvent {
  id: string
  title: string
  time: string
  type: 'meeting' | 'call' | 'deadline'
}

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [greeting, setGreeting] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const hour = currentTime.getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [currentTime])

  const todos: Todo[] = [
    { 
      id: '1', 
      text: 'Follow up with Mike Gorski on Copilot feedback', 
      completed: false, 
      priority: 'medium',
      details: 'Wait 3-4 days before reaching out. Check progress on implementation.'
    },
    { 
      id: '2', 
      text: 'Create Capterra/Gartner account for product listing', 
      completed: false, 
      priority: 'medium',
      details: 'Set up business profiles and start gathering reviews.'
    },
    { 
      id: '3', 
      text: 'Address S&A Properties AI agent fixes', 
      completed: false, 
      priority: 'high',
      details: 'Critical bug affecting lead routing. Fix before end of week.'
    },
  ]

  const pendingResponses: PendingResponse[] = [
    { id: '1', person: 'Spencer Brill', topic: 'NYC dates for meeting', since: 'Feb 5' },
    { id: '2', person: 'Sierra Pena', topic: 'Schedule call', since: 'Feb 5' },
    { id: '3', person: 'Dakota', topic: 'DALE deal counter', since: 'Feb 5' },
    { id: '4', person: 'Luca Rinaldi', topic: 'Tomorrow schedule', since: 'Feb 5' },
  ]

  const upcomingEvents: UpcomingEvent[] = [
    { id: '1', title: 'Janine Hudson / mobi9tech consult', time: 'Tue Feb 10 @ 1:15pm', type: 'meeting' },
    { id: '2', title: 'Jennie Stones consultation call', time: 'Fri Feb 13 @ 12:30pm', type: 'call' },
  ]

  const getEventIcon = (type: string) => {
    switch(type) {
      case 'meeting': return '🤝'
      case 'call': return '📞'
      case 'deadline': return '⏰'
      default: return '📅'
    }
  }

  const getPriorityClass = (priority: string) => {
    switch(priority) {
      case 'high': return 'priority-high'
      case 'medium': return 'priority-medium'
      case 'low': return 'priority-low'
      default: return ''
    }
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-10">
      {/* Header */}
      <header className="mb-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pepper-accent to-pepper-accentDark flex items-center justify-center text-2xl shadow-glow">
                🧠
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-pepper-success border-2 border-pepper-primary pulse-dot" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
                <span className="glow-text text-pepper-accent">Pepper</span> Dashboard
              </h1>
              <p className="text-pepper-muted text-sm md:text-base mt-1">
                {greeting}, Chief of Staff is online
              </p>
            </div>
          </div>
          
          <div className="glass-card px-6 py-4 flex items-center gap-6">
            <div className="text-right">
              <div className="time-display text-3xl md:text-4xl font-light text-pepper-accent glow-text">
                {currentTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </div>
              <div className="text-sm text-pepper-muted mt-1">
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Active Todos */}
        <div className="lg:col-span-5 glass-card p-6 animate-slide-up animate-delay-100">
          <h2 className="card-header">
            <span>📋</span> Active Tasks
            <span className="ml-auto text-sm font-normal text-pepper-accent bg-pepper-accent/10 px-2 py-1 rounded-full">
              {todos.length}
            </span>
          </h2>
          <ul className="space-y-3">
            {todos.map((todo, index) => (
              <li 
                key={todo.id} 
                className={`list-item ${getPriorityClass(todo.priority)}`}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <input 
                    type="checkbox" 
                    checked={todo.completed}
                    onChange={() => {}}
                    className="custom-checkbox mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`block ${todo.completed ? 'line-through text-pepper-muted' : 'text-pepper-text'}`}>
                      {todo.text}
                    </span>
                    {todo.details && (
                      <span className="block text-sm text-pepper-muted mt-1.5 truncate">
                        {todo.details}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Pending Responses */}
          <div className="glass-card p-6 animate-slide-up animate-delay-200">
            <h2 className="card-header">
              <span>⏳</span> Awaiting Response
              <span className="ml-auto text-sm font-normal text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">
                {pendingResponses.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingResponses.map((item, index) => (
                <div 
                  key={item.id} 
                  className="list-item flex items-center gap-4"
                  style={{ animationDelay: `${(index + 1) * 50}ms` }}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-sm flex-shrink-0">
                    {item.person.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-pepper-text truncate">{item.person}</div>
                    <div className="text-sm text-pepper-muted truncate">{item.topic}</div>
                  </div>
                  <div className="text-xs text-pepper-muted/60 flex-shrink-0">{item.since}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="glass-card p-6 animate-slide-up animate-delay-300">
            <h2 className="card-header">
              <span>📅</span> Upcoming Events
              <span className="ml-auto text-sm font-normal text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                {upcomingEvents.length}
              </span>
            </h2>
            <ul className="space-y-3">
              {upcomingEvents.map((event, index) => (
                <li 
                  key={event.id} 
                  className="list-item flex items-center gap-4"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pepper-accent/20 to-transparent flex items-center justify-center text-xl flex-shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-pepper-text">{event.title}</div>
                    <div className="text-sm text-pepper-accent mt-0.5">{event.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="lg:col-span-12 glass-card p-6 animate-slide-up animate-delay-400">
          <h2 className="card-header">
            <span>📊</span> Quick Stats
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="relative z-10">
                <div className="text-4xl font-bold text-pepper-accent glow-text">{todos.length}</div>
                <div className="text-sm text-pepper-muted mt-2">Active Tasks</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="relative z-10">
                <div className="text-4xl font-bold text-amber-500">{pendingResponses.length}</div>
                <div className="text-sm text-pepper-muted mt-2">Pending Responses</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="relative z-10">
                <div className="text-4xl font-bold text-emerald-500">{upcomingEvents.length}</div>
                <div className="text-sm text-pepper-muted mt-2">Upcoming Events</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-4xl font-bold text-purple-400">5</span>
                </div>
                <div className="text-sm text-pepper-muted mt-2">Channels Active</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-10 text-center animate-fade-in animate-delay-500">
        <div className="inline-flex items-center gap-2 text-pepper-muted text-sm">
          <span className="w-2 h-2 rounded-full bg-pepper-accent animate-pulse" />
          <p>Pepper Stark · Chief of Staff to Fitz Light · FlightSuite</p>
        </div>
      </footer>
    </main>
  )
}
