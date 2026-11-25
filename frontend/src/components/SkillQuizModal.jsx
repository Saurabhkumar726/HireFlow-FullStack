import { useEffect, useRef, useState } from 'react'
import './SkillQuizModal.css'

export default function SkillQuizModal({
    job,
    applicationId,
    onClose,
    onQuizCompleted
}) {
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [currentIdx, setCurrentIdx] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState({}) // { questionId: optionIndex }
    const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)

    const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

    useEffect(() => {
        let isMounted = true
        async function fetchQuestions() {
            setLoading(true)
            setError('')
            try {
                const res = await fetch(`${API_BASE}/AiAgent/skill-quiz/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jobId: job?.id || 0,
                        topic: job?.title || 'Full Stack Software Engineering'
                    })
                })
                if (!res.ok) throw new Error('Unable to load assessment questions.')
                const data = await res.json()
                if (isMounted) {
                    setQuestions(data || [])
                }
            } catch (err) {
                if (isMounted) setError(err.message || 'Error generating quiz.')
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchQuestions()
        return () => { isMounted = false }
    }, [job, API_BASE])

    const handleSubmitRef = useRef(null)

    // Countdown Timer
    useEffect(() => {
        if (loading || result || timeLeft <= 0) return
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer)
                    handleSubmitRef.current?.()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [loading, result, timeLeft])

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s < 10 ? '0' : ''}${s}`
    }

    function handleSelectOption(qId, optIdx) {
        if (result) return
        setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }))
    }

    async function handleSubmit() {
        if (submitting) return
        setSubmitting(true)
        setError('')
        try {
            const token = localStorage.getItem('hireflow-token')
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`

            const res = await fetch(`${API_BASE}/AiAgent/skill-quiz/submit`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    jobId: job?.id || 0,
                    applicationId: applicationId || null,
                    selectedAnswers
                })
            })
            if (!res.ok) throw new Error('Failed to evaluate assessment.')
            const data = await res.json()
            setResult(data)
            onQuizCompleted?.(data)
        } catch (err) {
            setError(err.message || 'Error submitting answers.')
        } finally {
            setSubmitting(false)
        }
    }

    useEffect(() => {
        handleSubmitRef.current = handleSubmit
    })

    const currentQ = questions[currentIdx]
    const answeredCount = Object.keys(selectedAnswers).length
    const isAllAnswered = questions.length > 0 && answeredCount === questions.length

    return (
        <div className="hf-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="hf-quiz-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="hf-quiz-header">
                    <div className="hf-quiz-title-area">
                        <span className="hf-quiz-badge">🧠 Technical Skill Assessment</span>
                        <h3>{job?.title || 'Technical Skill Verification'}</h3>
                    </div>
                    <div className="hf-quiz-meta-actions">
                        {!result && !loading && (
                            <div className={`hf-quiz-timer ${timeLeft < 60 ? 'urgent' : ''}`}>
                                ⏱ <span>{formatTime(timeLeft)}</span>
                            </div>
                        )}
                        <button type="button" className="hf-quiz-close-btn" onClick={onClose} aria-label="Close">✕</button>
                    </div>
                </header>

                {error && <div className="hf-quiz-alert error">{error}</div>}

                {loading ? (
                    <div className="hf-quiz-loading">
                        <div className="hf-quiz-spinner" />
                        <p>Preparing customized technical assessment questions…</p>
                    </div>
                ) : result ? (
                    /* Scorecard View */
                    <div className="hf-quiz-result-view">
                        <div className="hf-quiz-score-banner">
                            <div className={`hf-quiz-score-gauge tier-${result.tier.toLowerCase()}`}>
                                <span className="hf-quiz-gauge-num">{result.score}%</span>
                                <span className="hf-quiz-gauge-tier">{result.tier}</span>
                            </div>
                            <div className="hf-quiz-score-details">
                                <h4>Assessment Complete!</h4>
                                <p>{result.feedback}</p>
                                <div className="hf-quiz-metric-chips">
                                    <span>Correct: <strong>{result.correctCount} / {result.totalQuestions}</strong></span>
                                    <span>Proficiency: <strong>{result.tier}</strong></span>
                                    {applicationId && <span className="saved-badge">✓ Linked to Application #{applicationId}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Detailed Question Review */}
                        <div className="hf-quiz-reviews-section">
                            <h5>Detailed Answer Review & Insights:</h5>
                            <div className="hf-quiz-review-list">
                                {result.reviews?.map((r, i) => (
                                    <div key={r.questionId || i} className={`hf-quiz-review-item ${r.isCorrect ? 'correct' : 'incorrect'}`}>
                                        <div className="hf-review-q-title">
                                            <span className="hf-review-icon">{r.isCorrect ? '✓' : '✕'}</span>
                                            <strong>Question {i + 1}: {r.question}</strong>
                                        </div>
                                        <div className="hf-review-explanation">
                                            <p>{r.explanation}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="hf-quiz-result-actions">
                            <button type="button" className="hf-btn-done" onClick={onClose}>
                                Done & Return to Portal
                            </button>
                        </div>
                    </div>
                ) : questions.length === 0 ? (
                    <div className="hf-quiz-empty">
                        <p>No questions could be loaded for this topic. Please try again shortly.</p>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                ) : (
                    /* Active Quiz Interface */
                    <div className="hf-quiz-content">
                        {/* Progress Tracker */}
                        <div className="hf-quiz-stepper">
                            <div className="hf-quiz-progress-text">
                                <span>Question {currentIdx + 1} of {questions.length}</span>
                                <span>{answeredCount} of {questions.length} answered</span>
                            </div>
                            <div className="hf-quiz-progress-bar">
                                <div
                                    className="hf-quiz-progress-fill"
                                    style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Question Box */}
                        <div className="hf-quiz-question-box">
                            <div className="hf-quiz-skill-tag">{currentQ.skillTag || 'Software Architecture'}</div>
                            <h4 className="hf-quiz-q-text">{currentQ.question}</h4>

                            <div className="hf-quiz-options-list">
                                {currentQ.options?.map((opt, optIdx) => {
                                    const isSelected = selectedAnswers[currentQ.id] === optIdx
                                    const letter = String.fromCharCode(65 + optIdx) // A, B, C, D
                                    return (
                                        <button
                                            key={optIdx}
                                            type="button"
                                            className={`hf-quiz-opt-btn ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleSelectOption(currentQ.id, optIdx)}
                                        >
                                            <span className="hf-opt-letter">{letter}</span>
                                            <span className="hf-opt-text">{opt}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Navigation Footer */}
                        <footer className="hf-quiz-footer">
                            <button
                                type="button"
                                className="hf-btn-nav-prev"
                                onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
                                disabled={currentIdx === 0}
                            >
                                ← Previous
                            </button>

                            <div className="hf-quiz-pills-nav">
                                {questions.map((q, qIndex) => (
                                    <button
                                        key={q.id}
                                        type="button"
                                        className={`hf-nav-dot ${currentIdx === qIndex ? 'active' : ''} ${selectedAnswers[q.id] !== undefined ? 'answered' : ''}`}
                                        onClick={() => setCurrentIdx(qIndex)}
                                    >
                                        {qIndex + 1}
                                    </button>
                                ))}
                            </div>

                            {currentIdx < questions.length - 1 ? (
                                <button
                                    type="button"
                                    className="hf-btn-nav-next"
                                    onClick={() => setCurrentIdx((p) => Math.min(questions.length - 1, p + 1))}
                                >
                                    Next →
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="hf-btn-submit-quiz"
                                    onClick={handleSubmit}
                                    disabled={submitting || !isAllAnswered}
                                >
                                    {submitting ? 'Scoring Assessment…' : 'Submit Assessment 🏁'}
                                </button>
                            )}
                        </footer>
                    </div>
                )}
            </div>
        </div>
    )
}
