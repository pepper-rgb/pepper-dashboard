'use client'

import { useState, useEffect, useReducer, useCallback, useRef } from 'react'
import ChatPanel from '@/components/ChatPanel'
import QuickActionsBar from '@/components/QuickActionsBar'
import CalendarWidget from '@/components/CalendarWidget'
import ErrorBoundary from '@/components/ErrorBoundary'
import Toast, { useToast } from '@/components/Toast'
import CommandPalette from '@/components/CommandPalette'
import SettingsPanel from '@/components/SettingsPanel'

// Types
interface EmailContext {
  from: string
  subject: string
  snippet: string
  fullBody?: string
  threadId?: string
  date: string
  hasAttachments?: boolean
}

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
    email?: EmailContext
    calendarEvent?: {
      title: string
      time: string
      attendees?: string[]
    }
    person?: {
      name: string
      company?: string
      lastContact?: string
    }
  }
}

interface PendingResponse {
  id: string
  person: string
  topic: string
  since: string
}

// Reducer for todos
type TodoAction = 
  | { type: 'TOGGLE_COMPLETE'; id: string }
  | { type: 'REORDER'; fromIndex: number; toIndex: number }
  | { type: 'SET_TODOS'; todos: Todo[] }
  | { type: 'ADD_TODO'; todo: Todo }
  | { type: 'UPDATE_TODO'; id: string; updates: Partial<Todo> }
  | { type: 'DELETE_TODO'; id: string }

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
    case 'ADD_TODO':
      return [action.todo, ...state]
    case 'UPDATE_TODO':
      return state.map(todo =>
        todo.id === action.id ? { ...todo, ...action.updates } : todo
      )
    case 'DELETE_TODO':
      return state.filter(todo => todo.id !== action.id)
    default:
      return state
  }
}

