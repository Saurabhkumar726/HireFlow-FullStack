import { useState } from 'react'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

function formatDate(value) {
    if (!value) return 'Not provided'
    const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`)
    return Number.isNaN(date.getTime()) ? 'Not provided' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(date) + ' IST'
}

export default function CandidateResponseReview({ interview, onChanged }) {
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState('')
    const [error, setError] = useState('')
    const status = interview.candidateResponseStatus || interview.CandidateResponseStatus || 'Pending'
    const proposedAt = interview.proposedScheduledAtUtc || interview.ProposedScheduledAtUtc
    const interviewId = interview.id ?? interview.Id

    async function review(action) {
        setBusy(true)
        setError('')
        try {
            const token = localStorage.getItem('hireflow-token') || ''
            const response = await fetch(`${API_URL}/InterviewWorkflow/${interviewId}/hr-response`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ action, note }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not review this reschedule request.')
            setNote('')
            onChanged?.()
        } catch (requestError) {
            setError(requestError.message || 'Could not review this request.')
        } finally { setBusy(false) }
    }

    const label = String(status).replace(/([A-Z])/g, ' $1').trim()
    if (!status || status === 'Pending') return null

    return (
        <section className="hi-candidate-response" aria-label="Candidate interview response">
            <div className="hi-candidate-response-head">
                <strong>Candidate response</strong>
                <span className={`hi-candidate-response-status ${String(status).toLowerCase()}`}>{label}</span>
            </div>
            {(interview.candidateResponseNote || interview.CandidateResponseNote) && (
                <p>{interview.candidateResponseNote || interview.CandidateResponseNote}</p>
            )}
            {status === 'RescheduleRequested' && (
                <>
                    <p><b>Proposed time:</b> {formatDate(proposedAt)}</p>
                    <label className="hi-candidate-response-note-input">Reply note (optional)
                        <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={1000} placeholder="Add a short response for the candidate." />
                    </label>
                    <div className="hi-candidate-response-actions">
                        <button type="button" disabled={busy} onClick={() => review('ApproveReschedule')}>{busy ? 'Saving…' : 'Approve new time'}</button>
                        <button type="button" className="secondary" disabled={busy} onClick={() => review('DeclineReschedule')}>Decline request</button>
                    </div>
                </>
            )}
            {error && <small className="hi-candidate-response-error" role="alert">{error}</small>}
        </section>
    )
}
