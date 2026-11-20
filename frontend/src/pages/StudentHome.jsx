import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import CandidatePreferencesForm from '../components/CandidatePreferencesForm'
import CityLocationAutocomplete from '../components/CityLocationAutocomplete'
import SkeletonLoader from '../components/SkeletonLoader.jsx'
import './StudentHome.css'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

const EMPTY_PREFERENCES = {
    preferredRoles: [], preferredIndustries: [], preferredSkills: [], preferredLocations: [],
    employmentTypes: [], workModes: [], experienceLevel: '', expectedSalary: '', salaryCurrency: 'INR', salaryPeriod: 'Yearly',
}

const categories = [
    { label: 'Full Stack Development', filter: 'Full Stack' },
    { label: 'Frontend Development', filter: 'Frontend' },
    { label: 'Backend Development', filter: 'Backend' },
    { label: '.NET Development', filter: '.NET' },
    { label: 'React Development', filter: 'React' },
    { label: 'Software Engineering', filter: 'Software Engineering' },
    { label: 'Data & Analytics', filter: 'Data & Analytics' },
    { label: 'UI/UX Design', filter: 'UI/UX Design' },
    { label: 'Sales & Marketing', filter: 'Sales & Marketing' },
    { label: 'Internships', filter: 'Internships' },
]

async function apiRequest(path, token, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || data.title || `Request failed (${response.status}).`)
    return data
}

function initials(name) {
    return String(name || 'Company').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'C'
}

function salaryLabel(job) {
    const amount = Number(job?.salary || 0)
    const maximum = Number(job?.salaryMax || 0)
    const mode = String(job?.salaryMode || 'Range').toLowerCase()
    const currency = String(job?.salaryCurrency || 'INR').toUpperCase()
    const period = String(job?.salaryPeriod || 'Monthly').toLowerCase()
    if (mode === 'negotiable') return 'Salary negotiable'
    if (mode === 'notdisclosed' || amount <= 0) return 'Salary not disclosed'
    const format = value => {
        try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) }
        catch { return `${currency} ${Number(value).toLocaleString('en-IN')}` }
    }
    if (mode === 'startingat') return `From ${format(amount)} / ${period}`
    if (maximum > amount) return `${format(amount)} – ${format(maximum)} / ${period}`
    return `${format(amount)} / ${period}`
}

