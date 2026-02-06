'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { OpenClawClient, ChatMessage } from '@/lib/openclaw-client'

interface CardChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface CardChatProps {
  sessionKey: string
  client: OpenClawClient | null
  cardContext: string
  isVisible: boolean
}

export default function CardChat({ sessionKey, client, cardContext, isVisible }: CardChatProps) {
  const [messages, setMessages] = useState<CardChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasContextSent = useRef(false)
  const activeSessionRef = useRef<string | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText])

  // Switch session and register callbacks when this card chat becomes visible
  useEffect(() => {
    if (!isVisible || !client) return
    if (activeSessionRef.current === sessionKey) return

    activeSessionRef.current = sessionKey

    client.setCallbacks({
      onChatStream: (text) => {
        setStreamingText(text)
        setIsLoading(false)
      },
      onChatComplete: (history: ChatMessage[], lastStreamText: string | null) => {
        // Streaming bug fix: promote streamed text immediately
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
        const mapped: CardChatMessage[] = history.map((m, i) => ({
          id: `gw-${m.timestamp}-${i}`,
          content: m.content,
          role: m.role,
          timestamp: new Date(m.timestamp)
        }))
        setMessages(mapped)
        // If there's existing history, context has already been sent
        if (mapped.length > 0) {
          hasContextSent.current = true
        }
      },
      onChatError: (error) => {
        setStreamingText(null)
        setIsLoading(false)
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: `Error: ${error}`,
          role: 'assistant',
          timestamp: new Date()
        }])
      }
    })

    client.switchSession(sessionKey)
  }, [isVisible, client, sessionKey])

  // Reset when becoming invisible
  useEffect(() => {
    if (!isVisible) {
      activeSessionRef.current = null
    }
  }, [isVisible])

  const sendMessage = useCallback(async (messageText?: string) => {
    const textToSend = messageText || input.trim()
    if (!textToSend || isLoading || !client) return

    // First message in a new session: prepend card context
    let finalText = textToSend
    if (!hasContextSent.current) {
      finalText = `[Context: ${cardContext}]\n\n${textToSend}`
      hasContextSent.current = true
    }

    const userMessage: CardChatMessage = {
      id: Date.now().toString(),
      content: textToSend, // Show user's text without context prefix
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setStreamingText(null)

    if (client.connectionState === 'connected') {
      await client.sendMessage(finalText)
    } else {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: "Not connected to Pepper. Please wait for the connection.",
        role: 'assistant',
        timestamp: new Date()
      }])
      setIsLoading(false)
    }
  }, [input, isLoading, client, cardContext])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isVisible) return null

  return (
    <div className="mt-3 border-t border-pepper-light/10 pt-3">
      {/* Message history */}
      <div className="max-h-48 overflow-y-auto space-y-2 mb-2">
        {messages.length === 0 && !streamingText && !isLoading && (
          <p className="text-xs text-pepper-muted text-center py-2">
            Ask Pepper about this item...
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[85%] rounded-xl px-3 py-2
              ${msg.role === 'user'
                ? 'bg-pepper-accent text-white rounded-br-sm'
                : 'bg-pepper-primary/60 text-pepper-text rounded-bl-sm border border-pepper-light/10'
              }
            `}>
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl rounded-bl-sm px-3 py-2 bg-pepper-primary/60 text-pepper-text border border-pepper-light/10">
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{streamingText}</p>
              <p className="text-[10px] mt-0.5 text-pepper-muted">typing...</p>
            </div>
          </div>
        )}

        {/* Loading dots */}
        {isLoading && !streamingText && (
          <div className="flex justify-start">
            <div className="bg-pepper-primary/60 rounded-xl rounded-bl-sm px-3 py-2 border border-pepper-light/10">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask Pepper..."
          disabled={isLoading}
          className="
            flex-1 bg-pepper-primary/50 border border-pepper-light/20 rounded-lg
            px-3 py-2 text-xs text-pepper-text placeholder-pepper-muted
            focus:outline-none focus:border-pepper-accent/50
            disabled:opacity-50 transition-all
          "
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          className="
            bg-pepper-accent hover:bg-pepper-accentLight disabled:bg-pepper-light
            text-white px-2.5 py-2 rounded-lg
            transition-all disabled:opacity-50
            active:scale-95 text-xs
          "
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 2L9 11M18 2l-6 16-3-7-7-3 16-6z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
