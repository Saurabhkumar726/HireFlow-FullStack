import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import './NotificationBell.css'
import SkeletonLoader from './SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

function authHeaders(token) {
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
}

function formatTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function NotificationBell({ className = '' }) {
    const { user, token, isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const wrapperRef = useRef(null)
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const role = String(user?.role || '').toLowerCase()
    const notificationsPath = role === 'hr' ? '/hr/notifications' : '/candidate/notifications'
    const authToken = token || (typeof window !== 'undefined' ? window.localStorage.getItem('hireflow-token') : '') || ''

    const loadUnreadCount = useCallback(async (signal) => {
        if (!authToken || !isAuthenticated || !['student', 'hr'].includes(role)) return
        try {
            const response = await fetch(`${API_URL}/Notifications/unread-count`, {
                headers: authHeaders(authToken),
                signal,
            })
            if (!response.ok) return
            const data = await response.json()
            setUnreadCount(Number(data.unreadCount || 0))
        } catch (requestError) {
            if (requestError.name !== 'AbortError') console.warn('Notification count unavailable:', requestError)
        }
    }, [authToken, isAuthenticated, role])

    const loadRecent = useCallback(async (signal) => {
        if (!authToken) return
        setLoading(true)
        setError('')
        try {
            const response = await fetch(`${API_URL}/Notifications?take=6`, {
                headers: authHeaders(authToken),
                signal,
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not load notifications.')
            setItems(Array.isArray(data.items) ? data.items : [])
            setUnreadCount(Number(data.unreadCount || 0))
        } catch (requestError) {
            if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load notifications.')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [authToken])

    useEffect(() => {
        if (!isAuthenticated || !['student', 'hr'].includes(role)) return undefined
        const controller = new AbortController()
        Promise.resolve().then(() => {
            if (!controller.signal.aborted) loadUnreadCount(controller.signal)
        })
        const interval = window.setInterval(() => loadUnreadCount(), 30000)
        return () => {
            controller.abort()
            window.clearInterval(interval)
        }
    }, [isAuthenticated, role, authToken, loadUnreadCount])

    useEffect(() => {
        if (!open) return undefined
        const controller = new AbortController()
        Promise.resolve().then(() => {
            if (!controller.signal.aborted) loadRecent(controller.signal)
        })
        function onPointerDown(event) {
            if (!wrapperRef.current?.contains(event.target)) setOpen(false)
        }
        function onKeyDown(event) {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            controller.abort()
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open, authToken, loadRecent])

    async function markRead(notification) {
        if (!notification.isRead) {
            try {
                const response = await fetch(`${API_URL}/Notifications/${notification.id}/read`, {
                    method: 'PUT',
                    headers: authHeaders(authToken),
                })
                if (!response.ok) throw new Error('Could not mark notification as read.')
                setItems(current => current.map(item => item.id === notification.id ? { ...item, isRead: true } : item))
                setUnreadCount(current => Math.max(0, current - 1))
            } catch (requestError) {
                setError(requestError.message || 'Could not update notification.')
            }
        }
        setOpen(false)
        if (notification.actionUrl) navigate(notification.actionUrl)
        else navigate(notificationsPath)
    }

    if (!isAuthenticated || !['student', 'hr'].includes(role)) return null

    return (
        <div className={`hf-notification-bell ${className}`} ref={wrapperRef}>
            <button
                type="button"
                className="hf-notification-bell-button"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen(value => !value)}
                title="Notifications"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
                {unreadCount > 0 && <span className="hf-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>

            {open && (
                <section className="hf-notification-popover" role="dialog" aria-label="Recent notifications">
                    <header className="hf-notification-popover-header">
                        <div>
                            <strong>Notifications</strong>
                            <span>{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</span>
                        </div>
                        <button type="button" onClick={() => { setOpen(false); navigate(notificationsPath) }}>View all</button>
                    </header>
                    {error && <p className="hf-notification-popover-error" role="alert">{error}</p>}
                    {loading ? (
                        <SkeletonLoader variant="notifications" count={3} compact />
                    ) : items.length === 0 ? (
                        <div className="hf-notification-popover-empty">No notifications yet.</div>
                    ) : (
                        <div className="hf-notification-popover-list">
                            {items.map(item => (
                                <button
                                    type="button"
                                    className={`hf-notification-popover-item ${item.isRead ? '' : 'is-unread'}`}
                                    key={item.id}
                                    onClick={() => markRead(item)}
                                >
                                    <span className="hf-notification-dot" aria-hidden="true" />
                                    <span className="hf-notification-popover-copy">
                                        <strong>{item.title}</strong>
                                        <span>{item.message}</span>
                                        <small>{formatTime(item.createdAtUtc)}</small>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}