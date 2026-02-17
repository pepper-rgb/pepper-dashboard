'use client'

import { useEffect, useRef, useState } from 'react'

interface CardDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function CardDetailSheet({ isOpen, onClose, title, children }: CardDetailSheetProps) {
  const [isMobile, setIsMobile] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const currentTranslate = useRef(0)
  const isDragHandle = useRef(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isMobile, isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (dragHandleRef.current && (dragHandleRef.current === target || dragHandleRef.current.contains(target))) {
      isDragHandle.current = true
      dragStartY.current = e.touches[0].clientY
    } else {
      isDragHandle.current = false
      dragStartY.current = null
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragHandle.current || dragStartY.current === null || !sheetRef.current) return
    const delta = e.touches[0].clientY - dragStartY.current
    if (delta > 0) {
      currentTranslate.current = delta
      sheetRef.current.style.transform = `translateY(${delta}px)`
    }
  }

  const handleTouchEnd = () => {
    if (!isDragHandle.current || !sheetRef.current) {
      isDragHandle.current = false
      return
    }
    if (currentTranslate.current > 120) {
      onClose()
    } else {
      sheetRef.current.style.transform = ''
    }
    dragStartY.current = null
    currentTranslate.current = 0
    isDragHandle.current = false
  }

  if (!isOpen) return null

  // Desktop: render inline — stop propagation so parent onClick doesn't fire
  if (!isMobile) {
    return (
      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    )
  }

  // Mobile: full-screen bottom sheet
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />

      {/* Sheet — stopPropagation prevents parent list item onClick from firing */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bg-pepper-secondary rounded-t-2xl border-t border-x border-pepper-light/20 flex flex-col" style={{ maxHeight: '90vh' }}>
          {/* Drag handle */}
          <div ref={dragHandleRef} className="flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 rounded-full bg-pepper-light/40" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-pepper-light/10 flex-shrink-0">
            <h3 className="font-semibold text-pepper-text text-sm truncate flex-1">
              {title || 'Details'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-pepper-light/20 text-pepper-muted hover:text-pepper-text transition-colors ml-2"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 5L5 15M5 5l10 10" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
