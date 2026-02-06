'use client'

import { useState, useEffect, useCallback } from 'react'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  onToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

interface Settings {
  imessage: {
    enabled: boolean
    dmPolicy: string
    allowFrom: string[]
    groupPolicy: string
  }
  gateway: {
    status: 'connected' | 'disconnected' | 'checking'
    url: string
    port: number
    mode: string
    bind: string
  }
  tailscale: {
    mode: string
    enabled: boolean
  }
}

// Format phone number for display: +19043076970 -> +1 904-307-6970
function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  
  if (digits.length === 10) {
    return `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  
  return phone
}

// Known contacts mapping (could be enhanced to fetch from a contacts API)
const knownContacts: Record<string, string> = {
  '+19043076970': 'Fitz Light',
  '+15409409538': 'Unknown',
  '+19045212299': 'Unknown',
  '+19807660008': 'Unknown',
  '+14077990442': 'Unknown',
  '+14047077948': 'Unknown',
  '+12486725040': 'Unknown'
}

export default function SettingsPanel({ isOpen, onClose, onToast }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [isAddingNumber, setIsAddingNumber] = useState(false)
  const [removingNumber, setRemovingNumber] = useState<string | null>(null)

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/settings')
      const data = await response.json()
      
      if (data.status === 'success') {
        setSettings(data.settings)
      } else {
        onToast('Failed to load settings', 'error')
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      onToast('Failed to load settings', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
    }
  }, [isOpen, fetchSettings])

  // Add phone number to allowlist
  const handleAddNumber = async () => {
    if (!newPhoneNumber.trim()) return
    
    setIsAddingNumber(true)
    try {
      const response = await fetch('/api/settings/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          phoneNumber: newPhoneNumber.trim()
        })
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        setSettings(prev => prev ? {
          ...prev,
          imessage: { ...prev.imessage, allowFrom: data.allowFrom }
        } : null)
        setNewPhoneNumber('')
        onToast('Phone number added to allowlist', 'success')
      } else {
        onToast(data.error || 'Failed to add phone number', 'error')
      }
    } catch (error) {
      console.error('Failed to add number:', error)
      onToast('Failed to add phone number', 'error')
    } finally {
      setIsAddingNumber(false)
    }
  }

  // Remove phone number from allowlist
  const handleRemoveNumber = async (phoneNumber: string) => {
    setRemovingNumber(phoneNumber)
    try {
      const response = await fetch('/api/settings/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          phoneNumber
        })
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        setSettings(prev => prev ? {
          ...prev,
          imessage: { ...prev.imessage, allowFrom: data.allowFrom }
        } : null)
        onToast('Phone number removed from allowlist', 'success')
      } else {
        onToast(data.error || 'Failed to remove phone number', 'error')
      }
    } catch (error) {
      console.error('Failed to remove number:', error)
      onToast('Failed to remove phone number', 'error')
    } finally {
      setRemovingNumber(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddNumber()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Settings Panel */}
      <div className={`
        fixed right-0 top-0 h-full w-full sm:w-[420px] z-50
        bg-pepper-primary border-l border-pepper-light/20
        flex flex-col shadow-2xl
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-pepper-light/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pepper-accent to-pepper-accentDark flex items-center justify-center text-lg shadow-glow">
            ⚙️
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-pepper-text">Settings</h3>
            <p className="text-xs text-pepper-muted">Manage allowlist & gateway</p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-pepper-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : !settings ? (
            /* Not Connected State */
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🔌</span>
                  <div>
                    <h4 className="font-medium text-amber-400">Not Connected to Gateway</h4>
                    <p className="text-xs text-pepper-muted mt-1">
                      Settings require a connection to the local OpenClaw gateway
                    </p>
                  </div>
                </div>
                <div className="text-sm text-pepper-muted space-y-2">
                  <p>To enable full functionality:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Connect Tailscale on your Mac mini</li>
                    <li>Configure the dashboard to use Tailscale URL</li>
                    <li>Or access this dashboard from the local network</li>
                  </ol>
                </div>
              </div>

              {/* Show what would be available */}
              <section className="space-y-3 opacity-50">
                <h4 className="text-sm font-semibold text-pepper-text flex items-center gap-2">
                  <span>🌐</span> Gateway Status
                  <span className="text-xs bg-pepper-light/20 px-2 py-0.5 rounded">Unavailable</span>
                </h4>
                <div className="bg-pepper-tertiary rounded-xl p-4 border border-pepper-light/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pepper-muted">Connection</span>
                    <span className="text-sm text-amber-400">Not Connected</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3 opacity-50">
                <h4 className="text-sm font-semibold text-pepper-text flex items-center gap-2">
                  <span>📱</span> Allowlist
                  <span className="text-xs bg-pepper-light/20 px-2 py-0.5 rounded">Unavailable</span>
                </h4>
                <div className="bg-pepper-tertiary rounded-xl p-4 border border-pepper-light/10">
                  <p className="text-sm text-pepper-muted text-center">
                    Manage allowlist requires gateway connection
                  </p>
                </div>
              </section>

              <button
                onClick={fetchSettings}
                className="
                  w-full py-3 rounded-xl border border-pepper-light/20
                  text-pepper-muted hover:text-pepper-text hover:border-pepper-light/40
                  transition-colors flex items-center justify-center gap-2 text-sm
                "
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 8a7 7 0 0 1 13-3.5M15 8a7 7 0 0 1-13 3.5" />
                  <path d="M14 1v4h-4M2 15v-4h4" />
                </svg>
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              {/* Gateway Status Section */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-pepper-text flex items-center gap-2">
                  <span>🌐</span> Gateway Status
                </h4>
                <div className="bg-pepper-tertiary rounded-xl p-4 border border-pepper-light/10 space-y-3">
                  {/* Connection Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pepper-muted">Connection</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        settings.gateway.status === 'connected' 
                          ? 'bg-emerald-500' 
                          : 'bg-amber-500'
                      }`} />
                      <span className={`text-sm font-medium ${
                        settings.gateway.status === 'connected'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}>
                        {settings.gateway.status === 'connected' ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Gateway URL */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pepper-muted">Gateway URL</span>
                    <code className="text-xs bg-pepper-light/20 px-2 py-1 rounded text-pepper-accent">
                      {settings.gateway.url}
                    </code>
                  </div>
                  
                  {/* Mode */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pepper-muted">Mode</span>
                    <span className="text-sm text-pepper-text capitalize">{settings.gateway.mode}</span>
                  </div>
                  
                  {/* Tailscale */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pepper-muted">Tailscale</span>
                    <span className={`text-sm ${
                      settings.tailscale.enabled 
                        ? 'text-emerald-400' 
                        : 'text-pepper-muted'
                    }`}>
                      {settings.tailscale.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </section>

              {/* iMessage Settings Section */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-pepper-text flex items-center gap-2">
                  <span>💬</span> iMessage Settings
                </h4>
                <div className="bg-pepper-tertiary rounded-xl p-4 border border-pepper-light/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pepper-muted">Status</span>
                    <span className={`text-sm font-medium ${
                      settings.imessage.enabled ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {settings.imessage.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pepper-muted">DM Policy</span>
                    <span className="text-sm text-pepper-text capitalize">{settings.imessage.dmPolicy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pepper-muted">Group Policy</span>
                    <span className="text-sm text-pepper-text capitalize">{settings.imessage.groupPolicy}</span>
                  </div>
                </div>
              </section>

              {/* Allowlist Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-pepper-text flex items-center gap-2">
                    <span>📱</span> Allowlist
                  </h4>
                  <span className="text-xs bg-pepper-accent/20 text-pepper-accent px-2 py-1 rounded-full">
                    {settings.imessage.allowFrom.length} numbers
                  </span>
                </div>

                {/* Add Number Form */}
                <div className="bg-pepper-tertiary rounded-xl p-4 border border-pepper-light/10">
                  <label className="text-xs text-pepper-muted mb-2 block">Add Phone Number</label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="+1 904-307-6970"
                      className="
                        flex-1 bg-pepper-primary border border-pepper-light/20 rounded-lg
                        px-3 py-2 text-sm text-pepper-text placeholder-pepper-muted
                        focus:outline-none focus:border-pepper-accent/50
                      "
                    />
                    <button
                      onClick={handleAddNumber}
                      disabled={!newPhoneNumber.trim() || isAddingNumber}
                      className="
                        bg-pepper-accent hover:bg-pepper-accentLight disabled:bg-pepper-light
                        text-white px-4 py-2 rounded-lg text-sm font-medium
                        transition-all disabled:opacity-50
                        hover:shadow-glow active:scale-95
                      "
                    >
                      {isAddingNumber ? (
                        <span className="flex items-center gap-1">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </span>
                      ) : (
                        'Add'
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-pepper-muted mt-2">
                    Enter phone number with country code (e.g., +1 for US)
                  </p>
                </div>

                {/* Allowlist Items */}
                <div className="space-y-2">
                  {settings.imessage.allowFrom.length === 0 ? (
                    <div className="bg-pepper-tertiary rounded-xl p-4 border border-pepper-light/10 text-center">
                      <p className="text-pepper-muted text-sm">No numbers in allowlist</p>
                    </div>
                  ) : (
                    settings.imessage.allowFrom.map((phone) => (
                      <div 
                        key={phone}
                        className="
                          bg-pepper-tertiary rounded-xl p-3 border border-pepper-light/10
                          flex items-center justify-between group hover:border-pepper-light/30 transition-colors
                        "
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-pepper-accent/20 flex items-center justify-center text-pepper-accent">
                            📱
                          </div>
                          <div>
                            <div className="text-sm font-medium text-pepper-text">
                              {formatPhoneDisplay(phone)}
                            </div>
                            <div className="text-xs text-pepper-muted">
                              {knownContacts[phone] || 'Contact'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveNumber(phone)}
                          disabled={removingNumber === phone}
                          className="
                            p-2 rounded-lg text-pepper-muted hover:text-red-400 hover:bg-red-500/10
                            transition-colors opacity-0 group-hover:opacity-100
                            disabled:opacity-50
                          "
                          title="Remove from allowlist"
                        >
                          {removingNumber === phone ? (
                            <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin block" />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Refresh Button */}
              <button
                onClick={fetchSettings}
                className="
                  w-full py-3 rounded-xl border border-pepper-light/20
                  text-pepper-muted hover:text-pepper-text hover:border-pepper-light/40
                  transition-colors flex items-center justify-center gap-2 text-sm
                "
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 8a7 7 0 0 1 13-3.5M15 8a7 7 0 0 1-13 3.5" />
                  <path d="M14 1v4h-4M2 15v-4h4" />
                </svg>
                Refresh Settings
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-pepper-muted">
              Failed to load settings
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-pepper-light/20">
          <p className="text-xs text-pepper-muted text-center">
            Changes are saved automatically
          </p>
        </div>
      </div>
    </>
  )
}