type FilterType = 'all' | 'active' | 'completed' | 'high'

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [greeting, setGreeting] = useState('')
  const [mounted, setMounted] = useState(false)
  const [todos, dispatch] = useReducer(todoReducer, [])
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [activeSection, setActiveSection] = useState<'tasks' | 'responses' | 'events'>('tasks')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const chatRef = useRef<{ sendMessage: (msg: string) => void } | null>(null)
  const { toasts, addToast, dismissToast } = useToast()
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Fetch tasks from API
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks')
      const data = await response.json()
      if (data.tasks) {
        dispatch({ type: 'SET_TODOS', todos: data.tasks })
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    fetchTasks()
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [fetchTasks])

  useEffect(() => {
    const hour = currentTime.getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [currentTime])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          setShowNewTask(false)
          setEditingId(null)
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(true)
      }
      if (e.key === 'Escape') {
        setIsChatOpen(false)
        setShowNewTask(false)
        setEditingId(null)
        setIsCommandPaletteOpen(false)
        setIsSettingsOpen(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setShowNewTask(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const pendingResponses: PendingResponse[] = [
    { id: '1', person: 'Spencer Brill', topic: 'NYC dates for meeting', since: 'Feb 5' },
    { id: '2', person: 'Sierra Pena', topic: 'Schedule call', since: 'Feb 5' },
    { id: '3', person: 'Dakota', topic: 'DALE deal counter', since: 'Feb 5' },
    { id: '4', person: 'Luca Rinaldi', topic: 'Tomorrow schedule', since: 'Feb 5' },
  ]

  // Quick action handler - opens chat with prefilled message
  const handleQuickAction = useCallback((message: string) => {
    setPendingMessage(message)
    setIsChatOpen(true)
  }, [])

  // Ask AI about a specific task
  const handleAskAboutTask = useCallback((todo: Todo) => {
    let context = `Regarding task: "${todo.text}"`
    
    if (todo.context?.email) {
      context = `About this email from ${todo.context.email.from} with subject "${todo.context.email.subject}":`
    } else if (todo.context?.person) {
      context = `About ${todo.context.person.name}${todo.context.person.company ? ` from ${todo.context.person.company}` : ''}:`
    }
    
    setPendingMessage(context + ' ')
    setIsChatOpen(true)
  }, [])

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setIsLoading(true)
    fetchTasks()
    addToast('Dashboard refreshed', 'info')
  }, [fetchTasks, addToast])

  // API handlers
  const handleAddTask = async () => {
    if (!newTaskText.trim()) return
    
    const tempId = `temp-${Date.now()}`
    const newTodo: Todo = {
      id: tempId,
      text: newTaskText.trim(),
      completed: false,
      priority: newTaskPriority,
      createdAt: new Date().toISOString(),
      source: 'manual'
    }
    
    dispatch({ type: 'ADD_TODO', todo: newTodo })
    setNewTaskText('')
    setShowNewTask(false)
    addToast('Task added successfully', 'success')
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: { text: newTodo.text, priority: newTodo.priority } })
      })
      const data = await response.json()
      if (data.task) {
        dispatch({ type: 'UPDATE_TODO', id: tempId, updates: { id: data.task.id } })
      }
    } catch (error) {
      console.error('Failed to add task:', error)
      addToast('Failed to save task', 'error')
    }
  }

  const handleUpdateTask = async (id: string, updates: Partial<Todo>) => {
    dispatch({ type: 'UPDATE_TODO', id, updates })
    
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates })
      })
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const handleDeleteTask = async (id: string) => {
    dispatch({ type: 'DELETE_TODO', id })
    addToast('Task deleted', 'info')
    
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Failed to delete task:', error)
      addToast('Failed to delete task', 'error')
    }
  }

  const toggleTodo = (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (todo) {
      handleUpdateTask(id, { completed: !todo.completed })
    }
  }

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  const saveEdit = () => {
    if (editingId && editText.trim()) {
      handleUpdateTask(editingId, { text: editText.trim() })
    }
    setEditingId(null)
    setEditText('')
  }

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

  const toggleExpand = (id: string) => {
    setExpandedTodo(expandedTodo === id ? null : id)
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
      {/* Toast Notifications */}
      <Toast messages={toasts} onDismiss={dismissToast} />
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
          
          <div className="flex items-center gap-3">
            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="glass-card p-3 hover:border-pepper-accent/30 transition-all group"
              title="Settings"
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className="text-pepper-muted group-hover:text-pepper-accent transition-colors group-hover:rotate-45 transition-transform duration-300"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

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
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="hidden md:flex gap-3 text-xs text-pepper-muted">
          <button 
            onClick={() => setIsCommandPaletteOpen(true)}
            className="px-2 py-1 rounded bg-pepper-tertiary border border-pepper-light/10 hover:border-pepper-accent/30 transition-colors cursor-pointer"
          >
            ⌘K Command
          </button>
          <span className="px-2 py-1 rounded bg-pepper-tertiary border border-pepper-light/10">⌘N New Task</span>
          <span className="px-2 py-1 rounded bg-pepper-tertiary border border-pepper-light/10">Esc Close</span>
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

          {/* Filter Tabs + Add Button */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
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
                  {f === 'high' && '🔥 High'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNewTask(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-pepper-accent text-white hover:bg-pepper-accentLight transition-all hover:shadow-glow"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 1v12M1 7h12" />
              </svg>
              Add Task
            </button>
          </div>

          {/* New Task Form */}
          {showNewTask && (
            <div className="mb-4 p-4 rounded-xl bg-pepper-tertiary border border-pepper-accent/30 animate-fade-in">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="What needs to be done?"
                autoFocus
                className="w-full bg-transparent border-none text-pepper-text placeholder-pepper-muted focus:outline-none mb-3"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(['high', 'medium', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewTaskPriority(p)}
                      className={`px-2 py-1 rounded text-xs capitalize transition-all ${
                        newTaskPriority === p
                          ? getPriorityBadge(p) + ' border'
                          : 'bg-pepper-light/20 text-pepper-muted'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewTask(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-pepper-muted hover:text-pepper-text"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={!newTaskText.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs bg-pepper-accent text-white hover:bg-pepper-accentLight disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="list-item animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 rounded bg-pepper-light/30" />
                    <div className="flex-1 h-4 rounded bg-pepper-light/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Task List */
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
                    <div className="flex-1 min-w-0">
                      {editingId === todo.id ? (
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onBlur={saveEdit}
                          onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                          autoFocus
                          className="w-full bg-transparent border-b border-pepper-accent focus:outline-none text-pepper-text"
                        />
                      ) : (
                        <div 
                          className="cursor-pointer"
                          onClick={() => toggleExpand(todo.id)}
                          onDoubleClick={() => startEditing(todo)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`${todo.completed ? 'line-through text-pepper-muted' : 'text-pepper-text'}`}>
                              {todo.text}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityBadge(todo.priority)}`}>
                              {todo.priority}
                            </span>
                            {todo.source === 'memory' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-pepper-accent/10 text-pepper-accent border border-pepper-accent/20">
                                📝 memory
                              </span>
                            )}
                          </div>
                          
                          {/* Expanded Details */}
                          <div className={`overflow-hidden transition-all duration-300 ${
                            expandedTodo === todo.id ? 'max-h-[500px] mt-3 opacity-100' : 'max-h-0 opacity-0'
                          }`}>
                            <div className="p-4 rounded-lg bg-pepper-primary/50 border border-pepper-light/10 space-y-3">
                              {/* Email Context */}
                              {todo.context?.email && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-pepper-muted">
                                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">📧 Email</span>
                                    <span>{todo.context.email.date}</span>
                                    {todo.context.email.hasAttachments && (
                                      <span className="px-2 py-0.5 rounded bg-pepper-light/20">📎</span>
                                    )}
                                  </div>
                                  <div className="text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-pepper-muted">From:</span>
                                      <span className="text-pepper-text font-medium">{todo.context.email.from}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-pepper-muted">Subject:</span>
                                      <span className="text-pepper-text">{todo.context.email.subject}</span>
                                    </div>
                                  </div>
                                  <div className="p-3 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                                    <p className="text-sm text-pepper-text/90 whitespace-pre-wrap leading-relaxed">
                                      {todo.context.email.fullBody || todo.context.email.snippet}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Person Context */}
                              {todo.context?.person && !todo.context?.email && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-sm">
                                    {todo.context.person.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                    <div className="font-medium text-pepper-text">{todo.context.person.name}</div>
                                    {todo.context.person.company && (
                                      <div className="text-xs text-pepper-muted">{todo.context.person.company}</div>
                                    )}
                                    {todo.context.person.lastContact && (
                                      <div className="text-xs text-pepper-muted/60">Last contact: {todo.context.person.lastContact}</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Calendar Event Context */}
                              {todo.context?.calendarEvent && (
                                <div className="p-3 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                                  <div className="flex items-center gap-2 text-xs text-pepper-muted mb-2">
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">📅 Calendar</span>
                                    <span>{todo.context.calendarEvent.time}</span>
                                  </div>
                                  <div className="font-medium text-pepper-text">{todo.context.calendarEvent.title}</div>
                                  {todo.context.calendarEvent.attendees && (
                                    <div className="text-xs text-pepper-muted mt-1">
                                      {todo.context.calendarEvent.attendees.join(', ')}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Basic Details (fallback) */}
                              {!todo.context?.email && !todo.context?.person && !todo.context?.calendarEvent && (
                                <p className="text-sm text-pepper-muted whitespace-pre-wrap">
                                  {todo.details || 'No additional details'}
                                </p>
                              )}

                              {/* Footer with actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-pepper-light/10">
                                <div className="text-xs text-pepper-muted/60">
                                  Created: {new Date(todo.createdAt).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-pepper-muted/60">Double-click to edit</span>
                                  {/* Ask AI Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleAskAboutTask(todo)
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-pepper-accent/20 text-pepper-accent border border-pepper-accent/30 hover:bg-pepper-accent/30 hover:border-pepper-accent/50 transition-all group"
                                  >
                                    <svg 
                                      width="14" 
                                      height="14" 
                                      viewBox="0 0 24 24" 
                                      fill="none" 
                                      stroke="currentColor" 
                                      strokeWidth="2"
                                      className="group-hover:scale-110 transition-transform"
                                    >
                                      <circle cx="12" cy="12" r="3" />
                                      <path d="M12 2v2m0 16v2M2 12h2m16 0h2m-4.2-5.8l1.4-1.4M4.8 19.2l1.4-1.4m0-11.6L4.8 4.8m14.4 14.4l-1.4-1.4" />
                                    </svg>
                                    Ask AI
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {/* Ask AI Button - always visible */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAskAboutTask(todo)
                        }}
                        className="text-pepper-accent/60 hover:text-pepper-accent transition-colors p-1.5 rounded-lg hover:bg-pepper-accent/10"
                        title="Ask AI about this task"
                      >
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v2m0 16v2M2 12h2m16 0h2m-4.2-5.8l1.4-1.4M4.8 19.2l1.4-1.4m0-11.6L4.8 4.8m14.4 14.4l-1.4-1.4" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => toggleExpand(todo.id)}
                        className="text-pepper-muted hover:text-pepper-accent transition-colors p-1"
                        title="Show details"
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
                      <button 
                        onClick={() => handleDeleteTask(todo.id)}
                        className="text-pepper-muted hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                        title="Delete task"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && filteredTodos.length === 0 && (
            <div className="text-center py-8 text-pepper-muted">
              <p className="text-4xl mb-2">✨</p>
              <p>No tasks match your filter</p>
              <button 
                onClick={() => setShowNewTask(true)}
                className="mt-3 text-pepper-accent hover:underline text-sm"
              >
                Add a new task
              </button>
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
              {pendingResponses.map((item) => (
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

          {/* Upcoming Events - Calendar Widget */}
          <div className={`animate-slide-up animate-delay-300 ${activeSection === 'responses' ? 'hidden lg:block' : ''}`}>
            <ErrorBoundary>
              <CalendarWidget />
            </ErrorBoundary>
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
                    style={{ width: `${todos.length ? (activeCount / todos.length) * 100 : 0}%` }}
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

      {/* Floating Chat Button */}
      <button
        onClick={() => setIsChatOpen(true)}
        className={`
          fixed bottom-6 right-6 z-30
          w-14 h-14 rounded-full
          bg-gradient-to-br from-pepper-accent to-pepper-accentDark
          text-white shadow-glow
          flex items-center justify-center
          hover:scale-110 active:scale-95
          transition-all duration-200
          ${isChatOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {/* Notification Badge */}
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full text-xs flex items-center justify-center font-bold">
          1
        </span>
      </button>

      {/* Quick Actions Bar */}
      <QuickActionsBar 
        onAction={handleQuickAction}
        className={isChatOpen ? 'opacity-0 pointer-events-none' : ''}
      />

      {/* Chat Panel */}
      <ChatPanel 
        isOpen={isChatOpen} 
        onClose={() => {
          setIsChatOpen(false)
          setPendingMessage(null)
        }}
        initialMessage={pendingMessage}
        onMessageSent={() => setPendingMessage(null)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenChat={(message) => {
          setIsCommandPaletteOpen(false)
          if (message) {
            setPendingMessage(message)
          }
          setIsChatOpen(true)
        }}
        onAddTask={() => {
          setIsCommandPaletteOpen(false)
          setShowNewTask(true)
        }}
        onRefresh={handleRefresh}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onToast={addToast}
      />
    </main>
  )
}
