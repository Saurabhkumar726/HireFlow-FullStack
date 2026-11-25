import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import './HROverview.css'
import SkeletonLoader from '../../components/SkeletonLoader.jsx'

const API_BASE = 'http://localhost:5116/api'

function getList(data, keys = []) {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.$values)) return data.$values

    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key]
        if (Array.isArray(data?.[key]?.$values)) return data[key].$values
    }

    if (Array.isArray(data?.data)) return data.data
    return null
}

function getUserId(user) {
    return user?.id ?? user?.userId ?? user?.Id ?? user?.userID ?? null
}

function getApplicationId(application) {
    const value = application?.id ?? application?.applicationId ?? application?.applicationID ?? application?.Id
    if (value === null || value === undefined || String(value).trim() === '') return null

    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : null
}

function getInterviewId(interview) {
    return interview?.id ?? interview?.Id ?? null
}

function getDate(value) {
    if (!value) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value !== 'string' && typeof value !== 'number') return null

    const hasTimezone = typeof value === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
    const normalized = typeof value === 'string' && !hasTimezone ? `${value.trim()}Z` : value
    const date = new Date(normalized)

    return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
    const date = getDate(value)
    if (!date) return 'Date unavailable'

    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(date)
}

function formatDateTime(value) {
    const date = getDate(value)
    if (!date) return 'Time not set'

    const datePart = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(date)
    const timePart = new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
    }).format(date)

    return `${datePart} · ${timePart} IST`
}

function getStatus(value) {
    return String(value ?? 'Pending').trim() || 'Pending'
}

function getStatusClass(value) {
    return getStatus(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}


function getApplicationDate(application) {
    return getDate(
        application.appliedAt ??
        application.AppliedAt ??
        application.createdAt ??
        application.CreatedAt
    )
}

function buildMonthlyApplications(applications, months = 6, now = new Date()) {
    return Array.from({ length: months }, (_, index) => {
        const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        const monthDate = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - (months - 1 - index), 1))
        const year = monthDate.getUTCFullYear()
        const month = monthDate.getUTCMonth()
        const count = applications.filter((application) => {
            const date = getApplicationDate(application)
            return date && date.getFullYear() === year && date.getMonth() === month
        }).length

        return {
            key: `${year}-${String(month + 1).padStart(2, '0')}`,
            label: new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(monthDate),
            count,
        }
    })
}

function buildApplicationStatuses(applications) {
    const palette = {
        pending: '#f5b942',
        shortlisted: '#24b47e',
        rejected: '#ef6262',
        reviewed: '#5795f5',
        accepted: '#8b5cf6',
        hired: '#0f9d8a',
    }
    const counts = new Map()

    applications.forEach((application) => {
        const label = getStatus(application.status ?? application.Status)
        const key = label.toLowerCase()
        const existing = counts.get(key)
        counts.set(key, {
            key,
            label,
            count: (existing?.count ?? 0) + 1,
            color: palette[key] ?? '#8b93a7',
        })
    })

    return [...counts.values()].sort((a, b) => b.count - a.count)
}

function ApplicationsBarChart({ data, loading }) {
    const max = Math.max(1, ...data.map((item) => item.count))
    const chartHeight = 156
    const chartWidth = 520
    const left = 28
    const right = 12
    const top = 18
    const bottom = 28
    const plotHeight = chartHeight - top - bottom
    const plotWidth = chartWidth - left - right
    const step = plotWidth / data.length
    const barWidth = Math.min(42, step * 0.52)

    return (
        <div className="hr-overview-chart-wrap">
            {loading ? (
                <SkeletonLoader variant="chart" />
            ) : data.every((item) => item.count === 0) ? (
                <div className="hr-overview-chart-state">
                    <strong>No application activity yet</strong>
                    <span>Monthly application totals will appear here when candidates apply.</span>
                </div>
            ) : (
                <svg
                    className="hr-overview-bar-chart"
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    role="img"
                    aria-label={`Applications over the last six months: ${data.map((item) => `${item.label} ${item.count}`).join(', ')}`}
                    preserveAspectRatio="xMidYMid meet"
                >
                    {[0, 1, 2, 3].map((line) => {
                        const y = top + (plotHeight / 3) * line
                        const value = Math.round(max - (max / 3) * line)
                        return (
                            <g key={line}>
                                <line className="hr-overview-chart-gridline" x1={left} y1={y} x2={chartWidth - right} y2={y} />
                                <text className="hr-overview-chart-axis-label" x={left - 8} y={y + 4} textAnchor="end">{value}</text>
                            </g>
                        )
                    })}
                    {data.map((item, index) => {
                        const barHeight = item.count === 0 ? 2 : (item.count / max) * plotHeight
                        const x = left + step * index + (step - barWidth) / 2
                        const y = top + plotHeight - barHeight
                        return (
                            <g key={item.key}>
                                <rect
                                    className="hr-overview-chart-bar"
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={barHeight}
                                    rx="7"
                                />
                                <text className="hr-overview-chart-value" x={x + barWidth / 2} y={Math.max(12, y - 7)} textAnchor="middle">{item.count}</text>
                                <text className="hr-overview-chart-axis-label" x={x + barWidth / 2} y={chartHeight - 8} textAnchor="middle">{item.label}</text>
                            </g>
                        )
                    })}
                </svg>
            )}
        </div>
    )
}

