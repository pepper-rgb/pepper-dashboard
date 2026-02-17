'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { OpenClawClient, ChatMessage } from '@/lib/openclaw-client'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
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
  { label: 'News', emoji: '📰', message: "What's the latest tech and AI news?" },
]

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  content: "Hey! I'm Pepper, your Chief of Staff. How can I help you today?",
  role: 'assistant',
  timestamp: new Date()
}

interface PepperTabProps {
  client: OpenClawClient | null
  connectionStatus: 'checking' | 'connected' | 'disconnected'
}

export default function PepperTab({ client, connectionStatus }: PepperTabProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const registeredRef = useRef(false)
  const isInitialLoad = useRef(true)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
      }
    }, 100)
  }, [])

  useEffect(() => {
    if (isInitialLoad.current) return
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  // Register callbacks and switch to dashboard session
  useEffect(() => {
    if (!client) return
    if (registeredRef.current) return
    registeredRef.current = true
    isInitialLoad.current = true

    client.setCallbacks({
      onChatStream: (text) => {
        isInitialLoad.current = false
        setStreamingText(text)
        setIsLoading(false)
      },
      onChatComplete: (history: ChatMessage[], lastStreamText: string | null) => {
        if (lastStreamText) {
          setMessages(prev => {
            const hasIt = prev.some(m => m.content === lastStreamText && m.role === 'assistant')
            if (hasIt) return prev
            return [...prev, {
              id: `stream-${Date.now()}`,
              content: lastStreamText,
              role: 'assistant',
              timestamp: new Date()
            }]
          })
        }
        setStreamingText(null)
        setIsLoading(false)
        const mapped: Message[] = history.map((m, i) => ({
          id: `gw-${m.timestamp}-${i}`,
          content: m.content,
          role: m.role,
          timestamp: new Date(m.timestamp)
        }))
        if (mapped.length > 0) {
          setMessages([{
            ...WELCOME_MESSAGE,
            timestamp: new Date(mapped[0].timestamp.getTime() - 1000)
          }, ...mapped])
        }
        setTimeout(() => { isInitialLoad.current = false }, 150)
      },
      onChatError: (error) => {
        isInitialLoad.current = false
        setStreamingText(null)
        setIsLoading(false)
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: `Connection issue: ${error}. Retrying...`,
          role: 'assistant',
          timestamp: new Date()
        }])
      }
    })

    client.switchSession('dashboard')

    return () => {
      registeredRef.current = false
    }
  }, [client])

  // Cleanup scroll timer
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
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

    isInitialLoad.current = false
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setShowQuickActions(false)
    setStreamingText(null)

    if (client && client.connectionState === 'connected') {
      await client.sendMessage(textToSend)
    } else {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: textToSend })
        })
        const data = await response.json()
        if (data.response) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            content: data.response,
            role: 'assistant',
            timestamp: new Date()
          }])
        }
      } catch {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          content: "Not connected to Pepper. Please wait for the connection to be established.",
          role: 'assistant',
          timestamp: new Date()
        }])
      }
      setIsLoading(false)
    }
  }, [input, isLoading, client])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleQuickAction = (action: QuickAction) => {
    if (action.message.endsWith(' ')) {
      setInput(action.message)
      inputRef.current?.focus()
    } else {
      sendMessage(action.message)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
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
      case 'disconnected': return 'Reconnecting...'
      default: return 'Connecting...'
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] lg:h-[calc(100vh-48px)]">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-pepper-light/10">
        <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-xs text-pepper-muted">{getStatusText()}</span>
      </div>

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div className={`
              max-w-[70%] sm:max-w-[60%] rounded-2xl px-4 py-3
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

        {/* Streaming response */}
        {streamingText && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[70%] sm:max-w-[60%] rounded-2xl rounded-bl-md px-4 py-3 bg-pepper-tertiary text-pepper-text border border-pepper-light/10">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamingText}</p>
              <p className="text-xs mt-1 text-pepper-muted">typing...</p>
            </div>
          </div>
        )}

        {isLoading && !streamingText && (
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
      <div className="p-4 border-t border-pepper-light/20 safe-area-bottom">
        <div className="flex gap-2 max-w-3xl mx-auto">
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
  )
}
