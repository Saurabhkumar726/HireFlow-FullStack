import { useNavigate } from 'react-router-dom'
import './SavedJobs.css'
import ShareJob from './ShareJob'

function formatSalary(salary) {
    const amount = Number(salary)

    return amount > 0
        ? `₹${amount.toLocaleString('en-IN')}`
        : 'Salary not disclosed'
}

function SavedJobs({ jobs, savedJobs, onToggleSaved, onViewDetails, onApply }) {
    const navigate = useNavigate()

    const savedJobList = jobs.filter((job) =>
        savedJobs.some((id) => String(id) === String(job.id))
    )

    return (
        <main className="saved-jobs-page">
            <div className="saved-jobs-container">
                <button
                    type="button"
                    className="saved-jobs-back"
                    onClick={() => navigate('/')}
                >
                    ← Back to jobs
                </button>

                <header className="saved-jobs-header">
                    <p className="eyebrow">YOUR COLLECTION</p>
                    <h1>Saved <span>jobs.</span></h1>
                    <p>Keep track of the opportunities you want to explore.</p>
                    <div className="saved-jobs-count">
                        {savedJobList.length} saved {savedJobList.length === 1 ? 'job' : 'jobs'}
                    </div>
                </header>

                {savedJobList.length === 0 ? (
                    <section className="saved-jobs-empty">
                        <div className="saved-jobs-empty-icon">♡</div>
                        <h2>No saved jobs yet</h2>
                        <p>
                            When you save a job with the heart icon, it will appear here.
                        </p>
                        <button
                            type="button"
                            className="saved-jobs-primary"
                            onClick={() => navigate('/#jobs')}
                        >
                            Explore jobs →
                        </button>
                    </section>
                ) : (
                    <section className="saved-jobs-grid" aria-label="Your saved jobs">
                        {savedJobList.map((job, index) => (
                            <article className="saved-job-card" key={job.id}>
                                <div className="saved-job-card-top">
                                    <div className={`saved-job-avatar company-color-${index % 4}`}>
                                        {job.company?.trim().charAt(0).toUpperCase() || 'H'}
                                    </div>

                                    <div className="saved-job-card-actions">
                                        <ShareJob job={job} />

                                        <button
                                            type="button"
                                            className="saved-job-remove"
                                            onClick={() => onToggleSaved(job.id)}
                                            aria-label={`Remove ${job.title} from saved jobs`}
                                            title="Remove from saved jobs"
                                        >
                                            ♥
                                        </button>
                                    </div>
                                </div>

                                <div className="saved-job-labels">
                                    <span className="job-type-label">
                                        {job.jobType || 'Opportunity'}
                                    </span>
                                    {job.location?.toLowerCase().includes('remote') && (
                                        <span className="remote-label">Remote</span>
                                    )}
                                </div>

                                <h2 className="saved-job-title">{job.title}</h2>
                                <p className="saved-job-company">{job.company}</p>

                                <p className="saved-job-description">
                                    {job.description ||
                                        'Explore this opportunity and take the next step in your career.'}
                                </p>

                                <div className="saved-job-meta">
                                    <span>⌖ {job.location || 'Location flexible'}</span>
                                    <strong>
                                        {formatSalary(job.salary)}
                                        {Number(job.salary) > 0 && <small> / month</small>}
                                    </strong>
                                </div>

                                <div className="saved-job-footer">
                                    <span>
                                        {job.createdAt
                                            ? new Date(job.createdAt).toLocaleDateString(
                                                'en-IN',
                                                {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                }
                                            )
                                            : 'Recently posted'}
                                    </span>

                                    <div className="saved-job-actions">
                                        <button
                                            type="button"
                                            onClick={() => onViewDetails(job)}
                                        >
                                            View details
                                        </button>
                                        <button
                                            type="button"
                                            className="saved-job-apply"
                                            onClick={() => onApply(job)}
                                        >
                                            Apply now ↗
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </div>
        </main>
    )
}

export default SavedJobs