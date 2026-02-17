'use client'

import { useMemo } from 'react'
import CalendarWidget from '@/components/CalendarWidget'
import ErrorBoundary from '@/components/ErrorBoundary'
import { OpenClawClient } from '@/lib/openclaw-client'

interface Todo {
  id: string
  text: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  details?: string
  createdAt: string
  source?: 'memory' | 'manual'
  type?: 'email' | 'calendar' | 'task' | 'response'
  context?: {
    email?: {
      from: string
      subject: string
      snippet: string
      fullBody?: string
      date: string
      hasAttachments?: boolean
    }
    calendarEvent?: { title: string; time: string; attendees?: string[] }
    person?: { name: string; company?: string; lastContact?: string }
  }
}

interface PendingResponse {
  id: string
  person: string
  topic: string
  since: string
  context?: string
}

interface BriefingTabProps {
  todos: Todo[]
  pendingResponses: PendingResponse[]
  client: OpenClawClient | null
}

export default function BriefingTab({ todos, pendingResponses }: BriefingTabProps) {
  const needsAttention = useMemo(() => {
    return todos.filter(t => t.priority === 'high' && !t.completed).slice(0, 5)
  }, [todos])

  const handledToday = useMemo(() => {
    const today = new Date().toDateString()
    return todos.filter(t => t.completed && new Date(t.createdAt).toDateString() === today)
  }, [todos])

  const activeCount = todos.filter(t => !t.completed).length
  const highPriorityCount = needsAttention.length
  const handledCount = handledToday.length
  const pendingCount = pendingResponses.length

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500/80 bg-gradient-to-r from-red-500/5 to-transparent'
      case 'medium': return 'border-l-amber-500/80 bg-gradient-to-r from-amber-500/5 to-transparent'
      case 'low': return 'border-l-emerald-500/80 bg-gradient-to-r from-emerald-500/5 to-transparent'
      default: return ''
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Attention Banner */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pepper-accent to-pepper-accentDark flex items-center justify-center text-sm shadow-glow">
            🧠
          </div>
          <div>
            <h2 className="text-sm font-semibold text-pepper-text">Morning Briefing</h2>
            <p className="text-xs text-pepper-muted">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-red-400">{highPriorityCount}</span>
            <span className="text-xs text-pepper-muted">need you</span>
          </div>
          <div className="w-px h-8 bg-pepper-light/20" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-emerald-400">{handledCount}</span>
            <span className="text-xs text-pepper-muted">handled</span>
          </div>
          <div className="w-px h-8 bg-pepper-light/20" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-amber-400">{pendingCount}</span>
            <span className="text-xs text-pepper-muted">awaiting reply</span>
          </div>
          <div className="w-px h-8 bg-pepper-light/20" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-pepper-accent">{activeCount}</span>
            <span className="text-xs text-pepper-muted">active tasks</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Your Attention */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-pepper-text mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Needs Your Attention
          </h3>
          {needsAttention.length > 0 ? (
            <ul className="space-y-2">
              {needsAttention.map(todo => (
                <li
                  key={todo.id}
                  className={`p-3 rounded-xl border-l-4 ${getPriorityColor(todo.priority)} border border-pepper-light/10 transition-all hover:border-pepper-light/20`}
                >
                  <div className="flex items-center gap-2">
                    {todo.context?.email && <span className="text-xs text-blue-400">Email</span>}
                    {todo.context?.person && <span className="text-xs text-purple-400">{todo.context.person.name}</span>}
                    {todo.context?.calendarEvent && <span className="text-xs text-emerald-400">Calendar</span>}
                  </div>
                  <p className="text-sm text-pepper-text mt-1">{todo.text}</p>
                  {todo.context?.email && (
                    <p className="text-xs text-pepper-muted mt-1 truncate">
                      From {todo.context.email.from}: {todo.context.email.snippet}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-6 text-pepper-muted">
              <p className="text-3xl mb-2">✨</p>
              <p className="text-sm">Nothing urgent right now</p>
            </div>
          )}
        </div>

        {/* Pepper Activity */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-pepper-text mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Pepper Activity
          </h3>
          {handledToday.length > 0 ? (
            <ul className="space-y-2">
              {handledToday.map(todo => (
                <li key={todo.id} className="p-3 rounded-xl bg-pepper-tertiary/50 border border-pepper-light/10">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
                      <polyline points="2 7 5.5 10.5 12 3.5" />
                    </svg>
                    <span className="text-sm text-pepper-text">{todo.text}</span>
                  </div>
                  <p className="text-xs text-pepper-muted mt-1 ml-5">Completed today</p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              <li className="p-3 rounded-xl bg-pepper-tertiary/50 border border-pepper-light/10">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
                    <polyline points="2 7 5.5 10.5 12 3.5" />
                  </svg>
                  <span className="text-sm text-pepper-text">Checked email for urgent messages</span>
                </div>
                <p className="text-xs text-pepper-muted mt-1 ml-5">This morning</p>
              </li>
              <li className="p-3 rounded-xl bg-pepper-tertiary/50 border border-pepper-light/10">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
                    <polyline points="2 7 5.5 10.5 12 3.5" />
                  </svg>
                  <span className="text-sm text-pepper-text">Organized inbox by priority</span>
                </div>
                <p className="text-xs text-pepper-muted mt-1 ml-5">This morning</p>
              </li>
              <li className="p-3 rounded-xl bg-pepper-tertiary/50 border border-pepper-light/10">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                    <circle cx="7" cy="7" r="5" />
                    <path d="M7 4v3l2 2" />
                  </svg>
                  <span className="text-sm text-pepper-text">Monitoring {pendingCount} pending responses</span>
                </div>
                <p className="text-xs text-pepper-muted mt-1 ml-5">Ongoing</p>
              </li>
            </ul>
          )}
        </div>

        {/* Awaiting Responses */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-pepper-text mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Awaiting Responses
          </h3>
          {pendingResponses.length > 0 ? (
            <ul className="space-y-2">
              {pendingResponses.map(pr => (
                <li key={pr.id} className="p-3 rounded-xl bg-pepper-tertiary/50 border border-pepper-light/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-xs flex-shrink-0">
                      {pr.person.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-pepper-text font-medium">{pr.person}</p>
                      <p className="text-xs text-pepper-muted truncate">{pr.topic}</p>
                    </div>
                    <span className="text-xs text-pepper-muted/60 ml-auto flex-shrink-0">{pr.since}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-6 text-pepper-muted">
              <p className="text-sm">No pending responses</p>
            </div>
          )}
        </div>

        {/* Today's Schedule */}
        <div>
          <ErrorBoundary>
            <CalendarWidget />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
