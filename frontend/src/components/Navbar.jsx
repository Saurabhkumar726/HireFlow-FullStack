import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/ThemeContext'
import NotificationBell from './NotificationBell'
import './Navbar.css'

function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return 'U'
    return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('')
}

function BrandMark() {
    return (
        <span className="hireflow-brand-symbol" aria-hidden="true">
            <svg viewBox="0 0 40 40" role="img">
                <path d="M10 8v24M30 8v24M10 20h20M20 20l10-10" />
                <path d="M23 10h7v7" />
            </svg>
        </span>
    )
}

function NavIcon({ name }) {
    const common = {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
    }

    switch (name) {
        case 'jobs':
            return <svg {...common}><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2M8.5 10.8h4.6M10.8 8.5v4.6" /></svg>
        case 'companies':
            return <svg {...common}><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M8 7.5h2m4 0h2M8 11.5h2m4 0h2M8 15.5h2m4 0h2M10 20.5v-3h4v3" /></svg>
        case 'about':
            return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.7 9.2a2.4 2.4 0 1 1 4.1 1.7c-1.1 1.1-1.8 1.4-1.8 2.8M12 17.2h.01" /></svg>
        case 'contact':
            return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
        case 'saved':
            return <svg {...common}><path d="M6 4.5h12v16l-6-3.7-6 3.7z" /></svg>
        case 'applications':
            return <svg {...common}><rect x="5" y="4.5" width="14" height="17" rx="2" /><path d="M9 4.5v-2h6v2M8.5 10h7M8.5 14h7M8.5 18h4" /></svg>
        case 'preferences':
            return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" /></svg>
        default:
            return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
    }
}

function PrimaryNavLink({ to, tone, icon, children, onClick, end = false }) {
    return (
        <NavLink
            to={to}
            end={end}
            onClick={onClick}
            className={({ isActive }) => `hf-nav-link ${isActive ? 'active' : ''}`}
        >
            <span className={`hf-nav-icon hf-nav-icon--${tone}`} aria-hidden="true">
                <NavIcon name={icon} />
            </span>
            <span className="hf-nav-link-label">{children}</span>
            <svg className="hf-nav-link-arrow" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7 4.5 12.5 10 7 15.5" />
            </svg>
        </NavLink>
    )
}

