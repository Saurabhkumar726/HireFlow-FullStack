
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import './HRCreateJob.css'

const API_BASE_URL = 'http://localhost:5116/api'

const EMPTY_FORM = {
    title: '',
    company: '',
    location: '',
    jobType: 'Full-time',
    salary: '',
    description: '',
}

function getApiUrl(path) {
    const baseUrl = API_BASE_URL.trim().replace(/\/+$/, '')
    const cleanPath = String(path).trim().replace(/^\/+/, '')
    return `${baseUrl}/${cleanPath}`
}

async function readResponse(response) {
    const text = await response.text()

    if (!text) return null

    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

function getErrorMessage(data, fallback) {
    if (typeof data === 'string' && data.trim()) {
        return data
    }

    return data?.message || data?.title || data?.detail || fallback
}

function HRCreateJob({ mode = 'create', jobId }) {
    const navigate = useNavigate()
    const { token } = useAuth()

    const isEditMode = mode === 'edit'
    const isViewMode = mode === 'view'
    const isExistingJobMode = isEditMode || isViewMode

    const [form, setForm] = useState(EMPTY_FORM)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        let cancelled = false

        async function loadJob() {
            if (!isExistingJobMode) {
                setForm(EMPTY_FORM)
                setError('')
                setLoading(false)
                return
            }

            if (!jobId) {
                setError('Job ID is missing from the URL.')
                setLoading(false)
                return
            }

            setLoading(true)
            setError('')
            setSuccess('')

            try {
                const url = getApiUrl(`Jobs/${encodeURIComponent(String(jobId).trim())}`)

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                })

                const data = await readResponse(response)

                if (!response.ok) {
                    throw new Error(
                        getErrorMessage(
                            data,
                            `Unable to load this job (${response.status}).`,
                        ),
                    )
                }

                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    throw new Error('The API returned invalid job data.')
                }

                // Ensure the returned job matches the requested route ID.
                if (
                    data.id !== undefined &&
                    String(data.id) !== String(jobId)
                ) {
                    throw new Error(
                        'The route ID does not match the job ID.',
                    )
                }

                if (cancelled) return

                setForm({
                    title: data.title ?? '',
                    company: data.company ?? '',
                    location: data.location ?? '',
                    jobType: data.jobType ?? 'Full-time',
                    salary:
                        data.salary === null || data.salary === undefined
                            ? ''
                            : String(data.salary),
                    description: data.description ?? '',
                })
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || 'Unable to load this job.')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        loadJob()

        return () => {
            cancelled = true
        }
    }, [isExistingJobMode, jobId, token])

    function handleChange(event) {
        const { name, value } = event.target

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }))

        setError('')
        setSuccess('')
    }

    async function handleSubmit(event) {
        event.preventDefault()

        if (isViewMode) return

        setError('')
        setSuccess('')

        if (
            !form.title.trim() ||
            !form.company.trim() ||
            !form.location.trim() ||
            !form.jobType ||
            !form.description.trim()
        ) {
            setError('Please complete all required fields.')
            return
        }

        const salaryValue =
            form.salary.trim() === '' ? null : Number(form.salary)

        if (
            salaryValue !== null &&
            (!Number.isFinite(salaryValue) || salaryValue < 0)
        ) {
            setError('Please enter a valid non-negative salary.')
            return
        }

        if (isEditMode && !jobId) {
            setError('A job ID is required to update a job.')
            return
        }

        if (isEditMode && !token) {
            setError('Your session is missing. Please sign in again.')
            return
        }

        setSaving(true)

        try {
            const payload = {
                ...(isEditMode ? { id: Number(jobId) } : {}),
                title: form.title.trim(),
                company: form.company.trim(),
                location: form.location.trim(),
                jobType: form.jobType,
                salary: salaryValue,
                description: form.description.trim(),
            }

            const endpoint = isEditMode
                ? `Jobs/${encodeURIComponent(String(jobId).trim())}`
                : 'Jobs'

            const url = getApiUrl(endpoint)

            const response = await fetch(url, {
                method: isEditMode ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(payload),
            })

            const data = await readResponse(response)

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(
                        data,
                        `Unable to ${isEditMode ? 'update' : 'create'} job (${response.status}).`,
                    ),
                )
            }

            const message = isEditMode
                ? 'Job updated successfully.'
                : 'Job published successfully.'

            setSuccess(message)

            navigate('/hr/jobs', {
                replace: true,
                state: { message },
            })
        } catch (err) {
            setError(
                err.message || 'Something went wrong. Please try again.',
            )
        } finally {
            setSaving(false)
        }
    }

    const pageEyebrow = isViewMode
        ? 'JOB OVERVIEW'
        : isEditMode
            ? 'UPDATE OPPORTUNITY'
            : 'NEW OPPORTUNITY'

    const pageTitle = isViewMode
        ? 'Job details'
        : isEditMode
            ? 'Edit job information'
            : 'Create a job'

    const pageDescription = isViewMode
        ? 'Review the details of this job posting.'
        : isEditMode
            ? 'Update the details candidates see for this opportunity.'
            : 'Add the details candidates need to know about this opportunity.'

    if (loading) {
        return (
            <section className="hr-create-job">
                <div className="hr-create-job-intro">
                    <div>
                        <span className="hr-form-eyebrow">{pageEyebrow}</span>
                        <h2>{pageTitle}</h2>
                        <p>{pageDescription}</p>
                    </div>
                </div>

                <div className="hr-form-alert">
                    Loading job details...
                </div>
            </section>
        )
    }

    return (
        <section className="hr-create-job">
            <div className="hr-create-job-intro">
                <div>
                    <span className="hr-form-eyebrow">{pageEyebrow}</span>
                    <h2>{pageTitle}</h2>
                    <p>{pageDescription}</p>
                </div>

                {!isViewMode && (
                    <span className="hr-form-required">
                        * Required fields
                    </span>
                )}
            </div>

            {error && (
                <div
                    className="hr-form-alert hr-form-alert-error"
                    role="alert"
                >
                    {error}
                    {isExistingJobMode && (
                        <div>
                            <button
                                type="button"
                                className="hr-button-secondary"
                                onClick={() => navigate('/hr/jobs')}
                                style={{ marginTop: 12 }}
                            >
                                Back to My Jobs
                            </button>
                        </div>
                    )}
                </div>
            )}

            {success && (
                <div
                    className="hr-form-alert hr-form-alert-success"
                    role="status"
                >
                    {success}
                </div>
            )}

            <form
                className="hr-create-job-form"
                onSubmit={handleSubmit}
            >
                <div className="hr-form-grid">
                    <div className="hr-form-field hr-form-field-full">
                        <label htmlFor="title">
                            Job title <span>*</span>
                        </label>
                        <input
                            id="title"
                            name="title"
                            type="text"
                            value={form.title}
                            onChange={handleChange}
                            placeholder="e.g. Senior Full Stack Developer"
                            required
                            disabled={isViewMode || saving}
                        />
                    </div>

                    <div className="hr-form-field">
                        <label htmlFor="company">
                            Company <span>*</span>
                        </label>
                        <input
                            id="company"
                            name="company"
                            type="text"
                            value={form.company}
                            onChange={handleChange}
                            placeholder="Company name"
                            required
                            disabled={isViewMode || saving}
                        />
                    </div>

                    <div className="hr-form-field">
                        <label htmlFor="location">
                            Location <span>*</span>
                        </label>
                        <input
                            id="location"
                            name="location"
                            type="text"
                            value={form.location}
                            onChange={handleChange}
                            placeholder="e.g. Remote, Indore"
                            required
                            disabled={isViewMode || saving}
                        />
                    </div>

                    <div className="hr-form-field">
                        <label htmlFor="jobType">
                            Job type <span>*</span>
                        </label>
                        <select
                            id="jobType"
                            name="jobType"
                            value={form.jobType}
                            onChange={handleChange}
                            required
                            disabled={isViewMode || saving}
                        >
                            <option value="Full-time">Full-time</option>
                            <option value="Part-time">Part-time</option>
                            <option value="Contract">Contract</option>
                            <option value="Internship">Internship</option>
                            <option value="Temporary">Temporary</option>
                        </select>
                    </div>

                    <div className="hr-form-field">
                        <label htmlFor="salary">Salary (₹)</label>
                        <input
                            id="salary"
                            name="salary"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.salary}
                            onChange={handleChange}
                            placeholder="e.g. 80000"
                            disabled={isViewMode || saving}
                        />
                        <span className="hr-field-hint">
                            Enter the salary amount. Leave blank if not specified.
                        </span>
                    </div>

                    <div className="hr-form-field hr-form-field-full">
                        <label htmlFor="description">
                            Job description <span>*</span>
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            placeholder="Describe the responsibilities, requirements, and benefits..."
                            required
                            disabled={isViewMode || saving}
                        />
                    </div>
                </div>

                <div className="hr-create-job-actions">
                    <button
                        type="button"
                        className="hr-button-secondary"
                        onClick={() => navigate('/hr/jobs')}
                        disabled={saving}
                    >
                        {isViewMode ? 'Back to My Jobs' : 'Cancel'}
                    </button>

                    {!isViewMode && (
                        <button
                            type="submit"
                            className="hr-button-primary"
                            disabled={saving}
                        >
                            {saving && (
                                <span
                                    className="hr-submit-spinner"
                                    aria-hidden="true"
                                />
                            )}
                            {saving
                                ? 'Saving...'
                                : isEditMode
                                    ? 'Save changes'
                                    : 'Publish job'}
                        </button>
                    )}
                </div>
            </form>
        </section>
    )
}

export default HRCreateJob
