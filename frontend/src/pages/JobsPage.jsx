import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './JobsPage.css'
import JobCollectionPicker from '../components/JobCollectionPicker'
import ShareJob from '../components/ShareJob'
import CityLocationAutocomplete from '../components/CityLocationAutocomplete'
import SkeletonLoader from '../components/SkeletonLoader.jsx'

const PAGE_SIZE = 12
const LAST_SEARCH_KEY = 'hireflow-last-job-search'
const SEARCH_KEYS = ['keyword', 'location', 'category', 'jobType', 'workMode', 'company', 'datePosted', 'minSalary', 'maxSalary', 'experience', 'sort']
const CATEGORY_TERMS = {
    'Full Stack Development': ['full stack', 'fullstack'],
    'Frontend Development': ['frontend', 'front-end', 'react', 'angular', 'vue'],
    'Backend Development': ['backend', 'back-end', 'api', 'server'],
    '.NET Development': ['.net', 'dotnet', 'asp.net', 'c#'],
    'React Development': ['react', 'react.js', 'reactjs'],
    'Software Engineering': ['software engineer', 'software developer', 'engineer'],
    'Data & Analytics': ['data', 'analytics', 'analyst', 'machine learning'],
    'UI/UX Design': ['ui', 'ux', 'designer', 'figma'],
    'Sales & Marketing': ['sales', 'marketing', 'business development'],
    Internships: ['intern', 'internship', 'trainee'],
}
const EXPERIENCE_OPTIONS = [
    { value: '0-1', label: '0–1 years', min: 0, max: 1 },
    { value: '1-3', label: '1–3 years', min: 1, max: 3 },
    { value: '3-5', label: '3–5 years', min: 3, max: 5 },
    { value: '5+', label: '5+ years', min: 5, max: Infinity },
]

function textOf(job) {
    return [job.title, job.company, job.description, job.location, job.jobType, job.category, job.requirements]
        .map((item) => Array.isArray(item) ? item.join(' ') : String(item || '').toLowerCase())
        .join(' ')
        .toLowerCase()
}

function matchesCategory(job, category) {
    if (!category) return true
    const explicit = String(job.category || '').toLowerCase()
    if (explicit && (explicit === category.toLowerCase() || explicit.includes(category.toLowerCase()))) return true
    const terms = CATEGORY_TERMS[category] || [category.toLowerCase()]
    const text = textOf(job)
    return terms.some((term) => text.includes(term))
}

function currencyFormat(value, currency = 'INR') {
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount <= 0) return ''
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: String(currency || 'INR').toUpperCase(),
            maximumFractionDigits: 0,
        }).format(amount)
    } catch {
        return `${String(currency || 'INR').toUpperCase()} ${amount.toLocaleString('en-IN')}`
    }
}

function salaryText(job) {
    const mode = String(job.salaryMode || 'Range').toLowerCase()
    const salary = Number(job.salary || 0)
    const salaryMax = Number(job.salaryMax || 0)
    const currency = job.salaryCurrency || 'INR'
    const period = String(job.salaryPeriod || 'Monthly').toLowerCase()

    if (mode === 'negotiable') return 'Salary negotiable'
    if (mode === 'notdisclosed' || salary <= 0) return 'Salary not disclosed'
    if (mode === 'startingat') return `From ${currencyFormat(salary, currency)} / ${period}`
    if (salaryMax > salary) return `${currencyFormat(salary, currency)} – ${currencyFormat(salaryMax, currency)} / ${period}`
    return `${currencyFormat(salary, currency)} / ${period}`
}

function salaryMonthlyEquivalent(job, amountOverride = null) {
    const amount = Number(amountOverride ?? job.salary ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) return 0
    const period = String(job.salaryPeriod || 'Monthly').toLowerCase()
    if (period === 'yearly') return amount / 12
    if (period === 'weekly') return amount * 52 / 12
    if (period === 'hourly') return amount * 40 * 52 / 12
    return amount
}

function salaryLower(job) {
    return salaryMonthlyEquivalent(job, job.salary)
}

function salaryUpper(job) {
    return salaryMonthlyEquivalent(job, job.salaryMax ?? job.salary)
}

function companyInitials(name) {
    return String(name || 'Company').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'C'
}

