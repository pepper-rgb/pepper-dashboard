'use client'

import { useState } from 'react'

interface QuickAction {
  id: string
  label: string
  emoji: string
  message: string
  color: string
}

const quickActions: QuickAction[] = [
  { id: 'email', label: 'Email', emoji: '📧', message: 'Check my email inbox for anything urgent or important', color: 'from-blue-500 to-blue-600' },
  { id: 'weather', label: 'Weather', emoji: '🌤️', message: "What's the weather forecast for today?", color: 'from-amber-500 to-orange-500' },
  { id: 'search', label: 'Search', emoji: '🔍', message: 'Search the web for ', color: 'from-emerald-500 to-teal-500' },
  { id: 'calendar', label: 'Schedule', emoji: '📅', message: "What's on my calendar today and this week?", color: 'from-purple-500 to-violet-500' },
  { id: 'news', label: 'News', emoji: '📰', message: "What's the latest tech and AI news?", color: 'from-rose-500 to-pink-500' },
]

interface QuickActionsBarProps {
  onAction: (message: string) => void
  className?: string
}

export default function QuickActionsBar({ onAction, className = '' }: QuickActionsBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)

  const handleAction = (action: QuickAction) => {
    if (action.id === 'search') {
      setShowSearchInput(true)
    } else {
      onAction(action.message)
    }
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onAction(`Search the web for ${searchQuery.trim()}`)
      setSearchQuery('')
      setShowSearchInput(false)
    }
  }

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-20 ${className}`}>
      {/* Search Input */}
      {showSearchInput && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 animate-fade-in">
          <div className="glass-card p-2 flex items-center gap-2 shadow-glow">
            <span className="text-lg pl-2">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="What do you want to search for?"
              autoFocus
              className="bg-transparent border-none text-pepper-text placeholder-pepper-muted focus:outline-none w-64 py-2"
            />
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
              className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2L7 9M14 2l-5 14-2-6-5-2 12-4z" />
              </svg>
            </button>
            <button
              onClick={() => setShowSearchInput(false)}
              className="p-2 rounded-lg text-pepper-muted hover:text-pepper-text transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="glass-card px-2 py-2 flex items-center gap-1 shadow-glow-lg">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            onMouseEnter={() => setHoveredAction(action.id)}
            onMouseLeave={() => setHoveredAction(null)}
            className={`
              relative flex items-center gap-2 px-3 py-2 rounded-lg
              transition-all duration-200
              ${hoveredAction === action.id 
                ? `bg-gradient-to-r ${action.color} text-white shadow-glow` 
                : 'hover:bg-pepper-light/30 text-pepper-text'
              }
            `}
          >
            <span className="text-lg">{action.emoji}</span>
            <span className={`
              text-sm font-medium transition-all duration-200 overflow-hidden
              ${hoveredAction === action.id ? 'max-w-24 opacity-100' : 'max-w-0 opacity-0'}
            `}>
              {action.label}
            </span>
          </button>
        ))}

        {/* Divider */}
        <div className="w-px h-8 bg-pepper-light/30 mx-1" />
        
        {/* Refresh */}
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg text-pepper-muted hover:text-pepper-accent hover:bg-pepper-light/30 transition-all"
          title="Refresh dashboard"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1v6h6M17 17v-6h-6" />
            <path d="M3.51 6.5A7 7 0 0 1 15.36 4.64l1.64 1.64M14.49 11.5A7 7 0 0 1 2.64 13.36l-1.64-1.64" />
          </svg>
        </button>
      </div>

      {/* Tooltip */}
      {hoveredAction && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-pepper-muted whitespace-nowrap">
          Press to ask Pepper
        </div>
      )}
    </div>
  )
}
