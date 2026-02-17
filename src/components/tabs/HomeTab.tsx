'use client'

import { useState, useCallback, useMemo } from 'react'
import CardChat from '@/components/CardChat'
import CardDetailSheet from '@/components/CardDetailSheet'
import CalendarWidget from '@/components/CalendarWidget'
import ErrorBoundary from '@/components/ErrorBoundary'
import { OpenClawClient } from '@/lib/openclaw-client'

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

type TodoAction =
  | { type: 'TOGGLE_COMPLETE'; id: string }
  | { type: 'REORDER'; fromIndex: number; toIndex: number }
  | { type: 'SET_TODOS'; todos: Todo[] }
  | { type: 'ADD_TODO'; todo: Todo }
  | { type: 'UPDATE_TODO'; id: string; updates: Partial<Todo> }
  | { type: 'DELETE_TODO'; id: string }

type FilterType = 'all' | 'active' | 'completed' | 'high'

function buildTaskContext(todo: Todo): string {
  if (todo.context?.email) {
    const e = todo.context.email
    return `Task: "${todo.text}". Email from ${e.from}, subject "${e.subject}". Snippet: ${e.snippet}`
  }
  if (todo.context?.person) {
    const p = todo.context.person
    return `Task: "${todo.text}". Person: ${p.name}${p.company ? ` from ${p.company}` : ''}${p.lastContact ? `, last contact: ${p.lastContact}` : ''}`
  }
  if (todo.context?.calendarEvent) {
    const c = todo.context.calendarEvent
    return `Task: "${todo.text}". Calendar event: "${c.title}" at ${c.time}${c.attendees?.length ? `, attendees: ${c.attendees.join(', ')}` : ''}`
  }
  return `Task: "${todo.text}"${todo.details ? `. Details: ${todo.details}` : ''}`
}

function buildResponseContext(item: PendingResponse): string {
  return `Pending response from ${item.person} about "${item.topic}" (since ${item.since}).${item.context ? ` Context: ${item.context}` : ''}`
}

interface HomeTabProps {
  todos: Todo[]
  dispatch: React.Dispatch<TodoAction>
  client: OpenClawClient | null
  isLoading: boolean
  pendingResponses: PendingResponse[]
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
  fetchTasks: () => Promise<void>
}