function ApplicationStatusChart({ statuses, total, loading }) {
    const segments = useMemo(() => {
        if (!total) return []
        let offset = 0
        return statuses.map((status) => {
            const start = offset
            const amount = (status.count / total) * 100
            offset += amount
            return `${status.color} ${start}% ${offset}%`
        })
    }, [statuses, total])

    return (
        <div className="hr-overview-status-chart">
            {loading ? (
                <SkeletonLoader variant="donut" />
            ) : total === 0 ? (
                <div className="hr-overview-chart-state">
                    <strong>No applications to summarize</strong>
                    <span>Status distribution will appear when applications arrive.</span>
                </div>
            ) : (
                <>
                    <div
                        className="hr-overview-donut"
                        style={{ background: `conic-gradient(${segments.join(', ')})` }}
                        role="img"
                        aria-label={`Application status breakdown: ${statuses.map((status) => `${status.label} ${status.count}`).join(', ')}`}
                    >
                        <div className="hr-overview-donut-hole">
                            <strong>{total}</strong>
                            <span>Applications</span>
                        </div>
                    </div>
                    <div className="hr-overview-status-legend">
                        {statuses.map((status) => (
                            <div className="hr-overview-legend-item" key={status.key}>
                                <span className="hr-overview-legend-dot" style={{ backgroundColor: status.color }} />
                                <span className="hr-overview-legend-label">{status.label}</span>
                                <strong>{status.count}</strong>
                                <small>{Math.round((status.count / total) * 100)}%</small>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

function PipelineFunnelChart({ applications = [], jobs = [] }) {
    const [selectedJobId, setSelectedJobId] = useState('all')
    const [recentActivity, setRecentActivity] = useState([])

    useEffect(() => {
        let isCancelled = false
        async function fetchRecent() {
            try {
                const res = await fetch(`${API_BASE}/LiveEvents/recent?limit=6`)
                if (res.ok) {
                    const data = await res.json()
                    if (!isCancelled) setRecentActivity(Array.isArray(data) ? data : [])
                }
            } catch {
                // non-fatal
            }
        }
        fetchRecent()
        const timer = setInterval(fetchRecent, 15000)
        return () => { isCancelled = true; clearInterval(timer) }
    }, [])

    const filteredApplications = useMemo(() => {
        if (selectedJobId === 'all') return applications
        return applications.filter((a) => {
            const jId = a.jobId ?? a.JobId ?? a.job?.id ?? a.job?.Id
            return String(jId) === String(selectedJobId)
        })
    }, [applications, selectedJobId])

    const total = filteredApplications.length
    const pending = filteredApplications.filter((a) => getStatus(a.status || a.Status).toLowerCase() === 'pending').length
    const underReview = filteredApplications.filter((a) => ['under review', 'reviewed'].includes(getStatus(a.status || a.Status).toLowerCase())).length
    const shortlisted = filteredApplications.filter((a) => getStatus(a.status || a.Status).toLowerCase() === 'shortlisted').length
    const interview = filteredApplications.filter((a) => getStatus(a.status || a.Status).toLowerCase() === 'interview scheduled').length
    const selected = filteredApplications.filter((a) => getStatus(a.status || a.Status).toLowerCase() === 'selected').length

    const divisor = Math.max(1, total)

    const screenedCount = underReview + shortlisted + interview + selected
    const shortlistedCount = shortlisted + interview + selected
    const interviewedCount = interview + selected
    const selectedCount = selected

    const stages = [
        { label: 'Applied', count: total, pct: 100, dropoff: 0, color: '#6366f1' },
        {
            label: 'Screened / Review',
            count: screenedCount,
            pct: Math.round((screenedCount / divisor) * 100),
            dropoff: total > 0 ? Math.round(((total - screenedCount) / total) * 100) : 0,
            color: '#3b82f6'
        },
        {
            label: 'Shortlisted',
            count: shortlistedCount,
            pct: Math.round((shortlistedCount / divisor) * 100),
            dropoff: screenedCount > 0 ? Math.round(((screenedCount - shortlistedCount) / screenedCount) * 100) : 0,
            color: '#10b981'
        },
        {
            label: 'Interviewed',
            count: interviewedCount,
            pct: Math.round((interviewedCount / divisor) * 100),
            dropoff: shortlistedCount > 0 ? Math.round(((shortlistedCount - interviewedCount) / shortlistedCount) * 100) : 0,
            color: '#8b5cf6'
        },
        {
            label: 'Selected / Hired',
            count: selectedCount,
            pct: Math.round((selectedCount / divisor) * 100),
            dropoff: interviewedCount > 0 ? Math.round(((interviewedCount - selectedCount) / interviewedCount) * 100) : 0,
            color: '#059669'
        },
    ]

    return (
        <section className="hr-overview-panel hr-funnel-panel" aria-labelledby="hr-funnel-title">
            <div className="hr-overview-panel-heading">
                <div>
                    <h3 id="hr-funnel-title">📊 Hiring Funnel & Pipeline Analytics</h3>
                    <p>Stage-by-stage candidate progression and conversion drop-offs</p>
                </div>
                {jobs.length > 0 && (
                    <div className="hr-funnel-filter-wrap">
                        <label htmlFor="hr-funnel-job-filter" className="sr-only">Filter by job requisition</label>
                        <select
                            id="hr-funnel-job-filter"
                            className="hr-funnel-job-select"
                            value={selectedJobId}
                            onChange={(e) => setSelectedJobId(e.target.value)}
                        >
                            <option value="all">All Job Requisitions ({jobs.length})</option>
                            {jobs.map((j) => (
                                <option key={j.id || j.Id} value={j.id || j.Id}>
                                    {j.title || j.Title || 'Job'}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="hr-funnel-bars">
                {stages.map((stage, idx) => (
                    <div className="hr-funnel-row" key={stage.label}>
                        <div className="hr-funnel-label-col">
                            <div className="hr-funnel-label-head">
                                <strong>{stage.label}</strong>
                                {idx > 0 && stage.dropoff > 0 && (
                                    <span className="hr-funnel-dropoff-tag" title="Drop-off from previous stage">
                                        ↘ -{stage.dropoff}%
                                    </span>
                                )}
                            </div>
                            <span>{stage.count} candidate{stage.count === 1 ? '' : 's'}</span>
                        </div>
                        <div className="hr-funnel-bar-track">
                            <div
                                className="hr-funnel-bar-fill"
                                style={{ width: `${Math.max(6, stage.pct)}%`, background: stage.color }}
                            >
                                <span className="hr-funnel-pct">{stage.pct}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hr-funnel-stats-row">
                <div className="hr-funnel-stat">
                    <span>Funnel Yield</span>
                    <strong>{total > 0 ? Math.round((selected / total) * 100) : 0}%</strong>
                    <small>Application-to-offer rate</small>
                </div>
                <div className="hr-funnel-stat">
                    <span>In Active Pipeline</span>
                    <strong>{underReview + pending + shortlisted + interview}</strong>
                    <small>Awaiting next decision</small>
                </div>
                <div className="hr-funnel-stat">
                    <span>Hiring Velocity</span>
                    <strong>4.5 days</strong>
                    <small>Avg. response timeline</small>
                </div>
                <div className="hr-funnel-stat">
                    <span>Active Requisitions</span>
                    <strong>{jobs.length}</strong>
                    <small>Open positions</small>
                </div>
            </div>

            {/* Live Real-Time Recruitment Activity Feed */}
            {recentActivity.length > 0 && (
                <div className="hr-live-activity-box">
                    <div className="hr-live-act-header">
                        <h4>⚡ Live Recruitment Activity Feed</h4>
                        <span className="hr-live-pulse-dot" />
                    </div>
                    <ul className="hr-live-act-list">
                        {recentActivity.map((act) => (
                            <li key={act.id || act.timestampUtc} className="hr-live-act-item">
                                <span className="hr-live-act-time">
                                    {new Date(act.timestampUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className="hr-live-act-body">
                                    <strong>{act.title}</strong>
                                    <p>{act.message}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    )
}

function HROverview() {
    const { token, user } = useAuth()
    const [jobs, setJobs] = useState([])
    const [applications, setApplications] = useState([])
    const [interviews, setInterviews] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [reloadKey, setReloadKey] = useState(0)
    const [referenceTime, setReferenceTime] = useState(0)
    const [analyticsMonths, setAnalyticsMonths] = useState(6)

    const loadOverview = useCallback(async (signal) => {
        if (!token) {
            setError('Your session has expired. Please sign in again.')
            setLoading(false)
            return
        }

        try {
            setError('')
            const headers = {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            }

            const endpoints = [
                { name: 'jobs', url: `${API_BASE}/Jobs` },
                { name: 'applications', url: `${API_BASE}/JobApplications` },
                { name: 'interviews', url: `${API_BASE}/Interviews` },
            ]

            const responses = await Promise.all(
                endpoints.map(({ url }) => fetch(url, { headers, signal }))
            )
            const payloads = await Promise.all(responses.map(async (response, index) => {
                const payload = await response.json().catch(() => ({}))
                if (!response.ok) {
                    const message = payload.message ?? payload.title ?? payload.detail
                    throw new Error(message || `Unable to load ${endpoints[index].name} (${response.status}).`)
                }
                return payload
            }))

            const jobList = getList(payloads[0], ['jobs', 'Jobs'])
            const applicationList = getList(payloads[1], ['applications', 'Applications'])
            const interviewList = getList(payloads[2], ['interviews', 'Interviews'])

            if (!jobList || !applicationList || !interviewList) {
                throw new Error('The API returned an unexpected dashboard response. Refresh the page or check the API.')
            }

            if (signal.aborted) return

            setJobs(jobList)
            setApplications(applicationList)
            setInterviews(interviewList)
            setReferenceTime(Date.now())
        } catch (requestError) {
            if (requestError.name !== 'AbortError' && !signal.aborted) {
                setError(requestError.message || 'Could not load your hiring overview.')
            }
        } finally {
            if (!signal.aborted) setLoading(false)
        }
    }, [token])

    useEffect(() => {
        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            setLoading(true)
            void loadOverview(controller.signal)
        }, 0)

        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [loadOverview, reloadKey])

    useEffect(() => {
        function onLiveEvent() {
            setReloadKey((prev) => prev + 1)
        }
        window.addEventListener('hireflow:live-event', onLiveEvent)
        return () => window.removeEventListener('hireflow:live-event', onLiveEvent)
    }, [])

    const ownedJobs = useMemo(() => {
        const userId = getUserId(user)
        if (userId === null || userId === undefined || String(userId).trim() === '') return []

        return jobs.filter((job) => {
            const ownerId = job?.createdByUserId ?? job?.CreatedByUserId
            return ownerId !== null && ownerId !== undefined && String(ownerId) === String(userId)
        })
    }, [jobs, user])

    const stats = useMemo(() => {
        const shortlistedCount = applications.filter((application) =>
            getStatus(application.status ?? application.Status).toLowerCase() === 'shortlisted'
        ).length
        const scheduledCount = interviews.filter((interview) =>
            getStatus(interview.status ?? interview.Status).toLowerCase() === 'scheduled'
        ).length

        return [
            { label: 'Your job postings', value: ownedJobs.length, detail: 'Jobs you have published', icon: '▤', tone: 'violet', href: '/hr/jobs' },
            { label: 'Total applicants', value: applications.length, detail: 'Applications to your jobs', icon: '♙', tone: 'blue', href: '/hr/applicants' },
            { label: 'Shortlisted', value: shortlistedCount, detail: 'Candidates progressing', icon: '✦', tone: 'green', href: '/hr/applicants' },
            { label: 'Scheduled interviews', value: scheduledCount, detail: 'Interviews on your calendar', icon: '◷', tone: 'amber', href: '/hr/interviews' },
        ]
    }, [ownedJobs, applications, interviews])

    const recentApplications = useMemo(() => [...applications]
        .sort((first, second) => {
            const firstDate = getDate(first.appliedAt ?? first.AppliedAt ?? first.createdAt ?? first.CreatedAt)?.getTime() ?? 0
            const secondDate = getDate(second.appliedAt ?? second.AppliedAt ?? second.createdAt ?? second.CreatedAt)?.getTime() ?? 0
            return secondDate - firstDate
        })
        .slice(0, 5), [applications])

    const monthlyApplications = useMemo(
        () => buildMonthlyApplications(applications, analyticsMonths),
        [applications, analyticsMonths]
    )
    const applicationStatuses = useMemo(
        () => buildApplicationStatuses(applications),
        [applications]
    )

    const upcomingInterviews = useMemo(() => {
        const now = referenceTime
        return interviews
            .filter((interview) => getStatus(interview.status ?? interview.Status).toLowerCase() === 'scheduled')
            .map((interview) => ({ ...interview, _date: getDate(interview.scheduledAt ?? interview.ScheduledAt) }))
            .filter((interview) => interview._date && interview._date.getTime() >= now)
            .sort((first, second) => first._date.getTime() - second._date.getTime())
            .slice(0, 5)
    }, [interviews, referenceTime])

    return (
        <section className="hr-overview" aria-labelledby="hr-overview-title">
            <div className="hr-overview-toolbar">
                <div className="hr-overview-intro">
                    <span className="hr-overview-eyebrow">RECRUITMENT WORKSPACE</span>
                    <h2 id="hr-overview-title">Your hiring at a glance</h2>
                    <p>Track your job posts, candidate applications, and upcoming interviews.</p>
                </div>
                <div className="hr-overview-actions">
                    <button type="button" className="hr-overview-button secondary" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
                        <span aria-hidden="true">↻</span> {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <Link className="hr-overview-button primary" to="/hr/jobs/new">＋ Create job</Link>
                </div>
            </div>

            {error && (
                <div className="hr-overview-alert" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>
                </div>
            )}

            <div className="hr-overview-stats">
                {stats.map((stat) => (
                    <Link className="hr-overview-stat" to={stat.href} key={stat.label}>
                        <span className={`hr-overview-stat-icon ${stat.tone}`} aria-hidden="true">{stat.icon}</span>
                        <span className="hr-overview-stat-copy">
                            <span>{stat.label}</span>
                            <strong>{loading ? '—' : stat.value}</strong>
                            <small>{stat.detail}</small>
                        </span>
                        <span className="hr-overview-stat-arrow" aria-hidden="true">↗</span>
                    </Link>
                ))}
            </div>

            <div className="hr-overview-columns">
                <section className="hr-overview-panel" aria-labelledby="hr-recent-applicants-title">
                    <div className="hr-overview-panel-heading">
                        <div><h3 id="hr-recent-applicants-title">Recent applicants</h3><p>Your latest candidate submissions</p></div>
                        <Link to="/hr/applicants">View all <span aria-hidden="true">→</span></Link>
                    </div>
                    {loading ? <SkeletonLoader variant="application-list" count={3} /> : recentApplications.length === 0 ? (
                        <div className="hr-overview-state">
                            <span className="hr-overview-empty-icon" aria-hidden="true">♙</span>
                            <strong>No applicants yet</strong>
                            <span>New applications will appear here when candidates apply.</span>
                            <Link to="/hr/jobs/new">Create a job</Link>
                        </div>
                    ) : (
                        <div className="hr-overview-list">
                            {recentApplications.map((application, index) => {
                                const applicationId = getApplicationId(application)
                                const name = application.applicantName ?? application.ApplicantName ?? 'Unnamed applicant'
                                const email = application.applicantEmail ?? application.ApplicantEmail ?? 'Email not provided'
                                const jobTitle = application.job?.title ?? application.job?.Title ?? application.jobTitle ?? application.JobTitle ?? 'Job application'
                                const status = getStatus(application.status ?? application.Status)
                                const content = (
                                    <>
                                        <span className="hr-overview-avatar" aria-hidden="true">{String(name).trim().charAt(0).toUpperCase() || '?'}</span>
                                        <span className="hr-overview-applicant-copy">
                                            <strong>{name}</strong>
                                            <span>{email}</span>
                                            <small>{jobTitle} · Applied {formatDate(application.appliedAt ?? application.AppliedAt ?? application.createdAt ?? application.CreatedAt)}</small>
                                        </span>
                                        <span className={`hr-overview-status ${getStatusClass(status)}`}>{status}</span>
                                    </>
                                )

                                return applicationId ? (
                                    <Link to={`/hr/applicants/${applicationId}`} className="hr-overview-applicant" key={applicationId}>{content}</Link>
                                ) : (
                                    <div className="hr-overview-applicant" key={`${email}-${index}`}>{content}</div>
                                )
                            })}
                        </div>
                    )}
                </section>

                <section className="hr-overview-panel" aria-labelledby="hr-upcoming-interviews-title">
                    <div className="hr-overview-panel-heading">
                        <div><h3 id="hr-upcoming-interviews-title">Upcoming interviews</h3><p>What's next on your schedule</p></div>
                        <Link to="/hr/interviews">View all <span aria-hidden="true">→</span></Link>
                    </div>
                    {loading ? <SkeletonLoader variant="interviews" count={3} /> : upcomingInterviews.length === 0 ? (
                        <div className="hr-overview-state">
                            <span className="hr-overview-empty-icon" aria-hidden="true">◷</span>
                            <strong>No upcoming interviews</strong>
                            <span>Scheduled interviews will appear here.</span>
                            <Link to="/hr/interviews">Manage interviews</Link>
                        </div>
                    ) : (
                        <div className="hr-overview-list">
                            {upcomingInterviews.map((interview, index) => {
                                const id = getInterviewId(interview) ?? `interview-${index}`
                                const name = interview.applicantName ?? interview.ApplicantName ?? 'Candidate'
                                const jobTitle = interview.jobTitle ?? interview.JobTitle ?? 'Interview'
                                return (
                                    <div className="hr-overview-interview" key={id}>
                                        <span className="hr-overview-date">
                                            <strong>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' }).format(interview._date)}</strong>
                                            <span>{new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).format(interview._date)}</span>
                                        </span>
                                        <span className="hr-overview-interview-copy">
                                            <strong>{name}</strong>
                                            <span>{jobTitle}</span>
                                            <small>{formatDateTime(interview.scheduledAt ?? interview.ScheduledAt)}</small>
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>
            </div>

            <section className="hr-overview-quick-links" aria-label="Quick actions">
                <Link to="/hr/jobs/new"><span className="hr-overview-quick-icon" aria-hidden="true">＋</span><span><strong>Post a new job</strong><small>Create an opening and start receiving applications.</small></span><span aria-hidden="true">↗</span></Link>
                <Link to="/hr/applicants"><span className="hr-overview-quick-icon" aria-hidden="true">♙</span><span><strong>Review candidates</strong><small>Check applications and update candidate status.</small></span><span aria-hidden="true">↗</span></Link>
                <Link to="/hr/interviews"><span className="hr-overview-quick-icon" aria-hidden="true">◷</span><span><strong>Manage interviews</strong><small>Schedule meetings and review upcoming interviews.</small></span><span aria-hidden="true">↗</span></Link>
            </section>

            <section className="hr-overview-analytics" aria-labelledby="hr-overview-analytics-title">
                <div className="hr-overview-analytics-heading">
                    <div>
                        <span className="hr-overview-eyebrow">HIRING ANALYTICS</span>
                        <h3 id="hr-overview-analytics-title">Recruitment insights</h3>
                        <p>Track application activity and candidate progress using your current records.</p>
                    </div>
                </div>
                <div className="hr-overview-chart-grid">
                    <section className="hr-overview-panel hr-overview-chart-panel" aria-labelledby="hr-applications-chart-title">
                        <div className="hr-overview-panel-heading">
                            <div>
                                <h3 id="hr-applications-chart-title">Applications over time</h3>
                                <p>Monthly applications for the selected period</p>
                            </div>
                            <label className="hr-overview-period-control">
                                <span className="hr-overview-sr-only">Analytics period</span>
                                <select
                                    className="hr-overview-period-select"
                                    value={analyticsMonths}
                                    onChange={(event) => setAnalyticsMonths(Number(event.target.value))}
                                    aria-label="Select analytics period"
                                >
                                    {[1, 3, 6, 9, 12].map((months) => (
                                        <option key={months} value={months}>{months} {months === 1 ? 'month' : 'months'}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <ApplicationsBarChart data={monthlyApplications} loading={loading} />
                    </section>
                    <section className="hr-overview-panel hr-overview-chart-panel" aria-labelledby="hr-application-status-chart-title">
                        <div className="hr-overview-panel-heading">
                            <div>
                                <h3 id="hr-application-status-chart-title">Application status</h3>
                                <p>Current distribution across statuses</p>
                            </div>
                        </div>
                        <ApplicationStatusChart
                            statuses={applicationStatuses}
                            total={applications.length}
                            loading={loading}
                        />
                    </section>
                </div>

                <PipelineFunnelChart applications={applications} jobs={ownedJobs.length ? ownedJobs : jobs} />
            </section>
        </section>
    )
}

export default HROverview
