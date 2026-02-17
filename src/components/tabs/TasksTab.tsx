'use client'

import { useState, useCallback } from 'react'
import CardChat from '@/components/CardChat'
import CardDetailSheet from '@/components/CardDetailSheet'
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

interface TasksTabProps {
  todos: Todo[]
  dispatch: React.Dispatch<TodoAction>
  client: OpenClawClient | null
  isLoading: boolean
  fetchTasks: () => Promise<void>
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

export default function TasksTab({ todos, dispatch, client, isLoading, fetchTasks, addToast }: TasksTabProps) {
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')

  const activeCount = todos.filter(t => !t.completed).length
  const completedCount = todos.filter(t => t.completed).length

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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-pepper-text">Tasks</h2>
          <p className="text-xs text-pepper-muted mt-0.5">{activeCount} active · {completedCount} completed</p>
        </div>
        <button
          onClick={() => setShowNewTask(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-pepper-accent text-white hover:bg-pepper-accentLight transition-all hover:shadow-glow"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Add Task
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'active', 'completed', 'high'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              filter === f
                ? 'bg-pepper-accent/20 text-pepper-accent border border-pepper-accent/30'
                : 'bg-pepper-tertiary text-pepper-muted hover:text-pepper-text border border-transparent'
            }`}
          >
            {f === 'all' && 'All'}
            {f === 'active' && `Active (${activeCount})`}
            {f === 'completed' && `Done (${completedCount})`}
            {f === 'high' && 'High Priority'}
          </button>
        ))}
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
                            memory
                          </span>
                        )}
                      </div>

                      {/* Expanded Details + CardChat */}
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
                                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Email</span>
                                  <span>{todo.context.email.date}</span>
                                  {todo.context.email.hasAttachments && (
                                    <span className="px-2 py-0.5 rounded bg-pepper-light/20">Attachment</span>
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
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Calendar</span>
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

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-pepper-light/10">
                              <div className="text-xs text-pepper-muted/60">
                                Created: {new Date(todo.createdAt).toLocaleDateString()}
                              </div>
                              <span className="text-xs text-pepper-muted/60">Double-click to edit</span>
                            </div>

                            {/* Per-card chat thread */}
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
                <div className="flex items-center gap-1">
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
        <div className="text-center py-12 text-pepper-muted">
          <p className="text-4xl mb-3">✨</p>
          <p className="text-sm">No tasks match your filter</p>
          <button
            onClick={() => setShowNewTask(true)}
            className="mt-3 text-pepper-accent hover:underline text-sm"
          >
            Add a new task
          </button>
        </div>
      )}
    </div>
  )
}
