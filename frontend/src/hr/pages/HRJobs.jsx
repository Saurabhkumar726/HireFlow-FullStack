
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import ConfirmDialog from '../components/ConfirmDialog';
import './HRJobs.css';

const API_URL = 'http://localhost:5116/api';

function formatSalary(salary) {
    const amount = Number(salary);

    if (!Number.isFinite(amount) || amount <= 0) {
        return 'Salary not disclosed';
    }

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(date) {
    if (!date) return 'Date unavailable';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return 'Date unavailable';
    }

    return parsedDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function getJobId(job) {
    return job.id ?? job.Id;
}

function getOwnerId(job) {
    return job.createdByUserId ?? job.CreatedByUserId;
}

function getJobType(job) {
    return job.jobType ?? job.JobType ?? 'Not specified';
}

function HRJobs() {
    const { token, user } = useAuth();

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [deletingId, setDeletingId] = useState(null);
    const [jobToDelete, setJobToDelete] = useState(null);
    const [notice, setNotice] = useState('');

    const currentUserId =
        user?.id ??
        user?.userId ??
        user?.Id ??
        user?.userID;

    const loadJobs = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/Jobs`, {
                headers: token
                    ? { Authorization: `Bearer ${token}` }
                    : {},
            });

            const data = await response.json().catch(() => []);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.title ||
                    `Unable to load jobs (${response.status}).`
                );
            }

            if (!Array.isArray(data)) {
                throw new Error(
                    'The jobs API returned an unexpected response.'
                );
            }

            setJobs(data);
        } catch (err) {
            setError(
                err.message ||
                'Could not connect to HireFlow. Check that the API is running.'
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadJobs();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadJobs]);

    const ownedJobs = useMemo(() => {
        if (currentUserId == null || currentUserId === '') {
            return [];
        }

        return jobs.filter((job) => {
            const ownerId = getOwnerId(job);

            return (
                ownerId != null &&
                String(ownerId) === String(currentUserId)
            );
        });
    }, [jobs, currentUserId]);

    const filteredJobs = useMemo(() => {
        const query = search.trim().toLowerCase();

        return ownedJobs.filter((job) => {
            const title = job.title ?? job.Title ?? '';
            const company = job.company ?? job.Company ?? '';
            const location = job.location ?? job.Location ?? '';
            const type = getJobType(job);

            const matchesSearch =
                !query ||
                [title, company, location].some((value) =>
                    String(value).toLowerCase().includes(query)
                );

            const matchesType =
                typeFilter === 'All' ||
                type.toLowerCase() === typeFilter.toLowerCase();

            return matchesSearch && matchesType;
        });
    }, [ownedJobs, search, typeFilter]);

    // Open the custom dialog; do not use window.confirm().
    function handleDelete(job) {
        const id = getJobId(job);

        if (id == null) {
            setError('This job has no valid ID and cannot be deleted.');
            return;
        }

        if (!token) {
            setError('Your session is missing. Please log in again.');
            return;
        }

        setError('');
        setNotice('');
        setJobToDelete(job);
    }

    // Delete only after the user confirms in ConfirmDialog.
    async function confirmDeleteJob() {
        if (!jobToDelete || deletingId != null) return;

        const id = getJobId(jobToDelete);

        if (id == null) {
            setError('This job has no valid ID and cannot be deleted.');
            setJobToDelete(null);
            return;
        }

        if (!token) {
            setError('Your session is missing. Please log in again.');
            setJobToDelete(null);
            return;
        }

        setDeletingId(id);
        setError('');
        setNotice('');

        try {
            const response = await fetch(
                `${API_URL}/Jobs/${encodeURIComponent(id)}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));

                throw new Error(
                    data.message ||
                    data.title ||
                    (response.status === 404
                        ? 'Job not found, or you do not own this job.'
                        : `Unable to delete job (${response.status}).`)
                );
            }

            setJobs((previous) =>
                previous.filter(
                    (item) => String(getJobId(item)) !== String(id)
                )
            );

            setNotice('Job deleted successfully.');
            setJobToDelete(null);
        } catch (err) {
            setError(
                err.message ||
                'Something went wrong while deleting this job.'
            );
            setJobToDelete(null);
        } finally {
            setDeletingId(null);
        }
    }

    function cancelDeleteJob() {
        if (deletingId != null) return;

        setJobToDelete(null);
    }

    const deletingJobTitle = jobToDelete
        ? jobToDelete.title ?? jobToDelete.Title ?? 'this job'
        : 'this job';

    return (
        <section className="hr-jobs-page">
            <div className="hr-jobs-toolbar">
                <div className="hr-jobs-toolbar-copy">
                    <span className="hr-jobs-eyebrow">
                        YOUR OPPORTUNITIES
                    </span>

                    <h2>Manage your job postings</h2>

                    <p>
                        Search, review, and manage the jobs you have published.
                    </p>
                </div>

                <Link
                    className="hr-jobs-create-button"
                    to="/hr/jobs/new"
                >
                    <span aria-hidden="true">＋</span>
                    Create job
                </Link>
            </div>

            {!loading && !error && (
                <div className="hr-jobs-summary">
                    <div
                        className="hr-jobs-summary-icon"
                        aria-hidden="true"
                    >
                        ▤
                    </div>

                    <div>
                        <span className="hr-jobs-summary-label">
                            Your job postings
                        </span>
                        <strong>{ownedJobs.length}</strong>
                    </div>

                    <span className="hr-jobs-summary-note">
                        {ownedJobs.length === 1 ? 'job' : 'jobs'} posted
                    </span>
                </div>
            )}

            <div className="hr-jobs-filters">
                <label className="hr-jobs-search">
                    <span aria-hidden="true">⌕</span>

                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by job title, company, or location..."
                        aria-label="Search your jobs"
                    />
                </label>

                <select
                    className="hr-jobs-type-filter"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    aria-label="Filter jobs by employment type"
                >
                    <option value="All">All job types</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                    <option value="Remote">Remote</option>
                </select>

                <button
                    type="button"
                    className="hr-jobs-refresh-button"
                    onClick={loadJobs}
                    disabled={loading}
                >
                    ↻ Refresh
                </button>
            </div>

            {error && (
                <div
                    className="hr-jobs-message hr-jobs-error"
                    role="alert"
                >
                    <span>{error}</span>
                    <button type="button" onClick={loadJobs}>
                        Try again
                    </button>
                </div>
            )}

            {notice && (
                <div
                    className="hr-jobs-message hr-jobs-success"
                    role="status"
                >
                    {notice}
                </div>
            )}

            {loading ? (
                <div className="hr-jobs-state" role="status">
                    <span className="hr-jobs-spinner" />
                    <h3>Loading your jobs...</h3>
                    <p>Connecting to the HireFlow API.</p>
                </div>
            ) : !error && currentUserId == null ? (
                <div className="hr-jobs-state">
                    <div className="hr-jobs-state-icon">!</div>
                    <h3>Unable to identify your account</h3>
                    <p>
                        Your saved user information does not include a
                        recognized user ID. Check the user object returned
                        by your login API before loading your postings.
                    </p>
                </div>
            ) : !error && ownedJobs.length === 0 ? (
                <div className="hr-jobs-state">
                    <div className="hr-jobs-state-icon">▤</div>
                    <h3>You haven't posted any jobs yet</h3>
                    <p>
                        Create your first job posting to start receiving
                        applications from candidates.
                    </p>

                    <Link
                        className="hr-jobs-create-button"
                        to="/hr/jobs/new"
                    >
                        ＋ Create your first job
                    </Link>
                </div>
            ) : !error && filteredJobs.length === 0 ? (
                <div className="hr-jobs-state hr-jobs-state-compact">
                    <div className="hr-jobs-state-icon">⌕</div>
                    <h3>No matching jobs found</h3>
                    <p>Try another search term or employment type.</p>

                    <button
                        type="button"
                        className="hr-jobs-reset-button"
                        onClick={() => {
                            setSearch('');
                            setTypeFilter('All');
                        }}
                    >
                        Clear filters
                    </button>
                </div>
            ) : !error ? (
                <div className="hr-jobs-list">
                    {filteredJobs.map((job) => {
                        const id = getJobId(job);
                        const title = job.title ?? job.Title ?? 'Untitled job';
                        const company =
                            job.company ?? job.Company ?? 'Company not specified';
                        const location =
                            job.location ?? job.Location ?? 'Location not specified';
                        const description =
                            job.description ?? job.Description ?? '';
                        const createdAt = job.createdAt ?? job.CreatedAt;

                        return (
                            <article
                                className="hr-job-item"
                                key={id}
                            >
                                <div className="hr-job-item-main">
                                    <div className="hr-job-item-icon">
                                        {String(company).charAt(0).toUpperCase()}
                                    </div>

                                    <div className="hr-job-item-content">
                                        <div className="hr-job-item-heading">
                                            <div>
                                                <h3>{title}</h3>
                                                <p className="hr-job-company">
                                                    {company}
                                                </p>
                                            </div>

                                            <span className="hr-job-type">
                                                {getJobType(job)}
                                            </span>
                                        </div>

                                        <div className="hr-job-meta">
                                            <span>
                                                <span aria-hidden="true">⌖</span>
                                                {location}
                                            </span>

                                            <span>
                                                <span aria-hidden="true">₹</span>
                                                {formatSalary(
                                                    job.salary ?? job.Salary
                                                )}
                                            </span>

                                            <span>
                                                <span aria-hidden="true">◷</span>
                                                Posted {formatDate(createdAt)}
                                            </span>
                                        </div>

                                        {description && (
                                            <p className="hr-job-description">
                                                {description.length > 180
                                                    ? `${description.slice(0, 180)}…`
                                                    : description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="hr-job-item-actions">
                                    <Link
                                        to={`/hr/jobs/${id}`}
                                        className="hr-job-action hr-job-view"
                                    >
                                        View details
                                    </Link>

                                    <Link
                                        to={`/hr/jobs/${id}/edit`}
                                        className="hr-job-action hr-job-edit"
                                    >
                                        Edit
                                    </Link>

                                    <button
                                        type="button"
                                        className="hr-job-action hr-job-delete"
                                        onClick={() => handleDelete(job)}
                                        disabled={
                                            deletingId != null || !token
                                        }
                                    >
                                        {String(deletingId) === String(id)
                                            ? 'Deleting...'
                                            : 'Delete'}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : null}

            {!loading && !error && filteredJobs.length > 0 && (
                <p className="hr-jobs-results-count">
                    Showing {filteredJobs.length} of {ownedJobs.length}{' '}
                    {ownedJobs.length === 1 ? 'job' : 'jobs'}
                </p>
            )}

            {/* Custom confirmation dialog replaces the browser popup. */}
            <ConfirmDialog
                open={jobToDelete !== null}
                title="Delete job posting?"
                message={`Are you sure you want to delete "${deletingJobTitle}"? This action cannot be undone.`}
                confirmText="Delete Job"
                cancelText="Keep Job"
                danger={true}
                loading={deletingId != null}
                onConfirm={confirmDeleteJob}
                onCancel={cancelDeleteJob}
            />
        </section>
    );
}

export default HRJobs;
