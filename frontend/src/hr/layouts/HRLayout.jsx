
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

import HRSidebar from '../components/HRSidebar'
import HRCreateJob from '../pages/HRCreateJob'
import HRJobs from '../pages/HRJobs'
import HRApplicants from '../pages/HRApplicants'
import HRApplicantDetails from '../pages/HRApplicantDetails'
import HRProfile from '../pages/HRProfile'
import HRInterviews from '../pages/HRInterviews'
import HROverview from '../pages/HROverview'

import './HRLayout.css'

const pageTitles = [
    {
        match: /^\/hr\/?$/,
        title: 'HR Overview',
        description: 'Your hiring activity at a glance.',
    },
    {
        match: /^\/hr\/jobs\/new\/?$/,
        title: 'Create a Job',
        description: 'Publish a new opportunity for candidates.',
    },
    {
        match: /^\/hr\/jobs\/[^/]+\/edit\/?$/,
        title: 'Edit Job',
        description: 'Update your job posting.',
    },
    {
        match: /^\/hr\/jobs\/[^/]+\/applicants\/?$/,
        title: 'Job Applicants',
        description: 'Review candidates for this job.',
    },
    {
        match: /^\/hr\/jobs\/[^/]+\/?$/,
        title: 'Job Details',
        description: 'Review and manage this job posting.',
    },
    {
        match: /^\/hr\/jobs\/?$/,
        title: 'My Jobs',
        description: 'Manage the jobs you have posted.',
    },
    {
        match: /^\/hr\/applicants\/[^/]+\/?$/,
        title: 'Applicant Details',
        description: 'Review a candidate application.',
    },
    {
        match: /^\/hr\/applicants\/?$/,
        title: 'Applicants',
        description: 'Review applications for your jobs.',
    },
    {
        match: /^\/hr\/interviews\/?$/,
        title: 'Interviews',
        description: 'Organize your interview workflow.',
    },
    {
        match: /^\/hr\/profile\/?$/,
        title: 'My Profile',
        description: 'Review and manage your account information.',
    },
]

function HRLayout() {
    const { pathname } = useLocation()
    const { user, isAuthenticated } = useAuth()

    if (!isAuthenticated) {
        return <Navigate to="/" replace />
    }

    if (user?.role !== 'HR') {
        return <Navigate to="/" replace />
    }

    // Normalize trailing slashes so route matching stays consistent.
    const normalizedPath = pathname.replace(/\/+$/, '') || '/hr'

    const currentPage = pageTitles.find((page) =>
        page.match.test(normalizedPath)
    )

    const title = currentPage?.title || 'HR Workspace'
    const description =
        currentPage?.description ||
        'Manage your hiring activity on HireFlow.'

    function renderPage() {
        // HR Overview
        if (normalizedPath === '/hr') {
            return <HROverview />
        }

        // My Jobs
        if (normalizedPath === '/hr/jobs') {
            return <HRJobs />
        }

        // Create a Job
        if (normalizedPath === '/hr/jobs/new') {
            return <HRCreateJob />
        }

        // My Profile
        if (normalizedPath === '/hr/profile') {
            return <HRProfile />
        }

        // Interviews
        if (normalizedPath === '/hr/interviews') {
            return <HRInterviews />
        }

        // Applicant list
        if (normalizedPath === '/hr/applicants') {
            return <HRApplicants />
        }

        // Individual applicant details
        const applicantMatch = normalizedPath.match(
            /^\/hr\/applicants\/([^/]+)$/
        )

        if (applicantMatch) {
            return <HRApplicantDetails key={applicantMatch[1]} />
        }

        // Applicants for a specific job
        const jobApplicantsMatch = normalizedPath.match(
            /^\/hr\/jobs\/([^/]+)\/applicants$/
        )

        if (jobApplicantsMatch) {
            return (
                <HRApplicants
                    key={jobApplicantsMatch[1]}
                    jobId={jobApplicantsMatch[1]}
                />
            )
        }

        // Edit an existing job
        const editMatch = normalizedPath.match(
            /^\/hr\/jobs\/([^/]+)\/edit$/
        )

        if (editMatch) {
            return (
                <HRCreateJob
                    key={`edit-${editMatch[1]}`}
                    mode="edit"
                    jobId={editMatch[1]}
                />
            )
        }

        // View job details
        const detailsMatch = normalizedPath.match(
            /^\/hr\/jobs\/([^/]+)$/
        )

        if (detailsMatch) {
            return (
                <HRCreateJob
                    key={`view-${detailsMatch[1]}`}
                    mode="view"
                    jobId={detailsMatch[1]}
                />
            )
        }

        // Fallback for sections not yet implemented
        return (
            <div className="hr-placeholder">
                <div className="hr-placeholder-icon">✳</div>
                <h2>{title}</h2>
                <p>
                    This section is ready for implementation. We'll connect it
                    to your HireFlow API as we build each HR page.
                </p>
            </div>
        )
    }

    return (
        <main className="hr-workspace">
            <HRSidebar />

            <section className="hr-main">
                <div className="hr-page-heading">
                    <div>
                        <span className="hr-page-eyebrow">
                            HIRE FLOW / EMPLOYER
                        </span>

                        <h1>{title}</h1>
                        <p>{description}</p>
                    </div>

                    <div className="hr-page-account">
                        <span className="hr-account-status" />
                        <span>HR Workspace</span>
                    </div>
                </div>

                <div className="hr-page-content">
                    {renderPage()}
                </div>
            </section>
        </main>
    )
}

export default HRLayout
