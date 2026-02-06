'use client'

import { useState, useEffect } from 'react'

interface Todo {
  id: string
  text: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
}

interface PendingResponse {
  id: string
  person: string
  topic: string
  since: string
}

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
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
    { id: '1', text: 'Follow up with Mike Gorski on Copilot feedback (3-4 days)', completed: false, priority: 'medium' },
    { id: '2', text: 'Create Capterra/Gartner account for product listing', completed: false, priority: 'medium' },
    { id: '3', text: 'Address S&A Properties AI agent fixes', completed: false, priority: 'high' },
  ]

  const pendingResponses: PendingResponse[] = [
    { id: '1', person: 'Spencer Brill', topic: 'NYC dates for meeting', since: 'Feb 5' },
    { id: '2', person: 'Sierra Pena', topic: 'Schedule call', since: 'Feb 5' },
    { id: '3', person: 'Dakota', topic: 'DALE deal counter', since: 'Feb 5' },
    { id: '4', person: 'Luca Rinaldi', topic: 'Tomorrow schedule', since: 'Feb 5' },
  ]

  const upcomingEvents = [
    { id: '1', title: 'Janine Hudson / mobi9tech consult', time: 'Tue Feb 10 @ 1:15pm', type: 'meeting' },
    { id: '2', title: 'Jennie Stones consultation call', time: 'Fri Feb 13 @ 12:30pm', type: 'call' },
  ]

  return (
    <main className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-bold">
            <span className="text-pepper-accent">🧠⚡</span> Pepper Dashboard
          </h1>
          <div className="text-right">
            <div className="text-2xl font-mono text-pepper-accent">
              {currentTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })}
            </div>
            <div className="text-sm text-pepper-text/60">
              {currentTime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
        <p className="text-pepper-text/80">{greeting}, Pepper. Here is your operational status.</p>
      </header>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Active Todos */}
        <div className="card">
          <h2 className="card-header">
            <span>📋</span> Active Tasks
          </h2>
          <ul className="space-y-3">
            {todos.map((todo) => (
              <li 
                key={todo.id} 
                className={`flex items-start gap-3 p-3 rounded-lg bg-pepper-primary/50 border-l-4 ${
                  todo.priority === 'high' 
                    ? 'border-red-500' 
                    : todo.priority === 'medium' 
                    ? 'border-yellow-500' 
                    : 'border-green-500'
                }`}
              >
                <input 
                  type="checkbox" 
                  checked={todo.completed}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 rounded border-pepper-light"
                />
                <span className={todo.completed ? 'line-through text-pepper-text/50' : ''}>
                  {todo.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pending Responses */}
        <div className="card">
          <h2 className="card-header">
            <span>⏳</span> Awaiting Response
          </h2>
          <ul className="space-y-3">
            {pendingResponses.map((item) => (
              <li 
                key={item.id} 
                className="p-3 rounded-lg bg-pepper-primary/50"
              >
                <div className="font-medium text-pepper-accent">{item.person}</div>
                <div className="text-sm text-pepper-text/70">{item.topic}</div>
                <div className="text-xs text-pepper-text/50 mt-1">Since {item.since}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Upcoming Events */}
        <div className="card">
          <h2 className="card-header">
            <span>📅</span> Upcoming Events
          </h2>
          <ul className="space-y-3">
            {upcomingEvents.map((event) => (
              <li 
                key={event.id} 
                className="p-3 rounded-lg bg-pepper-primary/50"
              >
                <div className="font-medium">{event.title}</div>
                <div className="text-sm text-pepper-accent mt-1">{event.time}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Stats */}
        <div className="card md:col-span-2 lg:col-span-3">
          <h2 className="card-header">
            <span>📊</span> Quick Stats
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-pepper-primary/50">
              <div className="text-3xl font-bold text-pepper-accent">{todos.length}</div>
              <div className="text-sm text-pepper-text/70">Active Tasks</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-pepper-primary/50">
              <div className="text-3xl font-bold text-yellow-500">{pendingResponses.length}</div>
              <div className="text-sm text-pepper-text/70">Pending Responses</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-pepper-primary/50">
              <div className="text-3xl font-bold text-green-500">{upcomingEvents.length}</div>
              <div className="text-sm text-pepper-text/70">Upcoming Events</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-pepper-primary/50">
              <div className="text-3xl font-bold text-purple-500">5</div>
              <div className="text-sm text-pepper-text/70">Channels Active</div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-pepper-text/50 text-sm">
        <p>Pepper Stark | Chief of Staff to Fitz Light | FlightSuite</p>
      </footer>
    </main>
  )
}
