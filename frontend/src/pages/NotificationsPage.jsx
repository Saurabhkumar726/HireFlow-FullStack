import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import './NotificationsPage.css'
import SkeletonLoader from '../components/SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')
const DEFAULT_PREFERENCES = {
    inAppEnabled: true,
    applicationInAppEnabled: true,
    interviewInAppEnabled: true,
    emailEnabled: true,
    applicationEmailEnabled: true,
    interviewEmailEnabled: true,
    dailyDigestEmailEnabled: false,
    interviewReminderEmailEnabled: true,
    interviewReminderInAppEnabled: true,
}

function formatDate(value) {
    if (!value) return 'Just now'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Recently'
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getIcon(type) {
    const normalized = String(type || '').toLowerCase()
    if (normalized.includes('interview')) return '◷'
    if (normalized.includes('application')) return '▤'
    return '✦'
}

export default function NotificationsPage() {
    const { user, token } = useAuth()
    const navigate = useNavigate()
    const authToken = token || localStorage.getItem('hireflow-token') || ''
    const role = String(user?.role || '').toLowerCase()
    const [filter, setFilter] = useState('all')
    const [items, setItems] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
    const [loading, setLoading] = useState(true)
    const [savingPreferences, setSavingPreferences] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const headers = useMemo(() => ({
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
    }), [authToken])

    const loadNotifications = useCallback(async (currentFilter = 'all') => {
        setLoading(true)
        setError('')
        try {
            const unreadOnly = currentFilter === 'unread' ? 'true' : 'false'
            const response = await fetch(`${API_URL}/Notifications?unreadOnly=${unreadOnly}&take=100`, { headers })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not load notifications.')
            setItems(Array.isArray(data.items) ? data.items : [])
            setUnreadCount(Number(data.unreadCount || 0))
        } catch (requestError) {
            setError(requestError.message || 'Could not load notifications.')
        } finally {
            setLoading(false)
        }
    }, [headers])

    const loadPreferences = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/Notifications/preferences`, { headers })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not load notification preferences.')
            setPreferences({ ...DEFAULT_PREFERENCES, ...data })
        } catch (requestError) {
            console.warn('Notification preferences unavailable:', requestError)
        }
    }, [headers])

    useEffect(() => {
        let active = true
        Promise.resolve().then(() => {
            if (!active) return
            loadNotifications('all')
            loadPreferences()
        })
        return () => { active = false }
    }, [loadNotifications, loadPreferences])

    async function updatePreference(name, value) {
        const next = { ...preferences, [name]: value }
        setPreferences(next)
        setSavingPreferences(true)
        setNotice('')
        try {
            const response = await fetch(`${API_URL}/Notifications/preferences`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(next),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not save notification preferences.')
            setPreferences({ ...DEFAULT_PREFERENCES, ...data })
            setNotice('Notification preferences saved.')
        } catch (requestError) {
            setPreferences(preferences)
            setError(requestError.message || 'Could not save notification preferences.')
        } finally {
            setSavingPreferences(false)
        }
    }

    async function markRead(item) {
        if (!item.isRead) {
            try {
                const response = await fetch(`${API_URL}/Notifications/${item.id}/read`, { method: 'PUT', headers })
                if (!response.ok) throw new Error('Could not mark notification as read.')
                setItems(current => current.map(entry => entry.id === item.id ? { ...entry, isRead: true } : entry))
                setUnreadCount(current => Math.max(0, current - 1))
            } catch (requestError) {
                setError(requestError.message || 'Could not update notification.')
                return
            }
        }
        if (item.actionUrl) navigate(item.actionUrl)
    }

    async function markAllRead() {
        try {
            const response = await fetch(`${API_URL}/Notifications/read-all`, { method: 'POST', headers })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not mark notifications as read.')
            setItems(current => current.map(item => ({ ...item, isRead: true })))
            setUnreadCount(0)
            setNotice(`${Number(data.updated || 0)} notifications marked as read.`)
        } catch (requestError) {
            setError(requestError.message || 'Could not update notifications.')
        }
    }

    async function deleteNotification(id) {
        try {
            const response = await fetch(`${API_URL}/Notifications/${id}`, { method: 'DELETE', headers })
            if (!response.ok) throw new Error('Could not delete notification.')
            const removed = items.find(item => item.id === id)
            setItems(current => current.filter(item => item.id !== id))
            if (removed && !removed.isRead) setUnreadCount(current => Math.max(0, current - 1))
        } catch (requestError) {
            setError(requestError.message || 'Could not delete notification.')
        }
    }

    const title = role === 'hr' ? 'Recruiter notifications' : 'Your notifications'
    const description = role === 'hr'
        ? 'Stay up to date with new applications and interview activity.'
        : 'Keep track of application updates and interview activity.'

    return (
        <main className="hf-notifications-page">
            <div className="hf-notifications-heading">
                <div>
                    <span className="hf-notifications-eyebrow">H I R E F L O W / NOTIFICATIONS</span>
                    <h1>{title}</h1>
                    <p>{description}</p>
                </div>
                <div className="hf-notifications-heading-actions">
                    <span className="hf-notifications-unread-pill">{unreadCount} unread</span>
                    <button type="button" className="hf-notifications-secondary" onClick={markAllRead} disabled={!unreadCount}>Mark all as read</button>
                </div>
            </div>

            {error && <div className="hf-notifications-alert is-error" role="alert">{error}</div>}
            {notice && <div className="hf-notifications-alert is-success" role="status">{notice}</div>}

            <section className="hf-notifications-layout">
                <div className="hf-notifications-main-card">
                    <div className="hf-notifications-toolbar">
                        <div className="hf-notifications-tabs" role="tablist" aria-label="Notification filter">
                            <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); loadNotifications('all') }}>All</button>
                            <button type="button" role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'active' : ''} onClick={() => { setFilter('unread'); loadNotifications('unread') }}>Unread</button>
                        </div>
                        <button type="button" className="hf-notifications-refresh" onClick={() => loadNotifications(filter)}>Refresh</button>
                    </div>

                    {loading ? (
                        <SkeletonLoader variant="notifications" count={5} />
                    ) : items.length === 0 ? (
                        <div className="hf-notifications-empty">
                            <span className="hf-notifications-empty-icon">✦</span>
                            <h2>{filter === 'unread' ? 'No unread notifications' : 'You are all caught up'}</h2>
                            <p>New application and interview updates will appear here.</p>
                        </div>
                    ) : (
                        <div className="hf-notifications-list">
                            {items.map(item => (
                                <article className={`hf-notification-row ${item.isRead ? '' : 'is-unread'}`} key={item.id}>
                                    <button type="button" className="hf-notification-row-main" onClick={() => markRead(item)}>
                                        <span className="hf-notification-row-icon" aria-hidden="true">{getIcon(item.type)}</span>
                                        <span className="hf-notification-row-content">
                                            <strong>{item.title}</strong>
                                            <span>{item.message}</span>
                                            <small>{formatDate(item.createdAtUtc)}</small>
                                        </span>
                                        {!item.isRead && <span className="hf-notification-unread-dot" aria-label="Unread" />}
                                    </button>
                                    <button type="button" className="hf-notification-delete" onClick={() => deleteNotification(item.id)} aria-label={`Delete ${item.title}`}>×</button>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                <aside className="hf-notification-settings-card">
                    <div className="hf-notification-settings-heading">
                        <span className="hf-notification-settings-icon">⚙</span>
                        <div><h2>Delivery preferences</h2><p>Choose how HireFlow sends your updates.</p></div>
                    </div>
                    <div className="hf-notification-settings-group">In-app notifications</div>
                    <label className="hf-notification-setting-row">
                        <span><strong>In-app notifications</strong><small>Master switch for the notification center.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.inAppEnabled)} disabled={savingPreferences} onChange={event => updatePreference('inAppEnabled', event.target.checked)} />
                    </label>
                    <label className="hf-notification-setting-row">
                        <span><strong>Application updates</strong><small>New applications, withdrawals, and status changes.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.applicationInAppEnabled)} disabled={savingPreferences || !preferences.inAppEnabled} onChange={event => updatePreference('applicationInAppEnabled', event.target.checked)} />
                    </label>
                    <label className="hf-notification-setting-row">
                        <span><strong>Interview updates</strong><small>Scheduling, candidate responses, and interview changes.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.interviewInAppEnabled)} disabled={savingPreferences || !preferences.inAppEnabled} onChange={event => updatePreference('interviewInAppEnabled', event.target.checked)} />
                    </label>
                    <label className="hf-notification-setting-row">
                        <span><strong>Interview reminders</strong><small>24-hour, 1-hour, and 15-minute reminders.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.interviewReminderInAppEnabled)} disabled={savingPreferences || !preferences.inAppEnabled} onChange={event => updatePreference('interviewReminderInAppEnabled', event.target.checked)} />
                    </label>
                    <div className="hf-notification-settings-group">Email notifications</div>
                    <label className="hf-notification-setting-row">
                        <span><strong>Email notifications</strong><small>Master switch for transactional HireFlow emails.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.emailEnabled)} disabled={savingPreferences} onChange={event => updatePreference('emailEnabled', event.target.checked)} />
                    </label>
                    <label className="hf-notification-setting-row">
                        <span><strong>Application emails</strong><small>Application received, withdrawn, and status updates.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.applicationEmailEnabled)} disabled={savingPreferences || !preferences.emailEnabled} onChange={event => updatePreference('applicationEmailEnabled', event.target.checked)} />
                    </label>
                    <label className="hf-notification-setting-row">
                        <span><strong>Interview emails</strong><small>Interview workflow updates and candidate decisions.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.interviewEmailEnabled)} disabled={savingPreferences || !preferences.emailEnabled} onChange={event => updatePreference('interviewEmailEnabled', event.target.checked)} />
                    </label>
                    <label className="hf-notification-setting-row">
                        <span><strong>Daily digest</strong><small>One summary at 9:00 AM IST when unread updates are available.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.dailyDigestEmailEnabled)} disabled={savingPreferences || !preferences.emailEnabled} onChange={event => updatePreference('dailyDigestEmailEnabled', event.target.checked)} />
                    </label>
                    <label className="hf-notification-setting-row">
                        <span><strong>Interview reminder emails</strong><small>Email reminders 24 hours, 1 hour, and 15 minutes before.</small></span>
                        <input type="checkbox" checked={Boolean(preferences.interviewReminderEmailEnabled)} disabled={savingPreferences || !preferences.emailEnabled} onChange={event => updatePreference('interviewReminderEmailEnabled', event.target.checked)} />
                    </label>
                    <p className="hf-notification-settings-note">Email delivery requires valid SMTP settings on the HireFlow API. Failed messages are retried by the background worker.</p>
                </aside>
            </section>
        </main>
    )
}