function JobCard({ item, saved, onSave, onApply }) {
    const job = item?.job || item
    const score = item?.matchPercentage
    const coverage = item?.coveragePercentage || 0

    return (
        <article className="candidate-home-job-card">
            <div className="candidate-home-job-top">
                <span className="candidate-home-company-mark">{initials(job.company)}</span>
                <div className="candidate-home-job-top-copy">
                    <strong>{job.company || 'Company not specified'}</strong>
                    <span>{job.location || 'Location not specified'}</span>
                </div>
                <button className={`candidate-home-bookmark ${saved ? 'is-saved' : ''}`} type="button" onClick={() => onSave?.(job.id)} aria-label={saved ? 'Remove saved job' : 'Save job'} title={saved ? 'Remove saved job' : 'Save job'}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21V4.8Z" /></svg>
                </button>
            </div>
            <div className="candidate-home-job-title-row">
                <h3>{job.title || 'Job opportunity'}</h3>
                {Number.isFinite(score) && <span className="candidate-home-match-pill">{score}% match</span>}
            </div>
            {Number.isFinite(score) && (
                <details className="candidate-home-match-details">
                    <summary>{item.matchLabel || 'How this matches'} · {coverage}% criteria coverage</summary>
                    <div className="candidate-home-match-breakdown">
                        {(item.criteria || []).map(criterion => (
                            <div key={criterion.name}>
                                <span><b>{criterion.name}</b><small>{criterion.weight}% weight</small></span>
                                <strong>{Math.round(criterion.score)}%</strong>
                                <p>{criterion.explanation}</p>
                            </div>
                        ))}
                        {item.matchedSkills?.length > 0 && <p className="candidate-home-matched-skills">Skills mentioned in this listing: {item.matchedSkills.join(', ')}</p>}
                        {item.missingSkills?.length > 0 && <p className="candidate-home-missing-skills">Your profile skills not mentioned in this listing: {item.missingSkills.join(', ')}</p>}
                        {item.signals?.length > 0 && <div className="candidate-home-match-signals"><b>Other preference signals</b>{item.signals.map(signal => <span key={signal}>{signal}</span>)}</div>}
                    </div>
                </details>
            )}
            <div className="candidate-home-job-tags">
                <span>{job.jobType || 'Opportunity'}</span>
                <span>{job.workMode || (String(job.location || '').toLowerCase().includes('remote') ? 'Remote' : 'Work mode not specified')}</span>
                {job.experienceLevel && <span>{job.experienceLevel}</span>}
            </div>
            <div className="candidate-home-job-meta">
                <strong>{salaryLabel(job)}</strong>
                <span>{job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recently posted'}</span>
            </div>
            <div className="candidate-home-job-actions">
                <Link to={`/jobs/${job.id}`}>View details <span aria-hidden="true">↗</span></Link>
                <button type="button" onClick={() => onApply?.(job)}>Apply now <span aria-hidden="true">→</span></button>
            </div>
        </article>
    )
}

function SkeletonCard() {
    return <div className="candidate-home-skeleton"><i /><b /><span /><span /><span /></div>
}

export default function StudentHome({ jobs = [], loading = false, error = '', onRetry, savedJobs = [], onToggleSaved, onApply, user }) {
    const navigate = useNavigate()
    const { token } = useAuth()
    const [keyword, setKeyword] = useState('')
    const [place, setPlace] = useState('')
    const [recommendations, setRecommendations] = useState([])
    const [preferences, setPreferences] = useState(EMPTY_PREFERENCES)
    const [hasPreferences, setHasPreferences] = useState(false)
    const [recommendationsLoading, setRecommendationsLoading] = useState(true)
    const [recommendationsError, setRecommendationsError] = useState('')
    const [preferencesOpen, setPreferencesOpen] = useState(false)
    const [preferencesSaving, setPreferencesSaving] = useState(false)
    const [feedback, setFeedback] = useState('')

    const firstName = user?.fullName?.split(' ')[0] || 'there'

    const loadRecommendations = useCallback(async () => {
        if (!token) {
            setRecommendationsLoading(false)
            return
        }
        setRecommendationsLoading(true)
        setRecommendationsError('')
        try {
            const data = await apiRequest('/CandidateJobPreferences/recommendations?limit=8', token)
            setRecommendations(Array.isArray(data.items) ? data.items : [])
            setPreferences({ ...EMPTY_PREFERENCES, ...(data.preferences || {}) })
            setHasPreferences(Boolean(data.hasPreferences))
        } catch (loadError) {
            setRecommendationsError(loadError.message || 'Personalized recommendations are temporarily unavailable.')
            setRecommendations([])
        } finally {
            setRecommendationsLoading(false)
        }
    }, [token])

    useEffect(() => {
        let active = true
        Promise.resolve().then(() => { if (active) loadRecommendations() })
        return () => { active = false }
    }, [loadRecommendations])

    useEffect(() => {
        if (!preferencesOpen) return undefined
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        function closeOnEscape(event) {
            if (event.key === 'Escape') setPreferencesOpen(false)
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', closeOnEscape)
        }
    }, [preferencesOpen])

    const fallbackJobs = useMemo(() => [...jobs]
        .sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 8), [jobs])

    const visibleRecommendations = recommendations.length
        ? recommendations
        : fallbackJobs.map(job => ({ job, matchPercentage: null, coveragePercentage: 0, criteria: [], signals: [] }))

    const companyList = useMemo(() => {
        const seen = new Set()
        return jobs.filter(job => {
            const name = String(job.company || '').trim()
            const key = name.toLowerCase()
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
        }).slice(0, 6)
    }, [jobs])

    const categoriesWithCounts = useMemo(() => categories.map(category => ({
        ...category,
        count: jobs.filter(job => `${job.title || ''} ${job.description || ''} ${job.category || ''}`.toLowerCase().includes(category.filter.toLowerCase())).length,
    })), [jobs])

    function searchJobs(event) {
        event.preventDefault()
        const params = new URLSearchParams()
        if (keyword.trim()) params.set('keyword', keyword.trim())
        if (place.trim()) params.set('location', place.trim())
        navigate(`/jobs${params.toString() ? `?${params.toString()}` : ''}`)
    }

    async function saveQuickPreferences(nextPreferences) {
        setPreferencesSaving(true)
        setFeedback('')
        try {
            const data = await apiRequest('/CandidateJobPreferences', token, {
                method: 'PUT',
                body: JSON.stringify(nextPreferences),
            })
            setPreferences({ ...EMPTY_PREFERENCES, ...(data.preferences || nextPreferences) })
            setHasPreferences(Boolean(data.hasPreferences))
            setPreferencesOpen(false)
            setFeedback('Your job preferences have been updated.')
            await loadRecommendations()
        } catch (saveError) {
            setFeedback(saveError.message || 'Unable to save your preferences.')
        } finally {
            setPreferencesSaving(false)
        }
    }

    return (
        <main className="candidate-home-page">
            <div className="candidate-home-container">
                <section className="candidate-home-welcome">
                    <div>
                        <span className="candidate-home-eyebrow">YOUR CAREER, YOUR DIRECTION</span>
                        <h1>Welcome back, {firstName}.</h1>
                        <p>Discover roles that fit your skills, interests, and next career move.</p>
                    </div>
                    <Link to="/candidate" className="candidate-home-dashboard-link">My dashboard <span>↗</span></Link>
                </section>

                <section className="candidate-home-search-panel">
                    <div><span className="candidate-home-eyebrow">START WITH WHAT YOU WANT</span><h2>Find your next opportunity.</h2></div>
                    <form onSubmit={searchJobs} className="candidate-home-search-form">
                        <label><span>Job title, skill, or company</span><input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="e.g. React Developer, .NET, Software Engineer" /></label>
                        <label><span>Preferred location</span><CityLocationAutocomplete value={place} onChange={setPlace} placeholder="City, state, or Remote" ariaLabel="Preferred job location" /></label>
                        <button type="submit"><span aria-hidden="true">⌕</span> Find jobs</button>
                    </form>
                </section>

                <section className="candidate-home-categories-section">
                    <div className="candidate-home-section-heading"><div><span className="candidate-home-eyebrow">EXPLORE YOUR OPTIONS</span><h2>Popular job categories</h2></div><Link to="/jobs">All jobs ↗</Link></div>
                    <div className="candidate-home-categories">
                        {categoriesWithCounts.map(category => (
                            <button type="button" key={category.label} onClick={() => navigate(`/jobs?category=${encodeURIComponent(category.filter)}`)}>
                                <span className="candidate-home-category-icon" aria-hidden="true">⌘</span>
                                <strong>{category.label}</strong>
                                <small>{category.count > 0 ? `${category.count} current ${category.count === 1 ? 'opening' : 'openings'}` : 'No current openings'}</small>
                                <span className="candidate-home-category-arrow" aria-hidden="true">↗</span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="candidate-home-recommendations-section">
                    <div className="candidate-home-section-heading candidate-home-recommendation-heading">
                        <div><span className="candidate-home-eyebrow">PICKED FOR YOUR NEXT MOVE</span><h2>{hasPreferences ? 'Recommended for you' : 'Popular opportunities'}</h2><p>{hasPreferences ? 'Ranked using your saved preferences and profile details.' : 'Explore current opportunities now. Add preferences whenever you are ready.'}</p></div>
                        <button type="button" onClick={() => setPreferencesOpen(true)}> {hasPreferences ? 'Edit preferences' : 'Personalize my feed'} <span>↗</span></button>
                    </div>

                    {!hasPreferences && (
                        <div className="candidate-home-personalize-card">
                            <div className="candidate-home-personalize-icon">✦</div>
                            <div><strong>Make your job feed feel more like yours.</strong><p>Add preferred roles, skills, locations, and work modes to see transparent match insights. You can still browse all jobs without setting preferences.</p></div>
                            <button type="button" onClick={() => setPreferencesOpen(true)}>Set preferences</button>
                        </div>
                    )}

                    {(recommendationsError || error) && <div className="candidate-home-inline-error" role="status">{recommendationsError || error} Showing the latest available jobs instead. <button type="button" onClick={() => { onRetry?.(); loadRecommendations() }}>Retry</button></div>}
                    {(recommendationsLoading || loading) && !recommendations.length ? (
                        <div className="candidate-home-job-grid">{Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} />)}</div>
                    ) : visibleRecommendations.length ? (
                        <div className="candidate-home-job-grid">
                            {visibleRecommendations.slice(0, 8).map(item => {
                                const job = item.job || item
                                return <JobCard key={job.id} item={item} saved={savedJobs.some(id => String(id) === String(job.id))} onSave={onToggleSaved} onApply={onApply} />
                            })}
                        </div>
                    ) : (
                        <div className="candidate-home-empty"><strong>No current openings found.</strong><p>Try broadening your preferences or explore all available jobs.</p><Link to="/jobs">Browse all jobs ↗</Link></div>
                    )}
                    <div className="candidate-home-view-all"><Link to="/jobs">Explore all job listings <span>↗</span></Link></div>
                </section>

                <section className="candidate-home-company-section">
                    <div className="candidate-home-section-heading"><div><span className="candidate-home-eyebrow">EMPLOYERS WITH OPEN ROLES</span><h2>Companies hiring now</h2><p>Explore organizations represented in current job listings.</p></div><Link to="/companies">View companies ↗</Link></div>
                    {(recommendationsLoading || loading) && !companyList.length ? <SkeletonLoader variant="companies" count={4} /> : companyList.length ? <div className="candidate-home-company-grid">{companyList.map(company => <Link to={`/companies/${encodeURIComponent(String(company.company || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}`} key={company.company}><span>{initials(company.company)}</span><strong>{company.company}</strong><small>{company.location || 'India'}</small></Link>)}</div> : <div className="candidate-home-empty"><p>Company profiles will appear as employers publish jobs.</p></div>}
                </section>
            </div>

            {feedback && <div className="candidate-home-feedback" role="status"><span>{feedback}</span><button type="button" onClick={() => setFeedback('')} aria-label="Dismiss">×</button></div>}

            {preferencesOpen && (
                <div className="candidate-preferences-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !preferencesSaving) setPreferencesOpen(false) }}>
                    <section className="candidate-preferences-modal" role="dialog" aria-modal="true" aria-labelledby="candidate-quick-preferences-title">
                        <button type="button" className="candidate-preferences-modal-close" onClick={() => !preferencesSaving && setPreferencesOpen(false)} aria-label="Close preferences">×</button>
                        <span className="candidate-home-eyebrow">QUICK PERSONALIZATION</span>
                        <h2 id="candidate-quick-preferences-title">Tune your job feed.</h2>
                        <p>Update the essentials here, or manage salary and experience preferences on the full preferences page.</p>
                        <CandidatePreferencesForm key={JSON.stringify(preferences)} compact initialPreferences={preferences} onSubmit={saveQuickPreferences} submitting={preferencesSaving} submitLabel="Save and refresh my feed" />
                        <Link className="candidate-preferences-full-link" to="/candidate/preferences" onClick={() => setPreferencesOpen(false)}>Open full preferences ↗</Link>
                    </section>
                </div>
            )}
        </main>
    )
}
