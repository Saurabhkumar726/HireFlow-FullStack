import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ShareJob from './ShareJob'
import './SavedJobs.css'
import SkeletonLoader from './SkeletonLoader.jsx'

function formatSalary(job) {
    const mode = String(job.salaryMode || 'Range').toLowerCase()
    const amount = Number(job.salary || 0)
    const maximum = Number(job.salaryMax || 0)
    const currency = String(job.salaryCurrency || 'INR').toUpperCase()
    const period = String(job.salaryPeriod || 'Monthly').toLowerCase()
    if (mode === 'negotiable') return 'Salary negotiable'
    if (mode === 'notdisclosed' || amount <= 0) return 'Salary not disclosed'
    const format = value => {
        try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) }
        catch { return `${currency} ${value.toLocaleString('en-IN')}` }
    }
    if (mode === 'startingat') return `From ${format(amount)} / ${period}`
    return maximum > amount ? `${format(amount)} – ${format(maximum)} / ${period}` : `${format(amount)} / ${period}`
}

function SavedJobCard({ item, onToggleSaved, onViewDetails, onApply, onManageCollections }) {
    const job = item.job || {}
    const unavailable = !item.isAvailable
    return (
        <article className={`saved-job-card ${unavailable ? 'is-unavailable' : ''}`}>
            <div className="saved-job-card-top">
                <div className="saved-job-avatar">{String(job.company || 'H').trim().slice(0, 1).toUpperCase()}</div>
                <div className="saved-job-card-actions">
                    <ShareJob job={job} />
                    <button type="button" className="saved-job-remove" onClick={() => onToggleSaved(job.id)} aria-label={`Remove ${job.title} from saved jobs`} title="Remove saved job">♡</button>
                </div>
            </div>
            <div className="saved-job-labels">
                <span className="job-type-label">{job.jobType || 'Opportunity'}</span>
                {job.workMode && job.workMode !== 'Not specified' && <span className="remote-label">{job.workMode}</span>}
                {unavailable && <span className="saved-job-unavailable-pill">{item.unavailableReason || 'Unavailable'}</span>}
            </div>
            <h2 className="saved-job-title">{job.title || 'Job opportunity'}</h2>
            <p className="saved-job-company">{job.company || 'Company not specified'}</p>
            <p className="saved-job-description">{job.description || 'Explore this opportunity and take the next step in your career.'}</p>
            <div className="saved-job-meta">
                <span>⌖ {job.location || 'Location flexible'}</span>
                <strong>{formatSalary(job)}</strong>
            </div>
            <div className="saved-job-collection-tags">
                {(item.collections || []).map(collection => <span key={collection.id}>{collection.name}</span>)}
                <button type="button" onClick={() => onManageCollections(job.id)}>Organize collections</button>
            </div>
            <div className="saved-job-footer">
                <span>{job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently posted'}</span>
                <div className="saved-job-actions">
                    <button type="button" onClick={() => onViewDetails(job)}>View details</button>
                    {!unavailable && <button type="button" className="saved-job-apply" onClick={() => onApply(job)}>Apply now ↗</button>}
                </div>
            </div>
        </article>
    )
}

export default function SavedJobs({ savedItems = [], loading = false, error = '', onToggleSaved, onViewDetails, onApply, onManageCollections }) {
    const navigate = useNavigate()
    const activeItems = useMemo(() => savedItems.filter(item => item.isAvailable), [savedItems])
    const unavailableItems = useMemo(() => savedItems.filter(item => !item.isAvailable), [savedItems])

    function renderSection(title, items, unavailable = false) {
        return (
            <section className="saved-job-section">
                <header><div><h2>{title}</h2><p>{unavailable ? 'These opportunities are no longer accepting applications.' : 'Your currently available opportunities.'}</p></div><span>{items.length}</span></header>
                {items.length ? <div className="saved-jobs-grid">{items.map(item => <SavedJobCard key={item.jobId} item={item} onToggleSaved={onToggleSaved} onViewDetails={onViewDetails} onApply={onApply} onManageCollections={onManageCollections} />)}</div> : <div className="saved-jobs-empty-inline">{unavailable ? 'No unavailable saved jobs.' : 'No active saved jobs yet.'}</div>}
            </section>
        )
    }

    return (
        <main className="saved-jobs-page">
            <div className="saved-jobs-container">
                <button type="button" className="saved-jobs-back" onClick={() => navigate('/candidate/home')}>← Back to your job feed</button>
                <header className="saved-jobs-header">
                    <p className="eyebrow">YOUR COLLECTION</p>
                    <h1>Saved <span>jobs.</span></h1>
                    <p>Keep track of the opportunities you want to explore. Your saved jobs are synced to your HireFlow account.</p>
                    <div className="saved-jobs-header-actions"><div className="saved-jobs-count">{savedItems.length} saved {savedItems.length === 1 ? 'job' : 'jobs'}</div><button type="button" className="saved-jobs-primary" onClick={() => navigate('/candidate/collections')}>Manage collections →</button></div>
                </header>
                {error && <div className="saved-jobs-error" role="alert">{error} <button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
                {loading ? <SkeletonLoader variant="job-grid" count={6} /> : savedItems.length === 0 ? (
                    <section className="saved-jobs-empty"><div className="saved-jobs-empty-icon">♡</div><h2>No saved jobs yet</h2><p>Save a role while exploring HireFlow and it will appear here across your devices.</p><button type="button" className="saved-jobs-primary" onClick={() => navigate('/jobs')}>Explore jobs →</button></section>
                ) : <>{renderSection('Active saved jobs', activeItems)}{renderSection('Unavailable jobs', unavailableItems, true)}</>}
            </div>
        </main>
    )
}
