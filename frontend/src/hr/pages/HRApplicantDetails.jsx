import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './HRApplicantDetails.css'
import SkeletonLoader from '../../components/SkeletonLoader.jsx'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')
const EDITABLE_STATUSES = ['Pending', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected']
const DISPLAY_STATUSES = [...EDITABLE_STATUSES, 'Withdrawn']

function formatDate(value) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

async function getErrorMessage(response) {
    const text = await response.text()
    if (!text) return `Request failed (${response.status}).`
    try {
        const data = JSON.parse(text)
        if (typeof data === 'string') return data
        return data.message ?? data.title ?? data.detail ?? data.error ?? text
    } catch { return text }
}

function getField(object, ...keys) {
    for (const key of keys) if (object?.[key] !== undefined && object[key] !== null) return object[key]
    return undefined
}

function normalizeStatus(value) {
    return String(value || 'Pending').toLowerCase() === 'reviewed' ? 'Under Review' : (value || 'Pending')
}

function HRApplicantDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [application, setApplication] = useState(null)
    const [status, setStatus] = useState('Pending')
    const [rejectionReason, setRejectionReason] = useState('')
    const [recruiterNotes, setRecruiterNotes] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savingNotes, setSavingNotes] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [reloadKey, setReloadKey] = useState(0)

    const loadApplication = useCallback(async (signal) => {
        try {
            if (!/^\d+$/.test(String(id || '')) || Number(id) <= 0) throw new Error('Invalid application ID in the URL.')
            const token = localStorage.getItem('hireflow-token')
            if (!token) throw new Error('Your session has expired. Please sign in again.')
            const response = await fetch(`${API_BASE}/JobApplications/${encodeURIComponent(id)}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                signal,
            })
            if (!response.ok) throw new Error(await getErrorMessage(response))
            const data = await response.json()
            if (!signal.aborted) {
                setApplication(data)
                setStatus(normalizeStatus(getField(data, 'status', 'Status')))
                setRejectionReason(getField(data, 'rejectionReason', 'RejectionReason') || '')
                setRecruiterNotes(getField(data, 'recruiterNotes', 'RecruiterNotes') || '')
            }
        } catch (err) {
            if (err.name !== 'AbortError' && !signal.aborted) {
                setApplication(null)
                setError(err.message || 'Unable to load applicant details.')
            }
        } finally {
            if (!signal.aborted) setLoading(false)
        }
    }, [id])

    useEffect(() => {
        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            setLoading(true)
            setError('')
            setNotice('')
            void loadApplication(controller.signal)
        }, 0)
        return () => { window.clearTimeout(timer); controller.abort() }
    }, [loadApplication, reloadKey])

    async function saveStatus(event) {
        event.preventDefault()
        if (!EDITABLE_STATUSES.includes(status)) { setError('Select a valid application status.'); return }
        if (status === 'Rejected' && !rejectionReason.trim()) { setError('A rejection reason is required.'); return }
        setSaving(true)
        setError('')
        setNotice('')
        try {
            const token = localStorage.getItem('hireflow-token')
            if (!token) throw new Error('Your session has expired. Please sign in again.')
            const response = await fetch(`${API_BASE}/JobApplications/${encodeURIComponent(id)}/status-details`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ status, rejectionReason: status === 'Rejected' ? rejectionReason.trim() : null }),
            })
            const result = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(result.message || result.title || `Unable to update status (${response.status}).`)
            setNotice(result.message || 'Application status updated.')
            setReloadKey((value) => value + 1)
        } catch (err) {
            setError(err.message || 'Unable to update application status.')
        } finally { setSaving(false) }
    }

    async function saveNotes(event) {
        event.preventDefault()
        setSavingNotes(true)
        setError('')
        setNotice('')
        try {
            const token = localStorage.getItem('hireflow-token')
            if (!token) throw new Error('Your session has expired. Please sign in again.')
            const response = await fetch(`${API_BASE}/JobApplications/${encodeURIComponent(id)}/notes`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ notes: recruiterNotes }),
            })
            if (!response.ok) throw new Error(await getErrorMessage(response))
            setNotice('Private recruiter notes saved.')
        } catch (err) { setError(err.message || 'Unable to save recruiter notes.') }
        finally { setSavingNotes(false) }
    }

    const applicantName = getField(application, 'applicantName', 'ApplicantName') || 'Applicant'
    const applicantEmail = getField(application, 'applicantEmail', 'ApplicantEmail') || '—'
    const job = getField(application, 'job', 'Job') || {}
    const jobTitle = getField(job, 'title', 'Title') || 'Job posting'
    const currentStatus = normalizeStatus(getField(application, 'status', 'Status'))
    const appliedAt = getField(application, 'appliedAt', 'AppliedAt')
    const resumeUrl = getField(application, 'resumeUrl', 'ResumeUrl')
    const coverLetter = getField(application, 'coverLetter', 'CoverLetter')
    const history = getField(application, 'statusHistory', 'StatusHistory') || []
    const screeningAnswers = getField(application, 'screeningAnswers', 'ScreeningAnswers') || []
    const interviews = getField(application, 'interviews', 'Interviews') || []
    const selectedIsFinal = currentStatus === 'Selected' || currentStatus === 'Withdrawn'

    if (loading) return <section className="hr-applicant-details"><SkeletonLoader variant="profile" /></section>
    if (error && !application) return <section className="hr-applicant-details"><button type="button" className="hr-applicant-back" onClick={() => navigate('/hr/applicants')}>← Back to Applicants</button><div className="hr-applicant-details-alert hr-applicant-details-error" role="alert">{error}<button type="button" onClick={() => setReloadKey(value => value + 1)}>Try again</button></div></section>
    if (!application) return null

    return (
        <section className="hr-applicant-details">
            <button type="button" className="hr-applicant-back" onClick={() => navigate('/hr/applicants')}>← Back to Applicants</button>
            <div className="hr-applicant-details-heading">
                <div className="hr-applicant-details-avatar">{String(applicantName).charAt(0).toUpperCase()}</div>
                <div>
                    <span className="hr-applicant-details-eyebrow">APPLICATION DETAILS</span>
                    <h2>{applicantName}</h2>
                    <p>{applicantEmail}</p>
                </div>
                <span className={`hr-applicant-status hr-status-${currentStatus.toLowerCase().replace(/\s+/g, '-')}`}>{currentStatus}</span>
            </div>

            {error && <div className="hr-applicant-details-alert hr-applicant-details-error" role="alert">{error}</div>}
            {notice && <div className="hr-applicant-details-alert hr-applicant-details-success" role="status">{notice}</div>}

            <div className="hr-applicant-details-grid">
                <article className="hr-applicant-details-panel">
                    <h3>Application information</h3>
                    <div className="hr-applicant-detail-row"><span>Job title</span><strong>{jobTitle}</strong></div>
                    <div className="hr-applicant-detail-row"><span>Company</span><strong>{getField(job, 'company', 'Company') || '—'}</strong></div>
                    <div className="hr-applicant-detail-row"><span>Application status</span><strong>{currentStatus}</strong></div>
                    <div className="hr-applicant-detail-row"><span>Applied on</span><strong>{formatDate(appliedAt)}</strong></div>
                    <div className="hr-applicant-detail-row"><span>Application ID</span><strong>{application.id}</strong></div>
                    <div className="hr-applicant-detail-row"><span>Phone</span><strong>{getField(application, 'applicantPhoneNumber', 'ApplicantPhoneNumber') || 'Not provided'}</strong></div>
                    <div className="hr-applicant-detail-row"><span>Location</span><strong>{getField(application, 'applicantLocation', 'ApplicantLocation') || 'Not provided'}</strong></div>
                    {getField(application, 'applicantLinkedInUrl', 'ApplicantLinkedInUrl') && <a className="hr-applicant-resume" href={getField(application, 'applicantLinkedInUrl', 'ApplicantLinkedInUrl')} target="_blank" rel="noreferrer">Open LinkedIn ↗</a>}
                    {getField(application, 'applicantPortfolioUrl', 'ApplicantPortfolioUrl') && <a className="hr-applicant-resume" href={getField(application, 'applicantPortfolioUrl', 'ApplicantPortfolioUrl')} target="_blank" rel="noreferrer">Open portfolio ↗</a>}
                    {resumeUrl ? <a className="hr-applicant-resume" href={resumeUrl.startsWith('http') ? resumeUrl : `${window.location.origin.replace(':5173', ':5116')}/${String(resumeUrl).replace(/^\//, '')}`} target="_blank" rel="noreferrer">View resume ↗</a> : <p className="hr-applicant-no-resume">No resume was provided with this application.</p>}
                </article>

                <article className="hr-applicant-details-panel">
                    <h3>Review application</h3>
                    <p className="hr-applicant-panel-description">Update the candidate's stage. A reason is required when rejecting an application.</p>
                    <form onSubmit={saveStatus}>
                        <label htmlFor="hr-application-status">Application status</label>
                        <select id="hr-application-status" value={status} onChange={(event) => setStatus(event.target.value)} disabled={saving || selectedIsFinal}>
                            {DISPLAY_STATUSES.map((item) => <option key={item} value={item}>{item === 'Pending' ? 'New' : item}</option>)}
                        </select>
                        {status === 'Rejected' && <label htmlFor="hr-application-rejection">Rejection reason<textarea id="hr-application-rejection" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} maxLength={1000} placeholder="Share a concise reason with the candidate…" required /></label>}
                        {selectedIsFinal && <p className="hr-applicant-panel-description">This application is in a final state and cannot be changed.</p>}
                        <button type="submit" className="hr-applicant-save-status" disabled={saving || selectedIsFinal || (status === currentStatus && (status !== 'Rejected' || rejectionReason === (getField(application, 'rejectionReason', 'RejectionReason') || '')))}>{saving ? 'Saving…' : 'Save status'}</button>
                    </form>
                </article>

                <article className="hr-applicant-details-panel hr-applicant-cover-letter">
                    <h3>Screening responses</h3>
                    {screeningAnswers.length ? screeningAnswers.map((answer) => {
                        const question = getField(answer, 'questionTextSnapshot', 'QuestionTextSnapshot') || 'Screening question'
                        const rawAnswer = getField(answer, 'answerText', 'AnswerText') || ''
                        let displayAnswer = rawAnswer
                        try {
                            const parsed = JSON.parse(rawAnswer)
                            if (Array.isArray(parsed)) displayAnswer = parsed.join(', ')
                        } catch { /* Plain text and Yes/No answers remain unchanged. */ }
                        return <div className="hr-applicant-screening-answer" key={getField(answer, 'id', 'Id') || question}>
                            <strong>{question}</strong>
                            <p>{displayAnswer || 'No answer provided'}</p>
                        </div>
                    }) : <p className="hr-applicant-panel-description">This application did not include screening question responses.</p>}
                </article>

                <article className="hr-applicant-details-panel hr-applicant-cover-letter">
                    <h3>Cover letter</h3>
                    {coverLetter ? <p>{coverLetter}</p> : <p className="hr-applicant-panel-description">No cover letter was provided with this application.</p>}
                </article>

                <article className="hr-applicant-details-panel">
                    <h3>Private recruiter notes</h3>
                    <p className="hr-applicant-panel-description">These notes are visible only to the owning HR team, not to the candidate.</p>
                    <form onSubmit={saveNotes}>
                        <label htmlFor="hr-recruiter-notes">Internal notes</label>
                        <textarea id="hr-recruiter-notes" value={recruiterNotes} onChange={(event) => setRecruiterNotes(event.target.value)} rows={5} maxLength={4000} placeholder="Add private review notes…" />
                        <button type="submit" className="hr-applicant-save-status" disabled={savingNotes}>{savingNotes ? 'Saving…' : 'Save private notes'}</button>
                    </form>
                </article>

                <article className="hr-applicant-details-panel hr-applicant-cover-letter">
                    <h3>Interview schedule</h3>
                    {interviews.length ? interviews.map((interview) => (
                        <div className="hr-applicant-interview-entry" key={interview.id || interview.Id}>
                            <strong>{formatDate(interview.scheduledAt || interview.ScheduledAt)}</strong>
                            <span>{interview.interviewType || interview.InterviewType} · {interview.status || interview.Status}</span>
                            {(interview.meetingLink || interview.MeetingLink) && <a href={interview.meetingLink || interview.MeetingLink} target="_blank" rel="noreferrer">Open meeting link ↗</a>}
                        </div>
                    )) : <p className="hr-applicant-panel-description">No interview has been scheduled for this application yet.</p>}
                </article>

                <article className="hr-applicant-details-panel hr-applicant-cover-letter">
                    <h3>Application history</h3>
                    {history.length ? <ol className="hr-application-history">{history.map((item) => <li key={item.id}><strong>{normalizeStatus(item.newStatus || item.NewStatus)}</strong><time>{formatDate(item.changedAtUtc || item.ChangedAtUtc)}</time>{(item.reason || item.Reason) && <p>{item.reason || item.Reason}</p>}</li>)}</ol> : <p className="hr-applicant-panel-description">No status updates have been recorded yet.</p>}
                    {application.revisionNumber > 0 && <p className="hr-applicant-panel-description">Candidate has updated their application {application.revisionNumber} time(s) while it was new.</p>}
                </article>
            </div>
        </section>
    )
}

export default HRApplicantDetails
