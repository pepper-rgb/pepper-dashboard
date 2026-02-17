'use client'

import { useState, useCallback, useMemo } from 'react'
import BottomTabBar, { TabId } from './BottomTabBar'
import Sidebar from './Sidebar'
import HomeTab from '@/components/tabs/HomeTab'
import InboxTab from '@/components/tabs/InboxTab'
import PeopleTab from '@/components/tabs/PeopleTab'
import HealthTab from '@/components/tabs/HealthTab'
import ChatPanel from '@/components/ChatPanel'
import CommandPalette from '@/components/CommandPalette'
import SettingsPanel from '@/components/SettingsPanel'
import Toast, { useToast } from '@/components/Toast'
import { OpenClawClient } from '@/lib/openclaw-client'

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
    email?: {
      from: string
      subject: string
      snippet: string
      fullBody?: string
      threadId?: string
      date: string
      hasAttachments?: boolean
    }
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

interface AppShellProps {
  client: OpenClawClient | null
  connectionStatus: 'checking' | 'connected' | 'disconnected'
  todos: Todo[]
  dispatch: React.Dispatch<any>
  fetchTasks: () => Promise<void>
  isLoading: boolean
  pendingResponses: PendingResponse[]
}

export default function AppShell({
  client,
  connectionStatus,
  todos,
  dispatch,
  fetchTasks,
  isLoading,
  pendingResponses,
}: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { toasts, addToast, dismissToast } = useToast()

  const inboxBadge = useMemo(() => {
    const emailTasks = todos.filter(t => t.type === 'email' && !t.completed)
    return emailTasks.length + pendingResponses.length
  }, [todos, pendingResponses])

  const homeBadge = useMemo(() => {
    return todos.filter(t => t.priority === 'high' && !t.completed).length
  }, [todos])

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
  }, [])

  const handleRefresh = useCallback(() => {
    fetchTasks()
    addToast('Dashboard refreshed', 'info')
  }, [fetchTasks, addToast])

  return (
    <>
      <Toast messages={toasts} onDismiss={dismissToast} />

      {/* Desktop sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        inboxBadge={inboxBadge}
        homeBadge={homeBadge}
      />

      {/* Main content area */}
      <div className="lg:ml-14 xl:ml-[200px] pb-16 lg:pb-0 transition-all duration-300">
        {/* Compact header */}
        <header className="sticky top-0 z-20 bg-pepper-primary/90 backdrop-blur-xl border-b border-pepper-light/10">
          <div className="flex items-center justify-between h-12 px-4">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="text-pepper-accent font-bold text-sm">Pepper</span>
            </div>
            <div className="hidden lg:block" />

            <div className="flex items-center gap-3">
              {/* Connection status */}
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-emerald-500' :
                  connectionStatus === 'disconnected' ? 'bg-amber-500' :
                  'bg-gray-500 animate-pulse'
                }`} />
                <span className="text-xs text-pepper-muted hidden sm:block">
                  {connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'disconnected' ? 'Offline' : 'Connecting'}
                </span>
              </div>

              {/* Settings */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg text-pepper-muted hover:text-pepper-accent hover:bg-pepper-light/10 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Tab content */}
        <main className="min-h-[calc(100vh-48px)]">
          {activeTab === 'home' && (
            <HomeTab
              todos={todos}
              dispatch={dispatch}
              client={client}
              isLoading={isLoading}
              pendingResponses={pendingResponses}
              addToast={addToast}
              fetchTasks={fetchTasks}
            />
          )}
          {activeTab === 'inbox' && (
            <InboxTab
              todos={todos}
              pendingResponses={pendingResponses}
              client={client}
              dispatch={dispatch}
            />
          )}
          {activeTab === 'people' && (
            <PeopleTab
              todos={todos}
              pendingResponses={pendingResponses}
              client={client}
            />
          )}
          {activeTab === 'health' && (
            <HealthTab client={client} />
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        inboxBadge={inboxBadge}
        homeBadge={homeBadge}
      />

      {/* Chat FAB — floating button for general Pepper conversations */}
      <button
        onClick={() => setIsChatOpen(true)}
        className={`
          fixed z-30 w-12 h-12 rounded-full
          bg-gradient-to-br from-pepper-accent to-pepper-accentDark
          text-white shadow-glow
          flex items-center justify-center
          hover:scale-110 active:scale-95
          transition-all duration-200
          bottom-20 right-4 lg:bottom-6 lg:right-6
          ${isChatOpen ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100'}
        `}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Chat Panel (slide-out for general Pepper chat) */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        client={client}
        connectionStatus={connectionStatus}
      />

      {/* Overlays */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenChat={() => {
          setIsCommandPaletteOpen(false)
          setIsChatOpen(true)
        }}
        onAddTask={() => {
          setIsCommandPaletteOpen(false)
          setActiveTab('home')
        }}
        onRefresh={handleRefresh}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onToast={addToast}
      />
    </>
  )
}
