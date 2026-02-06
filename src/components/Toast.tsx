'use client'

import { useEffect, useState } from 'react'

export interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

interface ToastProps {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

export default function Toast({ messages, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {messages.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true))
    
    // Auto dismiss after 4 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onDismiss(toast.id), 300)
    }, 4000)
    
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const bgColors = {
    success: 'bg-emerald-500/90 border-emerald-400/30',
    error: 'bg-red-500/90 border-red-400/30',
    warning: 'bg-amber-500/90 border-amber-400/30',
    info: 'bg-pepper-accent/90 border-pepper-accentLight/30'
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  }

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 
        px-4 py-3 rounded-xl border backdrop-blur-sm
        shadow-lg transition-all duration-300
        ${bgColors[toast.type]}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <span className="text-white font-bold text-lg">{icons[toast.type]}</span>
      <p className="text-white text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => onDismiss(toast.id), 300)
        }}
        className="text-white/60 hover:text-white ml-2 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

// Custom hook for toast management
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, addToast, dismissToast }
}
