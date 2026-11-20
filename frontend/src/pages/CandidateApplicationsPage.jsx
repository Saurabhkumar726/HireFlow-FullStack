import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import CityLocationAutocomplete from '../components/CityLocationAutocomplete'
import './CandidateApplicationsPage.css'
import SkeletonLoader from '../components/SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')
const PROGRESS_STAGES = ['Pending', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected']

function readField(object, ...keys) {
    for (const key of keys) {
        if (object?.[key] !== undefined && object[key] !== null) return object[key]
    }
    return undefined
}

function normalizeStatus(value) {
    const status = String(value || 'Pending').trim()
    return status.toLowerCase() === 'reviewed' ? 'Under Review' : status
}

function statusClass(value) {
    return normalizeStatus(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function formatDate(value, withTime = false) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('en-IN', withTime
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : { dateStyle: 'medium' })
}

async function parseResponse(response) {
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(payload.message || payload.title || payload.detail || `Request failed (${response.status}).`)
    }
    return payload
}

function getJob(application) {
    return readField(application, 'job', 'Job') || {}
}

function isEditable(application) {
    const status = normalizeStatus(readField(application, 'status', 'Status'))
    return status === 'Pending'
}

function canWithdraw(application) {
    const status = normalizeStatus(readField(application, 'status', 'Status'))
    return status !== 'Selected' && status !== 'Withdrawn'
}

function WithdrawalConfirmationModal({ application, token, onClose, onSuccess }) {
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const dialogRef = useRef(null)
    const reasonRef = useRef(null)
    const job = getJob(application)
    const jobTitle = readField(job, 'title', 'Title') || 'this job'
    const companyName = readField(job, 'company', 'Company') || 'the employer'

    useEffect(() => {
        const previousOverflow = document.body.style.overflow
        const previousActiveElement = document.activeElement
        document.body.style.overflow = 'hidden'

        const focusFrame = window.requestAnimationFrame(() => {
            reasonRef.current?.focus()
        })

        function handleKeyDown(event) {
            if (event.key === 'Escape' && !submitting) {
                event.preventDefault()
                onClose()
                return
            }

            if (event.key !== 'Tab') return
            const focusable = dialogRef.current?.querySelectorAll(
                'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
            )
            if (!focusable?.length) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            window.cancelAnimationFrame(focusFrame)
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', handleKeyDown)
            if (previousActiveElement instanceof HTMLElement && previousActiveElement.isConnected) {
                previousActiveElement.focus()
            }
        }
    }, [onClose, submitting])

    async function submitWithdrawal(event) {
        event.preventDefault()
        if (submitting) return
        setSubmitting(true)
        setError('')
        try {
            const response = await fetch(`${API_URL}/JobApplications/${application.id}/withdraw`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ reason: reason.trim() }),
            })
            const result = await parseResponse(response)
            onSuccess(result.message || 'Your application has been withdrawn.')
        } catch (err) {
            setError(err.message || 'Unable to withdraw this application. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return createPortal(
        <div
            className="candidate-withdrawal-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !submitting) onClose()
            }}
        >
            <section
                className="candidate-withdrawal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-withdrawal-title"
                aria-describedby="candidate-withdrawal-description"
                ref={dialogRef}
            >
                <div className="candidate-withdrawal-icon" aria-hidden="true">↗</div>
                <button
                    type="button"
                    className="candidate-withdrawal-close"
                    onClick={onClose}
                    disabled={submitting}
                    aria-label="Close withdrawal dialog"
                >
                    ×
                </button>
                <span className="candidate-withdrawal-eyebrow">APPLICATION UPDATE</span>
                <h2 id="candidate-withdrawal-title">Withdraw this application?</h2>
                <p id="candidate-withdrawal-description" className="candidate-withdrawal-copy">
                    You're about to withdraw your application for <strong>{jobTitle}</strong> at {companyName}.
                    You can apply again while the job is still accepting applications.
                </p>

                <form onSubmit={submitWithdrawal}>
                    <label className="candidate-withdrawal-reason-label" htmlFor="candidate-withdrawal-reason">
                        Reason for withdrawing <span>Optional</span>
                    </label>
                    <textarea
                        id="candidate-withdrawal-reason"
                        ref={reasonRef}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={1000}
                        rows={4}
                        placeholder="Share a reason with the recruiter, if you'd like…"
                        disabled={submitting}
                    />
                    <div className="candidate-withdrawal-meta">
                        <span>Your reason is optional.</span>
                        <span>{reason.length}/1000</span>
                    </div>
                    {error && <p className="candidate-withdrawal-error" role="alert">{error}</p>}
                    <div className="candidate-withdrawal-actions">
                        <button
                            type="button"
                            className="candidate-withdrawal-cancel"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Keep application
                        </button>
                        <button type="submit" className="candidate-withdrawal-confirm" disabled={submitting}>
                            {submitting ? 'Withdrawing…' : 'Withdraw application'}
                        </button>
                    </div>
                </form>
            </section>
        </div>,
        document.body
    )
}

