
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './HRApplicants.css'

const API_BASE = 'http://localhost:5116/api'
const STATUSES = ['Pending', 'Reviewed', 'Shortlisted', 'Rejected']

function getApplicationId(application) {
    const value =
        application?.id ??
        application?.applicationId ??
        application?.applicationID ??
        application?.application_id ??
        application?.Id

    if (value === null || value === undefined || String(value).trim() === '') {
        return null
    }

    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : null
}

function getApplicantName(application) {
    return (
        application?.applicantName ??
        application?.ApplicantName ??
        application?.fullName ??
        application?.FullName ??
        application?.name ??
        'Unnamed applicant'
    )
}

function getApplicantEmail(application) {
    return (
        application?.applicantEmail ??
        application?.ApplicantEmail ??
        application?.email ??
        application?.Email ??
        'Email not provided'
    )
}

function getJobTitle(application) {
    return (
        application?.jobTitle ??
        application?.JobTitle ??
        application?.job?.title ??
        application?.job?.Title ??
        application?.title ??
        application?.Title ??
        'Job posting'
    )
}

function getStatus(application) {
    return application?.status ?? application?.Status ?? 'Pending'
}

function getAppliedDate(application) {
    return (
        application?.appliedAt ??
        application?.AppliedAt ??
        application?.createdAt ??
        application?.CreatedAt ??
        null
    )
}

function formatDate(value) {
    if (!value) return '—'

    const date = new Date(value)

    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
}

async function getErrorMessage(response) {
    const responseText = await response.text()

    if (responseText) {
        try {
            const parsed = JSON.parse(responseText)

            if (typeof parsed === 'string') return parsed

            return (
                parsed.message ??
                parsed.title ??
                parsed.detail ??
                parsed.error ??
                responseText
            )
        } catch {
            return responseText
        }
    }

    return `Request failed (${response.status}).`
}

function getApplicationsList(data) {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.$values)) return data.$values
    if (Array.isArray(data?.applications)) return data.applications
    if (Array.isArray(data?.Applications)) return data.Applications
    if (Array.isArray(data?.data)) return data.data

    return null
}

