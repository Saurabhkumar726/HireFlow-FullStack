
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const API_URL = 'http://localhost:5116/api/Auth'

let googleScriptPromise

function loadGoogleScript() {
    if (window.google?.accounts?.id) return Promise.resolve()

    if (!googleScriptPromise) {
        googleScriptPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(
                'script[src="https://accounts.google.com/gsi/client"]'
            )
            const script = existingScript || document.createElement('script')

            function handleLoad() {
                if (window.google?.accounts?.id) {
                    resolve()
                } else {
                    googleScriptPromise = null
                    reject(new Error('Google sign-in could not be initialized.'))
                }
            }

            function handleError() {
                googleScriptPromise = null
                reject(
                    new Error(
                        'Unable to load Google sign-in. Check your internet connection.'
                    )
                )
            }

            if (existingScript) {
                if (window.google?.accounts?.id) {
                    resolve()
                    return
                }

                script.addEventListener('load', handleLoad, { once: true })
                script.addEventListener('error', handleError, { once: true })
            } else {
                script.src = 'https://accounts.google.com/gsi/client'
                script.async = true
                script.defer = true
                script.onload = handleLoad
                script.onerror = handleError
                document.head.appendChild(script)
            }
        })
    }

    return googleScriptPromise
}

async function postAuth(endpoint, body) {
    const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        const message =
            data.message ||
            data.title ||
            (Array.isArray(data.errors) ? data.errors.join(' ') : '') ||
            'The request failed. Please try again.'

        throw new Error(message)
    }

    return data
}

function PasswordInput({
    id,
    label,
    value,
    onChange,
    placeholder,
    autoComplete = 'new-password',
    minLength = 8,
    required = true,
}) {
    const [visible, setVisible] = useState(false)

    return (
        <label htmlFor={id}>
            {label}

            <div className="auth-password-field">
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    required={required}
                    minLength={minLength}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="auth-password-input"
                />

                <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setVisible((current) => !current)}
                    aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                    aria-pressed={visible}
                    title={visible ? 'Hide password' : 'Show password'}
                >
                    {visible ? (
                        <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M3 3l18 18" />
                            <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                            <path d="M9.9 5.2A11 11 0 0112 5c5.5 0 9 7 9 7a15.8 15.8 0 01-3.1 3.9" />
                            <path d="M6.2 6.2C3.9 7.7 2 12 2 12s3.5 7 10 7a10.8 10.8 0 004-.8" />
                        </svg>
                    ) : (
                        <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    )}
                </button>
            </div>
        </label>
    )
}

