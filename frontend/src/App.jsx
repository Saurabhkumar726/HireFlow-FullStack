import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import JobDetails from './components/JobDetails'
import ApplicationModal from './components/ApplicationModal'
import Login from './components/Login'
import StudentDashboard from './components/StudentDashboard'
import CandidateInterviews from './components/CandidateInterviews'
import SavedJobs from './components/SavedJobs'
import HRLayout from './hr/layouts/HRLayout'
import AdminPortal from './admin/AdminPortal'
import Home from './pages/Home'
import StudentHome from './pages/StudentHome'
import CandidatePreferencesPage from './pages/CandidatePreferencesPage'
import JobsPage from './pages/JobsPage'
import CompaniesPage from './pages/CompaniesPage'
import InformationPage from './pages/InformationPage'
import SavedJobCollectionsPage from './pages/SavedJobCollectionsPage'
import CandidateApplicationsPage from './pages/CandidateApplicationsPage'
import NotificationsPage from './pages/NotificationsPage'
import { useAuth } from './context/useAuth'
import { useSavedJobs } from './context/useSavedJobs'
import SkeletonLoader from './components/SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

function formatSalary(salary, job = {}) {
    const data = salary && typeof salary === 'object' ? salary : job
    const amount = Number(data.salary ?? salary ?? 0)
    const maximum = Number(data.salaryMax || 0)
    const mode = String(data.salaryMode || 'Range').toLowerCase()
    const currency = String(data.salaryCurrency || 'INR').toUpperCase()
    const period = String(data.salaryPeriod || 'Monthly').toLowerCase()
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

function jobIsUnavailable(job) {
    if (!job) return true
    if (job.isActive === false) return true
    if (job.publicationStatus && String(job.publicationStatus).toLowerCase() !== 'published') return true
    return Boolean(job.applicationDeadlineUtc && new Date(job.applicationDeadlineUtc).getTime() < Date.now())
}

function NotFoundPage() {
    const navigate = useNavigate()
    return (
        <main className="hf-not-found">
            <span>404</span>
            <h1>This page isn't here.</h1>
            <p>The link may be incorrect or the page may have moved.</p>
            <button type="button" onClick={() => navigate('/')}>Back to HireFlow</button>
        </main>
    )
}

function App() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, token, isAuthenticated } = useAuth()
    const { savedJobs, savedItems, loadingSavedJobs, savedJobsError, toggleSaved: toggleSavedJob } = useSavedJobs()
    const pathname = location.pathname

    const isAdminRoute = pathname.startsWith('/admin')
    const isHRRoute = pathname.startsWith('/hr')
    const isJobDetailsRoute = /^\/jobs\/[^/]+\/?$/.test(pathname)
    const sharedJobId = isJobDetailsRoute ? decodeURIComponent(pathname.split('/')[2]) : null
    const isCandidateInterviewsRoute = pathname === '/candidate/interviews'
    const isCandidateHomeRoute = pathname === '/candidate/home'
    const isCandidatePreferencesRoute = pathname === '/candidate/preferences'
    const isCandidateApplicationsRoute = pathname === '/candidate/applications'
    const isCandidateNotificationsRoute = pathname === '/candidate/notifications'
    const isCandidateDashboardRoute = pathname === '/candidate' || pathname === '/candidate/dashboard'
    const isCandidateRoute = pathname.startsWith('/candidate')
    const isSavedJobsRoute = pathname === '/saved-jobs'
    const isCandidateCollectionsRoute = pathname === '/candidate/collections'
    const isJobsRoute = pathname === '/jobs'
    const isCompaniesRoute = pathname === '/companies' || pathname.startsWith('/companies/')
    const isInfoRoute = ['/about', '/contact', '/privacy', '/terms'].includes(pathname)

    const [jobs, setJobs] = useState([])
    const [loadingJobs, setLoadingJobs] = useState(true)
    const [jobsError, setJobsError] = useState('')
    const [featuredJobs, setFeaturedJobs] = useState(null)
    const [loadingFeaturedJobs, setLoadingFeaturedJobs] = useState(true)
    const [detailJob, setDetailJob] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState('')
    const [savedFeedback, setSavedFeedback] = useState('')

    const [selectedJob, setSelectedJob] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [applicationMessage, setApplicationMessage] = useState('')
    const [applicationId, setApplicationId] = useState(null)
    const [form, setForm] = useState({
        applicantName: '',
        applicantEmail: '',
        applicantPhoneNumber: '',
        applicantLocation: '',
        applicantLinkedInUrl: '',
        applicantPortfolioUrl: '',
        resumeUrl: '',
        coverLetter: '',
        screeningAnswers: [],
    })
    const [showLogin, setShowLogin] = useState(false)
    const [loginRole, setLoginRole] = useState('Student')
    const [pendingJob, setPendingJob] = useState(null)

    async function loadJobs(signal) {
        setLoadingJobs(true)
        setJobsError('')

        try {
            const response = await fetch(`${API_URL}/Jobs`, { signal })
            if (!response.ok) throw new Error(`Job request failed (${response.status}).`)
            const data = await response.json()
            if (!Array.isArray(data)) throw new Error('The jobs API returned an unexpected response.')
            setJobs(data)
        } catch (error) {
            if (error.name === 'AbortError') return
            console.error('HireFlow jobs request failed:', error)
            setJobsError('We could not connect to the HireFlow job service. Check that the .NET API is running and try again.')
        } finally {
            if (!signal?.aborted) setLoadingJobs(false)
        }
    }

    async function loadFeaturedJobs(signal) {
        setLoadingFeaturedJobs(true)
        try {
            const response = await fetch(`${API_URL}/Jobs/featured?count=6`, { signal })
            if (!response.ok) throw new Error(`Featured jobs request failed (${response.status}).`)
            const data = await response.json()
            if (!Array.isArray(data)) throw new Error('The featured jobs API returned an unexpected response.')
            setFeaturedJobs(data)
        } catch (error) {
            if (error.name === 'AbortError') return
            console.warn('Featured jobs endpoint unavailable; using the public jobs feed:', error)
            setFeaturedJobs(null)
        } finally {
            if (!signal?.aborted) setLoadingFeaturedJobs(false)
        }
    }

    function retryJobData() {
        loadJobs()
        loadFeaturedJobs()
    }

    useEffect(() => {
        const controller = new AbortController()
        Promise.resolve().then(() => {
            if (controller.signal.aborted) return
            loadJobs(controller.signal)
            loadFeaturedJobs(controller.signal)
        })
        return () => controller.abort()
        // Jobs are loaded once for shared discovery pages. Manual retry refreshes both feeds.
    }, [])

    function requestSignIn(role = 'Student') {
        setLoginRole(role === 'HR' ? 'HR' : 'Student')
        setShowLogin(true)
    }

    async function toggleSaved(jobId) {
        if (!isAuthenticated) {
            requestSignIn('Student')
            return
        }
        if (String(user?.role || '').toLowerCase() !== 'student') {
            setSavedFeedback('Saved Jobs are available to Student accounts.')
            return
        }
        try {
            const isNowSaved = await toggleSavedJob(jobId)
            setSavedFeedback(isNowSaved ? 'Job saved to your HireFlow account.' : 'Job removed from your saved jobs.')
        } catch (error) {
            setSavedFeedback(error.message || 'Could not update your saved jobs. Please try again.')
        }
    }

    async function prepareApplication(job, currentUser = user) {
        setPendingJob(null)
        setSelectedJob(job)
        setApplicationMessage('')
        setApplicationId(null)
        setForm({
            applicantName: currentUser?.fullName || currentUser?.FullName || '',
            applicantEmail: currentUser?.email || currentUser?.Email || '',
            applicantPhoneNumber: currentUser?.phoneNumber || currentUser?.PhoneNumber || '',
            applicantLocation: currentUser?.currentLocation || currentUser?.location || '',
            applicantLinkedInUrl: currentUser?.linkedInUrl || currentUser?.linkedinUrl || '',
            applicantPortfolioUrl: currentUser?.portfolioUrl || '',
            resumeUrl: currentUser?.resumeUrl || currentUser?.ResumeUrl || '',
            coverLetter: '',
            screeningAnswers: [],
        })

        const authToken = token || localStorage.getItem('hireflow-token') || ''
        if (!authToken) return

        // Reuse saved account/profile data as the application form defaults.
        // The form remains editable; submitted values are stored as an application snapshot.
        try {
            const profileResponse = await fetch(`${API_URL}/Profile`, {
                headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' },
            })
            const profile = profileResponse.ok ? await profileResponse.json().catch(() => ({})) : {}

            let candidateProfile = {}
            try {
                const candidateResponse = await fetch(`${API_URL}/CandidateProfile`, {
                    headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' },
                })
                if (candidateResponse.ok) candidateProfile = await candidateResponse.json().catch(() => ({}))
            } catch {
                // The base Profile response is enough to continue applying.
            }

            const employments = Array.isArray(candidateProfile.employments) ? candidateProfile.employments : []
            const currentEmployment = employments.find(item => item.isCurrentlyWorking || item.IsCurrentlyWorking) || employments[0]
            const jobLocation = currentEmployment?.location || currentEmployment?.Location || ''

            setForm(current => ({
                ...current,
                applicantName: current.applicantName || profile.fullName || profile.FullName || '',
                applicantEmail: current.applicantEmail || profile.email || profile.Email || '',
                applicantPhoneNumber: current.applicantPhoneNumber || profile.phoneNumber || profile.PhoneNumber || '',
                applicantLocation: current.applicantLocation || profile.currentLocation || profile.CurrentLocation || jobLocation,
                applicantLinkedInUrl: current.applicantLinkedInUrl || profile.linkedInUrl || profile.LinkedInUrl || '',
                applicantPortfolioUrl: current.applicantPortfolioUrl || profile.portfolioUrl || profile.PortfolioUrl || '',
                resumeUrl: current.resumeUrl || profile.resumeUrl || profile.ResumeUrl || '',
            }))
        } catch (error) {
            console.warn('Could not load all saved application profile details:', error)
        }
    }

    function openApplication(job) {
        if (jobIsUnavailable(job)) {
            setApplicationMessage('This job is closed or its application deadline has passed. You can still review the job details, but applications are no longer being accepted.')
            return
        }

        if (!isAuthenticated) {
            setPendingJob(job)
            requestSignIn('Student')
            return
        }

        if (String(user?.role || '').toLowerCase() !== 'student') {
            setApplicationMessage('Only Student accounts can apply for jobs.')
            return
        }

        void prepareApplication(job, user)
    }

    async function submitApplication(event) {
        event.preventDefault()
        if (!selectedJob) return
        setSubmitting(true)
        setApplicationMessage('')

        try {
            const authToken = token || localStorage.getItem('hireflow-token') || ''
            let storedUser = null
            try {
                storedUser = JSON.parse(localStorage.getItem('hireflow-user') || 'null')
            } catch {
                storedUser = null
            }
            const currentRole = String(user?.role || storedUser?.role || '').toLowerCase()
            if (!authToken || currentRole !== 'student') {
                throw new Error('Please sign in with a Student account before applying.')
            }

            const response = await fetch(`${API_URL}/JobApplications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    jobId: selectedJob.id ?? selectedJob.Id,
                    applicantName: form.applicantName.trim(),
                    applicantEmail: form.applicantEmail.trim(),
                    applicantPhoneNumber: form.applicantPhoneNumber.trim(),
                    applicantLocation: form.applicantLocation.trim(),
                    applicantLinkedInUrl: form.applicantLinkedInUrl.trim(),
                    applicantPortfolioUrl: form.applicantPortfolioUrl.trim(),
                    resumeUrl: form.resumeUrl.trim(),
                    coverLetter: form.coverLetter.trim(),
                    screeningAnswers: Array.isArray(form.screeningAnswers) ? form.screeningAnswers : [],
                }),
            })

            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(payload.message || payload.title || `Application submission failed (${response.status}).`)
            }

            setApplicationId(payload.id || payload.Id || null)
            setApplicationMessage('success')
        } catch (error) {
            console.error('HireFlow application submit failed:', error)
            setApplicationMessage(error.message || 'Could not submit your application. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    function handleLoginSuccess() {
        setShowLogin(false)

        let currentUser = user
        try {
            currentUser = JSON.parse(localStorage.getItem('hireflow-user') || 'null') || user
        } catch {
            // Use the context value if local storage cannot be read.
        }

        const role = String(currentUser?.role || '').toLowerCase()
        if (pendingJob && role === 'student') {
            void prepareApplication(pendingJob, currentUser)
            return
        }
        if (pendingJob && role !== 'student') {
            setPendingJob(null)
            setApplicationMessage('Only Student accounts can apply for jobs.')
            return
        }

        if (role === 'student') navigate('/candidate/home', { replace: true })
        else if (role === 'hr') navigate('/hr', { replace: true })
        else if (role === 'admin') navigate('/admin', { replace: true })
    }

    useEffect(() => {
        if (!sharedJobId || jobs.some((job) => String(job.id) === String(sharedJobId)) || loadingJobs) return undefined

        const controller = new AbortController()
        Promise.resolve().then(async () => {
            if (controller.signal.aborted) return
            setDetailJob(null)
            setDetailLoading(true)
            setDetailError('')
            try {
                // Closed/expired published jobs are absent from the public feed,
                // but remain readable through GET /api/Jobs/{id}.
                const response = await fetch(`${API_URL}/Jobs/${encodeURIComponent(sharedJobId)}`, { signal: controller.signal })
                const data = await response.json().catch(() => null)
                if (!response.ok) throw new Error(data?.message || data?.title || `Job details request failed (${response.status}).`)
                if (!data || typeof data !== 'object') throw new Error('The job details response was not valid.')
                setDetailJob(data)
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setDetailJob(null)
                    setDetailError(error.message || 'This job could not be found.')
                }
            } finally {
                if (!controller.signal.aborted) setDetailLoading(false)
            }
        })

        return () => controller.abort()
    }, [sharedJobId, jobs, loadingJobs])

    const routedJob = sharedJobId
        ? jobs.find((job) => String(job.id) === String(sharedJobId)) || (String(detailJob?.id) === String(sharedJobId) ? detailJob : null)
        : null

    useEffect(() => {
        const robotsMeta = document.querySelector('meta[name="robots"]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))
        const isPrivatePage = isCandidateRoute || isSavedJobsRoute || isHRRoute || isAdminRoute
        robotsMeta.setAttribute('content', isPrivatePage ? 'noindex,nofollow' : 'index,follow')

        // HR and Admin layouts manage their own document titles.
        if (isHRRoute || isAdminRoute) return

        const routeMeta = {
            '/': ['HireFlow — Where Careers Find Their Flow', 'Discover meaningful job opportunities, explore companies hiring, and move your career forward with HireFlow.'],
            '/jobs': ['Find Jobs | HireFlow', 'Search current job opportunities by title, skill, location, company, and work preference.'],
            '/companies': ['Companies Hiring | HireFlow', 'Discover companies represented in current HireFlow job listings.'],
            '/about': ['About HireFlow', 'Learn about HireFlow and our approach to clearer job discovery and recruitment.'],
            '/contact': ['Contact HireFlow', 'Get help with job discovery, applications, employer onboarding, and HireFlow.'],
            '/privacy': ['Privacy Policy Draft | HireFlow', 'Review the current HireFlow privacy policy draft.'],
            '/terms': ['Terms of Service Draft | HireFlow', 'Review the current HireFlow terms of service draft.'],
            '/candidate/home': ['Find Your Next Role | HireFlow', 'Explore job opportunities and companies on HireFlow.'],
            '/candidate/preferences': ['Job Preferences | HireFlow', 'Personalize job recommendations using your preferred roles, skills, locations, and work preferences.'],
            '/candidate/applications': ['My Applications | HireFlow', 'Track submitted applications, review recruiter updates, and manage applications.'],
            '/candidate/notifications': ['Notifications | HireFlow', 'Review your latest application and interview notifications.'],
            '/saved-jobs': ['Saved Jobs | HireFlow', 'Review opportunities you have saved on HireFlow.'],
        }
        const [title, description] = isJobDetailsRoute && routedJob
            ? [`${routedJob.title || 'Job Details'} | HireFlow`, `Explore the ${routedJob.title || 'job opportunity'} at ${routedJob.company || 'this company'} on HireFlow.`]
            : routeMeta[pathname] || ['HireFlow', 'Discover job opportunities and companies with HireFlow.']
        document.title = title
        const descriptionMeta = document.querySelector('meta[name="description"]')
        if (descriptionMeta) descriptionMeta.setAttribute('content', description)
    }, [pathname, isJobDetailsRoute, routedJob, isCandidateRoute, isSavedJobsRoute, isHRRoute, isAdminRoute])


    if (isAdminRoute) {
        // AdminPortal owns the isolated /admin/login and protected /admin/dashboard routes.
        return <AdminPortal />
    }

    if (isHRRoute) {
        // The existing HR workspace and its sidebar are preserved as a separate workspace.
        return <HRLayout />
    }

    let page

    if (isCandidateInterviewsRoute) {
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <CandidateInterviews />
            : <Navigate to="/" replace />
    } else if (isCandidateHomeRoute) {
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <StudentHome jobs={jobs} loading={loadingJobs} error={jobsError} onRetry={retryJobData} savedJobs={savedJobs} onToggleSaved={toggleSaved} onApply={openApplication} onSignIn={requestSignIn} user={user} />
            : <Navigate to="/" replace />
    } else if (isCandidatePreferencesRoute) {
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <CandidatePreferencesPage />
            : <Navigate to="/" replace />
    } else if (isCandidateApplicationsRoute) {
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <CandidateApplicationsPage />
            : <Navigate to="/" replace />
    } else if (isCandidateNotificationsRoute) {
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <NotificationsPage />
            : <Navigate to="/" replace />
    } else if (isCandidateDashboardRoute) {
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <StudentDashboard />
            : <Navigate to="/" replace />
    } else if (isCandidateCollectionsRoute) {
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <SavedJobCollectionsPage />
            : <Navigate to="/" replace />
    } else if (isCandidateRoute) {
        // Preserve legacy candidate sub-routes until each new page is implemented.
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <StudentDashboard />
            : <Navigate to="/" replace />
    } else if (isSavedJobsRoute) {
        page = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
            ? <SavedJobs savedItems={savedItems} loading={loadingSavedJobs} error={savedJobsError} onToggleSaved={toggleSaved} onViewDetails={(job) => navigate(`/jobs/${job.id}`)} onApply={openApplication} onManageCollections={(jobId) => navigate(`/candidate/collections?job=${encodeURIComponent(jobId)}`)} />
            : <Navigate to="/" replace />
    } else if (isJobDetailsRoute) {
        page = routedJob ? (
            <JobDetails job={routedJob} onBack={() => navigate('/jobs')} onApply={() => openApplication(routedJob)} formatSalary={formatSalary} />
        ) : loadingJobs || detailLoading || !detailError ? (
            <SkeletonLoader variant="job-details" />
        ) : (
            <main className="hf-not-found"><span>404</span><h1>Job not found.</h1><p>{detailError || 'This opportunity may have been removed or the link may be invalid.'}</p><button type="button" onClick={() => navigate('/jobs')}>Browse jobs</button></main>
        )
    } else if (isJobsRoute) {
        page = <JobsPage jobs={jobs} loading={loadingJobs} error={jobsError} onRetry={retryJobData} savedJobs={savedJobs} onToggleSaved={toggleSaved} onApply={openApplication} />
    } else if (isCompaniesRoute) {
        page = <CompaniesPage jobs={jobs} loading={loadingJobs} />
    } else if (isInfoRoute) {
        page = <InformationPage />
    } else if (pathname === '/') {
        page = <Home jobs={jobs} featuredJobs={featuredJobs} loading={loadingJobs || loadingFeaturedJobs} error={jobsError} onRetry={retryJobData} savedJobs={savedJobs} onToggleSaved={toggleSaved} onApply={openApplication} onSignIn={requestSignIn} user={user} />
    } else {
        page = <NotFoundPage />
    }

    return (
        <div className="hf-app-shell">
            <Navbar onSignIn={requestSignIn} savedJobsCount={savedJobs.length} />
            {page}
            {savedFeedback && <div className="hf-saved-feedback" role="status"><span>{savedFeedback}</span><button type="button" onClick={() => setSavedFeedback('')} aria-label="Dismiss">×</button></div>}
            <Footer />

            <ApplicationModal
                job={selectedJob}
                form={form}
                onChange={setForm}
                submitting={submitting}
                message={applicationMessage}
                onSubmit={submitApplication}
                applicationId={applicationId}
                onViewApplications={() => {
                    setSelectedJob(null)
                    setApplicationMessage('')
                    navigate('/candidate/applications')
                }}
                onBrowseJobs={() => {
                    setSelectedJob(null)
                    setApplicationMessage('')
                    navigate('/jobs')
                }}
                onClose={() => {
                    if (!submitting) {
                        setSelectedJob(null)
                        setApplicationMessage('')
                        setApplicationId(null)
                    }
                }}
            />

            {showLogin && <Login key={loginRole} initialRole={loginRole} onClose={() => setShowLogin(false)} onSuccess={handleLoginSuccess} />}
        </div>
    )
}

export default App