export default function HomeTab({ todos, dispatch, client, isLoading, pendingResponses, addToast }: HomeTabProps) {
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null)
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')

  const activeCount = todos.filter(t => !t.completed).length
  const completedCount = todos.filter(t => t.completed).length
  const highPriorityCount = todos.filter(t => t.priority === 'high' && !t.completed).length

  const handledToday = useMemo(() => {
    const today = new Date().toDateString()
    return todos.filter(t => t.completed && new Date(t.createdAt).toDateString() === today).length
  }, [todos])

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active': return !todo.completed
      case 'completed': return todo.completed
      case 'high': return todo.priority === 'high'
      default: return true
    }
  })

  const handleUpdateTask = useCallback(async (id: string, updates: Partial<Todo>) => {
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
  }, [dispatch])

  const handleDeleteTask = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_TODO', id })
    addToast('Task deleted', 'info')
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Failed to delete task:', error)
      addToast('Failed to delete task', 'error')
    }
  }, [dispatch, addToast])

  const toggleTodo = (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (todo) handleUpdateTask(id, { completed: !todo.completed })
  }

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
    addToast('Task added', 'success')
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

  const handleDragStart = (index: number) => setDraggedItem(index)
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedItem === null || draggedItem === index) return
    dispatch({ type: 'REORDER', fromIndex: draggedItem, toIndex: index })
    setDraggedItem(index)
  }
  const handleDragEnd = () => setDraggedItem(null)

  const toggleExpand = (id: string) => setExpandedTodo(expandedTodo === id ? null : id)
  const toggleResponseExpand = (id: string) => setExpandedResponse(expandedResponse === id ? null : id)

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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">

      {/* Briefing Banner */}
      <div className="glass-card p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pepper-accent to-pepper-accentDark flex items-center justify-center shadow-glow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-pepper-text">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-red-400">{highPriorityCount}</span>
            <span className="text-xs text-pepper-muted">need you</span>
          </div>
          <div className="w-px h-6 bg-pepper-light/20" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-emerald-400">{handledToday}</span>
            <span className="text-xs text-pepper-muted">handled</span>
          </div>
          <div className="w-px h-6 bg-pepper-light/20" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-amber-400">{pendingResponses.length}</span>
            <span className="text-xs text-pepper-muted">awaiting</span>
          </div>
          <div className="w-px h-6 bg-pepper-light/20" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-pepper-accent">{activeCount}</span>
            <span className="text-xs text-pepper-muted">active</span>
          </div>
        </div>
      </div>

      {/* Tasks Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-pepper-text">Tasks</h2>
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-pepper-accent text-white hover:bg-pepper-accentLight transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 1v12M1 7h12" />
            </svg>
            Add
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {(['all', 'active', 'completed', 'high'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-pepper-accent/20 text-pepper-accent border border-pepper-accent/30'
                  : 'bg-pepper-tertiary text-pepper-muted border border-transparent'
              }`}
            >
              {f === 'all' && 'All'}
              {f === 'active' && `Active (${activeCount})`}
              {f === 'completed' && `Done (${completedCount})`}
              {f === 'high' && 'Urgent'}
            </button>
          ))}
        </div>

        {/* New Task Form */}
        {showNewTask && (
          <div className="mb-3 p-3 rounded-xl bg-pepper-tertiary border border-pepper-accent/30 animate-fade-in">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full bg-transparent border-none text-pepper-text placeholder-pepper-muted focus:outline-none mb-2 text-sm"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {(['high', 'medium', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewTaskPriority(p)}
                    className={`px-2 py-0.5 rounded text-[10px] capitalize transition-all ${
                      newTaskPriority === p
                        ? getPriorityBadge(p) + ' border'
                        : 'bg-pepper-light/20 text-pepper-muted'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setShowNewTask(false)} className="px-2 py-1 rounded text-xs text-pepper-muted">
                  Cancel
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskText.trim()}
                  className="px-2 py-1 rounded text-xs bg-pepper-accent text-white disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="list-item animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-pepper-light/30" />
                  <div className="flex-1 h-3 rounded bg-pepper-light/30" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
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
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                    onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="w-full bg-transparent border-b border-pepper-accent focus:outline-none text-pepper-text text-sm"
                      />
                    ) : (
                      <div
                        className="cursor-pointer"
                        onClick={() => toggleExpand(todo.id)}
                        onDoubleClick={() => startEditing(todo)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm ${todo.completed ? 'line-through text-pepper-muted' : 'text-pepper-text'}`}>
                            {todo.text}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getPriorityBadge(todo.priority)}`}>
                            {todo.priority}
                          </span>
                          {todo.source === 'memory' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pepper-accent/10 text-pepper-accent border border-pepper-accent/20">
                              memory
                            </span>
                          )}
                        </div>

                        {/* Expanded content */}
                        <div className={`overflow-hidden transition-all duration-300 ${
                          expandedTodo === todo.id ? 'max-h-[800px] mt-3 opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                          <CardDetailSheet
                            isOpen={expandedTodo === todo.id}
                            onClose={() => setExpandedTodo(null)}
                            title={todo.text}
                          >
                            <div className="space-y-3">
                              {/* Email Context */}
                              {todo.context?.email && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-pepper-muted">
                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Email</span>
                                    <span>{todo.context.email.date}</span>
                                  </div>
                                  <div className="text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-pepper-muted text-xs">From:</span>
                                      <span className="text-pepper-text font-medium text-xs">{todo.context.email.from}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-pepper-muted text-xs">Subject:</span>
                                      <span className="text-pepper-text text-xs">{todo.context.email.subject}</span>
                                    </div>
                                  </div>
                                  <div className="p-2.5 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                                    <p className="text-xs text-pepper-text/90 whitespace-pre-wrap leading-relaxed">
                                      {todo.context.email.fullBody || todo.context.email.snippet}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Person Context */}
                              {todo.context?.person && !todo.context?.email && (
                                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-xs">
                                    {todo.context.person.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                    <div className="font-medium text-pepper-text text-sm">{todo.context.person.name}</div>
                                    {todo.context.person.company && (
                                      <div className="text-xs text-pepper-muted">{todo.context.person.company}</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Calendar */}
                              {todo.context?.calendarEvent && (
                                <div className="p-2.5 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                                  <div className="flex items-center gap-2 text-xs text-pepper-muted mb-1">
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Calendar</span>
                                    <span>{todo.context.calendarEvent.time}</span>
                                  </div>
                                  <div className="font-medium text-pepper-text text-sm">{todo.context.calendarEvent.title}</div>
                                </div>
                              )}

                              {/* Fallback */}
                              {!todo.context?.email && !todo.context?.person && !todo.context?.calendarEvent && (
                                <p className="text-xs text-pepper-muted">{todo.details || 'No additional details'}</p>
                              )}

                              {/* CardChat */}
                              <CardChat
                                sessionKey={`task-${todo.id}`}
                                client={client}
                                cardContext={buildTaskContext(todo)}
                                isVisible={expandedTodo === todo.id}
                              />
                            </div>
                          </CardDetailSheet>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(todo.id) }}
                      className="text-pepper-muted hover:text-pepper-accent transition-colors p-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`transition-transform ${expandedTodo === todo.id ? 'rotate-180' : ''}`}>
                        <path d="M4 6L8 10L12 6" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTask(todo.id) }}
                      className="text-pepper-muted hover:text-red-400 transition-colors p-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
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
            <p className="text-3xl mb-2">✨</p>
            <p className="text-sm">No tasks match your filter</p>
            <button onClick={() => setShowNewTask(true)} className="mt-2 text-pepper-accent text-xs hover:underline">
              Add a new task
            </button>
          </div>
        )}
      </div>

      {/* Awaiting Responses */}
      {pendingResponses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-pepper-text mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Awaiting Response
            <span className="text-xs font-normal text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full ml-auto">
              {pendingResponses.length}
            </span>
          </h2>
          <div className="space-y-2">
            {pendingResponses.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleResponseExpand(item.id)}
                className={`list-item cursor-pointer ${expandedResponse === item.id ? 'ring-1 ring-pepper-accent/30' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-xs flex-shrink-0">
                    {item.person.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-pepper-text text-sm truncate">{item.person}</div>
                    <div className="text-xs text-pepper-muted truncate">{item.topic}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-pepper-muted/60">{item.since}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`text-pepper-muted transition-transform ${expandedResponse === item.id ? 'rotate-180' : ''}`}>
                      <path d="M4 6L8 10L12 6" />
                    </svg>
                  </div>
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${
                  expandedResponse === item.id ? 'max-h-[600px] mt-3 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <CardDetailSheet
                    isOpen={expandedResponse === item.id}
                    onClose={() => setExpandedResponse(null)}
                    title={`${item.person} - ${item.topic}`}
                  >
                    <div className="space-y-3">
                      {item.context && (
                        <div className="p-2.5 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                          <p className="text-xs text-pepper-text/90 leading-relaxed">{item.context}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-pepper-muted">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Waiting since {item.since}</span>
                      </div>
                      <CardChat
                        sessionKey={`response-${item.id}`}
                        client={client}
                        cardContext={buildResponseContext(item)}
                        isVisible={expandedResponse === item.id}
                      />
                    </div>
                  </CardDetailSheet>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div className="mb-6">
        <ErrorBoundary>
          <CalendarWidget />
        </ErrorBoundary>
      </div>
    </div>
  )
}