export default function Login({ onClose, onSuccess }) {
    const { login, loginWithGoogle, register } = useAuth()
    const googleButtonRef = useRef(null)

    const [role, setRole] = useState('Student')
    const [mode, setMode] = useState('login')
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [otp, setOtp] = useState('')
    const [resetToken, setResetToken] = useState('')
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false

        if (role !== 'Student' || mode !== 'login' || !GOOGLE_CLIENT_ID) {
            return () => {
                cancelled = true
            }
        }

        loadGoogleScript()
            .then(() => {
                if (cancelled || !googleButtonRef.current) return

                googleButtonRef.current.replaceChildren()

                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: async (response) => {
                        if (!response.credential) {
                            setError('Google did not return a valid credential.')
                            return
                        }

                        setError('')
                        setNotice('')
                        setLoading(true)

                        try {
                            await loginWithGoogle(response.credential)
                            onSuccess?.()
                            onClose?.()
                        } catch (err) {
                            setError(
                                err.message ||
                                'Google sign-in failed. Please try again.'
                            )
                        } finally {
                            setLoading(false)
                        }
                    },
                })

                window.google.accounts.id.renderButton(
                    googleButtonRef.current,
                    {
                        type: 'standard',
                        theme: 'outline',
                        size: 'large',
                        text: 'continue_with',
                        shape: 'rectangular',
                        logo_alignment: 'left',
                        width: Math.max(
                            200,
                            Math.floor(
                                googleButtonRef.current.parentElement.getBoundingClientRect().width
                            )
                        ),
                    }
                )
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(
                        err.message || 'Unable to load Google sign-in.'
                    )
                }
            })

        return () => {
            cancelled = true
        }
    }, [role, mode, loginWithGoogle, onClose, onSuccess])

    function clearMessages() {
        setError('')
        setNotice('')
    }

    function changeRole(nextRole) {
        setRole(nextRole)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setOtp('')
        setResetToken('')
        clearMessages()
    }

    function returnToLogin(message = '') {
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setOtp('')
        setResetToken('')
        setError('')
        setNotice(message)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        clearMessages()
        setLoading(true)

        try {
            if (mode === 'register') {
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match.')
                }

                if (password.length < 8) {
                    throw new Error(
                        'Password must contain at least 8 characters.'
                    )
                }

                await register({
                    fullName: fullName.trim(),
                    email: email.trim(),
                    password,
                    role,
                })

                setPassword('')
                setConfirmPassword('')

                returnToLogin(
                    role === 'HR'
                        ? 'Registration submitted. HR access may require administrator approval. Please sign in after your account is approved.'
                        : 'Account created successfully. Please sign in.'
                )
            } else if (mode === 'login') {
                await login(email.trim(), password, role)
                onSuccess?.()
                onClose?.()
            } else if (mode === 'forgot') {
                await postAuth('forgot-password', {
                    email: email.trim(),
                })

                setMode('verifyOtp')
                setNotice(
                    'If an eligible account exists for this email, a verification code will be sent. Check your inbox and spam folder.'
                )
            } else if (mode === 'verifyOtp') {
                if (!/^\d{6}$/.test(otp)) {
                    throw new Error('Enter the six-digit verification code.')
                }

                const data = await postAuth('verify-reset-otp', {
                    email: email.trim(),
                    otp,
                })

                setResetToken(data.resetToken)
                setOtp('')
                setPassword('')
                setConfirmPassword('')
                setMode('resetPassword')
                setNotice('Email verified. Choose your new password.')
            } else if (mode === 'resetPassword') {
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match.')
                }

                if (password.length < 8) {
                    throw new Error(
                        'Password must contain at least 8 characters.'
                    )
                }

                await postAuth('reset-password', {
                    resetToken,
                    newPassword: password,
                })

                setPassword('')
                setConfirmPassword('')
                returnToLogin(
                    'Password reset successfully. Please sign in with your new password.'
                )
            }
        } catch (err) {
            setError(
                err.message || 'Something went wrong. Please try again.'
            )
        } finally {
            setLoading(false)
        }
    }

    function showForgotPassword() {
        clearMessages()
        setPassword('')
        setConfirmPassword('')
        setOtp('')
        setResetToken('')
        setMode('forgot')
    }

    async function resendOtp() {
        clearMessages()
        setLoading(true)

        try {
            await postAuth('forgot-password', {
                email: email.trim(),
            })

            setNotice(
                'If an eligible account exists, a new verification code will be sent. Check your inbox and spam folder.'
            )
        } catch (err) {
            setError(err.message || 'Unable to request another code.')
        } finally {
            setLoading(false)
        }
    }

    const isRecoveryMode = [
        'forgot',
        'verifyOtp',
        'resetPassword',
    ].includes(mode)

    const title = {
        login: 'Welcome to HireFlow',
        register: 'Create your account',
        forgot: 'Forgot password?',
        verifyOtp: 'Verify your email',
        resetPassword: 'Create a new password',
    }[mode]

    const description = {
        login: role === 'Student'
            ? 'Find your next opportunity and keep track of your applications.'
            : 'Manage job postings and connect with talented candidates.',
        register: 'Create your HireFlow account to get started.',
        forgot: 'Enter your registered email address and we will send you a verification code.',
        verifyOtp: 'Enter the six-digit code sent to your email address.',
        resetPassword: 'Choose a strong password for your HireFlow account.',
    }[mode]

    return (
        <div className="auth-overlay" onClick={onClose}>
            <section
                className="auth-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="login-title"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    className="auth-close"
                    onClick={onClose}
                    aria-label="Close authentication"
                >
                    ×
                </button>

                <div className="auth-brand">
                    <span className="brand-mark">H</span>
                    <span>
                        hire<span className="brand-accent">flow</span>
                    </span>
                </div>

                <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>

                <h2 id="login-title">{title}</h2>

                <p className="auth-description">{description}</p>

                {!isRecoveryMode && (
                    <div className="auth-role-switch" aria-label="Account type">
                        <button
                            type="button"
                            className={role === 'Student' ? 'active' : ''}
                            aria-pressed={role === 'Student'}
                            onClick={() => changeRole('Student')}
                        >
                            Student
                        </button>

                        <button
                            type="button"
                            className={role === 'HR' ? 'active' : ''}
                            aria-pressed={role === 'HR'}
                            onClick={() => changeRole('HR')}
                        >
                            HR / Employer
                        </button>
                    </div>
                )}

                {role === 'Student' && mode === 'login' && (
                    <>
                        {!GOOGLE_CLIENT_ID ? (
                            <p className="auth-notice" role="status">
                                Google sign-in needs VITE_GOOGLE_CLIENT_ID in
                                frontend/.env.local. Restart the frontend after
                                configuring it.
                            </p>
                        ) : (
                            <div className="auth-google-shell" aria-label="Continue with Google">
                                <div className="auth-google-visual" aria-hidden="true">
                                    <svg className="auth-google-logo" viewBox="0 0 48 48">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" transform="translate(0 4)" />
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.98 46.98 31.9 46.98 24.55z" />
                                        <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z" transform="translate(0 0)" />
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" transform="translate(0 -1)" />
                                    </svg>
                                    <span>Continue with Google</span>
                                </div>
                                <div
                                    className="auth-google"
                                    ref={googleButtonRef}
                                />
                            </div>
                        )}
                    </>
                )}

                {role === 'HR' && mode === 'login' && (
                    <p className="auth-notice" role="status">
                        Google sign-in is available for Student accounts only.
                    </p>
                )}

                {!isRecoveryMode && (
                    <div className="auth-divider">
                        <span>or continue with email</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    {mode === 'register' && (
                        <label htmlFor="auth-full-name">
                            Full name
                            <input
                                id="auth-full-name"
                                type="text"
                                autoComplete="name"
                                required
                                maxLength={100}
                                value={fullName}
                                onChange={(event) =>
                                    setFullName(event.target.value)
                                }
                                placeholder="Enter your full name"
                            />
                        </label>
                    )}

                    {(mode === 'login' ||
                        mode === 'register' ||
                        mode === 'forgot') && (
                            <label htmlFor="auth-email">
                                Email address
                                <input
                                    id="auth-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    maxLength={254}
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    placeholder="you@example.com"
                                    readOnly={mode === 'forgot' && false}
                                />
                            </label>
                        )}

                    {mode === 'verifyOtp' && (
                        <>
                            <label htmlFor="auth-otp-email">
                                Email address
                                <input
                                    id="auth-otp-email"
                                    type="email"
                                    value={email}
                                    readOnly
                                />
                            </label>

                            <label htmlFor="auth-otp">
                                Six-digit verification code
                                <input
                                    id="auth-otp"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    required
                                    value={otp}
                                    onChange={(event) =>
                                        setOtp(
                                            event.target.value
                                                .replace(/\D/g, '')
                                                .slice(0, 6)
                                        )
                                    }
                                    placeholder="Enter OTP"
                                />
                            </label>
                        </>
                    )}

                    {(mode === 'login' ||
                        mode === 'register' ||
                        mode === 'resetPassword') && (
                            <PasswordInput
                                id="auth-password"
                                label={
                                    mode === 'resetPassword'
                                        ? 'New password'
                                        : 'Password'
                                }
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                autoComplete={
                                    mode === 'login'
                                        ? 'current-password'
                                        : 'new-password'
                                }
                                minLength={8}
                                placeholder={
                                    mode === 'login'
                                        ? 'Enter your password'
                                        : 'Create a password (8+ characters)'
                                }
                            />
                        )}

                    {(mode === 'register' ||
                        mode === 'resetPassword') && (
                            <PasswordInput
                                id="auth-confirm-password"
                                label="Confirm password"
                                value={confirmPassword}
                                onChange={(event) =>
                                    setConfirmPassword(event.target.value)
                                }
                                autoComplete="new-password"
                                minLength={8}
                                placeholder="Re-enter your password"
                            />
                        )}

                    {mode === 'login' && (
                        <div className="auth-forgot-row">
                            <button
                                type="button"
                                className="auth-text-button"
                                onClick={showForgotPassword}
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}

                    {error && (
                        <p className="auth-error" role="alert">
                            {error}
                        </p>
                    )}

                    {notice && (
                        <p className="auth-notice" role="status">
                            {notice}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="button-primary auth-submit"
                        disabled={loading}
                    >
                        {loading
                            ? 'Please wait...'
                            : mode === 'register'
                                ? role === 'HR'
                                    ? 'Register as HR'
                                    : 'Create account'
                                : mode === 'login'
                                    ? 'Sign in'
                                    : mode === 'forgot'
                                        ? 'Send verification code'
                                        : mode === 'verifyOtp'
                                            ? 'Verify code'
                                            : 'Reset password'}
                    </button>
                </form>

                <p className="auth-switch-copy">
                    {isRecoveryMode ? (
                        <>
                            Remembered your password?{' '}
                            <button
                                type="button"
                                className="auth-text-button"
                                onClick={() => returnToLogin()}
                            >
                                Back to sign in
                            </button>
                        </>
                    ) : (
                        <>
                            {mode === 'register'
                                ? 'Already have an account?'
                                : 'New to HireFlow?'}{' '}
                            <button
                                type="button"
                                className="auth-text-button"
                                onClick={() => {
                                    setMode(
                                        mode === 'register'
                                            ? 'login'
                                            : 'register'
                                    )
                                    setPassword('')
                                    setConfirmPassword('')
                                    clearMessages()
                                }}
                            >
                                {mode === 'register'
                                    ? 'Sign in'
                                    : 'Create account'}
                            </button>
                        </>
                    )}
                </p>

                {mode === 'verifyOtp' && (
                    <p className="auth-switch-copy">
                        Didn't receive a code?{' '}
                        <button
                            type="button"
                            className="auth-text-button"
                            disabled={loading}
                            onClick={resendOtp}
                        >
                            Resend OTP
                        </button>
                    </p>
                )}

                <p className="auth-footnote">
                    {role === 'HR'
                        ? 'HR accounts may require administrator approval before access is granted.'
                        : 'Your career journey starts with one step.'}
                </p>
            </section>
        </div>
    )
}
