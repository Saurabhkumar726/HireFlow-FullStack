import { useEffect, useState, useCallback } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

export function useLiveEvents() {
    const [events, setEvents] = useState([])
    const [toasts, setToasts] = useState([])
    const [connected, setConnected] = useState(false)

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    useEffect(() => {
        let eventSource = null
        let reconnectTimeout = null
        let isCancelled = false

        function connect() {
            try {
                const token = localStorage.getItem('hireflow-token') || ''
                const streamUrl = `${API_BASE}/LiveEvents/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`

                eventSource = new EventSource(streamUrl)

                eventSource.onopen = () => {
                    if (!isCancelled) setConnected(true)
                }

                eventSource.onmessage = (event) => {
                    if (isCancelled || !event.data) return
                    try {
                        const parsed = JSON.parse(event.data)
                        if (parsed.type === 'Connected') return

                        // Add to event stream
                        setEvents((prev) => [parsed, ...prev.slice(0, 49)])

                        // Push visual toast
                        const toastId = parsed.id || `toast-${Date.now()}-${Math.random()}`
                        setToasts((prev) => [
                            {
                                id: toastId,
                                type: parsed.type,
                                title: parsed.title || 'Live Activity',
                                message: parsed.message || '',
                                timestamp: parsed.timestampUtc || new Date().toISOString()
                            },
                            ...prev.slice(0, 4) // keep max 5 toasts on screen
                        ])

                        // Dispatch local event for auto-refresh in tabs
                        window.dispatchEvent(new CustomEvent('hireflow:live-event', { detail: parsed }))

                        // Auto-dismiss toast after 6 seconds
                        setTimeout(() => {
                            setToasts((current) => current.filter((t) => t.id !== toastId))
                        }, 6000)
                    } catch {
                        // ignore malformed ping
                    }
                }

                eventSource.onerror = () => {
                    if (!isCancelled) {
                        setConnected(false)
                        eventSource?.close()
                        // Reconnect with backoff
                        reconnectTimeout = setTimeout(connect, 7000)
                    }
                }
            } catch {
                if (!isCancelled) {
                    reconnectTimeout = setTimeout(connect, 10000)
                }
            }
        }

        connect()

        return () => {
            isCancelled = true
            clearTimeout(reconnectTimeout)
            eventSource?.close()
        }
    }, [])

    return { events, toasts, connected, dismissToast }
}
