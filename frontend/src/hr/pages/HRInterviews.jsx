
import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import './HRInterviews.css'

const API_BASE = 'http://localhost:5116/api'
const INTERVIEW_TYPES = ['Online', 'In-person', 'Phone']
const INTERVIEW_STATUSES = ['Scheduled', 'Completed', 'Cancelled']

function getId(item) {
    const value = item?.id ?? item?.Id ??
        item?.applicationId ?? item?.ApplicationId

    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : null
}

function getList(data, keys = []) {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.$values)) return data.$values

    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key]
        if (Array.isArray(data?.[key]?.$values)) {
            return data[key].$values
        }
    }

    if (Array.isArray(data?.data)) return data.data
    return null
}

async function readResponse(response) {
    const text = await response.text()
    let data = {}

    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            data = { message: text }
        }
    }

    if (!response.ok) {
        throw new Error(
            data.message || data.title || data.detail ||
            `Request failed (${response.status}).`
        )
    }

    return data
}

// The API may return SQL Server DateTime values without a timezone suffix.
// Treat those values as UTC because the frontend sends scheduledAt as UTC.
function parseApiDateTime(value) {
    if (!value) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value !== 'string') {
        return null
    }

    const trimmedValue = value.trim()
    if (!trimmedValue) return null

    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmedValue)
    const date = new Date(hasTimezone ? trimmedValue : `${trimmedValue}Z`)

    return Number.isNaN(date.getTime()) ? null : date
}

function getLocalDateTime(value) {
    const date = parseApiDateTime(value)
    if (!date) return ''

    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    )

    return localDate.toISOString().slice(0, 16)
}

function formatDateTime(value) {
    if (!value) return 'Not scheduled'

    const date = parseApiDateTime(value)

    if (!date) return 'Invalid date'

    // Display the UTC timestamp as India Standard Time (IST).
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
    })
}

function getApplicantName(item) {
    return item?.applicantName ?? item?.ApplicantName ??
        item?.fullName ?? item?.FullName ?? 'Unnamed applicant'
}

function getApplicantEmail(item) {
    return item?.applicantEmail ?? item?.ApplicantEmail ??
        item?.email ?? item?.Email ?? 'Email not provided'
}

function getJobTitle(item) {
    return item?.jobTitle ?? item?.JobTitle ??
        item?.job?.title ?? item?.job?.Title ?? 'Job posting'
}

function getInterviewStatus(item) {
    return item?.status ?? item?.Status ?? 'Scheduled'
}

function getInterviewType(item) {
    return item?.interviewType ?? item?.InterviewType ?? 'Online'
}

async function getErrorMessage(response) {
    try {
        const data = await readResponse(response)
        return data.message || data.title || data.detail || 'Request failed.'
    } catch (err) {
        return err.message || 'Request failed.'
    }
}

