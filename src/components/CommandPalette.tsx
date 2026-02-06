'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Command {
  id: string
  label: string
  icon: string
  shortcut?: string
  action: () => void
  category: 'navigation' | 'actions' | 'chat'
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onOpenChat: (message?: string) => void
  onAddTask: () => void
  onRefresh: () => void
}

export default function CommandPalette({ 
  isOpen, 
  onClose, 
  onOpenChat, 
  onAddTask,
  onRefresh 
}: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Command[] = [
    { id: 'chat', label: 'Open Chat', icon: '💬', shortcut: '⌘K', action: () => onOpenChat(), category: 'navigation' },
    { id: 'task', label: 'Add New Task', icon: '➕', shortcut: '⌘N', action: onAddTask, category: 'actions' },
    { id: 'refresh', label: 'Refresh Dashboard', icon: '🔄', shortcut: '⌘R', action: onRefresh, category: 'actions' },
    { id: 'email', label: 'Check Email', icon: '📧', action: () => onOpenChat('Check my email inbox for anything urgent'), category: 'chat' },
    { id: 'weather', label: 'Get Weather', icon: '🌤️', action: () => onOpenChat("What's the weather forecast today?"), category: 'chat' },
    { id: 'calendar', label: 'View Calendar', icon: '📅', action: () => onOpenChat("What's on my calendar today?"), category: 'chat' },
    { id: 'search', label: 'Web Search...', icon: '🔍', action: () => onOpenChat('Search the web for '), category: 'chat' },
    { id: 'news', label: 'Latest News', icon: '📰', action: () => onOpenChat("What's the latest tech news?"), category: 'chat' },
  ]

  const filteredCommands = search
    ? commands.filter(cmd => 
        cmd.label.toLowerCase().includes(search.toLowerCase())
      )
    : commands

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
          onClose()
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setSearch('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Palette */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 animate-slide-up">
        <div className="glass-card overflow-hidden shadow-glow-lg mx-4">
          {/* Search Input */}
          <div className="p-4 border-b border-pepper-light/20">
            <div className="flex items-center gap-3">
              <span className="text-pepper-accent">⌘</span>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none text-pepper-text placeholder-pepper-muted focus:outline-none text-lg"
              />
              <kbd className="px-2 py-1 rounded bg-pepper-tertiary text-pepper-muted text-xs">esc</kbd>
            </div>
          </div>

          {/* Commands List */}
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-pepper-muted">
                <p className="text-2xl mb-2">🔍</p>
                <p>No commands found</p>
              </div>
            ) : (
              <>
                {['navigation', 'actions', 'chat'].map(category => {
                  const categoryCommands = filteredCommands.filter(c => c.category === category)
                  if (categoryCommands.length === 0) return null
                  
                  return (
                    <div key={category} className="mb-2">
                      <p className="px-3 py-1 text-xs text-pepper-muted uppercase tracking-wider">
                        {category}
                      </p>
                      {categoryCommands.map((cmd) => {
                        const globalIndex = filteredCommands.indexOf(cmd)
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => {
                              cmd.action()
                              onClose()
                            }}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                              transition-all duration-150
                              ${globalIndex === selectedIndex 
                                ? 'bg-pepper-accent text-white' 
                                : 'hover:bg-pepper-light/20 text-pepper-text'
                              }
                            `}
                          >
                            <span className="text-lg">{cmd.icon}</span>
                            <span className="flex-1 text-left">{cmd.label}</span>
                            {cmd.shortcut && (
                              <kbd className={`px-2 py-0.5 rounded text-xs ${
                                globalIndex === selectedIndex 
                                  ? 'bg-white/20 text-white'
                                  : 'bg-pepper-tertiary text-pepper-muted'
                              }`}>
                                {cmd.shortcut}
                              </kbd>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-pepper-light/20 flex items-center justify-between text-xs text-pepper-muted">
            <div className="flex gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
            </div>
            <span>Powered by Pepper</span>
          </div>
        </div>
      </div>
    </>
  )
}
