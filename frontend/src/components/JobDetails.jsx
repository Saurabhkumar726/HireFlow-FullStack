import './JobDetails.css'

function displayDate(value) {
    if (!value) return 'Recently posted'
    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? 'Recently posted'
        : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function JobDetails({ job, onBack, onApply, formatSalary }) {
    const description = String(job.description || '').trim()
    const requirements = Array.isArray(job.requirements)
        ? job.requirements
        : typeof job.requirements === 'string'
            ? job.requirements.split(/\r?\n/).map((item) => item.replace(/^[-•\s]+/, '').trim()).filter(Boolean)
            : []

    return (
        <main className="job-details-page">
            <div className="job-details-wrap">
                <button className="job-details-back" onClick={onBack}>← Back to jobs</button>

                <section className="job-details-hero">
                    <div className="job-details-company-mark">
                        {job.company?.trim().charAt(0).toUpperCase() || 'H'}
                    </div>
                    <div className="job-details-heading">
                        <div className="job-details-labels">
                            <span className="job-type-label">{job.jobType || 'Opportunity'}</span>
                            {String(job.location || '').toLowerCase().includes('remote') && (
                                <span className="remote-label">Remote</span>
                            )}
                        </div>
                        <h1>{job.title || 'Job opportunity'}</h1>
                        <p className="job-details-company">{job.company || 'Company not specified'}</p>
                        <div className="job-details-meta">
                            <span>⌖ {job.location || 'Location flexible'}</span>
                            <span>◷ Posted {displayDate(job.createdAt)}</span>
                        </div>
                    </div>
                    <div className="job-details-primary-action">
                        <strong>{formatSalary(job.salary)}</strong>
                        {Number(job.salary) > 0 && <span>Salary listed by employer</span>}
                        <button className="button-primary" onClick={onApply}>Apply now <span>↗</span></button>
                    </div>
                </section>

                <div className="job-details-layout">
                    <article className="job-details-content">
                        <section className="job-details-panel">
                            <p className="eyebrow">THE OPPORTUNITY</p>
                            <h2>About this role</h2>
                            {description ? (
                                <div className="job-details-description">
                                    {description.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => (
                                        <p key={`${index}-${line.slice(0, 18)}`}>{line}</p>
                                    ))}
                                </div>
                            ) : (
                                <p className="job-details-muted">
                                    The employer has not added a detailed description yet. You can still apply
                                    or return to the listings to explore other opportunities.
                                </p>
                            )}
                        </section>

                        {requirements.length > 0 && (
                            <section className="job-details-panel">
                                <p className="eyebrow">WHAT YOU'LL NEED</p>
                                <h2>Requirements</h2>
                                <ul className="job-requirements-list">
                                    {requirements.map((requirement, index) => (
                                        <li key={`${index}-${requirement}`}>{requirement}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </article>

                    <aside className="job-details-sidebar">
                        <section className="job-details-panel overview-panel">
                            <p className="eyebrow">AT A GLANCE</p>
                            <h2>Job overview</h2>
                            <dl>
                                <div><dt>Company</dt><dd>{job.company || 'Not specified'}</dd></div>
                                <div><dt>Location</dt><dd>{job.location || 'Flexible'}</dd></div>
                                <div><dt>Employment type</dt><dd>{job.jobType || 'Not specified'}</dd></div>
                                <div><dt>Salary</dt><dd>{formatSalary(job.salary)}</dd></div>
                                <div><dt>Date posted</dt><dd>{displayDate(job.createdAt)}</dd></div>
                            </dl>
                            <button className="button-primary overview-apply" onClick={onApply}>Apply for this job <span>↗</span></button>
                        </section>
                        <div className="job-details-tip">
                            <span>✦</span>
                            <div><strong>Ready for your next step?</strong><p>Review the role details, then submit your application through HireFlow.</p></div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}
