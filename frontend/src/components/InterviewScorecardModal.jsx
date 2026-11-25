import { useState, useEffect } from 'react'
import './InterviewScorecardModal.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

export default function InterviewScorecardModal({ application, onClose, onSaved }) {
    const interviews = application?.interviews || application?.Interviews || []
    const latestInterview = interviews[0] || null

    const [selectedInterviewId, setSelectedInterviewId] = useState(latestInterview?.id || latestInterview?.Id || 1)
    const [overallRating, setOverallRating] = useState(4)
    const [technicalRating, setTechnicalRating] = useState(4)
    const [problemSolvingRating, setProblemSolvingRating] = useState(4)
    const [communicationRating, setCommunicationRating] = useState(4)
    const [recommendation, setRecommendation] = useState('Hire')
    const [strengths, setStrengths] = useState('')
    const [areasToImprove, setAreasToImprove] = useState('')
    const [notes, setNotes] = useState('')
    const [existingFeedback, setExistingFeedback] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    useEffect(() => {
        let cancelled = false
        async function loadExisting() {
            try {
                const token = localStorage.getItem('hireflow-token')
                const res = await fetch(`${API_BASE}/InterviewFeedback/application/${application.id}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json'
                    }
                })
                if (res.ok && !cancelled) {
                    const data = await res.json()
                    if (cancelled) return
                    setExistingFeedback(data)
                    // If current user already submitted a review, prefill it
                    const myReview = data.reviews?.[0]
                    if (myReview) {
                        setOverallRating(myReview.overallRating ?? 4)
                        setTechnicalRating(myReview.technicalRating ?? 4)
                        setProblemSolvingRating(myReview.problemSolvingRating ?? 4)
                        setCommunicationRating(myReview.communicationRating ?? 4)
                        setRecommendation(myReview.recommendation ?? 'Hire')
                        setStrengths(myReview.strengths ?? '')
                        setAreasToImprove(myReview.areasToImprove ?? '')
                        setNotes(myReview.notes ?? '')
                    }
                }
            } catch {
                // non-fatal
            }
        }
        loadExisting()
        return () => {
            cancelled = true
        }
    }, [application.id])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setNotice('')
        setSubmitting(true)

        try {
            const token = localStorage.getItem('hireflow-token')
            if (!token) throw new Error('Your session has expired. Please sign in again.')

            // Target interview ID: either selected or fallback to 1
            const interviewId = Number(selectedInterviewId) || 1

            const res = await fetch(`${API_BASE}/InterviewFeedback/${interviewId}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify({
                    overallRating: Number(overallRating),
                    technicalRating: Number(technicalRating),
                    communicationRating: Number(communicationRating),
                    problemSolvingRating: Number(problemSolvingRating),
                    recommendation,
                    strengths: strengths.trim(),
                    areasToImprove: areasToImprove.trim(),
                    notes: notes.trim()
                })
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.message || 'Could not save scorecard evaluation.')

            setNotice('Scorecard saved successfully!')
            onSaved?.({
                overallRating,
                recommendation
            })
            setTimeout(() => {
                onClose?.()
            }, 1200)
        } catch (err) {
            setError(err.message || 'Error saving scorecard.')
            setSubmitting(false)
        }
    }

    const CRITERIA = [
        { label: 'Overall Evaluation', value: overallRating, setter: setOverallRating, desc: 'Overall holistic evaluation for hire decision' },
        { label: 'Technical Depth & Code Quality', value: technicalRating, setter: setTechnicalRating, desc: 'Syntax fluency, CS fundamentals, system design' },
        { label: 'Problem Solving & Logic', value: problemSolvingRating, setter: setProblemSolvingRating, desc: 'Analytical framing, edge cases, adaptability' },
        { label: 'Communication & Culture Fit', value: communicationRating, setter: setCommunicationRating, desc: 'Clarity, collaboration, team values' }
    ]

    const RECOMMENDATIONS = [
        { key: 'StrongHire', label: 'Strong Hire', tone: 'strong-hire' },
        { key: 'Hire', label: 'Hire', tone: 'hire' },
        { key: 'Undecided', label: 'Hold / Undecided', tone: 'hold' },
        { key: 'NoHire', label: 'No Hire', tone: 'no-hire' },
        { key: 'StrongNoHire', label: 'Strong No Hire', tone: 'strong-no' }
    ]

    return (
        <div className="hf-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="hf-scorecard-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="hf-scorecard-header">
                    <div>
                        <span className="hf-scorecard-badge">⭐ Recruiter Evaluation Rubric</span>
                        <h2>Interview Scorecard · {application.applicantName}</h2>
                        <p>{application.job?.title || 'Job Candidate'} · {application.job?.company || 'HireFlow'}</p>
                    </div>
                    <button type="button" className="hf-scorecard-close" onClick={onClose} aria-label="Close">✕</button>
                </header>

                {error && <div className="hf-scorecard-alert error">{error}</div>}
                {notice && <div className="hf-scorecard-alert success">{notice}</div>}

                {/* Scorecard Aggregate Summary (if prior reviews exist) */}
                {existingFeedback?.totalReviews > 0 && (
                    <div className="hf-scorecard-summary-card">
                        <div className="hf-scorecard-stat-pill">
                            <span>Consensus Rating</span>
                            <strong>★ {existingFeedback.averageOverall} / 5.0</strong>
                            <small>{existingFeedback.totalReviews} evaluation(s)</small>
                        </div>
                        <div className="hf-scorecard-stat-pill">
                            <span>Consensus Signal</span>
                            <span className={`hf-rec-badge ${existingFeedback.consensusRecommendation?.toLowerCase()}`}>
                                {existingFeedback.consensusRecommendation}
                            </span>
                        </div>
                        <div className="hf-scorecard-stat-pill">
                            <span>Technical Avg</span>
                            <strong>{existingFeedback.averageTechnical} / 5</strong>
                        </div>
                        <div className="hf-scorecard-stat-pill">
                            <span>Problem Solving Avg</span>
                            <strong>{existingFeedback.averageProblemSolving} / 5</strong>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form className="hf-scorecard-form" onSubmit={handleSubmit}>
                    {/* Select Interview Session if available */}
                    {interviews.length > 1 && (
                        <div className="hf-scorecard-field">
                            <label htmlFor="hf-interview-select">Interview Round</label>
                            <select
                                id="hf-interview-select"
                                value={selectedInterviewId}
                                onChange={(e) => setSelectedInterviewId(e.target.value)}
                            >
                                {interviews.map((iv, idx) => (
                                    <option key={iv.id || iv.Id} value={iv.id || iv.Id}>
                                        Round {idx + 1} ({iv.interviewType || 'General'}) · {new Date(iv.scheduledAt || iv.ScheduledAt).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Criteria Rating Grid */}
                    <div className="hf-scorecard-criteria-grid">
                        {CRITERIA.map((crit) => (
                            <div className="hf-criteria-card" key={crit.label}>
                                <div className="hf-criteria-info">
                                    <span className="hf-criteria-title">{crit.label}</span>
                                    <span className="hf-criteria-desc">{crit.desc}</span>
                                </div>
                                <div className="hf-star-selector" role="radiogroup" aria-label={crit.label}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            type="button"
                                            key={star}
                                            className={`hf-star-btn ${star <= crit.value ? 'active' : ''}`}
                                            onClick={() => crit.setter(star)}
                                            title={`${star} of 5 stars`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                    <span className="hf-star-numeric">{crit.value}/5</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Recommendation Selector */}
                    <div className="hf-scorecard-field">
                        <label>Final Hiring Recommendation</label>
                        <div className="hf-rec-options" role="radiogroup">
                            {RECOMMENDATIONS.map((rec) => (
                                <button
                                    type="button"
                                    key={rec.key}
                                    className={`hf-rec-btn ${rec.tone} ${recommendation === rec.key ? 'selected' : ''}`}
                                    onClick={() => setRecommendation(rec.key)}
                                >
                                    {rec.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Qualitative Notes */}
                    <div className="hf-scorecard-notes-grid">
                        <div className="hf-scorecard-field">
                            <label htmlFor="hf-strengths">Key Strengths & Highlights</label>
                            <textarea
                                id="hf-strengths"
                                rows={2}
                                value={strengths}
                                onChange={(e) => setStrengths(e.target.value)}
                                placeholder="e.g. Excellent algorithmic problem solving, clear code explanations..."
                            />
                        </div>
                        <div className="hf-scorecard-field">
                            <label htmlFor="hf-improvements">Areas to Evaluate / Concerns</label>
                            <textarea
                                id="hf-improvements"
                                rows={2}
                                value={areasToImprove}
                                onChange={(e) => setAreasToImprove(e.target.value)}
                                placeholder="e.g. Could deepen familiarity with distributed caching or CI/CD pipelines..."
                            />
                        </div>
                    </div>

                    <div className="hf-scorecard-field">
                        <label htmlFor="hf-committee-notes">Private Hiring Committee Notes</label>
                        <textarea
                            id="hf-committee-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Internal recruiter notes (never visible to candidate)..."
                        />
                    </div>

                    {/* Footer Actions */}
                    <footer className="hf-scorecard-footer">
                        <button type="button" className="hf-btn-cancel-sc" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="hf-btn-save-sc" disabled={submitting}>
                            {submitting ? 'Saving Evaluation…' : '✓ Save Interview Scorecard'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    )
}