function workModeOf(job) {
    const supplied = String(job.workMode || '').trim()
    if (['Remote', 'Hybrid', 'On-site'].some((value) => value.toLowerCase() === supplied.toLowerCase())) {
        return ['Remote', 'Hybrid', 'On-site'].find((value) => value.toLowerCase() === supplied.toLowerCase())
    }
    const text = `${job.location || ''} ${job.description || ''}`.toLowerCase()
    if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) return 'Remote'
    if (text.includes('hybrid')) return 'Hybrid'
    if (text.includes('on-site') || text.includes('onsite')) return 'On-site'
    return 'Not specified'
}

function experienceLabel(job) {
    const min = job.minimumExperienceYears
    const max = job.maximumExperienceYears
    if (min != null && max != null) return `${min}–${max} years`
    if (min != null) return `${min}+ years`
    return job.experienceLevel || 'Experience not specified'
}

function matchesExperience(job, selected) {
    if (!selected) return true
    const option = EXPERIENCE_OPTIONS.find((item) => item.value === selected)
    if (!option) return true
    const min = Number(job.minimumExperienceYears)
    const max = Number(job.maximumExperienceYears)
    const hasStructuredRange = job.minimumExperienceYears != null || job.maximumExperienceYears != null
    if (hasStructuredRange) {
        const jobMin = Number.isFinite(min) ? min : 0
        const jobMax = Number.isFinite(max) ? max : Infinity
        return jobMax >= option.min && jobMin <= option.max
    }
    const level = String(job.experienceLevel || '').toLowerCase()
    if (!level) return false
    if (option.value === '0-1') return /fresh|entry|intern|graduate|0.?1/.test(level)
    if (option.value === '1-3') return /junior|1.?3|early/.test(level)
    if (option.value === '3-5') return /mid|3.?5|intermediate/.test(level)
    return /senior|lead|expert|5\+|5 or more/.test(level)
}

function isPubliclyAvailable(job, now) {
    if (job.isActive === false) return false
    if (job.publicationStatus && String(job.publicationStatus).toLowerCase() !== 'published') return false
    if (job.applicationDeadlineUtc && new Date(job.applicationDeadlineUtc).getTime() < now) return false
    return true
}

function FilterGroup({ label, children }) {
    return <fieldset className="hf-filter-group"><legend>{label}</legend>{children}</fieldset>
}

