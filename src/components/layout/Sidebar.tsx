'use client'

import { TabId } from './BottomTabBar'

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  inboxBadge?: number
  homeBadge?: number
}

const tabs: { id: TabId; label: string; icon: JSX.Element }[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    id: 'people',
    label: 'People',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'health',
    label: 'Health',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
]

export default function Sidebar({ activeTab, onTabChange, inboxBadge, homeBadge }: SidebarProps) {
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full z-30 flex-col bg-pepper-primary/95 backdrop-blur-xl border-r border-pepper-light/20 w-14 xl:w-[200px] transition-all duration-300">
      {/* Logo */}
      <div className="flex items-center h-12 px-3 xl:px-4 border-b border-pepper-light/10">
        <span className="text-pepper-accent font-bold text-sm xl:text-base">P</span>
        <span className="hidden xl:inline text-pepper-accent font-bold text-base ml-0.5">epper</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 space-y-1 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const badge = tab.id === 'inbox' ? inboxBadge : tab.id === 'home' ? homeBadge : undefined
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl
                transition-all duration-200 relative group
                ${isActive
                  ? 'bg-pepper-accent/15 text-pepper-accent'
                  : 'text-pepper-muted hover:text-pepper-text hover:bg-pepper-light/10'
                }
              `}
            >
              <div className="relative flex-shrink-0">
                {tab.icon}
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={`hidden xl:block text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-pepper-accent rounded-r" />
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
