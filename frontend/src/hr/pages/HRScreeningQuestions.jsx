import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import './HRScreeningQuestions.css'
import SkeletonLoader from '../../components/SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')
const EMPTY_FORM = { questionText: '', questionType: 'Text', optionsText: '', isRequired: false, sortOrder: 0, isActive: true }

function readId(item) { return item?.id ?? item?.Id }
function readOwnerId(item) { return item?.createdByUserId ?? item?.CreatedByUserId }

export default function HRScreeningQuestions() {
    const { user, token } = useAuth()
    const authToken = token || localStorage.getItem('hireflow-token') || ''
    const userId = user?.id ?? user?.userId ?? user?.Id
    const [jobs, setJobs] = useState([])
    const [jobId, setJobId] = useState('')
    const [questions, setQuestions] = useState([])
    const [form, setForm] = useState(EMPTY_FORM)
    const [editingId, setEditingId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const headers = useMemo(() => ({
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
    }), [authToken])

    const loadJobs = useCallback(async () => {
        const response = await fetch(`${API_URL}/Jobs`, { headers })
        const data = await response.json().catch(() => [])
        if (!response.ok) throw new Error(data.message || 'Could not load your job postings.')
        const list = Array.isArray(data) ? data : []
        const owned = userId ? list.filter(item => readOwnerId(item) === userId) : list
        setJobs(owned)
        if (!jobId && owned.length) setJobId(String(readId(owned[0])))
    }, [headers, userId, jobId])

    const loadQuestions = useCallback(async () => {
        if (!jobId) { setQuestions([]); setLoading(false); return }
        setLoading(true)
        try {
            const response = await fetch(`${API_URL}/Jobs/${jobId}/screening-questions/manage`, { headers })
            const data = await response.json().catch(() => [])
            if (!response.ok) throw new Error(data.message || 'Could not load screening questions.')
            setQuestions(Array.isArray(data) ? data : [])
            setError('')
        } catch (requestError) {
            setError(requestError.message || 'Could not load screening questions.')
        } finally { setLoading(false) }
    }, [headers, jobId])

    useEffect(() => {
        let active = true
        Promise.resolve().then(async () => {
            try { await loadJobs() }
            catch (requestError) { if (active) setError(requestError.message || 'Could not load jobs.') }
        })
        return () => { active = false }
    }, [loadJobs])

    useEffect(() => { void loadQuestions() }, [loadQuestions])

    function editQuestion(question) {
        setEditingId(question.id)
        setForm({
            questionText: question.questionText || '',
            questionType: question.questionType || 'Text',
            optionsText: Array.isArray(question.options) ? question.options.join('\n') : '',
            isRequired: Boolean(question.isRequired),
            sortOrder: question.sortOrder || 0,
            isActive: Boolean(question.isActive),
        })
        setNotice('')
        setError('')
    }

    async function saveQuestion(event) {
        event.preventDefault()
        if (!jobId) { setError('Select one of your jobs first.'); return }
        const options = ['SingleChoice', 'MultipleChoice'].includes(form.questionType)
            ? form.optionsText.split('\n').map(value => value.trim()).filter(Boolean)
            : []
        if (['SingleChoice', 'MultipleChoice'].includes(form.questionType) && options.length < 2) {
            setError('Add at least two answer options, one per line.')
            return
        }
        setSaving(true); setError(''); setNotice('')
        try {
            const response = await fetch(`${API_URL}/Jobs/${jobId}/screening-questions${editingId ? `/${editingId}` : ''}`, {
                method: editingId ? 'PUT' : 'POST', headers,
                body: JSON.stringify({
                    questionText: form.questionText,
                    questionType: form.questionType,
                    options,
                    isRequired: form.isRequired,
                    sortOrder: Number(form.sortOrder) || 0,
                    isActive: form.isActive,
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.message || 'Could not save this question.')
            setForm(EMPTY_FORM); setEditingId(null)
            setNotice(editingId ? 'Screening question updated.' : 'Screening question added.')
            await loadQuestions()
        } catch (requestError) { setError(requestError.message || 'Could not save this question.') }
        finally { setSaving(false) }
    }

    async function deactivateQuestion(question) {
        if (!window.confirm('Deactivate this question? Existing applicant answers will be retained.')) return
        try {
            const response = await fetch(`${API_URL}/Jobs/${jobId}/screening-questions/${question.id}`, { method: 'DELETE', headers })
            if (!response.ok) throw new Error('Could not deactivate this question.')
            setNotice('Question deactivated. Existing applicant answers remain available in application history.')
            await loadQuestions()
        } catch (requestError) { setError(requestError.message || 'Could not deactivate this question.') }
    }

    return (
        <section className="hr-screening-page">
            <header className="hr-screening-intro">
                <div><span className="hr-screening-eyebrow">CANDIDATE QUALIFICATION</span><h2>Screening questions</h2><p>Add job-specific questions candidates answer when applying. Existing answers are kept with each application.</p></div>
                <label className="hr-screening-job-select"><span>Choose a job</span><select value={jobId} onChange={event => { setJobId(event.target.value); setEditingId(null); setForm(EMPTY_FORM) }}><option value="">Select job posting</option>{jobs.map(job => <option key={readId(job)} value={readId(job)}>{job.title ?? job.Title}</option>)}</select></label>
            </header>

            {error && <p className="hr-screening-alert is-error" role="alert">{error}</p>}
            {notice && <p className="hr-screening-alert is-success" role="status">{notice}</p>}

            <div className="hr-screening-layout">
                <form className="hr-screening-form" onSubmit={saveQuestion}>
                    <div className="hr-screening-form-heading"><h3>{editingId ? 'Edit question' : 'Add a question'}</h3><p>Keep questions clear and directly related to the role.</p></div>
                    <label>Question text<textarea value={form.questionText} onChange={event => setForm(current => ({ ...current, questionText: event.target.value }))} maxLength={500} minLength={5} required rows={3} placeholder="Example: How many years of experience do you have with React?" /></label>
                    <label>Answer type<select value={form.questionType} onChange={event => setForm(current => ({ ...current, questionType: event.target.value }))}><option value="Text">Short text answer</option><option value="YesNo">Yes / No</option><option value="SingleChoice">Choose one option</option><option value="MultipleChoice">Choose multiple options</option></select></label>
                    {['SingleChoice', 'MultipleChoice'].includes(form.questionType) && <label>Options <small>Enter one option per line (2–20 options).</small><textarea value={form.optionsText} onChange={event => setForm(current => ({ ...current, optionsText: event.target.value }))} rows={5} placeholder={'Less than 1 year\n1–3 years\n4–6 years\n7+ years'} required /></label>}
                    <div className="hr-screening-form-meta"><label><input type="checkbox" checked={form.isRequired} onChange={event => setForm(current => ({ ...current, isRequired: event.target.checked }))} /> Required</label><label>Order <input type="number" min="0" max="500" value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: event.target.value }))} /></label></div>
                    <div className="hr-screening-form-actions"><button type="submit" disabled={saving || !jobId}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add question'}</button>{editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>Cancel edit</button>}</div>
                </form>

                <section className="hr-screening-list"><div className="hr-screening-list-heading"><div><h3>Questions for this job</h3><p>{questions.filter(question => question.isActive).length} active question{questions.filter(question => question.isActive).length === 1 ? '' : 's'}</p></div></div>
                    {loading ? <SkeletonLoader variant="screening" count={3} /> : !jobId ? <div className="hr-screening-empty">Select one of your job postings to manage its questions.</div> : questions.length === 0 ? <div className="hr-screening-empty">No screening questions yet. Add your first question to collect structured candidate responses.</div> : questions.map(question => <article className={`hr-screening-question-card ${question.isActive ? '' : 'is-inactive'}`} key={question.id}><div><span className="hr-screening-type">{question.questionType}</span><h4>{question.questionText}</h4><p>{question.isRequired ? 'Required' : 'Optional'} · Position {question.sortOrder}</p>{question.options?.length > 0 && <ul>{question.options.map(option => <li key={option}>{option}</li>)}</ul>}</div><div className="hr-screening-question-actions"><button type="button" onClick={() => editQuestion(question)}>Edit</button>{question.isActive && <button type="button" className="danger" onClick={() => deactivateQuestion(question)}>Deactivate</button>}</div></article>)}
                </section>
            </div>
        </section>
    )
}
