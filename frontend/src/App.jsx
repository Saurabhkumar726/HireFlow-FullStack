
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Footer from './components/Footer'
import JobDetails from './components/JobDetails'

const API_URL = 'http://localhost:5116/api'

const formatSalary = (salary) => {
    const amount = Number(salary)
    return amount > 0
        ? `₹${amount.toLocaleString('en-IN')}`
        : 'Salary not disclosed'
}

function App() {
    const [jobs, setJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [location, setLocation] = useState('')
    const [jobType, setJobType] = useState('All')
    const [sortBy, setSortBy] = useState('newest')
    const [savedJobs, setSavedJobs] = useState([])
    const [selectedJob, setSelectedJob] = useState(null)
    const [detailJob, setDetailJob] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [applicationMessage, setApplicationMessage] = useState('')
    const [mobileMenu, setMobileMenu] = useState(false)
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem('hireflow-theme') || 'light'
        } catch {
            return 'light'
        }
    })
    const [form, setForm] = useState({
        applicantName: '',
        applicantEmail: '',
        resumeUrl: '',
        coverLetter: '',
    })

    async function loadJobs() {
        setLoading(true)
        setError('')

        try {
            const response = await fetch(`${API_URL}/Jobs`)
            if (!response.ok) throw new Error('Unable to load jobs.')
            const data = await response.json()
            setJobs(data)
        } catch (err) {
            console.error(err)
            setError('We could not connect to the job server. Make sure the .NET API is running.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()

        async function fetchJobs() {
            setLoading(true)
            setError('')

            try {
                const response = await fetch(`${API_URL}/Jobs`, {
                    signal: controller.signal,
                })

                if (!response.ok) {
                    throw new Error('Unable to load jobs.')
                }

                const data = await response.json()
                setJobs(data)
            } catch (err) {
                if (err.name === 'AbortError') return

                console.error(err)
                setError(
                    'We could not connect to the job server. Make sure the .NET API is running.'
                )
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            }
        }

        fetchJobs()

        return () => controller.abort()
    }, [])

    useEffect(() => {
        document.documentElement.dataset.theme = theme
        try {
            localStorage.setItem('hireflow-theme', theme)
        } catch {
            // Theme still works for the current session if storage is unavailable.
        }
    }, [theme])

    const filteredJobs = useMemo(() => {
        const query = search.trim().toLowerCase()
        const place = location.trim().toLowerCase()

        const result = jobs.filter((job) => {
            const matchesSearch =
                !query ||
                [job.title, job.company, job.description, job.location]
                    .some((value) => String(value || '').toLowerCase().includes(query))

            const matchesLocation =
                !place || String(job.location || '').toLowerCase().includes(place)

            const matchesType =
                jobType === 'All' ||
                String(job.jobType || '').toLowerCase() === jobType.toLowerCase()

            return matchesSearch && matchesLocation && matchesType
        })

        return [...result].sort((a, b) => {
            if (sortBy === 'salary') return Number(b.salary) - Number(a.salary)
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        })
    }, [jobs, search, location, jobType, sortBy])

    function toggleSaved(id) {
        setSavedJobs((current) =>
            current.includes(id)
                ? current.filter((jobId) => jobId !== id)
                : [...current, id]
        )
    }

    function openApplication(job) {
        setSelectedJob(job)
        setApplicationMessage('')
        setForm({
            applicantName: '',
            applicantEmail: '',
            resumeUrl: '',
            coverLetter: '',
        })
    }

    async function submitApplication(event) {
        event.preventDefault()
        if (!selectedJob) return

        setSubmitting(true)
        setApplicationMessage('')

        try {
            const response = await fetch(`${API_URL}/JobApplications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId: selectedJob.id,
                    applicantName: form.applicantName.trim(),
                    applicantEmail: form.applicantEmail.trim(),
                    resumeUrl: form.resumeUrl.trim(),
                    coverLetter: form.coverLetter.trim(),
                    status: 'Pending',
                }),
            })

            if (!response.ok) {
                const message = await response.text()
                throw new Error(message || 'Application submission failed.')
            }

            setApplicationMessage('success')
        } catch (err) {
            console.error(err)
            setApplicationMessage(
                'Could not submit your application. Check the API connection and try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="site-shell">
            <div className="announcement">
                <span className="announcement-dot" />
                Your next career move starts here
                <span className="announcement-arrow">↗</span>
            </div>

            <header className="navbar">
                <a className="brand" href="#home" aria-label="HireFlow home">
                    <span className="brand-mark">H</span>
                    <span>hire<span className="brand-accent">flow</span></span>
                </a>

                <div className="nav-actions">
                    <button
                        className="theme-toggle"
                        type="button"
                        onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
                        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
                        <span className="theme-toggle-label">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
                    </button>
                    <button
                        className="mobile-toggle"
                        onClick={() => setMobileMenu(!mobileMenu)}
                        aria-label="Toggle navigation"
                        aria-expanded={mobileMenu}
                    >
                        {mobileMenu ? '✕' : '☰'}
                    </button>
                </div>

                <nav className={`nav-links ${mobileMenu ? 'nav-open' : ''}`}>
                    <a href="#jobs" onClick={() => setMobileMenu(false)}>Find jobs</a>
                    <a href="#categories" onClick={() => setMobileMenu(false)}>Categories</a>
                    <a href="#about" onClick={() => setMobileMenu(false)}>About</a>
                    <a className="nav-signin" href="#jobs" onClick={() => setMobileMenu(false)}>Explore jobs</a>
                    <a className="nav-cta" href="#jobs" onClick={() => setMobileMenu(false)}>Get started <span>↗</span></a>
                </nav>
            </header>

            {detailJob ? (
                <JobDetails
                    job={detailJob}
                    onBack={() => {
                        setDetailJob(null)
                        window.setTimeout(() => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' }), 0)
                    }}
                    onApply={() => openApplication(detailJob)}
                    formatSalary={formatSalary}
                />
            ) : (
                <main>
                    <section className="hero" id="home">
                        <div className="hero-glow hero-glow-one" />
                        <div className="hero-glow hero-glow-two" />

                        <div className="hero-content">
                            <div className="hero-badge">
                                <span className="badge-sparkle">✳</span>
                                A better way to find your next role
                            </div>

                            <h1>
                                Work that fits
                                <br />
                                your <span className="gradient-text">ambition.</span>
                            </h1>

                            <p className="hero-description">
                                Discover meaningful opportunities, connect with great companies,
                                and build a career you're excited about.
                            </p>

                            <div className="hero-actions">
                                <a className="button-primary" href="#jobs">Explore opportunities <span>↗</span></a>
                                <a className="button-secondary" href="#about"><span className="play-icon">▶</span> How it works</a>
                            </div>

                            <div className="hero-proof">
                                <div className="avatar-stack" aria-hidden="true">
                                    <span>A</span><span>R</span><span>S</span><span>+</span>
                                </div>
                                <div>
                                    <div className="proof-stars">★★★★★</div>
                                    <p>Built for people ready to grow</p>
                                </div>
                            </div>
                        </div>

                        <div className="hero-visual" aria-hidden="true">
                            <div className="visual-orbit orbit-one" />
                            <div className="visual-orbit orbit-two" />
                            <div className="visual-center">
                                <span className="center-symbol">H</span>
                                <span className="center-caption">YOUR NEXT CHAPTER</span>
                            </div>
                            <div className="float-card float-card-top">
                                <span className="float-icon float-icon-purple">↗</span>
                                <div><strong>New possibilities</strong><small>Start exploring today</small></div>
                            </div>
                            <div className="float-card float-card-bottom">
                                <span className="float-icon float-icon-green">✓</span>
                                <div><strong>Career growth</strong><small>One opportunity at a time</small></div>
                            </div>
                            <div className="visual-spark spark-one">✳</div>
                            <div className="visual-spark spark-two">✦</div>
                        </div>

                        <div className="hero-bottom-label">
                            <span>DISCOVER</span><i /> <span>CONNECT</span><i /> <span>GROW</span>
                        </div>
                    </section>

                    <section className="search-section" aria-label="Search jobs">
                        <div className="search-panel">
                            <label className="search-field">
                                <span className="field-icon">⌕</span>
                                <span className="field-content">
                                    <span className="field-label">What are you looking for?</span>
                                    <input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Job title, company or keyword"
                                    />
                                </span>
                            </label>

                            <div className="search-divider" />

                            <label className="search-field location-field">
                                <span className="field-icon">⌖</span>
                                <span className="field-content">
                                    <span className="field-label">Where?</span>
                                    <input
                                        value={location}
                                        onChange={(event) => setLocation(event.target.value)}
                                        placeholder="City or remote"
                                    />
                                </span>
                            </label>

                            <button className="search-button" onClick={() => {
                                document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' })
                            }}>
                                Search jobs <span>→</span>
                            </button>
                        </div>
                        <p className="search-hint">
                            <span>✦</span> Try “Developer”, “Remote” or “Full-time”
                        </p>
                    </section>

                    <section className="trust-strip" aria-label="HireFlow benefits">
                        <div><span className="trust-icon">◎</span><span>Opportunities that matter</span></div>
                        <div><span className="trust-icon">↗</span><span>Simple job discovery</span></div>
                        <div><span className="trust-icon">✳</span><span>Built for your next step</span></div>
                    </section>

                    <section className="categories-section section-wrap" id="categories">
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">FIND YOUR DIRECTION</p>
                                <h2>Explore by <span>category.</span></h2>
                                <p className="section-description">Start with the kind of opportunity you're looking for.</p>
                            </div>
                            <a className="text-link" href="#jobs">Browse all jobs <span>↗</span></a>
                        </div>

                        <div className="category-grid">
                            {[
                                { name: 'All opportunities', type: 'All', symbol: '✳', color: 'lavender' },
                                { name: 'Full-time', type: 'Full-time', symbol: '▣', color: 'mint' },
                                { name: 'Part-time', type: 'Part-time', symbol: '◷', color: 'peach' },
                                { name: 'Internships', type: 'Internship', symbol: '✦', color: 'blue' },
                            ].map((category) => (
                                <button
                                    key={category.name}
                                    className={`category-card ${jobType === category.type ? 'category-active' : ''}`}
                                    onClick={() => {
                                        setJobType(category.type)
                                        document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' })
                                    }}
                                >
                                    <span className={`category-symbol ${category.color}`}>{category.symbol}</span>
                                    <span className="category-name">{category.name}</span>
                                    <span className="category-arrow">↗</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="jobs-section" id="jobs">
                        <div className="section-wrap">
                            <div className="section-heading jobs-heading">
                                <div>
                                    <p className="eyebrow">YOUR NEXT OPPORTUNITY</p>
                                    <h2>Featured <span>jobs.</span></h2>
                                    <p className="section-description">
                                        Real opportunities, loaded directly from HireFlow.
                                    </p>
                                </div>
                                <div className="jobs-count">
                                    <strong>{loading ? '—' : filteredJobs.length.toString().padStart(2, '0')}</strong>
                                    <span>{filteredJobs.length === 1 ? 'open position' : 'open positions'}</span>
                                </div>
                            </div>

                            <div className="filter-toolbar">
                                <div className="filter-chips">
                                    {['All', 'Full-time', 'Part-time', 'Internship'].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setJobType(type)}
                                            className={`filter-chip ${jobType === type ? 'filter-chip-active' : ''}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                                <label className="sort-select">
                                    <span>Sort by</span>
                                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                                        <option value="newest">Most recent</option>
                                        <option value="salary">Highest salary</option>
                                    </select>
                                </label>
                            </div>

                            {loading && (
                                <div className="status-panel">
                                    <div className="loading-spinner" />
                                    <p>Finding opportunities for you...</p>
                                </div>
                            )}

                            {error && (
                                <div className="status-panel error-panel">
                                    <span className="status-symbol">!</span>
                                    <h3>We couldn't load the jobs</h3>
                                    <p>{error}</p>
                                    <button className="button-primary" onClick={loadJobs}>Try again ↻</button>
                                </div>
                            )}

                            {!loading && !error && filteredJobs.length === 0 && (
                                <div className="status-panel">
                                    <span className="status-symbol">⌕</span>
                                    <h3>No matching jobs found</h3>
                                    <p>Try another keyword or reset your filters.</p>
                                    <button className="button-secondary" onClick={() => {
                                        setSearch('')
                                        setLocation('')
                                        setJobType('All')
                                    }}>Clear filters</button>
                                </div>
                            )}

                            {!loading && !error && filteredJobs.length > 0 && (
                                <div className="jobs-grid">
                                    {filteredJobs.map((job, index) => (
                                        <article className="job-card" key={job.id}>
                                            <div className="job-card-head">
                                                <div className={`company-avatar company-color-${index % 4}`}>
                                                    {job.company?.trim().charAt(0).toUpperCase() || 'H'}
                                                </div>
                                                <button
                                                    className={`save-button ${savedJobs.includes(job.id) ? 'is-saved' : ''}`}
                                                    onClick={() => toggleSaved(job.id)}
                                                    aria-label={savedJobs.includes(job.id) ? 'Unsave job' : 'Save job'}
                                                    title={savedJobs.includes(job.id) ? 'Unsave job' : 'Save job'}
                                                >
                                                    {savedJobs.includes(job.id) ? '♥' : '♡'}
                                                </button>
                                            </div>

                                            <div className="job-card-labels">
                                                <span className="job-type-label">{job.jobType || 'Opportunity'}</span>
                                                {job.location?.toLowerCase().includes('remote') && (
                                                    <span className="remote-label">Remote</span>
                                                )}
                                            </div>

                                            <h3 className="job-title">{job.title}</h3>
                                            <p className="job-company">{job.company}</p>

                                            <p className="job-summary">
                                                {job.description || 'Explore this opportunity and take the next step in your career.'}
                                            </p>

                                            <div className="job-card-meta">
                                                <span>⌖ {job.location || 'Location flexible'}</span>
                                                <strong>{formatSalary(job.salary)}{Number(job.salary) > 0 ? <small> / month</small> : null}</strong>
                                            </div>

                                            <div className="job-card-footer">
                                                <span className="job-posted">
                                                    {job.createdAt
                                                        ? new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                        : 'Recently posted'}
                                                </span>
                                                <div className="job-card-actions">
                                                    <button className="details-link" onClick={() => {
                                                        setDetailJob(job)
                                                        window.scrollTo({ top: 0, behavior: 'smooth' })
                                                    }}>
                                                        View details
                                                    </button>
                                                    <button className="apply-link" onClick={() => openApplication(job)}>
                                                        Apply now <span>↗</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}

                            <div className="jobs-bottom">
                                <span>Showing {filteredJobs.length} of {jobs.length} opportunities</span>
                                <button onClick={loadJobs} className="refresh-link">Refresh listings ↻</button>
                            </div>
                        </div>
                    </section>

                    <section className="about-section section-wrap" id="about">
                        <div className="about-visual">
                            <div className="about-card about-card-main">
                                <span className="about-star">✳</span>
                                <p className="about-card-label">YOUR CAREER</p>
                                <h3>Small steps.<br />Big possibilities.</h3>
                                <div className="about-progress"><span /></div>
                                <p className="about-progress-label">Your next chapter starts with one application.</p>
                            </div>
                            <div className="about-mini-card">
                                <span>↗</span><div><strong>Keep moving forward</strong><small>Your next opportunity awaits</small></div>
                            </div>
                        </div>
                        <div className="about-copy">
                            <p className="eyebrow">MORE THAN A JOB SEARCH</p>
                            <h2>Your future deserves <span>a better starting point.</span></h2>
                            <p className="section-description">
                                Finding the right role shouldn't feel complicated. HireFlow
                                brings opportunities into one place so you can focus on what
                                matters: finding work that matches your goals.
                            </p>
                            <a href="#jobs" className="button-primary">Find your opportunity <span>↗</span></a>
                            <div className="about-points">
                                <div><span>✓</span> Explore available roles</div>
                                <div><span>✓</span> Compare opportunities at a glance</div>
                                <div><span>✓</span> Apply directly through HireFlow</div>
                            </div>
                        </div>
                    </section>

                    <section className="final-cta">
                        <div className="cta-decoration cta-decoration-one" />
                        <div className="cta-decoration cta-decoration-two" />
                        <p className="eyebrow">YOUR NEXT CHAPTER STARTS NOW</p>
                        <h2>Ready to find your <span>next move?</span></h2>
                        <p>Explore the opportunities waiting for you.</p>
                        <a href="#jobs" className="cta-button">Explore open positions <span>↗</span></a>
                    </section>
                </main>
            )}

            <Footer />

            {selectedJob && (
                <div className="modal-backdrop" onClick={() => !submitting && setSelectedJob(null)}>
                    <div className="application-modal" role="dialog" aria-modal="true" aria-labelledby="application-title" onClick={(event) => event.stopPropagation()}>
                        <button className="modal-close" onClick={() => setSelectedJob(null)} disabled={submitting} aria-label="Close">×</button>

                        {applicationMessage === 'success' ? (
                            <div className="application-success">
                                <div className="success-icon">✓</div>
                                <p className="eyebrow">APPLICATION SUBMITTED</p>
                                <h2>You're one step closer.</h2>
                                <p>Your application for <strong>{selectedJob.title}</strong> at {selectedJob.company} has been received.</p>
                                <button className="button-primary" onClick={() => setSelectedJob(null)}>Done</button>
                            </div>
                        ) : (
                            <>
                                <p className="eyebrow">TAKE THE NEXT STEP</p>
                                <h2 id="application-title">Apply for this role.</h2>
                                <p className="modal-job-name">{selectedJob.title} <span>at {selectedJob.company}</span></p>

                                <form className="application-form" onSubmit={submitApplication}>
                                    <label>
                                        Full name
                                        <input required maxLength={100} value={form.applicantName} onChange={(event) => setForm({ ...form, applicantName: event.target.value })} placeholder="Your full name" />
                                    </label>
                                    <label>
                                        Email address
                                        <input type="email" required maxLength={254} value={form.applicantEmail} onChange={(event) => setForm({ ...form, applicantEmail: event.target.value })} placeholder="you@example.com" />
                                    </label>
                                    <label>
                                        Resume URL
                                        <input type="url" required maxLength={2048} value={form.resumeUrl} onChange={(event) => setForm({ ...form, resumeUrl: event.target.value })} placeholder="https://your-resume-link.com" />
                                        <small>Paste a shareable link to your resume.</small>
                                    </label>
                                    <label>
                                        Cover letter <span className="optional-label">Optional</span>
                                        <textarea maxLength={3000} rows={4} value={form.coverLetter} onChange={(event) => setForm({ ...form, coverLetter: event.target.value })} placeholder="Tell the employer why you're interested..." />
                                    </label>

                                    {applicationMessage && <p className="form-error">{applicationMessage}</p>}

                                    <button className="button-primary submit-application" disabled={submitting}>
                                        {submitting ? 'Submitting...' : 'Submit application →'}
                                    </button>
                                    <p className="form-privacy">Your details will be sent to HireFlow for this application.</p>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
