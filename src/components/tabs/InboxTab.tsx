'use client'

import { useState, useMemo } from 'react'
import CardChat from '@/components/CardChat'
import CardDetailSheet from '@/components/CardDetailSheet'
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

type Channel = 'all' | 'email' | 'slack' | 'imessage'
type StatusFilter = 'needs_action' | 'handled'

interface InboxItem {
  id: string
  channel: 'email' | 'slack' | 'imessage'
  sender: string
  subject: string
  summary: string
  timestamp: string
  status: 'needs_action' | 'handled'
  sourceType: 'task' | 'pending'
  taskId?: string
  context?: string
}

interface InboxTabProps {
  todos: Todo[]
  pendingResponses: PendingResponse[]
  client: OpenClawClient | null
  dispatch: React.Dispatch<any>
}

export default function InboxTab({ todos, pendingResponses, client, dispatch }: InboxTabProps) {
  const [channelFilter, setChannelFilter] = useState<Channel>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('needs_action')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  // Build unified inbox items from tasks and pending responses
  const inboxItems = useMemo((): InboxItem[] => {
    const items: InboxItem[] = []

    // Email tasks
    todos.filter(t => t.type === 'email' || t.context?.email).forEach(t => {
      items.push({
        id: `task-${t.id}`,
        channel: 'email',
        sender: t.context?.email?.from || 'Unknown',
        subject: t.context?.email?.subject || t.text,
        summary: t.context?.email?.snippet || t.details || '',
        timestamp: t.context?.email?.date || t.createdAt,
        status: t.completed ? 'handled' : 'needs_action',
        sourceType: 'task',
        taskId: t.id,
        context: t.context?.email ? `Email from ${t.context.email.from}, subject "${t.context.email.subject}". ${t.context.email.snippet}` : t.text,
      })
    })

    // Pending responses as inbox items
    pendingResponses.forEach(pr => {
      items.push({
        id: `pending-${pr.id}`,
        channel: 'email',
        sender: pr.person,
        subject: pr.topic,
        summary: pr.context || `Waiting for response about ${pr.topic}`,
        timestamp: pr.since,
        status: 'needs_action',
        sourceType: 'pending',
        context: pr.context || `Pending response from ${pr.person} about "${pr.topic}" since ${pr.since}`,
      })
    })

    // Sort by most recent first
    items.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime() || 0
      const dateB = new Date(b.timestamp).getTime() || 0
      return dateB - dateA
    })

    return items
  }, [todos, pendingResponses])

  const filteredItems = useMemo(() => {
    return inboxItems.filter(item => {
      if (channelFilter !== 'all' && item.channel !== channelFilter) return false
      if (item.status !== statusFilter) return false
      return true
    })
  }, [inboxItems, channelFilter, statusFilter])

  const channelCounts = useMemo(() => ({
    all: inboxItems.filter(i => i.status === statusFilter).length,
    email: inboxItems.filter(i => i.channel === 'email' && i.status === statusFilter).length,
    slack: inboxItems.filter(i => i.channel === 'slack' && i.status === statusFilter).length,
    imessage: inboxItems.filter(i => i.channel === 'imessage' && i.status === statusFilter).length,
  }), [inboxItems, statusFilter])

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'email': return { label: 'Email', color: 'bg-blue-500/20 text-blue-400' }
      case 'slack': return { label: 'Slack', color: 'bg-purple-500/20 text-purple-400' }
      case 'imessage': return { label: 'iMessage', color: 'bg-emerald-500/20 text-emerald-400' }
      default: return { label: channel, color: 'bg-pepper-light/20 text-pepper-muted' }
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-pepper-text">Inbox</h2>
        <p className="text-xs text-pepper-muted mt-0.5">
          {inboxItems.filter(i => i.status === 'needs_action').length} need action · {inboxItems.filter(i => i.status === 'handled').length} handled
        </p>
      </div>

      {/* Status toggle */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setStatusFilter('needs_action')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            statusFilter === 'needs_action'
              ? 'bg-pepper-accent/20 text-pepper-accent border border-pepper-accent/30'
              : 'bg-pepper-tertiary text-pepper-muted border border-transparent'
          }`}
        >
          Needs Action
        </button>
        <button
          onClick={() => setStatusFilter('handled')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            statusFilter === 'handled'
              ? 'bg-pepper-accent/20 text-pepper-accent border border-pepper-accent/30'
              : 'bg-pepper-tertiary text-pepper-muted border border-transparent'
          }`}
        >
          Handled
        </button>
      </div>

      {/* Channel filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {(['all', 'email', 'slack', 'imessage'] as const).map(ch => (
          <button
            key={ch}
            onClick={() => setChannelFilter(ch)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              channelFilter === ch
                ? 'bg-pepper-accent text-white'
                : 'bg-pepper-tertiary text-pepper-muted hover:text-pepper-text border border-pepper-light/10'
            }`}
          >
            {ch === 'all' ? `All (${channelCounts.all})` :
             ch === 'email' ? `Email (${channelCounts.email})` :
             ch === 'slack' ? `Slack (${channelCounts.slack})` :
             `iMessage (${channelCounts.imessage})`}
          </button>
        ))}
      </div>

      {/* Message cards */}
      <div className="space-y-3">
        {filteredItems.map(item => {
          const badge = getChannelBadge(item.channel)
          const isExpanded = expandedItem === item.id
          return (
            <div
              key={item.id}
              onClick={() => setExpandedItem(isExpanded ? null : item.id)}
              className={`list-item cursor-pointer transition-all ${
                isExpanded ? 'ring-1 ring-pepper-accent/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-sm flex-shrink-0">
                  {item.sender.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                    <span className="font-medium text-pepper-text text-sm truncate">{item.sender}</span>
                    <span className="text-xs text-pepper-muted/60 ml-auto flex-shrink-0">{item.timestamp}</span>
                  </div>
                  <p className="text-sm text-pepper-text/90 mt-0.5 truncate">{item.subject}</p>
                  <p className="text-xs text-pepper-muted mt-0.5 truncate">{item.summary}</p>
                </div>

                <svg
                  width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`text-pepper-muted transition-transform flex-shrink-0 mt-3 ${isExpanded ? 'rotate-180' : ''}`}
                >
                  <path d="M4 6L8 10L12 6" />
                </svg>
              </div>

              {/* Expanded content */}
              <div className={`overflow-hidden transition-all duration-300 ${
                isExpanded ? 'max-h-[600px] mt-3 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <CardDetailSheet
                  isOpen={isExpanded}
                  onClose={() => setExpandedItem(null)}
                  title={`${item.sender} - ${item.subject}`}
                >
                  <div className="space-y-3">
                    {item.summary && (
                      <div className="p-3 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                        <p className="text-sm text-pepper-text/90 leading-relaxed">{item.summary}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-pepper-muted">
                      <span className={`px-2 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                      <span>{item.timestamp}</span>
                      <span className={`px-2 py-0.5 rounded ${
                        item.status === 'needs_action' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {item.status === 'needs_action' ? 'Needs Action' : 'Handled'}
                      </span>
                    </div>
                    <CardChat
                      sessionKey={item.sourceType === 'task' ? `task-${item.taskId}` : `inbox-${item.id}`}
                      client={client}
                      cardContext={item.context || `${item.sender}: ${item.subject}`}
                      isVisible={isExpanded}
                    />
                  </div>
                </CardDetailSheet>
              </div>
            </div>
          )
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-pepper-muted">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">
            {statusFilter === 'needs_action' ? 'All caught up!' : 'No handled items yet'}
          </p>
        </div>
      )}
    </div>
  )
}
