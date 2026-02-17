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

interface Person {
  id: string
  name: string
  company?: string
  lastChannel: string
  snippet: string
  lastContact: string
  status: 'awaiting_them' | 'awaiting_you' | 'recent'
  context: string
}

interface PeopleTabProps {
  todos: Todo[]
  pendingResponses: PendingResponse[]
  client: OpenClawClient | null
}

export default function PeopleTab({ todos, pendingResponses, client }: PeopleTabProps) {
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null)

  const people = useMemo((): Person[] => {
    const personMap = new Map<string, Person>()

    // From pending responses (these are "awaiting their reply")
    pendingResponses.forEach(pr => {
      const key = pr.person.toLowerCase()
      if (!personMap.has(key)) {
        personMap.set(key, {
          id: `pending-${pr.id}`,
          name: pr.person,
          lastChannel: 'email',
          snippet: pr.topic,
          lastContact: pr.since,
          status: 'awaiting_them',
          context: pr.context || `Pending response from ${pr.person} about "${pr.topic}" since ${pr.since}`,
        })
      }
    })

    // From tasks with person context
    todos.forEach(t => {
      if (t.context?.person) {
        const key = t.context.person.name.toLowerCase()
        if (!personMap.has(key)) {
          personMap.set(key, {
            id: `task-${t.id}`,
            name: t.context.person.name,
            company: t.context.person.company,
            lastChannel: t.context?.email ? 'email' : 'task',
            snippet: t.text,
            lastContact: t.context.person.lastContact || t.createdAt,
            status: t.completed ? 'recent' : 'awaiting_you',
            context: `Task: "${t.text}". Person: ${t.context.person.name}${t.context.person.company ? ` from ${t.context.person.company}` : ''}`,
          })
        }
      }

      // From email tasks with sender info
      if (t.context?.email) {
        const senderName = t.context.email.from.split('<')[0].trim().replace(/"/g, '')
        const key = senderName.toLowerCase()
        if (!personMap.has(key) && senderName.length > 0) {
          personMap.set(key, {
            id: `email-${t.id}`,
            name: senderName,
            lastChannel: 'email',
            snippet: t.context.email.subject,
            lastContact: t.context.email.date || t.createdAt,
            status: t.completed ? 'recent' : 'awaiting_you',
            context: `Email from ${t.context.email.from}, subject "${t.context.email.subject}". ${t.context.email.snippet}`,
          })
        }
      }
    })

    return Array.from(personMap.values())
  }, [todos, pendingResponses])

  const awaitingThem = people.filter(p => p.status === 'awaiting_them')
  const awaitingYou = people.filter(p => p.status === 'awaiting_you')
  const recent = people.filter(p => p.status === 'recent')

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return 'Email'
      case 'slack': return 'Slack'
      case 'imessage': return 'iMessage'
      default: return 'Task'
    }
  }

  const renderSection = (title: string, items: Person[], dotColor: string) => {
    if (items.length === 0) return null
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-pepper-text mb-3 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          {title}
          <span className="text-xs font-normal text-pepper-muted bg-pepper-light/20 px-2 py-0.5 rounded-full">{items.length}</span>
        </h3>
        <div className="space-y-2">
          {items.map(person => {
            const isExpanded = expandedPerson === person.id
            return (
              <div
                key={person.id}
                onClick={() => setExpandedPerson(isExpanded ? null : person.id)}
                className={`list-item cursor-pointer transition-all ${isExpanded ? 'ring-1 ring-pepper-accent/30' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-sm flex-shrink-0">
                    {getInitials(person.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-pepper-text text-sm">{person.name}</span>
                      {person.company && (
                        <span className="text-xs text-pepper-muted truncate">· {person.company}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-pepper-light/20 text-pepper-muted">{getChannelIcon(person.lastChannel)}</span>
                      <span className="text-xs text-pepper-muted truncate">{person.snippet}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs text-pepper-muted/60">{person.lastContact}</span>
                    <svg
                      width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`text-pepper-muted transition-transform mt-1 ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <path d="M4 6L8 10L12 6" />
                    </svg>
                  </div>
                </div>

                {/* Expanded */}
                <div className={`overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'max-h-[600px] mt-3 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <CardDetailSheet
                    isOpen={isExpanded}
                    onClose={() => setExpandedPerson(null)}
                    title={person.name}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pepper-light to-pepper-secondary flex items-center justify-center text-pepper-accent font-semibold text-lg">
                          {getInitials(person.name)}
                        </div>
                        <div>
                          <div className="font-medium text-pepper-text">{person.name}</div>
                          {person.company && <div className="text-xs text-pepper-muted">{person.company}</div>}
                          <div className="text-xs text-pepper-muted/60 mt-0.5">
                            Last: {person.lastChannel} · {person.lastContact}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-pepper-tertiary border border-pepper-light/10">
                        <p className="text-xs text-pepper-muted mb-1">Latest</p>
                        <p className="text-sm text-pepper-text/90">{person.snippet}</p>
                      </div>

                      <CardChat
                        sessionKey={`person-${person.id}`}
                        client={client}
                        cardContext={person.context}
                        isVisible={isExpanded}
                      />
                    </div>
                  </CardDetailSheet>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-pepper-text">People</h2>
        <p className="text-xs text-pepper-muted mt-0.5">{people.length} contacts</p>
      </div>

      {renderSection('Awaiting Their Reply', awaitingThem, 'bg-amber-500')}
      {renderSection('Awaiting Your Reply', awaitingYou, 'bg-red-500')}
      {renderSection('Recent', recent, 'bg-pepper-muted')}

      {people.length === 0 && (
        <div className="text-center py-12 text-pepper-muted">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-sm">No contacts tracked yet</p>
          <p className="text-xs mt-1">Contacts will appear as tasks and emails come in</p>
        </div>
      )}
    </div>
  )
}
