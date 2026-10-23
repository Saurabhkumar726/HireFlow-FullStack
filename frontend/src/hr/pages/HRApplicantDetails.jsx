
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './HRApplicantDetails.css'

const API_BASE = 'http://localhost:5116/api'
const STATUSES = ['Pending', 'Reviewed', 'Shortlisted', 'Rejected']

function formatDate(value) {
    if (!value) return '—'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return '—'

    return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

async function getErrorMessage(response) {
    const text = await response.text()

    if (!text) return `Request failed (${response.status}).`

    try {
        const data = JSON.parse(text)

        if (typeof data === 'string') return data

        return data.message ?? data.title ?? data.detail ?? data.error ?? text
    } catch {
        return text
    }
}

function getField(object, ...keys) {
    for (const key of keys) {
        if (object?.[key] !== undefined && object[key] !== null) {
            return object[key]
        }
    }

    return undefined
}

function getApplicationId(params) {
    const routeId = params.id ?? params.applicationId

    if (routeId != null && String(routeId).trim() !== '') {
        return String(routeId).trim()
    }

    const match = window.location.pathname.match(
        /^\/hr\/applicants\/([^/]+)\/?$/
    )

    return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function HRApplicantDetails() {
    const params = useParams()
    const navigate = useNavigate()
    const id = getApplicationId(params)

    const [application, setApplication] = useState(null)
    const [status, setStatus] = useState('Pending')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [reloadKey, setReloadKey] = useState(0)

    // Navigate directly to the Applicants list.
    const goBackToApplicants = () => {
        navigate('/hr/applicants', { replace: false })
    }

    const loadApplication = useCallback(async (signal) => {
        try {
            if (
                !/^\d+$/.test(id) ||
                !Number.isSafeInteger(Number(id)) ||
                Number(id) <= 0
            ) {
                throw new Error(
                    `Invalid application ID: "${id || 'missing'}". Check the applicant details URL.`
                )
            }

            const token = localStorage.getItem('hireflow-token')

            if (!token) {
                throw new Error(
                    'Your session has expired. Please sign in again.'
                )
            }

            const response = await fetch(
                `${API_BASE}/JobApplications/${encodeURIComponent(id)}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json',
                    },
                    signal,
                }
            )

            if (!response.ok) {
                throw new Error(await getErrorMessage(response))
            }

            const data = await response.json()

            if (!data || typeof data !== 'object') {
                throw new Error('The API returned invalid application data.')
            }

            if (!signal.aborted) {
                setApplication(data)
                setStatus(getField(data, 'status', 'Status') ?? 'Pending')
            }
        } catch (err) {
            if (err.name === 'AbortError' || signal.aborted) return

            setApplication(null)
            setError(err.message || 'Unable to load this application.')
        } finally {
            if (!signal.aborted) {
                setLoading(false)
            }
        }
    }, [id])

    useEffect(() => {
        const controller = new AbortController()

        const timer = setTimeout(() => {
            setLoading(true)
            setError('')
            setNotice('')
            void loadApplication(controller.signal)
        }, 0)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [loadApplication, reloadKey])

    async function saveStatus(event) {
        event.preventDefault()

        if (!STATUSES.includes(status)) {
            setError('Please select a valid application status.')
            return
        }

        setSaving(true)
        setError('')
        setNotice('')

        try {
            const token = localStorage.getItem('hireflow-token')

            if (!token) {
                throw new Error(
                    'Your session has expired. Please sign in again.'
                )
            }

            const response = await fetch(
                `${API_BASE}/JobApplications/${encodeURIComponent(id)}/status`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(status),
                }
            )

            if (!response.ok) {
                throw new Error(await getErrorMessage(response))
            }

            setApplication((current) =>
                current ? { ...current, status, Status: status } : current
            )

            setNotice('Application status updated successfully.')
        } catch (err) {
            setError(
                err.message || 'Unable to update application status.'
            )
        } finally {
            setSaving(false)
        }
    }

    const applicantName =
        getField(
            application,
            'applicantName',
            'ApplicantName',
            'fullName',
            'FullName',
            'name',
            'Name'
        ) ?? 'Applicant'

    const applicantEmail =
        getField(
            application,
            'applicantEmail',
            'ApplicantEmail',
            'email',
            'Email'
        ) ?? '—'

    const job = getField(application, 'job', 'Job')

    const jobTitle =
        getField(application, 'jobTitle', 'JobTitle') ??
        getField(job, 'title', 'Title') ??
        'Job posting'

    const currentStatus =
        getField(application, 'status', 'Status') ?? 'Pending'

    const appliedAt = getField(
        application,
        'appliedAt',
        'AppliedAt',
        'createdAt',
        'CreatedAt'
    )

    const resumeUrl = getField(application, 'resumeUrl', 'ResumeUrl')
    const coverLetter = getField(application, 'coverLetter', 'CoverLetter')

    if (loading) {
        return (
            <section className="hr-applicant-details">
                <div className="hr-applicant-details-state" role="status">
                    Loading applicant details…
                </div>
            </section>
        )
    }

    if (error && !application) {
        return (
            <section className="hr-applicant-details">
                <button
                    type="button"
                    className="hr-applicant-back"
                    onClick={goBackToApplicants}
                >
                    ← Back to Applicants
                </button>

                <div
                    className="hr-applicant-details-alert hr-applicant-details-error"
                    role="alert"
                >
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={() => setReloadKey((value) => value + 1)}
                    >
                        Try again
                    </button>
                </div>
            </section>
        )
    }

    if (!application) return null

    return (
        <section className="hr-applicant-details">
            <button
                type="button"
                className="hr-applicant-back"
                onClick={goBackToApplicants}
            >
                ← Back to Applicants
            </button>

            <div className="hr-applicant-details-heading">
                <div className="hr-applicant-details-avatar">
                    {String(applicantName).charAt(0).toUpperCase()}
                </div>

                <div>
                    <span className="hr-applicant-details-eyebrow">
                        APPLICATION DETAILS
                    </span>
                    <h2>{applicantName}</h2>
                    <p>{applicantEmail}</p>
                </div>
            </div>

            {error && (
                <div
                    className="hr-applicant-details-alert hr-applicant-details-error"
                    role="alert"
                >
                    {error}
                </div>
            )}

            {notice && (
                <div
                    className="hr-applicant-details-alert hr-applicant-details-success"
                    role="status"
                >
                    {notice}
                </div>
            )}

            <div className="hr-applicant-details-grid">
                <article className="hr-applicant-details-panel">
                    <h3>Application information</h3>

                    <div className="hr-applicant-detail-row">
                        <span>Job title</span>
                        <strong>{jobTitle}</strong>
                    </div>

                    <div className="hr-applicant-detail-row">
                        <span>Application status</span>
                        <strong>{currentStatus}</strong>
                    </div>

                    <div className="hr-applicant-detail-row">
                        <span>Applied on</span>
                        <strong>{formatDate(appliedAt)}</strong>
                    </div>

                    <div className="hr-applicant-detail-row">
                        <span>Application ID</span>
                        <strong>
                            {getField(application, 'id', 'Id') ?? id}
                        </strong>
                    </div>

                    {resumeUrl ? (
                        <a
                            className="hr-applicant-resume"
                            href={resumeUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            View resume ↗
                        </a>
                    ) : (
                        <p className="hr-applicant-no-resume">
                            No resume URL was provided with this application.
                        </p>
                    )}
                </article>

                <article className="hr-applicant-details-panel">
                    <h3>Review application</h3>

                    <p className="hr-applicant-panel-description">
                        Update the status to reflect your review.
                    </p>

                    <form onSubmit={saveStatus}>
                        <label htmlFor="hr-application-status">
                            Application status
                        </label>

                        <select
                            id="hr-application-status"
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            disabled={saving}
                        >
                            {STATUSES.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>

                        <button
                            type="submit"
                            className="hr-applicant-save-status"
                            disabled={saving || status === currentStatus}
                        >
                            {saving ? 'Saving…' : 'Save status'}
                        </button>
                    </form>
                </article>

                <article className="hr-applicant-details-panel hr-applicant-cover-letter">
                    <h3>Cover letter</h3>

                    {coverLetter ? (
                        <p>{coverLetter}</p>
                    ) : (
                        <p className="hr-applicant-panel-description">
                            No cover letter was provided with this application.
                        </p>
                    )}
                </article>
            </div>
        </section>
    )
}

export default HRApplicantDetails