export default function JobsPage({ jobs = [], loading = false, error = '', onRetry, savedJobs = [], onToggleSaved, onApply }) {
    const [searchParams, setSearchParams] = useSearchParams()
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
    const [draftFilters, setDraftFilters] = useState(null)
    const [currentTime] = useState(() => Date.now())
    const filters = {
        keyword: searchParams.get('keyword') || '',
        location: searchParams.get('location') || '',
        category: searchParams.get('category') || '',
        jobType: searchParams.get('jobType') || '',
        workMode: searchParams.get('workMode') || '',
        company: searchParams.get('company') || '',
        datePosted: searchParams.get('datePosted') || '',
        minSalary: searchParams.get('minSalary') || '',
        maxSalary: searchParams.get('maxSalary') || '',
        experience: searchParams.get('experience') || '',
        sort: searchParams.get('sort') || 'newest',
    }

    // The URL is the source of truth for filters. Restore the last search into
    // the URL only when the visitor opens /jobs without explicit search criteria.
    useEffect(() => {
        const hasExplicitSearch = SEARCH_KEYS.some((key) => searchParams.has(key))
        if (hasExplicitSearch) return
        try {
            const saved = JSON.parse(localStorage.getItem(LAST_SEARCH_KEY) || 'null')
            if (!saved || typeof saved !== 'object') return
            const restored = {
                keyword: String(saved.keyword || ''),
                location: String(saved.location || ''),
                category: String(saved.category || ''),
                jobType: String(saved.jobType || ''),
                workMode: String(saved.workMode || ''),
                company: String(saved.company || ''),
                datePosted: String(saved.datePosted || ''),
                minSalary: String(saved.minSalary || ''),
                maxSalary: String(saved.maxSalary || ''),
                experience: String(saved.experience || ''),
                sort: String(saved.sort || 'newest'),
            }
            const hasSavedCriteria = Object.entries(restored).some(([key, value]) => value && !(key === 'sort' && value === 'newest'))
            if (!hasSavedCriteria) return
            const params = new URLSearchParams()
            Object.entries(restored).forEach(([key, value]) => {
                if (value && !(key === 'sort' && value === 'newest')) params.set(key, value)
            })
            setSearchParams(params, { replace: true })
        } catch {
            // Ignore unavailable or invalid saved-search data.
        }
    }, [searchParams, setSearchParams])

    const availableJobs = useMemo(() => jobs.filter((job) => isPubliclyAvailable(job, currentTime)), [jobs, currentTime])
    const companies = useMemo(() => [...new Set(availableJobs.map((job) => String(job.company || '').trim()).filter(Boolean))].sort(), [availableJobs])
    const jobTypes = useMemo(() => [...new Set(availableJobs.map((job) => String(job.jobType || '').trim()).filter(Boolean))].sort(), [availableJobs])
    const activeFilters = mobileFiltersOpen && draftFilters ? draftFilters : filters

    const filteredJobs = useMemo(() => {
        const list = availableJobs.filter((job) => {
            const text = textOf(job)
            if (activeFilters.keyword && !text.includes(activeFilters.keyword.trim().toLowerCase())) return false
            if (activeFilters.location && !String(job.location || '').toLowerCase().includes(activeFilters.location.trim().toLowerCase())) return false
            if (activeFilters.category && !matchesCategory(job, activeFilters.category)) return false
            if (activeFilters.jobType && String(job.jobType || '').toLowerCase() !== activeFilters.jobType.toLowerCase()) return false
            if (activeFilters.company && String(job.company || '').toLowerCase() !== activeFilters.company.toLowerCase()) return false
            if (activeFilters.workMode && workModeOf(job) !== activeFilters.workMode) return false
            if ((activeFilters.minSalary || activeFilters.maxSalary) && salaryLower(job) <= 0) return false
            if (activeFilters.minSalary && salaryUpper(job) < Number(activeFilters.minSalary)) return false
            if (activeFilters.maxSalary && salaryLower(job) > Number(activeFilters.maxSalary)) return false
            if (activeFilters.experience && !matchesExperience(job, activeFilters.experience)) return false
            if (activeFilters.datePosted) {
                const created = new Date(job.createdAt || 0).getTime()
                const days = Number(activeFilters.datePosted)
                if (!created || currentTime - created > days * 24 * 60 * 60 * 1000) return false
            }
            return true
        })

        return list.sort((a, b) => {
            if (activeFilters.sort === 'salary-high') return salaryUpper(b) - salaryUpper(a)
            if (activeFilters.sort === 'salary-low') return salaryLower(a) - salaryLower(b)
            if (activeFilters.sort === 'experience') return Number(b.minimumExperienceYears ?? 0) - Number(a.minimumExperienceYears ?? 0)
            if (activeFilters.sort === 'deadline') {
                const aDeadline = a.applicationDeadlineUtc ? new Date(a.applicationDeadlineUtc).getTime() : Number.MAX_SAFE_INTEGER
                const bDeadline = b.applicationDeadlineUtc ? new Date(b.applicationDeadlineUtc).getTime() : Number.MAX_SAFE_INTEGER
                return aDeadline - bDeadline
            }
            if (activeFilters.sort === 'relevance' && activeFilters.keyword.trim()) {
                const query = activeFilters.keyword.trim().toLowerCase()
                const score = (job) => {
                    const title = String(job.title || '').toLowerCase()
                    const company = String(job.company || '').toLowerCase()
                    const description = String(job.description || '').toLowerCase()
                    return (title.includes(query) ? 4 : 0) + (company.includes(query) ? 2 : 0) + (description.includes(query) ? 1 : 0)
                }
                const difference = score(b) - score(a)
                if (difference !== 0) return difference
            }
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        })
    }, [availableJobs, activeFilters, currentTime])

    const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
    const currentPage = Math.min(Math.max(1, Number(searchParams.get('page') || 1)), pageCount)
    const pageJobs = filteredJobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    function applyFilterState(next) {
        setDraftFilters(null)
        const hasSearchCriteria = Object.entries(next).some(([key, value]) => value && !(key === 'sort' && value === 'newest'))
        try {
            if (hasSearchCriteria) localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(next))
            else localStorage.removeItem(LAST_SEARCH_KEY)
        } catch {
            // URL parameters remain available even when browser storage is disabled.
        }
        const params = new URLSearchParams()
        Object.entries(next).forEach(([key, item]) => {
            if (item && !(key === 'sort' && item === 'newest')) params.set(key, item)
        })
        params.delete('page')
        setSearchParams(params, { replace: true })
    }

    function updateFilter(name, value) {
        if (mobileFiltersOpen) {
            setDraftFilters((current) => ({ ...(current || filters), [name]: value }))
            return
        }
        applyFilterState({ ...filters, [name]: value })
    }

    function clearFilters() {
        const next = { keyword: '', location: '', category: '', jobType: '', workMode: '', company: '', datePosted: '', minSalary: '', maxSalary: '', experience: '', sort: 'newest' }
        if (mobileFiltersOpen) {
            setDraftFilters(next)
            return
        }
        applyFilterState(next)
    }

    function openMobileFilters() {
        setDraftFilters(filters)
        setMobileFiltersOpen(true)
    }

    function applyMobileFilters() {
        applyFilterState(draftFilters || filters)
        setMobileFiltersOpen(false)
    }

    function changePage(nextPage) {
        const params = new URLSearchParams(searchParams)
        if (nextPage <= 1) params.delete('page')
        else params.set('page', String(nextPage))
        setSearchParams(params)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const hasFilters = Object.entries(activeFilters).some(([key, value]) => value && !(key === 'sort' && value === 'newest'))
    const currentResultsCount = filteredJobs.length

    return (
        <main className="hf-jobs-page">
            <div className="hf-jobs-hero"><div className="hf-jobs-container"><span className="hf-eyebrow">EXPLORE OPPORTUNITIES</span><h1>Find a role that moves <em>you forward.</em></h1><p>Search current opportunities and refine your results to match what matters to you.</p>
                <div className="hf-jobs-searchbar">
                    <label><span>Job title, skill, or company</span><input value={activeFilters.keyword} onChange={(event) => updateFilter('keyword', event.target.value)} placeholder="e.g. React Developer" /></label>
                    <label><span>Location</span><CityLocationAutocomplete value={activeFilters.location} onChange={value => updateFilter('location', value)} placeholder="City or Remote" ariaLabel="Job search location" /></label>
                    <button type="button" onClick={openMobileFilters}>Filters</button>
                </div>
            </div></div>

            <div className="hf-jobs-container hf-jobs-layout">
                <aside className={`hf-jobs-filters ${mobileFiltersOpen ? 'is-open' : ''}`} aria-label="Job filters">
                    <div className="hf-filter-header"><strong>Filters</strong><button type="button" onClick={clearFilters}>Clear all</button><button type="button" className="hf-filter-close" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">×</button></div>
                    <FilterGroup label="Job category"><select value={activeFilters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{Object.keys(CATEGORY_TERMS).map((category) => <option key={category} value={category}>{category}</option>)}</select></FilterGroup>
                    <FilterGroup label="Employment type"><select value={activeFilters.jobType} onChange={(event) => updateFilter('jobType', event.target.value)}><option value="">All types</option>{jobTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></FilterGroup>
                    <FilterGroup label="Work mode"><select value={activeFilters.workMode} onChange={(event) => updateFilter('workMode', event.target.value)}><option value="">Any work mode</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select></FilterGroup>
                    <FilterGroup label="Location"><CityLocationAutocomplete value={activeFilters.location} onChange={value => updateFilter('location', value)} placeholder="Enter city or area" ariaLabel="Location filter" /></FilterGroup>
                    <FilterGroup label="Minimum monthly-equivalent salary"><select value={activeFilters.minSalary} onChange={(event) => updateFilter('minSalary', event.target.value)}><option value="">No minimum</option><option value="10000">₹10,000+</option><option value="25000">₹25,000+</option><option value="50000">₹50,000+</option><option value="75000">₹75,000+</option><option value="100000">₹1,00,000+</option></select></FilterGroup>
                    <FilterGroup label="Maximum monthly-equivalent salary"><select value={activeFilters.maxSalary} onChange={(event) => updateFilter('maxSalary', event.target.value)}><option value="">No maximum</option><option value="25000">Up to ₹25,000</option><option value="50000">Up to ₹50,000</option><option value="75000">Up to ₹75,000</option><option value="100000">Up to ₹1,00,000</option></select></FilterGroup>
                    <div className="hf-filter-note">Yearly and weekly salaries are converted to monthly equivalents. Hourly estimates assume 40 hours per week.</div>
                    <FilterGroup label="Experience"><select value={activeFilters.experience} onChange={(event) => updateFilter('experience', event.target.value)}><option value="">Any experience</option>{EXPERIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FilterGroup>
                    <FilterGroup label="Date posted"><select value={activeFilters.datePosted} onChange={(event) => updateFilter('datePosted', event.target.value)}><option value="">Any time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></FilterGroup>
                    <FilterGroup label="Company"><select value={activeFilters.company} onChange={(event) => updateFilter('company', event.target.value)}><option value="">All companies</option>{companies.map((company) => <option key={company} value={company}>{company}</option>)}</select></FilterGroup>
                    <button className="hf-filter-apply-mobile" type="button" onClick={applyMobileFilters}>Show {currentResultsCount} jobs</button>
                </aside>
                {mobileFiltersOpen && <button className="hf-jobs-filter-backdrop" type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} />}

                <section className="hf-jobs-results" aria-label="Job search results">
                    <div className="hf-jobs-results-header"><div><span className="hf-eyebrow">YOUR SEARCH RESULTS</span><h2>{filteredJobs.length} {filteredJobs.length === 1 ? 'opportunity' : 'opportunities'}</h2><p>{activeFilters.keyword || activeFilters.location ? 'Results based on your search.' : 'Explore current jobs available on HireFlow.'}</p></div><label className="hf-jobs-sort">Sort by <select value={activeFilters.sort} onChange={(event) => updateFilter('sort', event.target.value)}><option value="newest">Newest first</option><option value="relevance">Most relevant</option><option value="salary-high">Salary: High to Low</option><option value="salary-low">Salary: Low to High</option><option value="experience">Experience level</option><option value="deadline">Application deadline: Soonest</option></select></label></div>
                    {hasFilters && <div className="hf-active-filters"><span>Active filters</span>{Object.entries(activeFilters).filter(([key, value]) => value && !(key === 'sort' && value === 'newest')).map(([key, value]) => <button key={key} type="button" onClick={() => updateFilter(key, '')}>{key === 'keyword' ? 'Keyword' : key === 'minSalary' ? 'Min salary' : key === 'maxSalary' ? 'Max salary' : key}: {value} ×</button>)}</div>}
                    {error ? <div className="hf-jobs-empty" role="alert"><h3>Job listings are temporarily unavailable.</h3><p>{error}</p><button type="button" onClick={onRetry}>Try again</button></div> : loading ? <SkeletonLoader variant="job-list" count={6} /> : pageJobs.length ? <div className="hf-job-list">{pageJobs.map((job) => {
                        const isSaved = savedJobs.some((id) => String(id) === String(job.id))
                        return <article className="hf-job-row" key={job.id}>
                            <span className="hf-job-row-mark">{companyInitials(job.company)}</span>
                            <div className="hf-job-row-main">
                                <div className="hf-job-row-top"><div><span className="hf-job-row-company">{job.company || 'Company not specified'}</span><h3>{job.title || 'Job opportunity'}</h3></div><div className="hf-job-row-save-actions"><ShareJob job={job} /><button type="button" className={`hf-job-row-save ${isSaved ? 'is-saved' : ''}`} onClick={() => onToggleSaved(job.id)} aria-label={isSaved ? 'Remove saved job' : 'Save job'} aria-pressed={isSaved}>♡</button><JobCollectionPicker jobId={job.id} isSaved={isSaved} /></div></div>
                                <div className="hf-job-row-tags"><span>{job.jobType || 'Opportunity'}</span><span>{workModeOf(job)}</span><span>{job.location || 'Location not specified'}</span><span>{experienceLabel(job)}</span></div>
                                <p>{String(job.description || '').slice(0, 190)}{String(job.description || '').length > 190 ? '…' : ''}</p>
                                <div className="hf-job-row-bottom"><strong>{salaryText(job)}</strong><div><Link to={`/jobs/${job.id}`}>View details</Link><button type="button" onClick={() => onApply(job)}>Apply now ↗</button></div></div>
                            </div>
                        </article>
                    })}</div> : <div className="hf-jobs-empty"><span>⌕</span><h3>No matching jobs found</h3><p>Try changing your keywords or removing one of the filters.</p><button type="button" onClick={clearFilters}>Clear all filters</button></div>}

                    {!loading && !error && filteredJobs.length > 0 && <div className="hf-pagination"><span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredJobs.length)} of {filteredJobs.length}</span><div><button type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button type="button" className={page === currentPage ? 'active' : ''} key={page} onClick={() => changePage(page)}>{page}</button>)}<button type="button" disabled={currentPage >= pageCount} onClick={() => changePage(currentPage + 1)}>Next</button></div></div>}
                </section>
            </div>
        </main>
    )
}