function HRInterviews() {
    const [interviews, setInterviews] = useState([])
    const [applications, setApplications] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('All')
    const [reloadKey, setReloadKey] = useState(0)
    const [editingInterview, setEditingInterview] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [pendingConfirmation, setPendingConfirmation] = useState(null)
    const [deletingId, setDeletingId] = useState(null)

    const [form, setForm] = useState({
        jobApplicationId: '',
        scheduledAt: '',
        interviewType: 'Online',
        meetingLink: '',
        notes: '',
        status: 'Scheduled',
    })

    const loadData = useCallback(async (signal) => {
        try {
            const token = localStorage.getItem('hireflow-token')

            if (!token) {
                throw new Error('Your session has expired. Please sign in again.')
            }

            const headers = {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            }

            const [interviewResponse, applicationResponse] =
                await Promise.all([
                    fetch(`${API_BASE}/Interviews`, { headers, signal }),
                    fetch(`${API_BASE}/JobApplications`, { headers, signal }),
                ])

            if (!interviewResponse.ok) {
                throw new Error(await getErrorMessage(interviewResponse))
            }

            if (!applicationResponse.ok) {
                throw new Error(await getErrorMessage(applicationResponse))
            }

            const [interviewData, applicationData] = await Promise.all([
                interviewResponse.json(),
                applicationResponse.json(),
            ])

            const interviewList = getList(interviewData, ['interviews', 'Interviews'])
            const applicationList = getList(applicationData, [
                'applications',
                'Applications',
            ])

            if (!interviewList || !applicationList) {
                throw new Error(
                    'The API returned an unexpected response. Check the Network tab.'
                )
            }

            if (signal.aborted) return

            setInterviews(interviewList)
            setApplications(applicationList)
            setError('')
        } catch (err) {
            if (err.name === 'AbortError' || signal.aborted) return
            setError(err.message || 'Unable to load interviews.')
        } finally {
            if (!signal.aborted) setLoading(false)
        }
    }, [])

    useEffect(() => {
        const controller = new AbortController()

        const timer = setTimeout(() => {
            setLoading(true)
            void loadData(controller.signal)
        }, 0)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [loadData, reloadKey])



    const applicationOptions = useMemo(() => {
        return applications.filter((application) => getId(application) !== null)
    }, [applications])

    const filteredInterviews = useMemo(() => {
        const term = search.trim().toLowerCase()

        return interviews.filter((item) => {
            const status = getInterviewStatus(item)
            const matchesStatus =
                statusFilter === 'All' || status === statusFilter

            const searchable = [
                getApplicantName(item),
                getApplicantEmail(item),
                getJobTitle(item),
                item.meetingLink,
                item.MeetingLink,
                item.interviewType,
                item.InterviewType,
            ].filter(Boolean).join(' ').toLowerCase()

            return matchesStatus &&
                (!term || searchable.includes(term))
        })
    }, [interviews, search, statusFilter])

    const counts = useMemo(() => ({
        total: interviews.length,
        scheduled: interviews.filter(
            (item) => getInterviewStatus(item) === 'Scheduled'
        ).length,
        completed: interviews.filter(
            (item) => getInterviewStatus(item) === 'Completed'
        ).length,
        cancelled: interviews.filter(
            (item) => getInterviewStatus(item) === 'Cancelled'
        ).length,
    }), [interviews])

    function resetForm() {
        setEditingInterview(null)
        setShowForm(false)
        setForm({
            jobApplicationId: '',
            scheduledAt: '',
            interviewType: 'Online',
            meetingLink: '',
            notes: '',
            status: 'Scheduled',
        })
    }

    function openCreateForm() {
        setError('')
        setNotice('')
        setEditingInterview(null)
        setForm({
            jobApplicationId: '',
            scheduledAt: '',
            interviewType: 'Online',
            meetingLink: '',
            notes: '',
            status: 'Scheduled',
        })
        setShowForm(true)
    }

    function openEditForm(item) {
        setError('')
        setNotice('')
        setEditingInterview(item)
        setForm({
            jobApplicationId: String(
                item.jobApplicationId ?? item.JobApplicationId ?? ''
            ),
            scheduledAt: getLocalDateTime(
                item.scheduledAt ?? item.ScheduledAt
            ),
            interviewType: getInterviewType(item),
            meetingLink: item.meetingLink ?? item.MeetingLink ?? '',
            notes: item.notes ?? item.Notes ?? '',
            status: getInterviewStatus(item),
        })
        setShowForm(true)
    }

    function updateField(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')
        setNotice('')

        if (!form.scheduledAt) {
            setError('Please select an interview date and time.')
            return
        }

        const scheduledDate = new Date(form.scheduledAt)

        if (Number.isNaN(scheduledDate.getTime())) {
            setError('Please enter a valid interview date and time.')
            return
        }

        if (
            form.status === 'Scheduled' &&
            scheduledDate.getTime() <= Date.now()
        ) {
            setError('A scheduled interview must be in the future.')
            return
        }

        if (!editingInterview && !form.jobApplicationId) {
            setError('Please select a job applicant.')
            return
        }

        if (
            !INTERVIEW_TYPES.includes(form.interviewType) ||
            !INTERVIEW_STATUSES.includes(form.status)
        ) {
            setError('Please select valid interview details.')
            return
        }

        // Ask for confirmation when changing an interview to Completed.
        const currentStatus = editingInterview
            ? getInterviewStatus(editingInterview)
            : null

        if (
            editingInterview &&
            form.status === 'Completed' &&
            currentStatus !== 'Completed'
        ) {
            setPendingConfirmation({ type: 'complete' })
            return
        }

        await saveInterview()
    }

    async function saveInterview() {
        try {
            const token = localStorage.getItem('hireflow-token')

            if (!token) {
                throw new Error('Your session has expired. Please sign in again.')
            }

            const isEditing = Boolean(editingInterview)
            const interviewId = editingInterview
                ? getId(editingInterview)
                : null

            if (isEditing && interviewId === null) {
                throw new Error('The interview has an invalid ID.')
            }

            const scheduledDate = new Date(form.scheduledAt)

            if (Number.isNaN(scheduledDate.getTime())) {
                throw new Error('Please enter a valid interview date and time.')
            }

            const payload = {
                scheduledAt: scheduledDate.toISOString(),
                interviewType: form.interviewType,
                meetingLink: form.meetingLink.trim() || null,
                notes: form.notes.trim() || null,
            }

            if (isEditing) {
                payload.status = form.status
            } else {
                payload.jobApplicationId = Number(form.jobApplicationId)
            }

            setSaving(true)
            setError('')
            setNotice('')

            const response = await fetch(
                isEditing
                    ? `${API_BASE}/Interviews/${interviewId}`
                    : `${API_BASE}/Interviews`,
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
                }
            )

            await readResponse(response)

            resetForm()
            setPendingConfirmation(null)
            setNotice(
                isEditing
                    ? 'Interview updated successfully.'
                    : 'Interview scheduled successfully.'
            )
            setReloadKey((current) => current + 1)
        } catch (err) {
            setError(err.message || 'Unable to save the interview.')
        } finally {
            setSaving(false)
        }
    }

    function requestDeleteInterview(item) {
        const id = getId(item)

        if (id === null) {
            setError('This interview has an invalid ID.')
            return
        }

        setError('')
        setNotice('')
        setPendingConfirmation({ type: 'delete', item })
    }

    async function deleteInterview(item) {
        const id = getId(item)

        if (id === null) {
            setError('This interview has an invalid ID.')
            return
        }

        try {
            setDeletingId(id)
            setError('')
            setNotice('')

            const token = localStorage.getItem('hireflow-token')

            if (!token) {
                throw new Error('Your session has expired. Please sign in again.')
            }

            const response = await fetch(`${API_BASE}/Interviews/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            })

            await readResponse(response)

            setInterviews((current) =>
                current.filter((interview) => getId(interview) !== id)
            )
            setPendingConfirmation(null)
            setNotice('Interview deleted successfully.')
        } catch (err) {
            setError(err.message || 'Unable to delete the interview.')
            setPendingConfirmation(null)
        } finally {
            setDeletingId(null)
        }
    }

    async function confirmPendingAction() {
        if (!pendingConfirmation || saving || deletingId !== null) return

        if (pendingConfirmation.type === 'complete') {
            await saveInterview()
            return
        }

        if (pendingConfirmation.type === 'delete') {
            await deleteInterview(pendingConfirmation.item)
        }
    }

    function cancelPendingConfirmation() {
        if (saving || deletingId !== null) return
        setPendingConfirmation(null)
    }


    return (
        <section className="hr-interviews">
            <header className="hr-interviews-header">
                <div>
                    <span className="hr-interviews-eyebrow">
                        RECRUITMENT WORKSPACE
                    </span>
                    <h2>Interviews</h2>
                    <p>Schedule interviews and manage candidate meetings.</p>
                </div>

                <div className="hr-interviews-header-actions">
                    <button
                        type="button"
                        className="hi-button hi-button-secondary"
                        onClick={() => setReloadKey((key) => key + 1)}
                        disabled={loading}
                    >
                        {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <button
                        type="button"
                        className="hi-button hi-button-primary"
                        onClick={openCreateForm}
                    >
                        + Schedule interview
                    </button>
                </div>
            </header>

            <div className="hi-stat-grid">
                <article className="hi-stat-card">
                    <span>Total interviews</span>
                    <strong>{counts.total}</strong>
                    <small>All interview records</small>
                </article>
                <article className="hi-stat-card">
                    <span>Scheduled</span>
                    <strong>{counts.scheduled}</strong>
                    <small>Upcoming or planned</small>
                </article>
                <article className="hi-stat-card">
                    <span>Completed</span>
                    <strong>{counts.completed}</strong>
                    <small>Finished interviews</small>
                </article>
                <article className="hi-stat-card">
                    <span>Cancelled</span>
                    <strong>{counts.cancelled}</strong>
                    <small>Cancelled meetings</small>
                </article>
            </div>

            {error && (
                <div className="hi-alert hi-alert-error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError('')}>
                        Dismiss
                    </button>
                </div>
            )}

            {notice && (
                <div className="hi-alert hi-alert-success" role="status">
                    <span>{notice}</span>
                    <button type="button" onClick={() => setNotice('')}>
                        Dismiss
                    </button>
                </div>
            )}

            <div className="hi-toolbar">
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search applicant, email, or job…"
                    aria-label="Search interviews"
                />

                <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter by interview status"
                >
                    <option value="All">All statuses</option>
                    {INTERVIEW_STATUSES.map((status) => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="hi-empty">
                    <span className="hi-loading-indicator" />
                    <h3>Loading interviews…</h3>
                    <p>Fetching your interview schedule.</p>
                </div>
            ) : filteredInterviews.length === 0 ? (
                <div className="hi-empty">
                    <div className="hi-empty-icon">▦</div>
                    <h3>
                        {interviews.length === 0
                            ? 'No interviews scheduled yet'
                            : 'No matching interviews'}
                    </h3>
                    <p>
                        {interviews.length === 0
                            ? 'Schedule an interview with an applicant to get started.'
                            : 'Try changing your search or status filter.'}
                    </p>
                    {interviews.length === 0 && (
                        <button
                            type="button"
                            className="hi-button hi-button-primary"
                            onClick={openCreateForm}
                        >
                            Schedule your first interview
                        </button>
                    )}
                </div>
            ) : (
                <div className="hi-interview-list">
                    {filteredInterviews.map((item, index) => {
                        const id = getId(item)
                        const status = getInterviewStatus(item)
                        const type = getInterviewType(item)
                        const name = getApplicantName(item)
                        const email = getApplicantEmail(item)
                        const scheduledAt =
                            item.scheduledAt ?? item.ScheduledAt
                        const jobTitle = getJobTitle(item)
                        const meetingLink =
                            item.meetingLink ?? item.MeetingLink

                        return (
                            <article
                                className="hi-interview-card"
                                key={id ?? `interview-${index}`}
                            >
                                <div className="hi-interview-card-top">
                                    <div className="hi-interview-person">
                                        <div className="hi-avatar">
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="hi-person-details">
                                            <h3>{name}</h3>
                                            <p>{email}</p>
                                            <span>{jobTitle}</span>
                                        </div>
                                    </div>

                                    <span
                                        className={`hi-status hi-status-${status.toLowerCase()}`}
                                    >
                                        {status}
                                    </span>
                                </div>

                                <div className="hi-interview-details">
                                    <div className="hi-detail-item">
                                        <span className="hi-detail-label">
                                            DATE & TIME
                                        </span>
                                        <strong>
                                            {formatDateTime(scheduledAt)}
                                        </strong>
                                    </div>
                                    <div className="hi-detail-item">
                                        <span className="hi-detail-label">
                                            INTERVIEW TYPE
                                        </span>
                                        <strong>{type}</strong>
                                    </div>
                                    <div className="hi-detail-item">
                                        <span className="hi-detail-label">
                                            MEETING LINK
                                        </span>
                                        {meetingLink ? (
                                            <a
                                                href={meetingLink}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Open meeting
                                            </a>
                                        ) : (
                                            <strong className="hi-muted">
                                                Not provided
                                            </strong>
                                        )}
                                    </div>
                                </div>

                                {(item.notes ?? item.Notes) && (
                                    <p className="hi-interview-notes">
                                        {item.notes ?? item.Notes}
                                    </p>
                                )}

                                <footer className="hi-interview-card-footer">
                                    <span>Interview #{id ?? '—'}</span>
                                    <div>
                                        <button
                                            type="button"
                                            className="hi-button hi-button-secondary"
                                            onClick={() => openEditForm(item)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="hi-button hi-button-danger"
                                            onClick={() => requestDeleteInterview(item)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </footer>
                            </article>
                        )
                    })}
                </div>
            )}

            <p className="hi-results-count">
                Showing {filteredInterviews.length} of {interviews.length} interviews
            </p>

            <ConfirmDialog
                open={pendingConfirmation !== null}
                title={
                    pendingConfirmation?.type === 'complete'
                        ? 'Mark interview as completed?'
                        : 'Delete interview?'
                }
                message={
                    pendingConfirmation?.type === 'complete'
                        ? `Are you sure you want to mark the interview with "${getApplicantName(editingInterview)}" as completed?`
                        : pendingConfirmation?.type === 'delete'
                            ? `Delete the interview with "${getApplicantName(pendingConfirmation.item)}"? This action cannot be undone.`
                            : ''
                }
                confirmText={
                    pendingConfirmation?.type === 'complete'
                        ? 'Mark Completed'
                        : 'Delete Interview'
                }
                cancelText="Cancel"
                danger={pendingConfirmation?.type === 'delete'}
                loading={saving || deletingId !== null}
                onConfirm={confirmPendingAction}
                onCancel={cancelPendingConfirmation}
            />

            {showForm && (
                <div
                    className="hi-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !saving) {
                            resetForm()
                        }
                    }}
                >
                    <section
                        className="hi-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="hi-modal-title"
                    >
                        <header className="hi-modal-header">
                            <div>
                                <span className="hr-interviews-eyebrow">
                                    INTERVIEW MANAGEMENT
                                </span>
                                <h2 id="hi-modal-title">
                                    {editingInterview
                                        ? 'Edit interview'
                                        : 'Schedule interview'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="hi-modal-close"
                                onClick={resetForm}
                                disabled={saving}
                                aria-label="Close form"
                            >
                                ×
                            </button>
                        </header>

                        <form onSubmit={handleSubmit}>
                            {!editingInterview && (
                                <label className="hi-form-field">
                                    <span>Job applicant *</span>
                                    <select
                                        name="jobApplicationId"
                                        value={form.jobApplicationId}
                                        onChange={updateField}
                                        required
                                    >
                                        <option value="">
                                            Select an applicant
                                        </option>
                                        {applicationOptions.map((application) => {
                                            const applicationId = getId(application)

                                            return (
                                                <option
                                                    key={applicationId}
                                                    value={applicationId}
                                                >
                                                    {getApplicantName(application)}
                                                    {' — '}
                                                    {getJobTitle(application)}
                                                    {' (Application #'}
                                                    {applicationId}
                                                    {')'}
                                                </option>
                                            )
                                        })}
                                    </select>
                                    {applicationOptions.length === 0 && (
                                        <small>
                                            No applications with valid IDs were returned.
                                            Check the JobApplications API.
                                        </small>
                                    )}
                                </label>
                            )}

                            <div className="hi-form-row">
                                <label className="hi-form-field">
                                    <span>Date and time *</span>
                                    <input
                                        type="datetime-local"
                                        name="scheduledAt"
                                        value={form.scheduledAt}
                                        onChange={updateField}
                                        required
                                    />
                                </label>

                                <label className="hi-form-field">
                                    <span>Interview type *</span>
                                    <select
                                        name="interviewType"
                                        value={form.interviewType}
                                        onChange={updateField}
                                        required
                                    >
                                        {INTERVIEW_TYPES.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {editingInterview && (
                                <label className="hi-form-field">
                                    <span>Status *</span>
                                    <select
                                        name="status"
                                        value={form.status}
                                        onChange={updateField}
                                        required
                                    >
                                        {INTERVIEW_STATUSES.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <label className="hi-form-field">
                                <span>Meeting link</span>
                                <input
                                    type="url"
                                    name="meetingLink"
                                    value={form.meetingLink}
                                    onChange={updateField}
                                    maxLength={500}
                                    placeholder="https://meet.example.com/..."
                                />
                            </label>

                            <label className="hi-form-field">
                                <span>Notes</span>
                                <textarea
                                    name="notes"
                                    value={form.notes}
                                    onChange={updateField}
                                    maxLength={1000}
                                    rows={4}
                                    placeholder="Interview agenda or instructions…"
                                />
                            </label>

                            <div className="hi-modal-actions">
                                <button
                                    type="button"
                                    className="hi-button hi-button-secondary"
                                    onClick={resetForm}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="hi-button hi-button-primary"
                                    disabled={
                                        saving ||
                                        (!editingInterview &&
                                            applicationOptions.length === 0)
                                    }
                                >
                                    {saving
                                        ? 'Saving…'
                                        : editingInterview
                                            ? 'Save changes'
                                            : 'Schedule interview'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </section>
    )
}

export default HRInterviews
