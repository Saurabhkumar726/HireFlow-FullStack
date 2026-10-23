import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import './HRSidebar.css'

const API_ORIGIN = 'http://localhost:5116'

const navigationItems = [
    { label: 'Overview', path: '/hr', icon: '▦', end: true },
    { label: 'My Jobs', path: '/hr/jobs', icon: '▤' },
    { label: 'Create Job', path: '/hr/jobs/new', icon: '+' },
    { label: 'Applicants', path: '/hr/applicants', icon: '♙' },
    { label: 'Interviews', path: '/hr/interviews', icon: '▣' },
    { label: 'My Profile', path: '/hr/profile', icon: '◎' },
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
    const { user } = useAuth()
    const navigate = useNavigate()

    const fullName = getUserName(user)
    const profilePictureUrl = getProfilePictureUrl(user)

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
                        className={({ isActive }) =>
                            `hr-sidebar-link ${isActive ? 'active' : ''}`
                        }
                    >
                        <span className="hr-sidebar-icon" aria-hidden="true">
                            {item.icon}
                        </span>
                        <span>{item.label}</span>
                        {item.label === 'Create Job' && (
                            <span className="hr-sidebar-add">+</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="hr-sidebar-bottom">
                <div className="hr-sidebar-user">
                    <div className="hr-sidebar-avatar" aria-label={`${fullName} profile photo`}>
                        <span className="hr-sidebar-avatar-fallback">
                            {getInitial(fullName)}
                        </span>
                        {profilePictureUrl && (
                            <img
                                className="hr-sidebar-avatar-image"
                                src={profilePictureUrl}
                                alt=""
                                onError={(event) => {
                                    event.currentTarget.style.display = 'none'
                                }}
                            />
                        )}
                    </div>
                    <div className="hr-sidebar-user-info">
                        <strong>{fullName}</strong>
                        <span>HR Workspace</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="hr-sidebar-home"
                    onClick={() => navigate('/')}
                >
                    ← Back to HireFlow
                </button>
            </div>
        </aside>
    )
}

export default HRSidebar