export default function Navbar({ onSignIn, savedJobsCount = 0 }) {
    const { user, isAuthenticated, logout } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const [menuOpen, setMenuOpen] = useState(false)
    const [isCompactNav, setIsCompactNav] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches
    )
    const menuButtonRef = useRef(null)
    const navigate = useNavigate()
    const rawRole = String(user?.role || '').trim().toLowerCase()
    // Normalize common identity-provider role aliases so all account layouts
    // render consistently for Student, Employer/HR and Admin accounts.
    const role = ['candidate', 'applicant'].includes(rawRole)
        ? 'student'
        : ['employer', 'recruiter'].includes(rawRole)
            ? 'hr'
            : rawRole === 'administrator' ? 'admin' : rawRole
    const userName = user?.fullName || user?.email || 'Your account'

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined

        const mediaQuery = window.matchMedia('(max-width: 1024px)')
        const updateCompactState = (event) => {
            setIsCompactNav(event.matches)
            if (!event.matches) setMenuOpen(false)
        }

        // The initial state is already read by the useState initializer above.
        // Only update it when the media query changes, avoiding a synchronous
        // state update during effect execution.
        mediaQuery.addEventListener?.('change', updateCompactState)
        return () => mediaQuery.removeEventListener?.('change', updateCompactState)
    }, [])

    useEffect(() => {
        if (!menuOpen) return undefined

        function closeOnEscape(event) {
            if (event.key === 'Escape') {
                setMenuOpen(false)
                menuButtonRef.current?.focus()
            }
        }

        function closeOnWideScreen() {
            if (window.innerWidth > 1024) setMenuOpen(false)
        }

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        document.addEventListener('keydown', closeOnEscape)
        window.addEventListener('resize', closeOnWideScreen)

        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', closeOnEscape)
            window.removeEventListener('resize', closeOnWideScreen)
        }
    }, [menuOpen])

    function closeMenu() {
        const shouldRestoreFocus = menuOpen && isCompactNav
        setMenuOpen(false)
        if (shouldRestoreFocus) menuButtonRef.current?.focus()
    }

    function openSignIn(targetRole = 'Student') {
        closeMenu()
        onSignIn?.(targetRole)
    }

    function goToDashboard() {
        closeMenu()
        if (role === 'hr') navigate('/hr')
        else if (role === 'admin') navigate('/admin/dashboard')
        else navigate('/candidate')
    }

    function handleLogout() {
        closeMenu()
        logout()
        navigate('/', { replace: true })
    }

    return (
        <header className={`hf-header ${menuOpen ? 'is-menu-open' : ''}`}>
            <div className="hf-header-inner">
                <Link className="hf-brand" to="/" aria-label="HireFlow home" onClick={closeMenu}>
                    <BrandMark />
                    <span>Hire<span>Flow</span></span>
                </Link>

                <nav
                    id="hf-primary-navigation"
                    className={`hf-nav hf-nav--${isAuthenticated ? role : 'guest'} ${menuOpen ? 'is-open' : ''}`}
                    aria-label="Primary navigation"
                    inert={isCompactNav && !menuOpen}
                >
                    <div className="hf-nav-links">
                        <span className="hf-nav-section-label">Explore HireFlow</span>
                        <PrimaryNavLink to="/jobs" onClick={closeMenu} tone="violet" icon="jobs">Find Jobs</PrimaryNavLink>
                        <PrimaryNavLink to="/companies" onClick={closeMenu} tone="blue" icon="companies">Companies</PrimaryNavLink>
                        <PrimaryNavLink to="/about" onClick={closeMenu} tone="teal" icon="about">About Us</PrimaryNavLink>
                        <PrimaryNavLink to="/contact" onClick={closeMenu} tone="amber" icon="contact">Contact</PrimaryNavLink>

                        {isAuthenticated && role === 'student' && (
                            <PrimaryNavLink to="/saved-jobs" onClick={closeMenu} tone="violet" icon="saved">
                                Saved Jobs{savedJobsCount > 0 ? ` (${savedJobsCount})` : ''}
                            </PrimaryNavLink>
                        )}
                        {isAuthenticated && role === 'student' && (
                            <PrimaryNavLink to="/candidate/applications" onClick={closeMenu} tone="amber" icon="applications">My Applications</PrimaryNavLink>
                        )}
                        {isAuthenticated && role === 'student' && (
                            <PrimaryNavLink to="/candidate/preferences" onClick={closeMenu} tone="teal" icon="preferences">Preferences</PrimaryNavLink>
                        )}
                    </div>

                    <div className={`hf-nav-actions hf-nav-actions--${isAuthenticated ? role : 'guest'}`}>
                        <span className="hf-nav-section-label hf-nav-account-label">Your account</span>
                        <div className={`hf-nav-account-items hf-nav-account-items--${isAuthenticated ? role : 'guest'}`}>
                            {!isAuthenticated && (
                                <>
                                    <button className="hf-button hf-button-quiet hf-account-action hf-account-action--signin" type="button" onClick={() => openSignIn('Student')}>
                                        Sign in
                                    </button>
                                    <button className="hf-button hf-button-outline hf-account-action hf-account-action--employer" type="button" onClick={() => openSignIn('HR')}>
                                        Employer / Post Job
                                    </button>
                                    <Link className="hf-admin-entry hf-account-action hf-account-action--admin" to="/admin/login" onClick={closeMenu}>
                                        Admin access
                                    </Link>
                                </>
                            )}

                            {isAuthenticated && role === 'student' && (
                                <>
                                    <Link className="hf-dashboard-link hf-account-action-link hf-account-action--home" to="/candidate/home" onClick={closeMenu}>
                                        My Home
                                    </Link>
                                    <button className="hf-account-button hf-account-action--profile" type="button" onClick={goToDashboard} aria-label="Open your account home">
                                        <span className="hf-account-avatar">{getInitials(userName)}</span>
                                        <span className="hf-account-name">{userName}</span>
                                    </button>
                                    <button className="hf-button hf-button-outline hf-account-logout" type="button" onClick={handleLogout}>
                                        Logout
                                    </button>
                                </>
                            )}

                            {isAuthenticated && role === 'hr' && (
                                <>
                                    <Link className="hf-dashboard-link hf-account-action-link hf-account-action--home" to="/hr/jobs/new" onClick={closeMenu}>
                                        Post a Job
                                    </Link>
                                    <button className="hf-account-button hf-account-action--profile" type="button" onClick={goToDashboard} aria-label="Open Employer Workspace">
                                        <span className="hf-account-avatar">{getInitials(userName)}</span>
                                        <span className="hf-account-name">Employer Workspace</span>
                                    </button>
                                    <button className="hf-button hf-button-outline hf-account-logout" type="button" onClick={handleLogout}>
                                        Logout
                                    </button>
                                </>
                            )}

                            {isAuthenticated && role === 'admin' && (
                                <>
                                    <Link className="hf-admin-badge hf-account-action--home" to="/admin/dashboard" onClick={closeMenu}>
                                        Admin Workspace
                                    </Link>
                                    <button className="hf-button hf-button-outline hf-account-logout" type="button" onClick={handleLogout}>
                                        Logout
                                    </button>
                                </>
                            )}

                            {isAuthenticated && !['student', 'hr', 'admin'].includes(role) && (
                                <>
                                    <button className="hf-account-button hf-account-action--profile" type="button" onClick={goToDashboard} aria-label="Open your account">
                                        <span className="hf-account-avatar">{getInitials(userName)}</span>
                                        <span className="hf-account-name">{userName}</span>
                                    </button>
                                    <button className="hf-button hf-button-outline hf-account-logout" type="button" onClick={handleLogout}>
                                        Logout
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </nav>

                <div className="hf-header-utility" aria-label="Header tools">
                    {isAuthenticated && role === 'student' && (
                        <NotificationBell className="hf-header-notification" />
                    )}

                    <button
                        className="hf-theme-toggle hf-header-theme-toggle"
                        type="button"
                        onClick={toggleTheme}
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? (
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.6 8.6 0 1 0 20.5 15.2Z" /></svg>
                        )}
                    </button>
                </div>

                <button
                    ref={menuButtonRef}
                    className="hf-mobile-menu-button"
                    type="button"
                    aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    aria-expanded={menuOpen}
                    aria-controls="hf-primary-navigation"
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <span />
                    <span />
                    <span />
                </button>
            </div>

            {menuOpen && (
                <button
                    className="hf-mobile-backdrop"
                    type="button"
                    aria-label="Close navigation"
                    onClick={closeMenu}
                />
            )}
        </header>
    )
}
