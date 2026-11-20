import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import './HRSidebar.css'

const API_ORIGIN = 'http://localhost:5116'

const navigationItems = [
    { label: 'Overview', path: '/hr', icon: '▦', tone: 'violet', end: true },
    { label: 'My Jobs', path: '/hr/jobs', icon: '▤', tone: 'blue' },
    { label: 'Create Job', path: '/hr/jobs/new', icon: '+', tone: 'amber' },
    { label: 'Applicants', path: '/hr/applicants', icon: '♙', tone: 'violet' },
    { label: 'Screening Questions', path: '/hr/screening-questions', icon: '☷', tone: 'teal' },
    { label: 'Interviews', path: '/hr/interviews', icon: '▣', tone: 'amber' },
    { label: 'Notifications', path: '/hr/notifications', icon: '♢', tone: 'violet' },
    { label: 'Company Profile', path: '/hr/company', icon: '▣', tone: 'blue' },
    { label: 'My Profile', path: '/hr/profile', icon: '◎', tone: 'amber' },
]

function getUserName(user) {
    return user?.fullName || user?.FullName || 'HR Account'
}

function getProfilePictureUrl(user) {
    const pictureUrl = user?.profilePictureUrl || user?.ProfilePictureUrl || ''
    if (!pictureUrl) return ''
    if (/^https?:\/\//i.test(pictureUrl)) return pictureUrl
    return `${API_ORIGIN}/${pictureUrl.replace(/^\/+/, '')}`
}

function getInitial(name) {
    return name.trim().charAt(0).toUpperCase() || 'H'
}

function HRSidebar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const fullName = getUserName(user)
    const profilePictureUrl = getProfilePictureUrl(user)

    function handleLogout() {
        logout()
        navigate('/', { replace: true })
    }

    return (
        <aside className="hr-sidebar">
            <div className="hr-sidebar-heading">
                <span className="hr-sidebar-eyebrow">EMPLOYER WORKSPACE</span>
                <h2>Manage hiring</h2>
                <p>Manage your jobs and candidates in one place.</p>
            </div>

            <nav className="hr-sidebar-nav" aria-label="HR navigation">
                <span className="hr-sidebar-section-label">WORKSPACE</span>
                {navigationItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.end}
                        className={({ isActive }) => `hr-sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        <span className={`hr-sidebar-icon hr-sidebar-icon--${item.tone}`} aria-hidden="true">
                            {item.icon}
                        </span>
                        <span className="hr-sidebar-link-label">{item.label}</span>
                        {item.label === 'Create Job' && <span className="hr-sidebar-add">+</span>}
                        <span className="hr-sidebar-link-indicator" aria-hidden="true" />
                    </NavLink>
                ))}
            </nav>

            <div className="hr-sidebar-bottom">
                <div className="hr-sidebar-user">
                    <div className="hr-sidebar-avatar" aria-label={`${fullName} profile photo`}>
                        <span className="hr-sidebar-avatar-fallback">{getInitial(fullName)}</span>
                        {profilePictureUrl && (
                            <img
                                className="hr-sidebar-avatar-image"
                                src={profilePictureUrl}
                                alt=""
                                onError={(event) => { event.currentTarget.style.display = 'none' }}
                            />
                        )}
                    </div>
                    <div className="hr-sidebar-user-info">
                        <strong>{fullName}</strong>
                        <span>HR Workspace</span>
                    </div>
                </div>

                <button type="button" className="hr-sidebar-home" onClick={() => navigate('/')}>
                    <span className="hr-sidebar-home-icon" aria-hidden="true">↗</span>
                    <span>Back to HireFlow</span>
                </button>

                <button
                    type="button"
                    className="hr-sidebar-logout"
                    onClick={handleLogout}
                    aria-label="Log out of HireFlow"
                >
                    <span className="hr-sidebar-logout-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 4H19C20.1046 4 21 4.89543 21 6V18C21 19.1046 20.1046 20 19 20H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M10 8L14 12L10 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 12H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    </span>
                    <span>Log out</span>
                </button>
            </div>
        </aside>
    )
}

export default HRSidebar