function HRApplicants() {
    const [applications, setApplications] = useState([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('All')
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState(null)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [reloadKey, setReloadKey] = useState(0)

    const loadApplications = useCallback(async (signal) => {
        try {
            const token = localStorage.getItem('hireflow-token')

            if (!token) {
                throw new Error('Your session has expired. Please sign in again.')
            }

            const response = await fetch(`${API_BASE}/JobApplications`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
                signal,
            })

            if (!response.ok) {
                throw new Error(await getErrorMessage(response))
            }

            const data = await response.json()
            const list = getApplicationsList(data)

            if (!list) {
                throw new Error(
                    'The API returned an unexpected applications response. Check the Network tab.'
                )
            }

            if (signal.aborted) return

            setApplications(list)

            const missingIds = list.filter(
                (application) => getApplicationId(application) === null
            )

            if (missingIds.length > 0) {
                console.warn(
                    'Some applications do not contain a valid numeric ID:',
                    missingIds
                )
            }
        } catch (err) {
            if (err.name === 'AbortError' || signal.aborted) return

            setError(err.message || 'Unable to load applications.')
        } finally {
            if (!signal.aborted) {
                setLoading(false)
            }
        }
    }, [])

    useEffect(() => {
        const controller = new AbortController()

        // Defer the request so state updates do not run synchronously
        // inside the effect body.
        const timer = setTimeout(() => {
            setLoading(true)
            setError('')
            setNotice('')
            void loadApplications(controller.signal)
        }, 0)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [loadApplications, reloadKey])

    const filteredApplications = useMemo(() => {
        const term = search.trim().toLowerCase()

        return applications.filter((application) => {
            const status = String(getStatus(application))

            const matchesStatus =
                statusFilter === 'All' ||
                status.toLowerCase() === statusFilter.toLowerCase()

            const searchableText = [
                getApplicantName(application),
                getApplicantEmail(application),
                getJobTitle(application),
                application?.job?.company,
                application?.job?.Company,
                application?.coverLetter,
                application?.CoverLetter,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return matchesStatus && (!term || searchableText.includes(term))
        })
    }, [applications, search, statusFilter])

    const pendingCount = useMemo(
        () =>
            applications.filter(
                (application) =>
                    String(getStatus(application)).toLowerCase() === 'pending'
            ).length,
        [applications]
    )

    const shortlistedCount = useMemo(
        () =>
            applications.filter(
                (application) =>
                    String(getStatus(application)).toLowerCase() === 'shortlisted'
            ).length,
        [applications]
    )

    const refreshApplications = useCallback(() => {
        setLoading(true)
        setError('')
        setNotice('')
        setReloadKey((current) => current + 1)
    }, [])

    async function updateStatus(application, nextStatus) {
        const applicationId = getApplicationId(application)

        if (applicationId === null) {
            setError(
                'This application has no valid numeric ID. Check the JobApplications API response.'
            )
            return
        }

        if (!STATUSES.includes(nextStatus)) {
            setError('Please select a valid application status.')
            return
        }

        const previousStatus = getStatus(application)

        if (previousStatus === nextStatus) return

        setUpdatingId(applicationId)
        setError('')
        setNotice('')

        try {
            const token = localStorage.getItem('hireflow-token')

            if (!token) {
                throw new Error('Your session has expired. Please sign in again.')
            }

            const response = await fetch(
                `${API_BASE}/JobApplications/${applicationId}/status`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    // The backend accepts the status as a JSON string.
                    body: JSON.stringify(nextStatus),
                }
            )

            if (!response.ok) {
                throw new Error(await getErrorMessage(response))
            }

            setApplications((current) =>
                current.map((item) =>
                    getApplicationId(item) === applicationId
                        ? { ...item, status: nextStatus, Status: nextStatus }
                        : item
                )
            )

            setNotice(`Application status updated to ${nextStatus}.`)
        } catch (err) {
            setError(err.message || 'Unable to update application status.')
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <section className="hr-applicants">
            <div className="hr-applicants-intro">
                <div>
                    <span className="hr-applicants-eyebrow">
                        CANDIDATE PIPELINE
                    </span>
                    <h2>Manage applicants</h2>
                    <p>
                        Review applications submitted for your job postings.
                    </p>
                </div>

                <button
                    className="hr-applicants-refresh"
                    type="button"
                    onClick={refreshApplications}
                    disabled={loading}
                >
                    ↻ {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            <div className="hr-applicants-summary">
                <div>
                    <span>Total applications</span>
                    <strong>{applications.length}</strong>
                </div>
                <div>
                    <span>Pending review</span>
                    <strong>{pendingCount}</strong>
                </div>
                <div>
                    <span>Shortlisted</span>
                    <strong>{shortlistedCount}</strong>
                </div>
            </div>

            {error && (
                <div
                    className="hr-applicants-alert hr-applicants-alert-error"
                    role="alert"
                >
                    {error}
                    <button
                        type="button"
                        onClick={refreshApplications}
                        disabled={loading}
                    >
                        Try again
                    </button>
                </div>
            )}

            {notice && (
                <div
                    className="hr-applicants-alert hr-applicants-alert-success"
                    role="status"
                >
                    {notice}
                </div>
            )}

            <div className="hr-applicants-toolbar">
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by applicant, email, or job title…"
                    aria-label="Search applications"
                />

                <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter by application status"
                >
                    <option value="All">All statuses</option>
                    {STATUSES.map((status) => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="hr-applicants-empty">
                    Loading applications…
                </div>
            ) : filteredApplications.length === 0 ? (
                <div className="hr-applicants-empty">
                    <div className="hr-applicants-empty-icon">♙</div>
                    <h3>
                        {applications.length === 0
                            ? 'No applications yet'
                            : 'No matching applicants'}
                    </h3>
                    <p>
                        {applications.length === 0
                            ? 'Applications for your job postings will appear here.'
                            : 'Try another search term or status filter.'}
                    </p>

                    {(search || statusFilter !== 'All') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('')
                                setStatusFilter('All')
                            }}
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="hr-applicants-list">
                    {filteredApplications.map((application, index) => {
                        const applicationId = getApplicationId(application)
                        const status = String(getStatus(application))
                        const name = getApplicantName(application)
                        const email = getApplicantEmail(application)
                        const isUpdating = updatingId === applicationId

                        return (
                            <article
                                className="hr-applicant-card"
                                key={
                                    applicationId ??
                                    `application-without-id-${index}`
                                }
                            >
                                <div className="hr-applicant-card-main">
                                    <div className="hr-applicant-avatar">
                                        {name.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="hr-applicant-identity">
                                        <h3>{name}</h3>
                                        <p>{email}</p>
                                        <span className="hr-applicant-job">
                                            {getJobTitle(application)}
                                        </span>
                                    </div>

                                    <span
                                        className={`hr-applicant-status hr-status-${status
                                            .toLowerCase()
                                            .replace(/\s+/g, '-')}`}
                                    >
                                        {status}
                                    </span>
                                </div>

                                <div className="hr-applicant-card-footer">
                                    <span>
                                        Applied{' '}
                                        {formatDate(getAppliedDate(application))}
                                    </span>

                                    <div className="hr-applicant-actions">
                                        {applicationId !== null ? (
                                            <Link
                                                to={`/hr/applicants/${applicationId}`}
                                                className="hr-applicant-button"
                                            >
                                                View details
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                className="hr-applicant-button"
                                                disabled
                                                title="The API response does not include a valid numeric application ID."
                                            >
                                                Details unavailable
                                            </button>
                                        )}

                                        <select
                                            value={status}
                                            disabled={
                                                applicationId === null ||
                                                isUpdating
                                            }
                                            onChange={(event) =>
                                                updateStatus(
                                                    application,
                                                    event.target.value
                                                )
                                            }
                                            aria-label={`Update status for ${name}`}
                                        >
                                            {!STATUSES.includes(status) && (
                                                <option value={status}>
                                                    {status}
                                                </option>
                                            )}

                                            {STATUSES.map((item) => (
                                                <option
                                                    key={item}
                                                    value={item}
                                                >
                                                    {item}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}

            <div className="hr-applicants-results">
                Showing {filteredApplications.length} of {applications.length}{' '}
                applications
            </div>
        </section>
    )
}

export default HRApplicants
