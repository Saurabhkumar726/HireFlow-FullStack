import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './CompaniesPage.css'
import SkeletonLoader from '../components/SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

function slugify(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function buildCompanies(jobs) {
    const map = new Map()
    jobs.forEach(job => {
        const name = String(job.company || '').trim()
        if (!name) return
        const key = name.toLowerCase()
        const entry = map.get(key) || { name, slug: slugify(name), jobs: [], location: job.location || '', activeJobsCount: 0, isVerified: false }
        entry.jobs.push(job)
        entry.activeJobsCount = entry.jobs.length
        if (!entry.location && job.location) entry.location = job.location
        map.set(key, entry)
    })
    return [...map.values()].sort((a, b) => b.activeJobsCount - a.activeJobsCount || a.name.localeCompare(b.name))
}

function initials(name) {
    return String(name || 'Company').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'C'
}

function CompanyLogo({ company, large = false }) {
    const [failed, setFailed] = useState(false)
    return <span className={`hf-company-profile-mark ${large ? 'large' : ''}`}>{company.logoUrl && !failed ? <img src={company.logoUrl} alt={`${company.name} logo`} onError={() => setFailed(true)} /> : initials(company.name)}</span>
}

export default function CompaniesPage({ jobs = [], loading: jobsLoading = false }) {
    const location = useLocation()
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [companies, setCompanies] = useState([])
    const [loadingCompanies, setLoadingCompanies] = useState(true)
    const [companyError, setCompanyError] = useState('')
    const [selectedCompany, setSelectedCompany] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const selectedSlug = decodeURIComponent(location.pathname.split('/')[2] || '')

    useEffect(() => {
        const controller = new AbortController()
        fetch(`${API_URL}/Companies`, { signal: controller.signal })
            .then(async response => {
                const data = await response.json().catch(() => [])
                if (!response.ok) throw new Error(data.message || `Company request failed (${response.status}).`)
                if (!Array.isArray(data)) throw new Error('The company API returned an unexpected response.')
                setCompanies(data)
                setCompanyError('')
            })
            .catch(error => {
                if (error.name === 'AbortError') return
                setCompanies(buildCompanies(jobs))
                setCompanyError('Company profiles could not be loaded from the company service. Showing companies from current public job listings instead.')
            })
            .finally(() => { if (!controller.signal.aborted) setLoadingCompanies(false) })
        return () => controller.abort()
    }, [jobs])

    useEffect(() => {
        if (!selectedSlug) return undefined
        const controller = new AbortController()
        Promise.resolve().then(async () => {
            if (controller.signal.aborted) return
            setDetailLoading(true)
            try {
                const response = await fetch(`${API_URL}/Companies/${encodeURIComponent(selectedSlug)}`, { signal: controller.signal })
                const data = await response.json().catch(() => null)
                if (!response.ok) throw new Error(data?.message || `Company profile request failed (${response.status}).`)
                if (!controller.signal.aborted) setSelectedCompany(data)
            } catch (error) {
                if (error.name === 'AbortError' || controller.signal.aborted) return
                const fallback = buildCompanies(jobs).find(company => company.slug === selectedSlug)
                if (fallback) setSelectedCompany({ ...fallback, jobs: fallback.jobs, description: '', approvalStatus: 'Profile not verified', isVerified: false })
                else setSelectedCompany(null)
            } finally {
                if (!controller.signal.aborted) setDetailLoading(false)
            }
        })
        return () => controller.abort()
    }, [selectedSlug, jobs])

    const visibleCompanies = useMemo(() => companies.filter(company =>
        `${company.name} ${company.industry || ''} ${company.location || ''}`.toLowerCase().includes(query.trim().toLowerCase())
    ), [companies, query])

    if (selectedSlug) {
        if (detailLoading || (jobsLoading && !selectedCompany)) return <main className="hf-companies-page"><div className="hf-companies-container"><SkeletonLoader variant="profile" /></div></main>
        if (!selectedCompany) return <main className="hf-companies-page"><div className="hf-companies-container"><h1>Company not found</h1><p>This company is not currently represented in HireFlow's public company directory.</p><Link to="/companies">Browse companies</Link></div></main>

        const companyJobs = Array.isArray(selectedCompany.jobs) ? selectedCompany.jobs : []
        return (
            <main className="hf-companies-page">
                <div className="hf-companies-container hf-company-profile-page">
                    <button className="hf-company-back" type="button" onClick={() => navigate('/companies')}>← All companies</button>
                    <header className="hf-company-profile-header">
                        <CompanyLogo company={selectedCompany} large />
                        <div><span className="hf-eyebrow">{selectedCompany.isVerified ? 'VERIFIED COMPANY PROFILE' : 'COMPANY FROM PUBLIC LISTINGS'}</span><h1>{selectedCompany.name}</h1><p>{[selectedCompany.industry, selectedCompany.location].filter(Boolean).join(' · ') || 'Company information'}</p><span className="hf-company-openings">{Number(selectedCompany.activeJobsCount ?? companyJobs.length)} active job openings</span></div>
                    </header>
                    {selectedCompany.description && <section className="hf-company-profile-description"><h2>About {selectedCompany.name}</h2><p>{selectedCompany.description}</p>{selectedCompany.website && <a href={selectedCompany.website} target="_blank" rel="noreferrer">Company website ↗</a>}</section>}
                    <section className="hf-company-profile-jobs"><div className="hf-company-title-row"><div><h2>Current opportunities</h2><p>Active public opportunities at this company.</p></div><Link to={`/jobs?company=${encodeURIComponent(selectedCompany.name)}`}>View all jobs ↗</Link></div>
                        {companyJobs.length ? <div className="hf-company-job-list">{companyJobs.map(job => <article key={job.id}><div><strong>{job.title}</strong><span>{job.location || 'Location not specified'} · {job.jobType || 'Opportunity'}</span></div><Link to={`/jobs/${job.id}`}>View details ↗</Link></article>)}</div> : <div className="hf-company-directory-empty"><p>This company has no current openings. Check back for future opportunities.</p></div>}
                    </section>
                    {!selectedCompany.isVerified && <p className="hf-company-data-note">This company page currently uses details from its public job listings. Additional company information will appear after the company profile is reviewed and approved.</p>}
                </div>
            </main>
        )
    }

    return (
        <main className="hf-companies-page">
            <div className="hf-companies-container">
                <header className="hf-companies-hero"><span className="hf-eyebrow">DISCOVER EMPLOYERS</span><h1>Find your next opportunity <em>by company.</em></h1><p>Explore approved company profiles and organizations currently represented in public HireFlow job listings.</p><label className="hf-company-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search companies, industries or locations" aria-label="Search companies" /></label></header>
                {companyError && <p className="hf-company-data-note">{companyError}</p>}
                {loadingCompanies ? <SkeletonLoader variant="companies" count={6} /> : visibleCompanies.length ? <div className="hf-company-directory-grid">{visibleCompanies.map(company => <article key={company.id || company.slug || company.name} className="hf-company-directory-card"><CompanyLogo company={company} /><h2>{company.name}</h2><p>{[company.industry, company.location].filter(Boolean).join(' · ') || 'Location not specified'}</p><strong>{Number(company.activeJobsCount || 0)} {Number(company.activeJobsCount || 0) === 1 ? 'active job' : 'active jobs'}</strong><Link to={`/companies/${company.slug || slugify(company.name)}`}>View company <span>↗</span></Link></article>)}</div> : <div className="hf-company-directory-empty"><h2>No companies found</h2><p>Company profiles will appear as employers publish opportunities and complete company information.</p><Link to="/jobs">Browse jobs ↗</Link></div>}
            </div>
        </main>
    )
}
