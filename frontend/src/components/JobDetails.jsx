import { useState } from 'react'
import './JobDetails.css'
import MockInterviewModal from './MockInterviewModal.jsx'
import ShareJob from './ShareJob.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

function displayDate(value) {
    if (!value) return 'Recently posted'
    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? 'Recently posted'
        : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function displayList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
    if (typeof value !== 'string' || !value.trim()) return []
    return value.split(/\r?\n|•|(?<=[.!?])\s+(?=[A-Z])/)
        .map((item) => item.replace(/^[-*\s]+/, '').trim())
        .filter(Boolean)
}

function renderInlineMarkdown(text) {
    if (!text) return null
    const str = String(text)
    const parts = []
    const regex = /\*\*(.*?)\*\*/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) {
            parts.push(str.slice(lastIndex, match.index))
        }
        parts.push(<strong key={match.index}>{match[1]}</strong>)
        lastIndex = regex.lastIndex
    }
    if (lastIndex < str.length) {
        parts.push(str.slice(lastIndex))
    }
    return parts
}

function ownSalary(job) {
    const amount = Number(job.salary || 0)
    const maximum = Number(job.salaryMax || 0)
    const mode = String(job.salaryMode || 'Range').toLowerCase()
    const currency = String(job.salaryCurrency || 'INR').toUpperCase()
    const period = String(job.salaryPeriod || 'Monthly').toLowerCase()
    if (mode === 'negotiable') return 'Salary negotiable'
    if (mode === 'notdisclosed' || amount <= 0) return 'Salary not disclosed'
    const format = (value) => {
        try {
            return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
        } catch {
            return `${currency} ${Number(value).toLocaleString('en-IN')}`
        }
    }
    if (mode === 'startingat') return `From ${format(amount)} / ${period}`
    if (maximum > amount) return `${format(amount)} – ${format(maximum)} / ${period}`
    return `${format(amount)} / ${period}`
}

function experienceText(job) {
    const min = job.minimumExperienceYears
    const max = job.maximumExperienceYears
    if (min != null && max != null) return `${min}–${max} years`
    if (min != null) return `${min}+ years`
    return job.experienceLevel || 'Not specified'
}

function workModeText(job) {
    if (job.workMode && String(job.workMode).toLowerCase() !== 'not specified') return job.workMode
    const text = `${job.location || ''} ${job.description || ''}`.toLowerCase()
    if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) return 'Remote'
    if (text.includes('hybrid')) return 'Hybrid'
    if (text.includes('onsite') || text.includes('on-site')) return 'On-site'
    return 'Not specified'
}

function unavailableReason(job) {
    if (job.isActive === false) return 'This job has been closed by the employer.'
    if (job.publicationStatus && String(job.publicationStatus).toLowerCase() !== 'published') return 'This job is not currently published.'
    if (job.applicationDeadlineUtc && new Date(job.applicationDeadlineUtc).getTime() < Date.now()) return 'The application deadline for this job has passed.'
    return ''
}

function DetailList({ title, eyebrow, items, emptyText }) {
    if (!items.length) return null
    return (
        <section className="job-details-panel">
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <ul className="job-requirements-list">
                {items.map((item, index) => <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>)}
            </ul>
            {emptyText ? <p className="job-details-muted">{emptyText}</p> : null}
        </section>
    )
}

