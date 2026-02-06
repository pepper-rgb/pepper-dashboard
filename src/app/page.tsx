'use client'

import { useState, useEffect, useReducer, useCallback } from 'react'

// Types
interface Todo {
  id: string
  text: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  details?: string
  createdAt: Date
}

interface PendingResponse {
  id: string
  person: string
  topic: string
  since: string
}

interface UpcomingEvent {
  id: string
  title: string
  time: string
  type: 'meeting' | 'call' | 'deadline'
}

// Reducer for todos
type TodoAction = 
  | { type: 'TOGGLE_COMPLETE'; id: string }
  | { type: 'REORDER'; fromIndex: number; toIndex: number }
  | { type: 'SET_TODOS'; todos: Todo[] }

function todoReducer(state: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'TOGGLE_COMPLETE':
      return state.map(todo => 
        todo.id === action.id ? { ...todo, completed: !todo.completed } : todo
      )
    case 'REORDER':
      const newState = [...state]
      const [movedItem] = newState.splice(action.fromIndex, 1)
      newState.splice(action.toIndex, 0, movedItem)
      return newState
    case 'SET_TODOS':
      return action.todos
    default:
      return state
  }
}

// Initial data
const initialTodos: Todo[] = [
  { 
    id: '1', 
    text: 'Follow up with Mike Gorski on Copilot feedback', 
    completed: false, 
    priority: 'medium',
    details: 'Wait 3-4 days before reaching out. Check progress on implementation. Important to gather user feedback for next sprint.',
    createdAt: new Date('2024-02-03')
  },
  { 
    id: '2', 
    text: 'Create Capterra/Gartner account for product listing', 
    completed: false, 
    priority: 'medium',
    details: 'Set up business profiles and start gathering reviews. This will improve visibility for enterprise customers.',
    createdAt: new Date('2024-02-04')
  },
  { 
    id: '3', 
    text: 'Address S&A Properties AI agent fixes', 
    completed: false, 
    priority: 'high',
    details: 'Critical bug affecting lead routing. Fix before end of week. Client has escalated this issue twice already.',
    createdAt: new Date('2024-02-05')
  },
]

