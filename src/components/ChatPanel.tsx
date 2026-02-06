'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface QuickAction {
  label: string
  emoji: string
  message: string
}

const quickActions: QuickAction[] = [
  { label: 'Check Email', emoji: '📧', message: 'Check my email inbox for anything urgent' },
  { label: 'Weather', emoji: '🌤️', message: "What's the weather like today?" },
  { label: 'Calendar', emoji: '📅', message: 'What do I have on my calendar today?' },
  { label: 'Search', emoji: '🔍', message: 'Search the web for ' },
]

export default function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hey! I'm Pepper, your Chief of Staff. How can I help you today?",
      role: 'assistant',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [showQuickActions, setShowQuickActions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/chat')
        const data = await response.json()
        setConnectionStatus(data.openclawIntegration ? 'connected' : 'disconnected')
      } catch {
        setConnectionStatus('disconnected')
      }
    }
    
    checkConnection()
    const interval = setInterval(checkConnection, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [])

  const sendMessage = useCallback(async (messageText?: string) => {
    const textToSend = messageText || input.trim()
    if (!textToSend || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: textToSend,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setShowQuickActions(false)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      })

      const data = await response.json()

      if (data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          role: 'assistant',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I couldn't process that. Please try again.",
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleQuickAction = (action: QuickAction) => {
    if (action.message.endsWith(' ')) {
      // Search action - put in input for user to complete
      setInput(action.message)
      inputRef.current?.focus()
    } else {
      sendMessage(action.message)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-emerald-500'
      case 'disconnected': return 'bg-amber-500'
      default: return 'bg-gray-500 animate-pulse'
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected to OpenClaw'
      case 'disconnected': return 'Local mode'
      default: return 'Connecting...'
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Chat Panel */}
      <div className={`
        fixed right-0 top-0 h-full w-full sm:w-96 z-50
        bg-pepper-primary border-l border-pepper-light/20
        flex flex-col shadow-2xl
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-pepper-light/20 flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pepper-accent to-pepper-accentDark flex items-center justify-center text-lg shadow-glow">
              🧠
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${getStatusColor()} border-2 border-pepper-primary`} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-pepper-text">Chat with Pepper</h3>
            <p className="text-xs text-pepper-muted flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`} />
              {getStatusText()}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-pepper-light/20 text-pepper-muted hover:text-pepper-text transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`
                max-w-[80%] rounded-2xl px-4 py-3 
                ${message.role === 'user' 
                  ? 'bg-pepper-accent text-white rounded-br-md' 
                  : 'bg-pepper-tertiary text-pepper-text rounded-bl-md border border-pepper-light/10'
                }
              `}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-white/60' : 'text-pepper-muted'
                }`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-pepper-tertiary rounded-2xl rounded-bl-md px-4 py-3 border border-pepper-light/10">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {showQuickActions && messages.length < 3 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-pepper-muted mb-2">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action)}
                  className="
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                    bg-pepper-tertiary border border-pepper-light/20
                    text-pepper-text hover:border-pepper-accent/50 hover:bg-pepper-light/20
                    transition-all duration-200 hover:scale-105
                  "
                >
                  <span>{action.emoji}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-pepper-light/20">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message Pepper..."
              disabled={isLoading}
              className="
                flex-1 bg-pepper-tertiary border border-pepper-light/20 rounded-xl
                px-4 py-3 text-pepper-text placeholder-pepper-muted
                focus:outline-none focus:border-pepper-accent/50 focus:ring-1 focus:ring-pepper-accent/20
                disabled:opacity-50 transition-all
              "
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="
                bg-pepper-accent hover:bg-pepper-accentLight disabled:bg-pepper-light
                text-white px-4 py-3 rounded-xl
                transition-all disabled:opacity-50
                hover:shadow-glow active:scale-95
              "
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 2L9 11M18 2l-6 16-3-7-7-3 16-6z" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-pepper-muted mt-2 text-center">
            Press Enter to send · Powered by OpenClaw
          </p>
        </div>
      </div>
    </>
  )
}