export default function JobDetails({ job, onBack, onApply, formatSalary }) {
    const [atsMatch, setAtsMatch] = useState(null)
    const [loadingAts, setLoadingAts] = useState(false)
    const [atsError, setAtsError] = useState('')
    const [showMockInterview, setShowMockInterview] = useState(false)

    async function handleCheckAts() {
        if (loadingAts) return
        setLoadingAts(true)
        setAtsError('')
        try {
            const token = localStorage.getItem('hireflow-token')
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`
            const res = await fetch(`${API_URL}/AiAgent/ats-match`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ jobId: job.id })
            })
            if (!res.ok) throw new Error('Unable to analyze ATS match at this time.')
            const data = await res.json()
            setAtsMatch(data)
        } catch (err) {
            setAtsError(err.message || 'ATS match analysis unavailable.')
        } finally {
            setLoadingAts(false)
        }
    }

    const description = String(job.description || '').trim()
    const requirements = displayList(job.requirements)
    const responsibilities = displayList(job.responsibilities)
    const benefits = displayList(job.benefits)
    const closedReason = unavailableReason(job)
    const salary = typeof formatSalary === 'function' ? formatSalary(job.salary, job) : ownSalary(job)
    const deadline = job.applicationDeadlineUtc ? new Date(job.applicationDeadlineUtc) : null
    const deadlineLabel = deadline && !Number.isNaN(deadline.getTime())
        ? deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Not specified'
    const companyInitials = String(job.company || 'H').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'H'

    return (
        <main className="job-details-page">
            <div className="job-details-wrap">
                <button className="job-details-back" type="button" onClick={onBack}>← Back to jobs</button>

                <section className="job-details-hero">
                    <div className="job-details-company-mark" aria-hidden="true">{companyInitials}</div>
                    <div className="job-details-heading">
                        <div className="job-details-labels">
                            <span className="job-type-label">{job.jobType || 'Opportunity'}</span>
                            <span className="job-type-label">{workModeText(job)}</span>
                            {closedReason && <span className="job-unavailable-label">{job.isActive === false ? 'Closed' : 'Expired / unavailable'}</span>}
                        </div>
                        <h1>{job.title || 'Job opportunity'}</h1>
                        <p className="job-details-company">{job.company || 'Company not specified'}</p>
                        <div className="job-details-meta">
                            <span>⌖ {job.location || 'Location flexible'}</span>
                            <span>◷ Posted {displayDate(job.createdAt)}</span>
                            {job.category && <span>{job.category}</span>}
                        </div>
                    </div>
                    <div className="job-details-primary-action">
                        <strong>{salary}</strong>
                        <span>{job.salaryMode === 'NotDisclosed' ? 'Compensation not provided by employer' : `Compensation ${job.salaryPeriod ? `per ${String(job.salaryPeriod).toLowerCase()}` : 'as listed by employer'}`}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button className="button-primary" type="button" onClick={onApply} disabled={Boolean(closedReason)}>{closedReason ? 'Applications closed' : 'Apply now'} <span>↗</span></button>
                            <ShareJob job={job} />
                        </div>
                    </div>
                </section>

                {closedReason && <div className="job-closed-notice" role="status"><strong>This opportunity is no longer accepting applications.</strong><span>{closedReason}</span></div>}

                <div className="job-details-layout">
                    <article className="job-details-content">
                        <section className="job-details-panel">
                            <p className="eyebrow">THE OPPORTUNITY</p>
                            <h2>About this role</h2>
                            {description ? (
                                <div className="job-details-description">
                                    {description.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => <p key={`${index}-${line.slice(0, 18)}`}>{line}</p>)}
                                </div>
                            ) : (
                                <p className="job-details-muted">The employer has not added a detailed description yet.</p>
                            )}
                        </section>

                        <DetailList title="Responsibilities" eyebrow="WHAT YOU'LL DO" items={responsibilities} />
                        <DetailList title="Requirements and qualifications" eyebrow="WHAT YOU'LL NEED" items={requirements} />
                        <DetailList title="Benefits" eyebrow="WHAT'S INCLUDED" items={benefits} />

                        <section className="job-details-panel">
                            <p className="eyebrow">ABOUT THE EMPLOYER</p>
                            <h2>{job.company || 'Company information'}</h2>
                            <p className="job-details-muted">{job.companyDescription || 'Additional company information has not been provided for this listing.'}</p>
                            {job.companyWebsite && <a className="job-details-company-link" href={job.companyWebsite} target="_blank" rel="noreferrer">Visit company website ↗</a>}
                        </section>
                    </article>

                    <aside className="job-details-sidebar">
                        <section className="job-details-panel overview-panel">
                            <p className="eyebrow">AT A GLANCE</p>
                            <h2>Job overview</h2>
                            <dl>
                                <div><dt>Company</dt><dd>{job.company || 'Not specified'}</dd></div>
                                <div><dt>Location</dt><dd>{job.location || 'Flexible'}</dd></div>
                                <div><dt>Employment type</dt><dd>{job.jobType || 'Not specified'}</dd></div>
                                <div><dt>Work mode</dt><dd>{workModeText(job)}</dd></div>
                                <div><dt>Experience</dt><dd>{experienceText(job)}</dd></div>
                                <div><dt>Salary</dt><dd>{salary}</dd></div>
                                <div><dt>Date posted</dt><dd>{displayDate(job.createdAt)}</dd></div>
                                <div><dt>Apply by</dt><dd>{deadlineLabel}</dd></div>
                            </dl>
                            <button className="button-primary overview-apply" type="button" onClick={onApply} disabled={Boolean(closedReason)}>{closedReason ? 'Applications closed' : 'Apply for this job'} <span>↗</span></button>
                        </section>

                        <section className="job-details-panel ats-analyzer-panel">
                            <p className="eyebrow">AI CAREER COPILOT</p>
                            <h2>ATS Match & Insights</h2>
                            {atsMatch ? (
                                <div className="job-ats-result">
                                    <div className="job-ats-score-badge">
                                        <div className={`job-ats-circle ${atsMatch.matchPercentage >= 75 || /strong/i.test(atsMatch.fitLevel || '') ? 'high' : atsMatch.matchPercentage >= 45 || /good|moderate/i.test(atsMatch.fitLevel || '') ? 'medium' : 'low'}`}>
                                            <span className="job-ats-score">{atsMatch.matchPercentage}%</span>
                                            <span className="job-ats-level">{atsMatch.fitLevel}</span>
                                        </div>
                                        <div className="job-ats-badge-info">
                                            <strong>{atsMatch.isProfileBased ? 'Profile Verified' : 'Resume Scan'}</strong>
                                            <p>{renderInlineMarkdown(atsMatch.summary)}</p>
                                        </div>
                                    </div>
                                    {atsMatch.matchedSkills?.length > 0 && (
                                        <div className="job-ats-skills-sec">
                                            <span className="job-ats-sec-lbl match">✓ Matching Required Skills:</span>
                                            <div className="job-ats-pills">
                                                {atsMatch.matchedSkills.map((s) => <span key={s} className="ats-pill matched">{s}</span>)}
                                            </div>
                                        </div>
                                    )}
                                    {atsMatch.missingSkills?.length > 0 && (
                                        <div className="job-ats-skills-sec">
                                            <span className="job-ats-sec-lbl missing">+ Missing Competencies to Add:</span>
                                            <div className="job-ats-pills">
                                                {atsMatch.missingSkills.map((s) => <span key={s} className="ats-pill missing">{s}</span>)}
                                            </div>
                                        </div>
                                    )}
                                    {atsMatch.topRecommendations?.length > 0 && (
                                        <div className="job-ats-tips">
                                            <strong>Application Advice:</strong>
                                            <ul>{atsMatch.topRecommendations.map((tip, i) => <li key={i}>{renderInlineMarkdown(tip)}</li>)}</ul>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="job-ats-prompt">
                                    <p className="job-details-muted">Evaluate your verified skills and resume keywords against this position to maximize your chances of getting shortlisted.</p>
                                    {atsError && <p className="job-ats-error">{atsError}</p>}
                                    <button type="button" className="job-ats-btn" onClick={handleCheckAts} disabled={loadingAts}>
                                        {loadingAts ? 'Analyzing match...' : 'Check My ATS Match ✨'}
                                    </button>
                                </div>
                            )}

                            <div className="job-mock-interview-section">
                                <button type="button" className="job-mock-btn" onClick={() => setShowMockInterview(true)}>
                                    🎯 Practice AI Mock Interview
                                </button>
                            </div>
                        </section>

                        <div className="job-details-tip">
                            <span>✦</span>
                            <div><strong>Ready for your next step?</strong><p>Review the role details, then submit your application through HireFlow.</p></div>
                        </div>
                    </aside>
                </div>
            </div>
            {showMockInterview && (
                <MockInterviewModal job={job} onClose={() => setShowMockInterview(false)} />
            )}
        </main>
    )
}