function ApplicationEditForm({ application, token, onCancel, onSaved }) {
    const [form, setForm] = useState({
        applicantName: readField(application, 'applicantName', 'ApplicantName') || '',
        applicantEmail: readField(application, 'applicantEmail', 'ApplicantEmail') || '',
        applicantPhoneNumber: readField(application, 'applicantPhoneNumber', 'ApplicantPhoneNumber') || '',
        applicantLocation: readField(application, 'applicantLocation', 'ApplicantLocation') || '',
        applicantLinkedInUrl: readField(application, 'applicantLinkedInUrl', 'ApplicantLinkedInUrl') || '',
        applicantPortfolioUrl: readField(application, 'applicantPortfolioUrl', 'ApplicantPortfolioUrl') || '',
        resumeUrl: readField(application, 'resumeUrl', 'ResumeUrl') || '',
        coverLetter: readField(application, 'coverLetter', 'CoverLetter') || '',
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    function change(event) {
        const { name, value } = event.target
        setForm((previous) => ({ ...previous, [name]: value }))
        setError('')
    }

    async function submit(event) {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            const response = await fetch(`${API_URL}/JobApplications/${application.id}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(form),
            })
            const result = await parseResponse(response)
            onSaved(result.message || 'Application updated successfully.')
        } catch (err) {
            setError(err.message || 'Unable to update this application.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="candidate-application-edit" onSubmit={submit}>
            <div className="candidate-application-edit-heading">
                <div><span>APPLICATION IS STILL NEW</span><h4>Edit submitted details</h4></div>
                <button type="button" onClick={onCancel} disabled={saving} aria-label="Close edit form">×</button>
            </div>
            <div className="candidate-application-edit-grid">
                <label>Full name<input name="applicantName" value={form.applicantName} onChange={change} required maxLength={100} /></label>
                <label>Email address<input name="applicantEmail" type="email" value={form.applicantEmail} onChange={change} required maxLength={254} /></label>
                <label>Phone number<input name="applicantPhoneNumber" value={form.applicantPhoneNumber} onChange={change} maxLength={32} /></label>
                <label>Current location<CityLocationAutocomplete name="applicantLocation" value={form.applicantLocation} onChange={value => setForm(current => ({ ...current, applicantLocation: value }))} maxLength={150} placeholder="City, State" ariaLabel="Current location" /></label>
                <label>LinkedIn URL<input name="applicantLinkedInUrl" type="url" value={form.applicantLinkedInUrl} onChange={change} maxLength={500} placeholder="https://linkedin.com/in/…" /></label>
                <label>Portfolio URL<input name="applicantPortfolioUrl" type="url" value={form.applicantPortfolioUrl} onChange={change} maxLength={500} placeholder="https://…" /></label>
                <label className="candidate-application-edit-wide">Resume URL<input name="resumeUrl" value={form.resumeUrl} onChange={change} maxLength={2048} placeholder="Saved resume link or uploaded profile resume" /></label>
                <label className="candidate-application-edit-wide">Cover letter <span>Optional</span><textarea name="coverLetter" value={form.coverLetter} onChange={change} maxLength={3000} rows={4} /></label>
            </div>
            {error && <p className="candidate-application-alert candidate-application-alert-error" role="alert">{error}</p>}
            <div className="candidate-application-edit-actions">
                <button type="button" className="candidate-application-button candidate-application-button-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
                <button type="submit" className="candidate-application-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
        </form>
    )
}

export default function CandidateApplicationsPage() {
    const { token } = useAuth()
    const [applications, setApplications] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('All')
    const [editingId, setEditingId] = useState(null)
    const [withdrawalApplication, setWithdrawalApplication] = useState(null)
    const [reloadKey, setReloadKey] = useState(0)

    const loadApplications = useCallback(async (signal) => {
        try {
            const response = await fetch(`${API_URL}/JobApplications`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                signal,
            })
            const data = await parseResponse(response)
            const list = Array.isArray(data) ? data : data?.applications || data?.data
            if (!Array.isArray(list)) throw new Error('The applications API returned an unexpected response.')
            if (!signal.aborted) setApplications(list)
        } catch (err) {
            if (err.name !== 'AbortError' && !signal.aborted) setError(err.message || 'Unable to load your applications.')
        } finally {
            if (!signal.aborted) setLoading(false)
        }
    }, [token])

    useEffect(() => {
        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            setLoading(true)
            setError('')
            void loadApplications(controller.signal)
        }, 0)
        return () => { window.clearTimeout(timer); controller.abort() }
    }, [loadApplications, reloadKey])

    const filteredApplications = useMemo(() => {
        const term = search.trim().toLowerCase()
        return applications.filter((application) => {
            const status = normalizeStatus(readField(application, 'status', 'Status'))
            const job = getJob(application)
            const searchable = [
                readField(application, 'applicantName', 'ApplicantName'),
                readField(application, 'applicantEmail', 'ApplicantEmail'),
                readField(job, 'title', 'Title'),
                readField(job, 'company', 'Company'),
            ].filter(Boolean).join(' ').toLowerCase()
            return (statusFilter === 'All' || status === statusFilter) && (!term || searchable.includes(term))
        })
    }, [applications, search, statusFilter])

    const counts = useMemo(() => ({
        total: applications.length,
        active: applications.filter((item) => ['Pending', 'Under Review', 'Shortlisted', 'Interview Scheduled'].includes(normalizeStatus(readField(item, 'status', 'Status')))).length,
        interviews: applications.filter((item) => normalizeStatus(readField(item, 'status', 'Status')) === 'Interview Scheduled').length,
    }), [applications])

    function saved(message) {
        setEditingId(null)
        setNotice(message)
        setReloadKey((value) => value + 1)
    }

    return (
        <main className="candidate-applications-page">
            <div className="candidate-applications-shell">
                <Link className="candidate-applications-back" to="/candidate/home">← Back to your job feed</Link>
                <header className="candidate-applications-heading">
                    <div>
                        <span className="candidate-applications-eyebrow">YOUR CAREER ACTIVITY</span>
                        <h1>My <em>applications.</em></h1>
                        <p>Track every opportunity, follow recruiter updates, and manage applications that are still new.</p>
                    </div>
                    <Link to="/jobs" className="candidate-application-button">Find more jobs →</Link>
                </header>

                <section className="candidate-applications-stats" aria-label="Application summary">
                    <article><span>Total applications</span><strong>{counts.total}</strong></article>
                    <article><span>In progress</span><strong>{counts.active}</strong></article>
                    <article><span>Interviews scheduled</span><strong>{counts.interviews}</strong></article>
                </section>

                {error && <div className="candidate-application-alert candidate-application-alert-error" role="alert">{error}<button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button></div>}
                {notice && <div className="candidate-application-alert candidate-application-alert-success" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}

                <div className="candidate-applications-toolbar">
                    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by job or company" aria-label="Search applications" />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter applications by status">
                        <option value="All">All statuses</option>
                        {['Pending', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'Withdrawn'].map((status) => <option key={status} value={status}>{status === 'Pending' ? 'New' : status}</option>)}
                    </select>
                </div>

                {loading ? (
                    <SkeletonLoader variant="application-list" count={5} />
                ) : filteredApplications.length === 0 ? (
                    <section className="candidate-applications-empty">
                        <div className="candidate-applications-empty-icon">▤</div>
                        <h2>{applications.length ? 'No matching applications' : 'Your next opportunity starts here.'}</h2>
                        <p>{applications.length ? 'Try another search or status filter.' : 'When you apply for a job, its progress and recruiter updates will appear here.'}</p>
                        <Link to="/jobs" className="candidate-application-button">Explore jobs →</Link>
                    </section>
                ) : (
                    <div className="candidate-applications-list">
                        {filteredApplications.map((application) => {
                            const job = getJob(application)
                            const status = normalizeStatus(readField(application, 'status', 'Status'))
                            const history = readField(application, 'statusHistory', 'StatusHistory') || []
                            const editOpen = editingId === application.id
                            return (
                                <article className="candidate-application-card" key={application.id}>
                                    <div className="candidate-application-card-top">
                                        <div className="candidate-application-company-mark">{String(readField(job, 'company', 'Company') || 'H').trim().charAt(0).toUpperCase()}</div>
                                        <div className="candidate-application-card-title">
                                            <h2>{readField(job, 'title', 'Title') || 'Job posting'}</h2>
                                            <p>{readField(job, 'company', 'Company') || 'Company'} · {readField(job, 'location', 'Location') || 'Location not specified'}</p>
                                            <span>Applied {formatDate(readField(application, 'appliedAt', 'AppliedAt'))} · Application #{application.id}</span>
                                        </div>
                                        <span className={`candidate-application-status candidate-status-${statusClass(status)}`}>{status === 'Pending' ? 'New' : status}</span>
                                    </div>

                                    <div className="candidate-application-progress" aria-label={`Application status: ${status}`}>
                                        {PROGRESS_STAGES.map((stage, index) => {
                                            const currentIndex = PROGRESS_STAGES.indexOf(status)
                                            const complete = currentIndex >= index && currentIndex >= 0
                                            return <div className={`candidate-application-progress-step ${complete ? 'is-complete' : ''}`} key={stage}><span>{complete ? '✓' : index + 1}</span><small>{stage === 'Pending' ? 'New' : stage}</small></div>
                                        })}
                                    </div>

                                    {(status === 'Rejected' && readField(application, 'rejectionReason', 'RejectionReason')) && <p className="candidate-application-reason"><strong>Recruiter update:</strong> {readField(application, 'rejectionReason', 'RejectionReason')}</p>}
                                    {(status === 'Withdrawn' && readField(application, 'withdrawalReason', 'WithdrawalReason')) && <p className="candidate-application-reason"><strong>Withdrawal reason:</strong> {readField(application, 'withdrawalReason', 'WithdrawalReason')}</p>}

                                    {Array.isArray(application.interviews) && application.interviews.length > 0 && (
                                        <section className="candidate-application-interviews" aria-label="Interview details">
                                            <div className="candidate-application-interviews-heading">
                                                <strong>Interview schedule</strong>
                                                <Link to="/candidate/interviews">View all interviews →</Link>
                                            </div>
                                            {application.interviews.map((interview) => (
                                                <div className="candidate-application-interview-row" key={interview.id}>
                                                    <div>
                                                        <strong>{formatDate(interview.scheduledAt, true)}</strong>
                                                        <span>{interview.interviewType} · {interview.status}</span>
                                                    </div>
                                                    {interview.status === 'Scheduled' && interview.meetingLink && (
                                                        <a href={interview.meetingLink} target="_blank" rel="noreferrer">Join meeting ↗</a>
                                                    )}
                                                </div>
                                            ))}
                                        </section>
                                    )}

                                    {history.length > 0 && (
                                        <details className="candidate-application-history">
                                            <summary>Application activity ({history.length})</summary>
                                            <ol>{history.map((entry) => <li key={entry.id}><span>{normalizeStatus(entry.newStatus || entry.NewStatus)}</span><time>{formatDate(entry.changedAtUtc || entry.ChangedAtUtc, true)}</time>{(entry.reason || entry.Reason) && <p>{entry.reason || entry.Reason}</p>}</li>)}</ol>
                                        </details>
                                    )}

                                    <div className="candidate-application-card-actions">
                                        <Link to={`/jobs/${job.id}`} className="candidate-application-link">View job details ↗</Link>
                                        {isEditable(application) && <button type="button" className="candidate-application-button candidate-application-button-secondary" onClick={() => setEditingId(editOpen ? null : application.id)}>{editOpen ? 'Close editor' : 'Edit application'}</button>}
                                        {canWithdraw(application) && <button type="button" className="candidate-application-withdraw" onClick={() => setWithdrawalApplication(application)}>Withdraw application</button>}
                                    </div>

                                    {editOpen && <ApplicationEditForm application={application} token={token} onCancel={() => setEditingId(null)} onSaved={saved} />}
                                </article>
                            )
                        })}
                    </div>
                )}
            </div>
            {withdrawalApplication && (
                <WithdrawalConfirmationModal
                    application={withdrawalApplication}
                    token={token}
                    onClose={() => setWithdrawalApplication(null)}
                    onSuccess={(message) => {
                        setWithdrawalApplication(null)
                        setNotice(message)
                        setError('')
                        setReloadKey((value) => value + 1)
                    }}
                />
            )}
        </main>
    )
}