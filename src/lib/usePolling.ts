'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UsePollingOptions {
  /** Polling interval in milliseconds (default: 30000) */
  interval?: number
  /** Whether polling is enabled (default: true) */
  enabled?: boolean
}

/**
 * Polls a callback at a fixed interval, pausing when the tab is not visible.
 */
export function usePolling(callback: () => void | Promise<void>, options: UsePollingOptions = {}) {
  const { interval = 30000, enabled = true } = options
  const callbackRef = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        callbackRef.current()
      }
    }, interval)
  }, [interval])

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stopPolling()
      return
    }

    startPolling()

    // Poll immediately when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current()
        startPolling()
      } else {
        stopPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, startPolling, stopPolling])
}
