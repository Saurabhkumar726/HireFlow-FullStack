import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CityLocationAutocomplete from './CityLocationAutocomplete'
import './ApplicationModal.css'
import SkeletonLoader from './SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

function parseSelectedOptions(value) {
    try { return Array.isArray(JSON.parse(value || '[]')) ? JSON.parse(value || '[]') : [] }
    catch { return [] }
}

export default function ApplicationModal({
    job,
    form,
    onChange,
    submitting = false,
    message = '',
    applicationId = null,
    onSubmit,
    onClose,
    onViewApplications,
    onBrowseJobs,
}) {
    const dialogRef = useRef(null)
    const closeButtonRef = useRef(null)
    const onCloseRef = useRef(onClose)
    const submittingRef = useRef(submitting)
    const [screeningResult, setScreeningResult] = useState({
        jobId: null,
        questions: [],
        error: '',
    })
    const screeningJobId = job?.id ?? job?.Id ?? null
    const hasScreeningResult = screeningJobId != null &&
        String(screeningResult.jobId) === String(screeningJobId)
    const screeningQuestions = hasScreeningResult ? screeningResult.questions : []
    const screeningError = hasScreeningResult ? screeningResult.error : ''
    const screeningLoading = screeningJobId != null && !hasScreeningResult

    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    useEffect(() => {
        submittingRef.current = submitting
    }, [submitting])

    useEffect(() => {
        if (screeningJobId == null) return undefined

        const controller = new AbortController()
        const authToken = localStorage.getItem('hireflow-token') || ''

        async function loadScreeningQuestions() {
            try {
                const response = await fetch(`${API_URL}/Jobs/${screeningJobId}/screening-questions`, {
                    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                    signal: controller.signal,
                })
                const data = await response.json().catch(() => [])
                if (!response.ok) {
                    throw new Error(data.message || 'Could not load screening questions.')
                }

                if (!controller.signal.aborted) {
                    setScreeningResult({
                        jobId: String(screeningJobId),
                        questions: Array.isArray(data) ? data : [],
                        error: '',
                    })
                }
            } catch (error) {
                if (error.name !== 'AbortError' && !controller.signal.aborted) {
                    setScreeningResult({
                        jobId: String(screeningJobId),
                        questions: [],
                        error: error.message || 'Screening questions could not be loaded.',
                    })
                }
            }
        }

        void loadScreeningQuestions()
        return () => controller.abort()
    }, [screeningJobId])

    useEffect(() => {
        if (!job || typeof document === 'undefined') return undefined

        const previousBodyOverflow = document.body.style.overflow
        const previousHtmlOverflow = document.documentElement.style.overflow
        const previousBodyPaddingRight = document.body.style.paddingRight
        const previousFocus = document.activeElement
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = 'hidden'
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`

        const focusTimer = window.setTimeout(() => {
            closeButtonRef.current?.focus()
            if (dialogRef.current) dialogRef.current.scrollTop = 0
        }, 0)

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault()
                if (!submittingRef.current) onCloseRef.current?.()
                return
            }
            if (event.key !== 'Tab' || !dialogRef.current) return
            const focusable = dialogRef.current.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
            )
            const items = Array.from(focusable).filter((element) => element.getClientRects().length > 0)
            if (!items.length) return
            const first = items[0]
            const last = items[items.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            window.clearTimeout(focusTimer)
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = previousBodyOverflow
            document.documentElement.style.overflow = previousHtmlOverflow
            document.body.style.paddingRight = previousBodyPaddingRight
            if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true })
        }
    }, [job])

    if (!job || typeof document === 'undefined') return null

    function updateField(field, value) {
        onChange({ ...form, [field]: value })
    }

    function updateScreeningAnswer(questionId, answerText) {
        const current = Array.isArray(form.screeningAnswers) ? form.screeningAnswers : []
        const next = current.filter((item) => item.questionId !== questionId)
        if (answerText !== '' && answerText !== '[]') next.push({ questionId, answerText })
        onChange({ ...form, screeningAnswers: next })
    }

    function getScreeningAnswer(questionId) {
        return (form.screeningAnswers || []).find((item) => item.questionId === questionId)?.answerText || ''
    }

    function handleBackdropClick(event) {
        if (event.target === event.currentTarget && !submitting) onClose?.()
    }

    const jobTitle = job.title || job.jobTitle || 'this role'
    const companyName = job.company || job.companyName || 'the company'

    return createPortal(
        <div className="hf-apply-backdrop" onMouseDown={handleBackdropClick}>
            <section
                className="hf-apply-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hf-apply-title"
                aria-describedby="hf-apply-job-name"
                ref={dialogRef}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <button
                    className="hf-apply-close"
                    type="button"
                    onClick={() => !submitting && onClose?.()}
                    disabled={submitting}
                    aria-label="Close application form"
                    ref={closeButtonRef}
                >×</button>

                {message === 'success' ? (
                    <div className="hf-apply-success">
                        <div className="hf-apply-success-icon" aria-hidden="true">✓</div>
                        <p className="hf-apply-eyebrow">APPLICATION SUBMITTED</p>
                        <h2 id="hf-apply-title">You're one step closer.</h2>
                        <p className="hf-apply-success-copy">
                            Your application for <strong>{jobTitle}</strong> at {companyName} has been received.
                        </p>
                        {applicationId && <p className="hf-apply-reference">Application reference <strong>#{applicationId}</strong></p>}
                        <div className="hf-apply-success-actions">
                            <button className="hf-apply-submit" type="button" onClick={onViewApplications}>View My Applications →</button>
                            <button className="hf-apply-secondary" type="button" onClick={onBrowseJobs}>Browse similar jobs</button>
                            <button className="hf-apply-secondary" type="button" onClick={onClose}>Done</button>
                        </div>
                    </div>
                ) : (
                    <div className="hf-apply-content">
                        <p className="hf-apply-eyebrow">TAKE THE NEXT STEP</p>
                        <h2 id="hf-apply-title">Apply for this role.</h2>
                        <p className="hf-apply-job-name" id="hf-apply-job-name">{jobTitle} <span>at {companyName}</span></p>

                        <form className="hf-apply-form" onSubmit={onSubmit}>
                            <div className="hf-apply-section-label">Your contact details</div>
                            <div className="hf-apply-grid">
                                <label htmlFor="hf-apply-name">
                                    <span className="hf-apply-label-line">Full name <span className="hf-apply-required" aria-hidden="true">*</span></span>
                                    <input id="hf-apply-name" name="applicantName" type="text" autoComplete="name" required maxLength={100} value={form.applicantName || ''} onChange={(event) => updateField('applicantName', event.target.value)} placeholder="Your full name" />
                                </label>
                                <label htmlFor="hf-apply-email">
                                    <span className="hf-apply-label-line">Email address <span className="hf-apply-required" aria-hidden="true">*</span></span>
                                    <input id="hf-apply-email" name="applicantEmail" type="email" autoComplete="email" required maxLength={254} value={form.applicantEmail || ''} onChange={(event) => updateField('applicantEmail', event.target.value)} placeholder="you@example.com" />
                                </label>
                                <label htmlFor="hf-apply-phone">
                                    <span className="hf-apply-label-line">Phone number <span className="hf-apply-required" aria-hidden="true">*</span></span>
                                    <input id="hf-apply-phone" name="applicantPhoneNumber" type="tel" autoComplete="tel" required maxLength={32} value={form.applicantPhoneNumber || ''} onChange={(event) => updateField('applicantPhoneNumber', event.target.value)} placeholder="Your contact number" />
                                </label>
                                <label htmlFor="hf-apply-location">
                                    <span className="hf-apply-label-line">Current location <span className="hf-apply-required" aria-hidden="true">*</span></span>
                                    <CityLocationAutocomplete id="hf-apply-location" name="applicantLocation" autoComplete="address-level2" required maxLength={150} value={form.applicantLocation || ''} onChange={value => updateField('applicantLocation', value)} placeholder="City, State" ariaLabel="Current location" />
                                </label>
                                <label htmlFor="hf-apply-linkedin">
                                    <span className="hf-apply-label-line">LinkedIn URL <span className="hf-apply-optional">Optional</span></span>
                                    <input id="hf-apply-linkedin" name="applicantLinkedInUrl" type="url" inputMode="url" maxLength={500} value={form.applicantLinkedInUrl || ''} onChange={(event) => updateField('applicantLinkedInUrl', event.target.value)} placeholder="https://linkedin.com/in/…" />
                                </label>
                                <label htmlFor="hf-apply-portfolio">
                                    <span className="hf-apply-label-line">Portfolio URL <span className="hf-apply-optional">Optional</span></span>
                                    <input id="hf-apply-portfolio" name="applicantPortfolioUrl" type="url" inputMode="url" maxLength={500} value={form.applicantPortfolioUrl || ''} onChange={(event) => updateField('applicantPortfolioUrl', event.target.value)} placeholder="https://your-portfolio.com" />
                                </label>
                            </div>

                            <div className="hf-apply-section-label">Resume and introduction</div>
                            <label htmlFor="hf-apply-resume">
                                <span className="hf-apply-label-line">Resume URL <span className="hf-apply-required" aria-hidden="true">*</span></span>
                                <input id="hf-apply-resume" name="resumeUrl" type="text" inputMode="url" required maxLength={2048} value={form.resumeUrl || ''} onChange={(event) => updateField('resumeUrl', event.target.value)} placeholder="Use your saved resume or paste a shareable URL" />
                                <small>{form.resumeUrl ? 'Your saved resume is attached. You can replace this link before submitting.' : 'Add your saved resume or paste a shareable URL before submitting.'}</small>
                            </label>

                            <label htmlFor="hf-apply-cover-letter">
                                <span className="hf-apply-label-line">Cover letter <span className="hf-apply-optional">Optional</span></span>
                                <textarea id="hf-apply-cover-letter" name="coverLetter" maxLength={3000} rows={4} value={form.coverLetter || ''} onChange={(event) => updateField('coverLetter', event.target.value)} placeholder="Tell the employer why you're interested…" />
                            </label>

                            {(screeningLoading || screeningQuestions.length > 0 || screeningError) && (
                                <section className="hf-apply-screening" aria-label="Screening questions">
                                    <div className="hf-apply-section-label">A few role-specific questions</div>
                                    {screeningLoading && <SkeletonLoader variant="screening" count={2} compact />}
                                    {screeningError && <p className="hf-apply-screening-error" role="status">{screeningError}</p>}
                                    {screeningQuestions.map((question) => {
                                        const answer = getScreeningAnswer(question.id)
                                        const options = Array.isArray(question.options) ? question.options : []
                                        const selectedOptions = parseSelectedOptions(answer)
                                        return (
                                            <fieldset className="hf-apply-screening-question" key={question.id}>
                                                <legend>{question.questionText} {question.isRequired && <span className="hf-apply-required" aria-hidden="true">*</span>}</legend>
                                                {question.questionType === 'Text' && (
                                                    <textarea rows={3} maxLength={4000} required={Boolean(question.isRequired)} value={answer} onChange={(event) => updateScreeningAnswer(question.id, event.target.value)} placeholder="Type your answer…" />
                                                )}
                                                {question.questionType === 'YesNo' && (
                                                    <div className="hf-apply-screening-options">
                                                        {['Yes', 'No'].map((option) => (
                                                            <label key={option}><input type="radio" name={`screening-${question.id}`} checked={answer === option} onChange={() => updateScreeningAnswer(question.id, option)} required={Boolean(question.isRequired)} /> {option}</label>
                                                        ))}
                                                    </div>
                                                )}
                                                {question.questionType === 'SingleChoice' && (
                                                    <div className="hf-apply-screening-options">
                                                        {options.map((option) => (
                                                            <label key={option}><input type="radio" name={`screening-${question.id}`} checked={answer === option} onChange={() => updateScreeningAnswer(question.id, option)} required={Boolean(question.isRequired)} /> {option}</label>
                                                        ))}
                                                    </div>
                                                )}
                                                {question.questionType === 'MultipleChoice' && (
                                                    <div className="hf-apply-screening-options">
                                                        {options.map((option) => (
                                                            <label key={option}><input type="checkbox" checked={selectedOptions.includes(option)} onChange={(event) => {
                                                                const next = event.target.checked
                                                                    ? [...selectedOptions, option]
                                                                    : selectedOptions.filter((item) => item !== option)
                                                                updateScreeningAnswer(question.id, next.length ? JSON.stringify(next) : '')
                                                            }} /> {option}</label>
                                                        ))}
                                                        {question.isRequired && selectedOptions.length === 0 && <small>Select at least one option.</small>}
                                                    </div>
                                                )}
                                            </fieldset>
                                        )
                                    })}
                                </section>
                            )}

                            {message && message !== 'success' && <p className="hf-apply-error" role="alert">{message}</p>}
                            <button className="hf-apply-submit" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application →'}</button>
                            <p className="hf-apply-privacy">Your submitted details and resume link will be saved with this application.</p>
                        </form>
                    </div>
                )}
            </section>
        </div>,
        document.body
    )
}
