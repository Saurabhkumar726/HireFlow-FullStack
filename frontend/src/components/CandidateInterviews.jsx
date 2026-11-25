import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth'
import './CandidateInterviews.css'
import SkeletonLoader from './SkeletonLoader.jsx'
import { downloadInterviewIcs } from '../utils/calendarExport.js'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

// API timestamps without a timezone suffix are stored as UTC.
function parseApiDateTime(value) {
    if (!value) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value !== 'string') return null

    const normalized = value.trim()
    if (!normalized) return null

    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)

    const date = new Date(
        hasTimezone ? normalized : `${normalized}Z`
    )

    return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
    const date = parseApiDateTime(value)
    if (!date) return 'Date not available'

    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(date)
}

function formatTime(value) {
    const date = parseApiDateTime(value)
    if (!date) return 'Time not available'

    return new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
    }).format(date) + ' IST'
}

function normalizeStatus(status) {
    return String(status || 'Scheduled').toLowerCase()
}

function CandidateInterviews() {
    const { token, user } = useAuth()

    const [interviews, setInterviews] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)
    const [activeFilter, setActiveFilter] = useState('All')
    const [currentTime, setCurrentTime] = useState(() => new Date().getTime())
    const [rescheduleOpenId, setRescheduleOpenId] = useState(null)
    const [proposedTimes, setProposedTimes] = useState({})
    const [responseNotes, setResponseNotes] = useState({})
    const [respondingId, setRespondingId] = useState(null)

    const loadInterviews = useCallback(async (signal) => {
        try {
            const response = await fetch(`${API_URL}/CandidateInterviews`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                signal,
            })

            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    (response.status === 401
                        ? 'Please sign in again to view your interviews.'
                        : response.status === 403
                            ? 'This page is available to student accounts only.'
                            : 'Unable to load your interviews.')
                )
            }

            if (!signal.aborted) {
                setInterviews(Array.isArray(data) ? data : [])
                setError('')
            }
        } catch (err) {
            if (err.name !== 'AbortError' && !signal.aborted) {
                setError(err.message || 'Unable to load your interviews.')
            }
        } finally {
            if (!signal.aborted) {
                setLoading(false)
            }
        }
    }, [token])

    useEffect(() => {
        const controller = new AbortController()

        Promise.resolve().then(() => {
            if (!controller.signal.aborted) {
                setLoading(true)
                setError('')
                return loadInterviews(controller.signal)
            }
        })

        return () => controller.abort()
    }, [loadInterviews, refreshKey])

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date().getTime())
        }, 60000)

        return () => clearInterval(interval)
    }, [])

    async function sendCandidateResponse(interview, action) {
        const interviewId = Number(interview.id)
        if (!Number.isSafeInteger(interviewId) || interviewId <= 0) return
        const note = responseNotes[interviewId] || ''
        let proposedScheduledAtUtc
        if (action === 'RequestReschedule') {
            const value = proposedTimes[interviewId]
            if (!value) {
                setError('Choose a proposed date and time first.')
                return
            }
            const parsed = new Date(value)
            if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= currentTime) {
                setError('Choose a date and time in the future.')
                return
            }
            proposedScheduledAtUtc = parsed.toISOString()
        }

        setRespondingId(interviewId)
        setError('')
        try {
            const response = await fetch(`${API_URL}/InterviewWorkflow/${interviewId}/candidate-response`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ action, note, proposedScheduledAtUtc }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not submit your interview response.')
            setInterviews((current) => current.map((item) => Number(item.id) === interviewId
                ? { ...item, candidateResponseStatus: data.candidateResponseStatus || (action === 'Accept' ? 'Accepted' : action === 'Decline' ? 'Declined' : 'RescheduleRequested'), candidateResponseAtUtc: data.candidateResponseAtUtc || new Date().toISOString(), proposedScheduledAtUtc: proposedScheduledAtUtc || item.proposedScheduledAtUtc }
                : item))
            setRescheduleOpenId(null)
            setError('')
        } catch (requestError) {
            setError(requestError.message || 'Could not submit your interview response.')
        } finally {
            setRespondingId(null)
        }
    }

    const minDateTime = useMemo(() => {
        const date = new Date(currentTime + 60 * 60 * 1000)
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    }, [currentTime])

    const filteredInterviews = useMemo(() => {
        if (activeFilter === 'All') return interviews

        return interviews.filter(
            (item) => normalizeStatus(item.status) === activeFilter.toLowerCase()
        )
    }, [interviews, activeFilter])

    const counts = useMemo(() => ({
        upcoming: interviews.filter((item) => {
            const date = parseApiDateTime(item.scheduledAt)?.getTime()
            return normalizeStatus(item.status) === 'scheduled' &&
                date != null &&
                Number.isFinite(date) &&
                date >= currentTime
        }).length,
        completed: interviews.filter(
            (item) => normalizeStatus(item.status) === 'completed'
        ).length,
        cancelled: interviews.filter(
            (item) => normalizeStatus(item.status) === 'cancelled'
        ).length,
    }), [interviews, currentTime])

    return (
        <main className="candidate-interviews-page">
            <section className="candidate-interviews-hero">
                <div>
                    <p className="candidate-interviews-eyebrow">CANDIDATE PORTAL</p>
                    <h1>My Interviews</h1>
                    <p className="candidate-interviews-subtitle">
                        Keep track of your interview schedule, meeting details, and updates.
                    </p>
                    <p className="candidate-interviews-greeting">
                        Welcome{user?.fullName ? `, ${user.fullName}` : ''}.
                    </p>
                </div>

                <button
                    className="candidate-interviews-refresh"
                    type="button"
                    onClick={() => setRefreshKey((value) => value + 1)}
                    disabled={loading}
                >
                    <span aria-hidden="true">↻</span> Refresh
                </button>
            </section>

            <section className="candidate-interviews-stats" aria-label="Interview summary">
                <article className="candidate-interviews-stat">
                    <span className="candidate-interviews-stat-icon upcoming" aria-hidden="true">◷</span>
                    <div><p>Upcoming</p><strong>{counts.upcoming}</strong></div>
                </article>
                <article className="candidate-interviews-stat">
                    <span className="candidate-interviews-stat-icon completed" aria-hidden="true">✓</span>
                    <div><p>Completed</p><strong>{counts.completed}</strong></div>
                </article>
                <article className="candidate-interviews-stat">
                    <span className="candidate-interviews-stat-icon cancelled" aria-hidden="true">×</span>
                    <div><p>Cancelled</p><strong>{counts.cancelled}</strong></div>
                </article>
            </section>

            <section className="candidate-interviews-content">
                <div className="candidate-interviews-section-heading">
                    <div>
                        <h2>Interview schedule</h2>
                        <p>Your interview details, as shared by the hiring team.</p>
                    </div>

                    <label className="candidate-interviews-filter">
                        <span className="sr-only">Filter interviews</span>
                        <select
                            value={activeFilter}
                            onChange={(event) => setActiveFilter(event.target.value)}
                        >
                            <option>All</option>
                            <option>Scheduled</option>
                            <option>Completed</option>
                            <option>Cancelled</option>
                        </select>
                    </label>
                </div>

                {loading ? (
                    <SkeletonLoader variant="interviews" count={3} />
                ) : error ? (
                    <div className="candidate-interviews-state error" role="alert">
                        <h3>We couldn't load your interviews</h3>
                        <p>{error}</p>
                        <button
                            type="button"
                            onClick={() => setRefreshKey((value) => value + 1)}
                        >
                            Try again
                        </button>
                    </div>
                ) : filteredInterviews.length === 0 ? (
                    <div className="candidate-interviews-empty">
                        <div className="candidate-interviews-empty-icon" aria-hidden="true">▦</div>
                        <h3>
                            {activeFilter === 'All'
                                ? 'No interviews scheduled yet'
                                : `No ${activeFilter.toLowerCase()} interviews`}
                        </h3>
                        <p>
                            {activeFilter === 'All'
                                ? 'When HR schedules an interview for one of your applications, the details will appear here.'
                                : 'Try another filter to see your interview schedule.'}
                        </p>
                        {activeFilter !== 'All' && (
                            <button type="button" onClick={() => setActiveFilter('All')}>
                                Show all interviews
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="candidate-interviews-list">
                        {filteredInterviews.map((interview) => {
                            const status = normalizeStatus(interview.status)
                            const scheduledTime = parseApiDateTime(interview.scheduledAt)?.getTime()
                            const isUpcoming =
                                status === 'scheduled' &&
                                scheduledTime != null &&
                                Number.isFinite(scheduledTime) &&
                                scheduledTime >= currentTime

                            const dateParts = formatDate(interview.scheduledAt).split(' ')

                            return (
                                <article className="candidate-interview-card" key={interview.id}>
                                    <div className="candidate-interview-card-top">
                                        <div className="candidate-interview-date">
                                            <span>{dateParts[0]}</span>
                                            <strong>{dateParts.slice(1).join(' ')}</strong>
                                        </div>

                                        <div className="candidate-interview-main">
                                            <div className="candidate-interview-title-row">
                                                <div>
                                                    <h3>{interview.jobTitle || 'Job interview'}</h3>
                                                    <p>{interview.company || 'Company not available'}</p>
                                                </div>
                                                <span className={`candidate-interview-status ${status}`}>
                                                    {interview.status || 'Scheduled'}
                                                </span>
                                            </div>

                                            <div className="candidate-interview-meta">
                                                <span><b aria-hidden="true">◷</b>{formatTime(interview.scheduledAt)}</span>
                                                <span><b aria-hidden="true">▣</b>{interview.interviewType || 'Interview'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="candidate-interview-response">
                                        <div className="candidate-interview-response-heading">
                                            <strong>Your response</strong>
                                            <span className={`candidate-interview-response-status ${String(interview.candidateResponseStatus || 'Pending').toLowerCase()}`}>
                                                {String(interview.candidateResponseStatus || 'Pending').replace(/([A-Z])/g, ' $1').trim()}
                                            </span>
                                        </div>
                                        {interview.candidateResponseNote && <p className="candidate-interview-response-note">{interview.candidateResponseNote}</p>}
                                        {interview.candidateResponseStatus === 'RescheduleRequested' && interview.proposedScheduledAtUtc && (
                                            <p className="candidate-interview-response-note">Requested time: {formatDate(interview.proposedScheduledAtUtc)} · {formatTime(interview.proposedScheduledAtUtc)}</p>
                                        )}
                                        {isUpcoming && !['Accepted', 'Declined', 'RescheduleRequested', 'RescheduleApproved'].includes(interview.candidateResponseStatus) && (
                                            <>
                                                <div className="candidate-interview-response-actions">
                                                    <button type="button" className="is-primary" disabled={respondingId === Number(interview.id)} onClick={() => sendCandidateResponse(interview, 'Accept')}>Accept interview</button>
                                                    <button type="button" disabled={respondingId === Number(interview.id)} onClick={() => sendCandidateResponse(interview, 'Decline')}>Decline</button>
                                                    <button type="button" disabled={respondingId === Number(interview.id)} onClick={() => setRescheduleOpenId(current => current === Number(interview.id) ? null : Number(interview.id))}>Request reschedule</button>
                                                </div>
                                                {rescheduleOpenId === Number(interview.id) && (
                                                    <div className="candidate-interview-reschedule-form">
                                                        <label>Proposed date and time<input type="datetime-local" min={minDateTime} value={proposedTimes[interview.id] || ''} onChange={event => setProposedTimes(current => ({ ...current, [interview.id]: event.target.value }))} /></label>
                                                        <label>Message to HR (optional)<textarea rows={2} maxLength={1000} value={responseNotes[interview.id] || ''} onChange={event => setResponseNotes(current => ({ ...current, [interview.id]: event.target.value }))} placeholder="Share a suitable time or a short note." /></label>
                                                        <div><button type="button" className="is-primary" disabled={respondingId === Number(interview.id)} onClick={() => sendCandidateResponse(interview, 'RequestReschedule')}>{respondingId === Number(interview.id) ? 'Sending…' : 'Send request'}</button><button type="button" onClick={() => setRescheduleOpenId(null)}>Cancel</button></div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {!isUpcoming && status === 'scheduled' && <small>This interview is no longer accepting responses because its start time has passed.</small>}
                                    </div>

                                    {interview.notes && (
                                        <div className="candidate-interview-notes">
                                            <strong>Notes from HR</strong>
                                            <p>{interview.notes}</p>
                                        </div>
                                    )}

                                    <div className="candidate-interview-actions">
                                        <button
                                            type="button"
                                            className="candidate-interview-calendar-btn"
                                            onClick={() => downloadInterviewIcs({
                                                id: interview.id,
                                                title: interview.jobTitle,
                                                company: interview.company,
                                                scheduledAt: interview.scheduledAt,
                                                meetingLink: interview.meetingLink,
                                                interviewType: interview.interviewType
                                            })}
                                        >
                                            📅 Add to Calendar (.ics)
                                        </button>

                                        {interview.meetingLink &&
                                            String(interview.interviewType || '').toLowerCase() === 'online' &&
                                            status !== 'cancelled' && (
                                                <a
                                                    className={isUpcoming ? 'candidate-interview-join' : 'candidate-interview-link'}
                                                    href={interview.meetingLink}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {isUpcoming ? 'Join interview' : 'Open meeting link'} <span aria-hidden="true">↗</span>
                                                </a>
                                            )}
                                    </div>

                                    {status === 'cancelled' && (
                                        <p className="candidate-interview-cancelled-note">
                                            This interview has been cancelled. Contact the hiring team if you need clarification.
                                        </p>
                                    )}
                                </article>
                            )
                        })}
                    </div>
                )}
            </section>
        </main>
    )
}

export default CandidateInterviews