type FilterType = 'all' | 'active' | 'completed' | 'high'

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [greeting, setGreeting] = useState('')
  const [mounted, setMounted] = useState(false)
  const [todos, dispatch] = useReducer(todoReducer, initialTodos)
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [activeSection, setActiveSection] = useState<'tasks' | 'responses' | 'events'>('tasks')

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

  // Filtering
  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active': return !todo.completed
      case 'completed': return todo.completed
      case 'high': return todo.priority === 'high'
      default: return true
    }
  })

  // Drag and Drop handlers
  const handleDragStart = (index: number) => {
    setDraggedItem(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedItem === null || draggedItem === index) return
    
    dispatch({ type: 'REORDER', fromIndex: draggedItem, toIndex: index })
    setDraggedItem(index)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const toggleTodo = (id: string) => {
    dispatch({ type: 'TOGGLE_COMPLETE', id })
  }

  const toggleExpand = (id: string) => {
    setExpandedTodo(expandedTodo === id ? null : id)
  }

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

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-500/20 text-red-400 border-red-500/30',
      medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    }
    return colors[priority as keyof typeof colors] || ''
  }

  const activeCount = todos.filter(t => !t.completed).length
  const completedCount = todos.filter(t => t.completed).length

  if (!mounted) return null

  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-10">
      {/* Header */}
      <header className="mb-8 animate-fade-in">
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

        {/* Mobile Section Tabs */}
        <div className="flex lg:hidden gap-2 mt-4 overflow-x-auto pb-2">
          {(['tasks', 'responses', 'events'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeSection === section
                  ? 'bg-pepper-accent text-white shadow-glow'
                  : 'bg-pepper-tertiary text-pepper-muted hover:text-pepper-text'
              }`}
            >
              {section === 'tasks' && '📋 Tasks'}
              {section === 'responses' && '⏳ Responses'}
              {section === 'events' && '📅 Events'}
            </button>
          ))}
        </div>
      </header>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Active Todos */}
        <div className={`lg:col-span-5 glass-card p-6 animate-slide-up animate-delay-100 ${activeSection !== 'tasks' ? 'hidden lg:block' : ''}`}>
          <h2 className="card-header">
            <span>📋</span> Active Tasks
            <span className="ml-auto text-sm font-normal text-pepper-accent bg-pepper-accent/10 px-2 py-1 rounded-full">
              {activeCount} active
            </span>
          </h2>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['all', 'active', 'completed', 'high'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-pepper-accent/20 text-pepper-accent border border-pepper-accent/30'
                    : 'bg-pepper-tertiary text-pepper-muted hover:text-pepper-text border border-transparent'
                }`}
              >
                {f === 'all' && 'All'}
                {f === 'active' && `Active (${activeCount})`}
                {f === 'completed' && `Done (${completedCount})`}
                {f === 'high' && '🔥 High Priority'}
              </button>
            ))}
          </div>

          {/* Task List */}
          <ul className="space-y-3">
            {filteredTodos.map((todo, index) => (
              <li 
                key={todo.id} 
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`list-item ${getPriorityClass(todo.priority)} ${
                  draggedItem === index ? 'opacity-50 scale-95' : ''
                } ${expandedTodo === todo.id ? 'ring-1 ring-pepper-accent/30' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Drag Handle */}
                  <div className="cursor-grab active:cursor-grabbing text-pepper-muted hover:text-pepper-accent mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="4" cy="4" r="1.5" />
                      <circle cx="4" cy="8" r="1.5" />
                      <circle cx="4" cy="12" r="1.5" />
                      <circle cx="10" cy="4" r="1.5" />
                      <circle cx="10" cy="8" r="1.5" />
                      <circle cx="10" cy="12" r="1.5" />
                    </svg>
                  </div>
                  
                  {/* Checkbox */}
                  <input 
                    type="checkbox" 
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                    className="custom-checkbox mt-0.5 flex-shrink-0"
                  />
                  
                  {/* Content */}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => toggleExpand(todo.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`${todo.completed ? 'line-through text-pepper-muted' : 'text-pepper-text'}`}>
                        {todo.text}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityBadge(todo.priority)}`}>
                        {todo.priority}
                      </span>
                    </div>
                    
                    {/* Expanded Details */}
                    <div className={`overflow-hidden transition-all duration-300 ${
                      expandedTodo === todo.id ? 'max-h-40 mt-3 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="p-3 rounded-lg bg-pepper-primary/50 border border-pepper-light/10">
                        <p className="text-sm text-pepper-muted">{todo.details}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-pepper-muted/60">
                          <span>Created: {todo.createdAt.toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expand Icon */}
                  <button 
                    onClick={() => toggleExpand(todo.id)}
                    className="text-pepper-muted hover:text-pepper-accent transition-colors p-1"
                  >
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 16 16" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      className={`transition-transform ${expandedTodo === todo.id ? 'rotate-180' : ''}`}
                    >
                      <path d="M4 6L8 10L12 6" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {filteredTodos.length === 0 && (
            <div className="text-center py-8 text-pepper-muted">
              <p>No tasks match your filter</p>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className={`lg:col-span-7 flex flex-col gap-6 ${activeSection !== 'responses' && activeSection !== 'events' ? 'hidden lg:flex' : ''}`}>
          
          {/* Pending Responses */}
          <div className={`glass-card p-6 animate-slide-up animate-delay-200 ${activeSection === 'events' ? 'hidden lg:block' : ''}`}>
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
                  className="list-item flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-sm flex-shrink-0 group-hover:shadow-glow transition-shadow">
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
          <div className={`glass-card p-6 animate-slide-up animate-delay-300 ${activeSection === 'responses' ? 'hidden lg:block' : ''}`}>
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
                  className="list-item flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pepper-accent/20 to-transparent flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-pepper-text">{event.title}</div>
                    <div className="text-sm text-pepper-accent mt-0.5">{event.time}</div>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity text-pepper-muted hover:text-pepper-accent">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 4l6 6-6 6" />
                    </svg>
                  </button>
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
            <div className="stat-card group">
              <div className="relative z-10">
                <div className="text-4xl font-bold text-pepper-accent glow-text group-hover:scale-110 transition-transform">{activeCount}</div>
                <div className="text-sm text-pepper-muted mt-2">Active Tasks</div>
                <div className="w-full bg-pepper-light/30 h-1 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-pepper-accent rounded-full transition-all duration-500" 
                    style={{ width: `${(activeCount / todos.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="stat-card group">
              <div className="relative z-10">
                <div className="text-4xl font-bold text-amber-500 group-hover:scale-110 transition-transform">{pendingResponses.length}</div>
                <div className="text-sm text-pepper-muted mt-2">Pending Responses</div>
                <div className="flex gap-1 mt-3 justify-center">
                  {pendingResponses.slice(0, 4).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-amber-500/60" />
                  ))}
                </div>
              </div>
            </div>
            <div className="stat-card group">
              <div className="relative z-10">
                <div className="text-4xl font-bold text-emerald-500 group-hover:scale-110 transition-transform">{completedCount}</div>
                <div className="text-sm text-pepper-muted mt-2">Completed</div>
                <div className="text-xs text-emerald-500/60 mt-3">
                  {todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0}% done
                </div>
              </div>
            </div>
            <div className="stat-card group">
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-4xl font-bold text-purple-400 group-hover:scale-110 transition-transform">5</span>
                </div>
                <div className="text-sm text-pepper-muted mt-2">Channels Active</div>
                <div className="flex gap-1 mt-3 justify-center text-xs">
                  {['💬', '📧', '📱', '🔔', '💼'].map((emoji, i) => (
                    <span key={i} className="opacity-60 hover:opacity-100 cursor-pointer transition-opacity">{emoji}</span>
                  ))}
                </div>
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
