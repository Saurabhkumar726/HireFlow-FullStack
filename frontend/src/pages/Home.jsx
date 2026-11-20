import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ShareJob from '../components/ShareJob'
import JobCollectionPicker from '../components/JobCollectionPicker'
import CityLocationAutocomplete from '../components/CityLocationAutocomplete'
import SkeletonLoader from '../components/SkeletonLoader.jsx'
import './Home.css'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

const categoryDefinitions = [
    { name: 'Full Stack Development', keywords: ['full stack', 'fullstack'], icon: 'layers' },
    { name: 'Frontend Development', keywords: ['frontend', 'front-end', 'react', 'angular', 'vue'], icon: 'monitor' },
    { name: 'Backend Development', keywords: ['backend', 'back-end', 'api', 'server'], icon: 'server' },
    { name: '.NET Development', keywords: ['.net', 'dotnet', 'asp.net', 'c#'], icon: 'brackets' },
    { name: 'React Development', keywords: ['react', 'react.js', 'reactjs'], icon: 'atom' },
    { name: 'Software Engineering', keywords: ['software engineer', 'software developer', 'engineer'], icon: 'code' },
    { name: 'Data & Analytics', keywords: ['data', 'analytics', 'analyst', 'machine learning'], icon: 'chart' },
    { name: 'UI/UX Design', keywords: ['ui', 'ux', 'designer', 'figma'], icon: 'pen' },
    { name: 'Sales & Marketing', keywords: ['sales', 'marketing', 'business development'], icon: 'megaphone' },
    { name: 'Internships', keywords: ['intern', 'internship', 'trainee'], icon: 'briefcase' },
]

function slugify(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function jobText(job) {
    return [job?.title, job?.company, job?.description, job?.location, job?.jobType]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
}

function getCompanies(jobs) {
    const map = new Map()
    jobs.forEach((job) => {
        const name = String(job.company || '').trim()
        if (!name) return
        const key = name.toLowerCase()
        const existing = map.get(key) || { name, jobs: [], location: job.location || '', featured: Boolean(job.companyIsFeatured || job.companyProfile?.isFeatured) }
        existing.jobs.push(job)
        if (!existing.location && job.location) existing.location = job.location
        map.set(key, existing)
    })
    return [...map.values()].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.jobs.length - a.jobs.length || a.name.localeCompare(b.name))
}

const skillVocabulary = ['React', 'JavaScript', 'TypeScript', 'C#', '.NET', 'ASP.NET Core', 'SQL', 'PostgreSQL', 'Node.js', 'Python', 'Java', 'HTML', 'CSS', 'Azure', 'AWS', 'Docker', 'Figma']


function CategoryIcon({ icon }) {
    const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
    const drawings = {
        layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
        monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
        server: <><rect x="4" y="4" width="16" height="6" rx="1.5" /><rect x="4" y="14" width="16" height="6" rx="1.5" /><path d="M8 7h.01M8 17h.01m4-10h4m-4 10h4" /></>,
        brackets: <><path d="m8 5-5 7 5 7m8-14 5 7-5 7m-2-15-4 18" /></>,
        atom: <><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(30 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-30 12 12)" /><circle cx="12" cy="12" r="1.4" /></>,
        code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-2-13-4 18" /></>,
        chart: <><path d="M4 19V5m0 14h17" /><rect x="7" y="12" width="3" height="4" rx=".5" /><rect x="13" y="8" width="3" height="8" rx=".5" /><rect x="19" y="5" width="2" height="11" rx=".5" /></>,
        pen: <><path d="m4 20 4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" /><path d="m14.8 6.2 3 3" /></>,
        megaphone: <><path d="M4 13V9l14-5v14L4 13Z" /><path d="m7 14 2 6h4l-2-5m7-7h3" /></>,
        briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-11 0v2h4v-2" /></>,
    }
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>{drawings[icon] || drawings.code}</svg>
}

