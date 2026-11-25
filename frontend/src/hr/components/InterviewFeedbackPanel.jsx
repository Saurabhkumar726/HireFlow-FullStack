import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/useAuth'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')
const EMPTY_FEEDBACK = {
    overallRating: 3,
    technicalRating: 3,
    communicationRating: 3,
    problemSolvingRating: 3,
    recommendation: 'Undecided',
    strengths: '',
    areasToImprove: '',
    notes: '',
}

export default function InterviewFeedbackPanel({ interview }) {
    const { user } = useAuth()
    const interviewId = interview.id ?? interview.Id
    const isCompleted = String(interview.status ?? interview.Status).toLowerCase() === 'completed'
    const userId = user?.id ?? user?.userId ?? user?.Id
    const [entries, setEntries] = useState([])
    const [form, setForm] = useState(EMPTY_FEEDBACK)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const loadFeedback = useCallback(async () => {
        if (!isCompleted) return
        setLoading(true)
        setError('')
        try {
            const token = localStorage.getItem('hireflow-token') || ''
            const response = await fetch(`${API_URL}/InterviewFeedback/${interviewId}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
            const data = await response.json().catch(() => [])
            if (!response.ok) throw new Error(data.message || 'Could not load interview feedback.')
            const list = Array.isArray(data) ? data : []
            setEntries(list)
            const mine = list.find(item => String(item.submittedByUserId ?? item.SubmittedByUserId) === String(userId))
            if (mine) setForm({
                overallRating: mine.overallRating ?? mine.OverallRating ?? 3,
                technicalRating: mine.technicalRating ?? mine.TechnicalRating ?? 3,
                communicationRating: mine.communicationRating ?? mine.CommunicationRating ?? 3,
                problemSolvingRating: mine.problemSolvingRating ?? mine.ProblemSolvingRating ?? 3,
                recommendation: mine.recommendation ?? mine.Recommendation ?? 'Undecided',
                strengths: mine.strengths ?? mine.Strengths ?? '',
                areasToImprove: mine.areasToImprove ?? mine.AreasToImprove ?? '',
                notes: mine.notes ?? mine.Notes ?? '',
            })
        } catch (requestError) { setError(requestError.message || 'Could not load interview feedback.') }
        finally { setLoading(false) }
    }, [interviewId, isCompleted, userId])

    useEffect(() => {
        let active = true
        Promise.resolve().then(async () => {
            if (active) await loadFeedback()
        })
        return () => { active = false }
    }, [loadFeedback])

    async function saveFeedback(event) {
        event.preventDefault()
        setSaving(true); setError(''); setNotice('')
        try {
            const token = localStorage.getItem('hireflow-token') || ''
            const response = await fetch(`${API_URL}/InterviewFeedback/${interviewId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ ...form, overallRating: Number(form.overallRating), technicalRating: Number(form.technicalRating), communicationRating: Number(form.communicationRating), problemSolvingRating: Number(form.problemSolvingRating) }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not save interview feedback.')
            setNotice('Interview evaluation saved.')
            await loadFeedback()
        } catch (requestError) { setError(requestError.message || 'Could not save feedback.') }
        finally { setSaving(false) }
    }

    if (!isCompleted) return null

    function update(name, value) { setForm(current => ({ ...current, [name]: value })) }

    return (
        <section className="hi-feedback-panel">
            <div className="hi-feedback-heading"><div><strong>Interview evaluation</strong><p>{entries.length} feedback entr{entries.length === 1 ? 'y' : 'ies'} recorded for this interview.</p></div></div>
            {error && <p className="hi-feedback-message is-error" role="alert">{error}</p>}
            {notice && <p className="hi-feedback-message is-success" role="status">{notice}</p>}
            {entries.filter(item => String(item.submittedByUserId ?? item.SubmittedByUserId) !== String(userId)).map(item => (
                <div className="hi-feedback-summary" key={item.id ?? item.Id}>
                    <span>Other reviewer · {item.overallRating ?? item.OverallRating}/5 · {item.recommendation ?? item.Recommendation}</span>
                    {item.notes && <p>{item.notes}</p>}
                </div>
            ))}
            <form onSubmit={saveFeedback} className="hi-feedback-form">
                <div className="hi-feedback-rating-grid">
                    {[
                        ['overallRating', 'Overall'],
                        ['technicalRating', 'Technical'],
                        ['communicationRating', 'Communication'],
                        ['problemSolvingRating', 'Problem solving'],
                    ].map(([name, label]) => <label key={name}>{label}<select value={form[name]} onChange={event => update(name, event.target.value)}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>)}
                </div>
                <label>Recommendation<select value={form.recommendation} onChange={event => update('recommendation', event.target.value)}><option value="StrongHire">Strong hire</option><option value="Hire">Hire</option><option value="Undecided">Undecided</option><option value="NoHire">No hire</option><option value="StrongNoHire">Strong no hire</option></select></label>
                <div className="hi-feedback-text-grid">
                    <label>Strengths<textarea rows={2} maxLength={2000} value={form.strengths} onChange={event => update('strengths', event.target.value)} /></label>
                    <label>Areas to improve<textarea rows={2} maxLength={2000} value={form.areasToImprove} onChange={event => update('areasToImprove', event.target.value)} /></label>
                </div>
                <label>Additional notes<textarea rows={3} maxLength={4000} value={form.notes} onChange={event => update('notes', event.target.value)} /></label>
                <div className="hi-feedback-actions"><button type="submit" disabled={saving || loading}>{saving ? 'Saving…' : 'Save evaluation'}</button><button type="button" className="secondary" onClick={loadFeedback} disabled={saving || loading}>Refresh</button></div>
            </form>
        </section>
    )
}
