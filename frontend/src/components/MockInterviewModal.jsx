import { useEffect, useState } from 'react'
import './MockInterviewModal.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

export default function MockInterviewModal({ job, onClose }) {
    const [questions, setQuestions] = useState([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answerText, setAnswerText] = useState('')
    const [loadingQuestions, setLoadingQuestions] = useState(true)
    const [evaluating, setEvaluating] = useState(false)
    const [evaluation, setEvaluation] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        let isMounted = true

        async function fetchQuestions() {
            setLoadingQuestions(true)
            setError('')
            try {
                const response = await fetch(`${API_BASE}/AiAgent/mock-interview/generate-questions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jobId: job?.id,
                        roleTitle: job?.title,
                        jobDescription: job?.description,
                        skills: job?.requirements ? job.requirements.split(',').map((s) => s.trim()) : [],
                    }),
                })
                if (!response.ok) throw new Error('Unable to generate interview questions.')
                const data = await response.json()
                if (isMounted) {
                    setQuestions(Array.isArray(data) ? data : [])
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.message || 'Could not load interview questions.')
                }
            } finally {
                if (isMounted) setLoadingQuestions(false)
            }
        }

        fetchQuestions()

        return () => {
            isMounted = false
        }
    }, [job])

    async function handleEvaluate() {
        if (!answerText.trim()) return
        setEvaluating(true)
        setError('')
        try {
            const currentQ = questions[currentIndex]
            const response = await fetch(`${API_BASE}/AiAgent/mock-interview/evaluate-answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: currentQ.question,
                    candidateAnswer: answerText.trim(),
                    roleTitle: job?.title,
                    category: currentQ.category,
                }),
            })
            if (!response.ok) throw new Error('Evaluation failed.')
            const result = await response.json()
            setEvaluation(result)
        } catch (err) {
            setError(err.message || 'Unable to evaluate your answer.')
        } finally {
            setEvaluating(false)
        }
    }

    function handleNextQuestion() {
        setEvaluation(null)
        setAnswerText('')
        setError('')
        if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1)
        }
    }

    function handlePrevQuestion() {
        setEvaluation(null)
        setAnswerText('')
        setError('')
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1)
        }
    }

    const currentQuestion = questions[currentIndex]

    return (
        <div className="hf-mock-overlay" role="dialog" aria-modal="true" aria-labelledby="hf-mock-title">
            <div className="hf-mock-backdrop" onClick={onClose} />
            <div className="hf-mock-modal">
                <header className="hf-mock-header">
                    <div>
                        <span className="hf-mock-badge">AI Interview Simulator</span>
                        <h2 id="hf-mock-title">Practice for {job?.title || 'Job Interview'}</h2>
                        <p>{job?.company || 'Target Employer'}</p>
                    </div>
                    <button type="button" className="hf-mock-close-btn" onClick={onClose} aria-label="Close modal">
                        ✕
                    </button>
                </header>

                <main className="hf-mock-body">
                    {loadingQuestions ? (
                        <div className="hf-mock-loading">
                            <div className="hf-mock-spinner" />
                            <p>Analyzing job requirements and synthesizing customized interview questions…</p>
                        </div>
                    ) : error && !questions.length ? (
                        <div className="hf-mock-error" role="alert">
                            <p>{error}</p>
                            <button type="button" onClick={onClose}>Close</button>
                        </div>
                    ) : (
                        <>
                            <div className="hf-mock-progress-bar">
                                <div
                                    className="hf-mock-progress-fill"
                                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                                />
                            </div>

                            <div className="hf-mock-meta-row">
                                <span className="hf-mock-step-count">
                                    Question {currentIndex + 1} of {questions.length}
                                </span>
                                {currentQuestion?.category && (
                                    <span className="hf-mock-category-tag">{currentQuestion.category}</span>
                                )}
                            </div>

                            <div className="hf-mock-question-card">
                                <h3>{currentQuestion?.question}</h3>
                                {currentQuestion?.tips && (
                                    <p className="hf-mock-tip">
                                        💡 <strong>Coaching tip:</strong> {currentQuestion.tips}
                                    </p>
                                )}
                            </div>

                            {!evaluation ? (
                                <div className="hf-mock-answer-section">
                                    <label htmlFor="hf-mock-answer">Your response</label>
                                    <textarea
                                        id="hf-mock-answer"
                                        rows={6}
                                        value={answerText}
                                        onChange={(e) => setAnswerText(e.target.value)}
                                        placeholder="Type your structured answer here. Include your technical rationale, measurable results, and edge cases…"
                                        maxLength={4000}
                                        disabled={evaluating}
                                    />
                                    <div className="hf-mock-answer-footer">
                                        <span>{answerText.length} / 4000 chars</span>
                                        <div className="hf-mock-answer-actions">
                                            <button
                                                type="button"
                                                className="hf-mock-btn-secondary"
                                                onClick={handlePrevQuestion}
                                                disabled={currentIndex === 0 || evaluating}
                                            >
                                                ← Prev
                                            </button>
                                            <button
                                                type="button"
                                                className="hf-mock-btn-primary"
                                                onClick={handleEvaluate}
                                                disabled={evaluating || !answerText.trim()}
                                            >
                                                {evaluating ? 'Analyzing Answer…' : 'Submit for AI Review ✦'}
                                            </button>
                                        </div>
                                    </div>
                                    {error && <p className="hf-mock-error-inline" role="alert">{error}</p>}
                                </div>
                            ) : (
                                <div className="hf-mock-feedback-section">
                                    <div className="hf-mock-score-header">
                                        <div className="hf-mock-score-circle" data-score={evaluation.score}>
                                            <strong>{evaluation.score}</strong>
                                            <span>/ 10</span>
                                        </div>
                                        <div className="hf-mock-score-summary">
                                            <h4>{evaluation.score >= 8 ? 'Outstanding Answer!' : evaluation.score >= 6 ? 'Solid Response' : 'Room for Growth'}</h4>
                                            <p>{evaluation.summary}</p>
                                        </div>
                                    </div>

                                    {Array.isArray(evaluation.strengths) && evaluation.strengths.length > 0 && (
                                        <div className="hf-mock-feedback-block strengths">
                                            <h5>Key Strengths</h5>
                                            <ul>
                                                {evaluation.strengths.map((item, i) => (
                                                    <li key={i}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {Array.isArray(evaluation.improvements) && evaluation.improvements.length > 0 && (
                                        <div className="hf-mock-feedback-block improvements">
                                            <h5>Areas to Elevate</h5>
                                            <ul>
                                                {evaluation.improvements.map((item, i) => (
                                                    <li key={i}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {evaluation.modelAnswer && (
                                        <div className="hf-mock-model-answer">
                                            <h5>Exemplary Strategy & Model Answer</h5>
                                            <p>{evaluation.modelAnswer}</p>
                                        </div>
                                    )}

                                    <div className="hf-mock-feedback-actions">
                                        <button
                                            type="button"
                                            className="hf-mock-btn-secondary"
                                            onClick={() => setEvaluation(null)}
                                        >
                                            Retry Question
                                        </button>
                                        {currentIndex < questions.length - 1 ? (
                                            <button
                                                type="button"
                                                className="hf-mock-btn-primary"
                                                onClick={handleNextQuestion}
                                            >
                                                Next Question →
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="hf-mock-btn-primary"
                                                onClick={onClose}
                                            >
                                                Complete Session 🎉
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
