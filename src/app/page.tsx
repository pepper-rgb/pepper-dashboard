'use client'

import { useState, useEffect, useReducer, useCallback, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import { OpenClawClient, ConnectionState } from '@/lib/openclaw-client'
import { GATEWAY_URL, GATEWAY_TOKEN, GATEWAY_PASSWORD, DASHBOARD_DEVICE } from '@/lib/constants'
import { usePolling } from '@/lib/usePolling'

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
  context?: string
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

export default function Dashboard() {
  const [mounted, setMounted] = useState(false)
  const [todos, dispatch] = useReducer(todoReducer, [])
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const clientRef = useRef<OpenClawClient | null>(null)

  const pendingResponses: PendingResponse[] = [
    { id: '1', person: 'Spencer Brill', topic: 'NYC dates for meeting', since: 'Feb 5', context: 'Spencer Brill is a contact you emailed about meeting up in NYC. Waiting for him to send dates.' },
    { id: '2', person: 'Sierra Pena', topic: 'Schedule call', since: 'Feb 5', context: 'Sierra Pena reached out interested in FlightSuite. Waiting for her response to schedule a call.' },
    { id: '3', person: 'Dakota', topic: 'DALE deal counter', since: 'Feb 5', context: 'Dakota from DALE with 17 GHL clients ($4,700 MRR). Sent counter offer: $15k upfront + $5k earnout + 20% expansion revenue.' },
    { id: '4', person: 'Luca Rinaldi', topic: 'Tomorrow schedule', since: 'Feb 5', context: 'Luca Rinaldi is your team member. Asked about his schedule for tomorrow to plan task assignments.' },
  ]

  // Lift OpenClawClient to dashboard level — single shared connection
  useEffect(() => {
    const client = new OpenClawClient({
      gatewayUrl: GATEWAY_URL,
      token: GATEWAY_TOKEN,
      password: GATEWAY_PASSWORD,
      sessionKey: 'dashboard',
      deviceIdentity: DASHBOARD_DEVICE,
      onConnectionChange: (state: ConnectionState) => {
        if (state === 'connected') setConnectionStatus('connected')
        else if (state === 'connecting') setConnectionStatus('checking')
        else setConnectionStatus('disconnected')
      },
    })

    clientRef.current = client
    client.start()

    return () => {
      client.stop()
      clientRef.current = null
    }
  }, [])

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
  }, [fetchTasks])

  // Auto-poll tasks every 30s
  usePolling(fetchTasks, { interval: 30000 })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Command palette handled by AppShell
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!mounted) return null

  return (
    <AppShell
      client={clientRef.current}
      connectionStatus={connectionStatus}
      todos={todos}
      dispatch={dispatch}
      fetchTasks={fetchTasks}
      isLoading={isLoading}
      pendingResponses={pendingResponses}
    />
  )
}
