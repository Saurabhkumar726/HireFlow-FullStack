import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck, Users, Zap } from './AdminIcons'
import { useAuth } from '../context/useAuth'
import './AdminLogin.css'
import AdminThemeToggle from './AdminThemeToggle'

function AdminLogin() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')
        setLoading(true)

        try {
            const signedInUser = await login(email.trim(), password, 'Admin')
            if (signedInUser?.role !== 'Admin') {
                throw new Error('This account is not authorized for the Admin workspace.')
            }
            navigate('/admin/dashboard', { replace: true })
        } catch (err) {
            setError(err?.message || 'Unable to sign in. Please verify your credentials.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="admin-portal-page">
            <header className="admin-public-header">
                <div className="admin-brand-group">
                    <button className="admin-brand" type="button" onClick={() => navigate('/')} aria-label="Back to HireFlow home">
                        <span className="admin-brand-mark">H</span>
                        <span>hire<span>flow</span></span>
                    </button>
                    <AdminThemeToggle />
                </div>
                <div className="admin-header-actions">
                    <span className="admin-secure-label"><ShieldCheck size={15} /> Secure administrator access</span>
                    <button type="button" className="admin-back-link" onClick={() => navigate('/')}>Back to main site</button>
                </div>
            </header>

            <main>
                <section className="admin-hero-section">
                    <div className="admin-hero-copy">
                        <div className="admin-eyebrow"><span /> H I R E F L O W&nbsp; A D M I N I S T R A T I O N</div>
                        <h1>Better hiring starts with <span>better oversight.</span></h1>
                        <p className="admin-hero-description">A dedicated workspace to help keep HireFlow trusted, organized, and ready for the next opportunity.</p>
                        <div className="admin-value-points">
                            <div><CheckCircle2 size={18} /><span>Review and approve employer accounts</span></div>
                            <div><CheckCircle2 size={18} /><span>Protect the quality of the hiring community</span></div>
                            <div><CheckCircle2 size={18} /><span>Manage access from one secure workspace</span></div>
                        </div>
                        <div className="admin-hero-stats">
                            <div><strong><Users size={19} /> People first</strong><span>Built around trusted connections</span></div>
                            <div><strong><Zap size={19} /> One workspace</strong><span>Clear, focused administration</span></div>
                        </div>
                    </div>

                    <section className="admin-login-card" aria-labelledby="admin-login-title">
                        <div className="admin-login-icon"><LockKeyhole size={23} /></div>
                        <p className="admin-card-eyebrow">ADMINISTRATOR PORTAL</p>
                        <h2 id="admin-login-title">Welcome back</h2>
                        <p className="admin-login-intro">Sign in with your pre-configured administrator account.</p>

                        <form onSubmit={handleSubmit} className="admin-login-form">
                            <label htmlFor="admin-email">Administrator email</label>
                            <input id="admin-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@yourcompany.com" />

                            <label htmlFor="admin-password">Password</label>
                            <div className="admin-password-wrap">
                                <input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
                                <button type="button" className="admin-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                            </div>

                            {error && <div className="admin-login-error" role="alert">{error}</div>}

                            <button className="admin-submit-button" type="submit" disabled={loading}>
                                {loading ? <><span className="admin-button-spinner" /> Signing in...</> : <>Sign in securely <ArrowRight size={18} /></>}
                            </button>
                        </form>

                        <div className="admin-login-security"><ShieldCheck size={16} /><span>Access is restricted to the configured Admin account. Public Admin registration is not available.</span></div>
                        <p className="admin-forgot-note">Forgot your password? Contact the system administrator to use the configured account recovery process.</p>
                    </section>
                </section>

                <section className="admin-about-section" id="about-hireflow">
                    <div className="admin-about-heading">
                        <p className="admin-card-eyebrow">ABOUT H I R E F L O W</p>
                        <h2>Connecting ambition with opportunity.</h2>
                        <p>HireFlow brings job seekers and employers together in one organized hiring experience. The Admin workspace supports that mission by helping keep employer access accountable.</p>
                    </div>
                    <div className="admin-about-cards">
                        <article><span className="admin-about-card-icon"><BriefcaseBusiness size={21} /></span><h3>Meaningful opportunities</h3><p>Help employers connect with candidates and keep job discovery moving.</p></article>
                        <article><span className="admin-about-card-icon"><ShieldCheck size={21} /></span><h3>Trusted employers</h3><p>Review new HR registrations before they can access employer tools.</p></article>
                        <article><span className="admin-about-card-icon"><Users size={21} /></span><h3>A better community</h3><p>Support a hiring platform built around clear access and responsible management.</p></article>
                    </div>
                </section>
            </main>

            <footer className="admin-public-footer"><span>© {new Date().getFullYear()} HireFlow</span><span>Administrator access · Secure workspace</span><button type="button" onClick={() => navigate('/')}>Return to HireFlow ↗</button></footer>
        </div>
    )
}

export default AdminLogin