function CompanyMark({ name, logoUrl }) {
    const [imageFailed, setImageFailed] = useState(false)
    const initials = String(name || 'Company').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'C'
    return <span className="hf-company-mark" aria-hidden="true">{logoUrl && !imageFailed ? <img src={logoUrl} alt="" onError={() => setImageFailed(true)} /> : initials}</span>
}

function formatJobSalary(job) {
    const amount = Number(job?.salary || 0)
    const maximum = Number(job?.salaryMax || 0)
    const mode = String(job?.salaryMode || 'Range').toLowerCase()
    const currency = String(job?.salaryCurrency || 'INR').toUpperCase()
    const period = String(job?.salaryPeriod || 'Monthly').toLowerCase()
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

function Salary({ job }) {
    return <>{formatJobSalary(job)}</>
}

function isAvailableJob(job) {
    if (job?.isActive === false) return false
    if (job?.publicationStatus && String(job.publicationStatus).toLowerCase() !== 'published') return false
    if (job?.applicationDeadlineUtc && new Date(job.applicationDeadlineUtc).getTime() < Date.now()) return false
    return true
}

function JobCard({ job, index, saved, onSave, onApply }) {
    return (
        <article className="hf-job-card" style={{ '--card-index': index }}>
            <div className="hf-job-card-top">
                <div className="hf-job-card-brand"><CompanyMark name={job.company} /><ShareJob job={job} /></div>
                <div className="hf-job-card-save-actions">
                    <button className={`hf-save-button ${saved ? 'is-saved' : ''}`} type="button" onClick={() => onSave(job.id)} aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`} title={saved ? 'Remove saved job' : 'Save job'}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21V4.8Z" /></svg>
                    </button>
                    <JobCollectionPicker jobId={job.id} isSaved={saved} />
                </div>
            </div>
            <div className="hf-job-card-labels"><span>{job.jobType || 'Opportunity'}</span>{String(job.location || '').toLowerCase().includes('remote') && <span className="is-remote">Remote</span>}</div>
            <h3>{job.title || 'Job opportunity'}</h3>
            <p className="hf-job-company">{job.company || 'Company not specified'}</p>
            <div className="hf-job-meta"><span><i aria-hidden="true">⌖</i>{job.location || 'Location not specified'}</span><strong><Salary job={job} /></strong></div>
            <div className="hf-job-card-footer">
                <span>{job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recently posted'}</span>
                <div><Link to={`/jobs/${job.id}`}>View details</Link><button type="button" onClick={() => onApply(job)}>Apply <span aria-hidden="true">↗</span></button></div>
            </div>
        </article>
    )
}

function SkeletonJobCard() {
    return <div className="hf-job-skeleton" aria-hidden="true"><span /><i /><i /><i /></div>
}

export default function Home({ jobs = [], featuredJobs: apiFeaturedJobs = null, loading = false, error = '', onRetry, savedJobs = [], onToggleSaved, onApply, onSignIn, studentMode = false, user }) {
    const navigate = useNavigate()
    const [keyword, setKeyword] = useState('')
    const [place, setPlace] = useState('')
    const [suggestionsOpen, setSuggestionsOpen] = useState(false)
    const [suggestionField, setSuggestionField] = useState('keyword')
    const [suggestionIndex, setSuggestionIndex] = useState(0)
    const [companyFeed, setCompanyFeed] = useState(null)
    const [companyFeedLoading, setCompanyFeedLoading] = useState(true)

    useEffect(() => {
        const controller = new AbortController()
        fetch(`${API_URL}/Companies/featured?count=6`, { signal: controller.signal })
            .then(response => {
                if (!response.ok) throw new Error(`Company request failed (${response.status}).`)
                return response.json()
            })
            .then(data => { if (!controller.signal.aborted && Array.isArray(data)) setCompanyFeed(data) })
            .catch(error => { if (!controller.signal.aborted && error.name !== 'AbortError') setCompanyFeed(null) })
            .finally(() => { if (!controller.signal.aborted) setCompanyFeedLoading(false) })
        return () => controller.abort()
    }, [])

    const featuredJobs = useMemo(() => {
        const source = Array.isArray(apiFeaturedJobs) ? apiFeaturedJobs : jobs
        return [...source].filter(isAvailableJob)
            .sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 6)
    }, [apiFeaturedJobs, jobs])
    const companies = useMemo(() => (Array.isArray(companyFeed) ? companyFeed : getCompanies(jobs)).slice(0, 6), [companyFeed, jobs])
    const keywordSuggestions = useMemo(() => {
        const query = keyword.trim().toLowerCase()
        if (query.length < 2) return []
        const suggestions = []
        const seen = new Set()
        const add = (item) => {
            const key = `${item.type}:${String(item.value).toLowerCase()}`
            if (!seen.has(key) && suggestions.length < 7) { seen.add(key); suggestions.push(item) }
        }
        jobs.filter((job) => String(job.title || '').toLowerCase().includes(query)).slice(0, 3).forEach((job) =>
            add({ type: 'job', value: job.title, detail: `${job.company || 'Company not specified'} · ${job.location || 'Location not specified'}`, jobId: job.id })
        )
        getCompanies(jobs).filter((company) => company.name.toLowerCase().includes(query)).slice(0, 2).forEach((company) =>
            add({ type: 'company', value: company.name, detail: 'Company' })
        )
        skillVocabulary.filter((skill) => skill.toLowerCase().includes(query) && jobs.some((job) => jobText(job).includes(skill.toLowerCase()))).slice(0, 3).forEach((skill) =>
            add({ type: 'skill', value: skill, detail: 'Skill mentioned in current job listings' })
        )
        if (!suggestions.length) add({ type: 'keyword', value: keyword.trim(), detail: 'Search all current listings' })
        return suggestions
    }, [keyword, jobs])
    const currentSuggestions = keywordSuggestions

    function chooseSuggestion(item) {
        setSuggestionsOpen(false)
        setSuggestionIndex(0)
        if (item.type === 'job' && item.jobId !== undefined && item.jobId !== null) {
            navigate(`/jobs/${item.jobId}`)
            return
        }
        if (item.type === 'location') setPlace(item.value)
        else setKeyword(item.value)
    }

    function handleSuggestionKeyDown(event) {
        if (!suggestionsOpen || !currentSuggestions.length) return
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSuggestionIndex((current) => Math.min(current + 1, currentSuggestions.length - 1))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSuggestionIndex((current) => Math.max(current - 1, 0))
        } else if (event.key === 'Escape') {
            setSuggestionsOpen(false)
        } else if (event.key === 'Enter') {
            event.preventDefault()
            chooseSuggestion(currentSuggestions[suggestionIndex] || currentSuggestions[0])
        }
    }

    function submitSearch(event) {
        event.preventDefault()
        const params = new URLSearchParams()
        if (keyword.trim()) params.set('keyword', keyword.trim())
        if (place.trim()) params.set('location', place.trim())
        navigate(`/jobs${params.toString() ? `?${params.toString()}` : ''}`)
    }

    function selectCategory(category) {
        navigate(`/jobs?category=${encodeURIComponent(category)}`)
    }

    const greetingName = user?.fullName?.split(' ')[0] || 'there'

    return (
        <main className={`hf-home ${studentMode ? 'hf-student-home' : ''}`} onClick={(event) => { if (!event.target.closest?.('.hf-search-card')) setSuggestionsOpen(false) }}>
            <section className="hf-hero-section">
                <div className="hf-hero-grid hf-container">
                    <div className="hf-hero-copy">
                        <span className="hf-eyebrow"><i /> {studentMode ? 'YOUR NEXT CAREER MOVE' : 'WHERE CAREERS FIND THEIR FLOW'}</span>
                        <h1>{studentMode ? <>Welcome back, <em>{greetingName}.</em></> : <>Find work that fits <em>your ambition.</em></>}</h1>
                        <p className="hf-hero-description">{studentMode ? 'Explore opportunities selected around your interests, skills, and next career goals.' : 'Discover meaningful opportunities, connect with great companies, and move towards work that feels right for you.'}</p>

                        <form className="hf-search-card" onSubmit={submitSearch}>
                            <div className="hf-search-autocomplete">
                                <label className="hf-search-input-wrap">
                                    <span className="hf-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg></span>
                                    <span><small>WHAT ARE YOU LOOKING FOR?</small><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setSuggestionField('keyword'); setSuggestionIndex(0); setSuggestionsOpen(true) }} onFocus={() => { setSuggestionField('keyword'); setSuggestionsOpen(true) }} onKeyDown={handleSuggestionKeyDown} role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen && suggestionField === 'keyword' && keywordSuggestions.length > 0} aria-controls="hf-keyword-suggestions" placeholder="Job title, skill or company" aria-label="Job title, skill or company" /></span>
                                </label>
                                {suggestionsOpen && suggestionField === 'keyword' && keywordSuggestions.length > 0 && <div className="hf-search-suggestions" id="hf-keyword-suggestions" role="listbox" aria-label="Job and skill suggestions">{keywordSuggestions.map((item, index) => <button key={`${item.type}-${item.value}-${index}`} type="button" role="option" aria-selected={suggestionIndex === index} className={suggestionIndex === index ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(item)}><span className="hf-suggestion-type">{item.type === 'job' ? 'JOB' : item.type === 'company' ? 'COMPANY' : item.type === 'skill' ? 'SKILL' : 'SEARCH'}</span><span><strong>{item.value}</strong><small>{item.detail}</small></span><i>↗</i></button>)}</div>}
                            </div>
                            <span className="hf-search-divider" />
                            <div className="hf-search-autocomplete">
                                <label className="hf-search-input-wrap hf-location-field">
                                    <span className="hf-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M19 10.2c0 5-7 11-7 11s-7-6-7-11a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></svg></span>
                                    <span>
                                        <small>LOCATION</small>
                                        <CityLocationAutocomplete
                                            id="hf-home-location"
                                            value={place}
                                            onChange={setPlace}
                                            onFocus={() => setSuggestionsOpen(false)}
                                            placeholder="City or Remote"
                                            ariaLabel="Job location"
                                        />
                                    </span>
                                </label>
                            </div>
                            <button type="submit" className="hf-search-submit">Search Jobs <span aria-hidden="true">↗</span></button>
                        </form>
                        <div className="hf-hero-hints"><span>Popular:</span>{['React Developer', '.NET', 'Remote', 'Internship'].map((item) => <button type="button" key={item} onClick={() => { setKeyword(item); navigate(`/jobs?keyword=${encodeURIComponent(item)}`) }}>{item}</button>)}</div>
                        <div className="hf-hero-trust"><span className="hf-trust-icon"><svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7" /></svg></span><span>One place to explore roles, companies, and career possibilities.</span></div>
                    </div>

                    <div className="hf-hero-preview" aria-label="Current opportunities on HireFlow">
                        <div className="hf-preview-orb hf-preview-orb-one" /><div className="hf-preview-orb hf-preview-orb-two" />
                        <div className="hf-preview-heading"><span>OPPORTUNITIES TO EXPLORE</span><span className="hf-live-indicator"><i /> LIVE LISTINGS</span></div>
                        {loading ? (
                            <div className="hf-preview-stack"><SkeletonJobCard /><SkeletonJobCard /></div>
                        ) : featuredJobs.length > 0 ? (
                            <div className="hf-preview-stack">
                                {featuredJobs.slice(0, 2).map((job, index) => (
                                    <Link to={`/jobs/${job.id}`} className={`hf-preview-job hf-preview-job-${index + 1}`} key={job.id}>
                                        <div className="hf-preview-job-head"><CompanyMark name={job.company} /><span>{job.jobType || 'Opportunity'}</span></div>
                                        <strong>{job.title}</strong>
                                        <small>{job.company} · {job.location || 'Location flexible'}</small>
                                        <div className="hf-preview-job-foot"><b><Salary job={job} /></b><span>View role ↗</span></div>
                                    </Link>
                                ))}
                                <span className="hf-preview-floating-note"><i>✦</i> New opportunities, one place</span>
                            </div>
                        ) : (
                            <div className="hf-preview-empty"><span>↗</span><strong>Your next opportunity starts here.</strong><p>New job listings will appear in this space when they are available.</p></div>
                        )}
                        <Link to="/jobs" className="hf-preview-all">Explore all jobs <span>↗</span></Link>
                    </div>
                </div>
                <div className="hf-hero-bottom hf-container"><span>DISCOVER</span><i /><span>CONNECT</span><i /><span>GROW</span></div>
            </section>

            <section className="hf-category-section hf-container" aria-labelledby="hf-category-heading">
                <div className="hf-section-heading"><div><span className="hf-eyebrow">FIND YOUR DIRECTION</span><h2 id="hf-category-heading">Explore by <em>category.</em></h2><p>Start with the kind of opportunity you want to grow into.</p></div><Link to="/jobs">Browse all jobs <span>↗</span></Link></div>
                <div className="hf-category-grid">
                    {categoryDefinitions.map((category) => {
                        const count = jobs.filter((job) => category.keywords.some((word) => jobText(job).includes(word))).length
                        return <button type="button" className="hf-category-card" key={category.name} onClick={() => selectCategory(category.name)}>
                            <span className="hf-category-glyph"><CategoryIcon icon={category.icon} /></span><strong>{category.name}</strong><small>{count > 0 ? `${count} ${count === 1 ? 'opening' : 'openings'}` : 'No current openings'}</small><span className="hf-category-arrow" aria-hidden="true">↗</span>
                        </button>
                    })}
                </div>
            </section>

            <section className="hf-featured-section" aria-labelledby="hf-featured-heading">
                <div className="hf-container">
                    <div className="hf-section-heading"><div><span className="hf-eyebrow">YOUR NEXT OPPORTUNITY</span><h2 id="hf-featured-heading">Featured <em>jobs.</em></h2><p>Explore current opportunities from the HireFlow job feed.</p></div><Link to="/jobs">View all jobs <span>↗</span></Link></div>
                    {error ? (
                        <div className="hf-state-card" role="alert"><span className="hf-state-icon">!</span><h3>We couldn't load the latest jobs.</h3><p>{error}</p><button type="button" onClick={onRetry}>Try again</button></div>
                    ) : loading ? (
                        <div className="hf-jobs-grid">{Array.from({ length: 6 }, (_, index) => <SkeletonJobCard key={index} />)}</div>
                    ) : featuredJobs.length ? (
                        <div className="hf-jobs-grid">{featuredJobs.map((job, index) => <JobCard key={job.id} job={job} index={index} saved={savedJobs.some((id) => String(id) === String(job.id))} onSave={onToggleSaved} onApply={onApply} />)}</div>
                    ) : (
                        <div className="hf-state-card"><span className="hf-state-icon">⌕</span><h3>No job listings yet</h3><p>When employers publish opportunities, they will appear here.</p><button type="button" onClick={onRetry}>Refresh listings</button></div>
                    )}
                </div>
            </section>

            <section className="hf-company-section hf-container" aria-labelledby="hf-company-heading">
                <div className="hf-section-heading"><div><span className="hf-eyebrow">COMPANIES WITH LISTINGS</span><h2 id="hf-company-heading">See who's <em>hiring.</em></h2><p>Discover companies represented in current job listings.</p></div><Link to="/companies">View all companies <span>↗</span></Link></div>
                {companyFeedLoading && !companies.length ? (
                    <SkeletonLoader variant="companies" count={6} />
                ) : companies.length ? (
                    <>
                        <div className="hf-company-ticker" aria-label="Companies with current job listings">
                            <div className="hf-company-ticker-track">{[...companies, ...companies].map((company, index) => <span className="hf-ticker-company" key={`${company.name}-${index}`}><CompanyMark name={company.name} logoUrl={company.logoUrl} /><strong>{company.name}</strong></span>)}</div>
                        </div>
                        <div className="hf-company-grid">
                            {companies.map((company) => <article className="hf-company-card" key={company.id || company.slug || company.name}>
                                <CompanyMark name={company.name} logoUrl={company.logoUrl} /><div className="hf-company-card-copy"><strong>{company.name}</strong><span>{company.location || 'Location not specified'}</span></div><b>{Number(company.activeJobsCount ?? company.jobs?.length ?? 0)} {Number(company.activeJobsCount ?? company.jobs?.length ?? 0) === 1 ? 'job' : 'jobs'}</b><Link to={`/companies/${company.slug || slugify(company.name)}`} aria-label={`View ${company.name} company profile`}>↗</Link>
                            </article>)}
                        </div>
                    </>
                ) : <div className="hf-state-card hf-company-empty"><h3>Company listings will appear here</h3><p>As employers publish roles, their companies will be discoverable on HireFlow.</p></div>}
            </section>

            <section className="hf-how-section" aria-labelledby="hf-how-heading">
                <div className="hf-container"><div className="hf-section-heading"><div><span className="hf-eyebrow">A CLEARER WAY FORWARD</span><h2 id="hf-how-heading">Your next step, <em>made simpler.</em></h2><p>Move from discovery to application in a few clear steps.</p></div></div>
                    <div className="hf-steps-grid"><article><span>01</span><div className="hf-step-icon">⌕</div><h3>Find opportunities</h3><p>Search current roles by title, skill, company, or location.</p></article><article><span>02</span><div className="hf-step-icon">↗</div><h3>Explore and apply</h3><p>Review the details, compare roles, and apply with your profile.</p></article><article><span>03</span><div className="hf-step-icon">✦</div><h3>Move forward</h3><p>Keep your applications organized as you progress in your search.</p></article></div>
                </div>
            </section>

            <section className="hf-insights-section hf-container" aria-label="HireFlow job marketplace activity">
                <div className="hf-insight-copy"><span className="hf-eyebrow">A MARKETPLACE THAT MOVES WITH YOU</span><h2>More clarity at every step of your <em>career search.</em></h2><p>Explore opportunities, compare employers, and keep your next move organized in one place.</p><Link to="/jobs" className="hf-text-link">Start exploring <span>↗</span></Link></div>
                <div className="hf-insight-metrics"><div><strong>{loading ? '—' : jobs.length.toLocaleString('en-IN')}</strong><span>Job listings in the current feed</span></div><div><strong>{loading ? '—' : companies.length.toLocaleString('en-IN')}</strong><span>Companies represented in this feed</span></div><p>Counts reflect the job data currently returned by HireFlow. Candidate and hiring success statistics will be shown when verified platform data is available.</p></div>
            </section>

            {!studentMode && (
                <section className="hf-recruiter-cta">
                    <div className="hf-container hf-recruiter-inner"><div><span className="hf-eyebrow">FOR EMPLOYERS</span><h2>Find the talent that moves your business <em>forward.</em></h2><p>Bring your hiring workflow into one place and connect with people ready for their next opportunity.</p></div><div className="hf-recruiter-actions"><button type="button" onClick={() => onSignIn?.('HR')}>Post a Job <span>↗</span></button><Link to="/about">Explore HireFlow</Link></div></div>
                </section>
            )}
        </main>
    )
}
