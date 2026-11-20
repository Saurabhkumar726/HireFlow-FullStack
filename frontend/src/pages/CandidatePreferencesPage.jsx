import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import CandidatePreferencesForm from '../components/CandidatePreferencesForm'
import './CandidatePreferencesPage.css'
import SkeletonLoader from '../components/SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

async function request(path, token, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || data.title || `Request failed (${response.status}).`)
    return data
}

const EMPTY_PREFERENCES = {
    preferredRoles: [], preferredIndustries: [], preferredSkills: [], preferredLocations: [],
    employmentTypes: [], workModes: [], experienceLevel: '', expectedSalary: '', salaryCurrency: 'INR', salaryPeriod: 'Yearly',
}

export default function CandidatePreferencesPage() {
    const { token, user } = useAuth()
    const [preferences, setPreferences] = useState(EMPTY_PREFERENCES)
    const [hasPreferences, setHasPreferences] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const loadPreferences = useCallback(async () => {
        if (!token) {
            setLoading(false)
            setError('Please sign in with your Student account to manage job preferences.')
            return
        }
        setLoading(true)
        setError('')
        try {
            const data = await request('/CandidateJobPreferences', token)
            setPreferences({ ...EMPTY_PREFERENCES, ...(data.preferences || {}) })
            setHasPreferences(Boolean(data.hasPreferences))
        } catch (loadError) {
            setError(loadError.message || 'Unable to load your job preferences.')
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        let active = true
        Promise.resolve().then(() => { if (active) loadPreferences() })
        return () => { active = false }
    }, [loadPreferences])

    async function savePreferences(nextPreferences) {
        setSaving(true)
        setError('')
        setMessage('')
        try {
            const data = await request('/CandidateJobPreferences', token, {
                method: 'PUT',
                body: JSON.stringify(nextPreferences),
            })
            setPreferences({ ...EMPTY_PREFERENCES, ...(data.preferences || nextPreferences) })
            setHasPreferences(Boolean(data.hasPreferences))
            setMessage('Your preferences are saved. Your job feed will use these choices.')
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (saveError) {
            setError(saveError.message || 'Unable to save your preferences. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <main className="candidate-preferences-page">
            <div className="candidate-preferences-container">
                <Link className="candidate-preferences-back" to="/candidate/home">← Back to your job feed</Link>
                <header className="candidate-preferences-hero">
                    <span className="candidate-preferences-eyebrow">PERSONALIZE YOUR DISCOVERY</span>
                    <h1>Make your next role <em>find you.</em></h1>
                    <p>Hi {user?.fullName?.split(' ')[0] || 'there'} — choose the roles, skills, locations, and work arrangements you want HireFlow to prioritize.</p>
                </header>

                {message && <div className="candidate-preferences-alert is-success" role="status">{message}</div>}
                {error && <div className="candidate-preferences-alert is-error" role="alert"><span>{error}</span><button type="button" onClick={loadPreferences}>Retry</button></div>}

                {loading ? (
                    <SkeletonLoader variant="form" count={6} />
                ) : (
                    <>
                        <section className="candidate-preferences-info-card">
                            <div className="candidate-preferences-info-icon" aria-hidden="true">✦</div>
                            <div>
                                <strong>{hasPreferences ? 'Your job discovery is personalized' : 'Start with popular opportunities'}</strong>
                                <p>{hasPreferences ? 'Your current profile details were used as starting suggestions. You can change any selection below.' : 'You do not need to complete this page to explore jobs. Save preferences whenever you are ready for more personalized recommendations.'} Saving discovery preferences does not overwrite your Student Profile.</p>
                            </div>
                            <span className={`candidate-preferences-status ${hasPreferences ? 'is-active' : ''}`}>{hasPreferences ? 'Personalized' : 'Optional'}</span>
                        </section>
                        <CandidatePreferencesForm key={JSON.stringify(preferences)} initialPreferences={preferences} onSubmit={savePreferences} submitting={saving} submitLabel="Save my preferences" />
                    </>
                )}
            </div>
        </main>
    )
}
