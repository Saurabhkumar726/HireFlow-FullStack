import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import CityLocationAutocomplete from '../../components/CityLocationAutocomplete'
import './HRCompanyProfile.css'
import SkeletonLoader from '../../components/SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

async function readResponse(response) {
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || data.title || `Request failed (${response.status}).`)
    return data
}

const emptyForm = { name: '', description: '', industry: '', location: '', website: '', logoUrl: '' }

export default function HRCompanyProfile() {
    const { token } = useAuth()
    const [company, setCompany] = useState(null)
    const [form, setForm] = useState(emptyForm)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const loadCompany = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const response = await fetch(`${API_URL}/Companies/mine`, { headers: { Authorization: `Bearer ${token}` } })
            const data = await readResponse(response)
            setCompany(data)
            setForm({ name: data.name || '', description: data.description || '', industry: data.industry || '', location: data.location || '', website: data.website || '', logoUrl: data.logoUrl || '' })
        } catch (requestError) {
            if (requestError.message?.includes('(404)') || requestError.message?.toLowerCase().includes('not created')) {
                setCompany(null)
                setForm(emptyForm)
            } else if (requestError.message?.toLowerCase().includes('not found')) {
                setCompany(null)
                setForm(emptyForm)
            } else {
                setError(requestError.message || 'Unable to load your company profile.')
            }
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { Promise.resolve().then(() => loadCompany()) }, [loadCompany])

    function change(field, value) {
        setForm(current => ({ ...current, [field]: value }))
    }

    async function submit(event) {
        event.preventDefault()
        setSaving(true)
        setError('')
        setNotice('')
        try {
            const response = await fetch(`${API_URL}/Companies${company ? '/mine' : ''}`, {
                method: company ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            })
            const data = await readResponse(response)
            setCompany(data)
            setForm({ name: data.name || '', description: data.description || '', industry: data.industry || '', location: data.location || '', website: data.website || '', logoUrl: data.logoUrl || '' })
            setNotice(company ? 'Company details updated and sent for Admin review.' : 'Company profile created and submitted for Admin approval.')
        } catch (requestError) {
            setError(requestError.message || 'Unable to save your company profile.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <section className="hr-company-profile-page"><SkeletonLoader variant="form" count={5} /></section>

    return (
        <section className="hr-company-profile-page">
            <header className="hr-company-profile-intro"><div><span className="hr-company-eyebrow">EMPLOYER BRAND</span><h2>Your company profile</h2><p>Give candidates a clear picture of your organization. Public company details appear after Admin approval.</p></div>{company && <span className={`hr-company-status status-${String(company.approvalStatus || 'Pending').toLowerCase()}`}>{company.approvalStatus || 'Pending'}</span>}</header>
            {error && <div className="hr-company-alert error" role="alert">{error}</div>}
            {notice && <div className="hr-company-alert success" role="status">{notice}</div>}
            {company?.reviewReason && <div className="hr-company-review-reason"><strong>Admin review note</strong><p>{company.reviewReason}</p><span>Update the information below and save it to resubmit for review.</span></div>}
            <form className="hr-company-form" onSubmit={submit}>
                <div className="hr-company-form-grid">
                    <label>Company name <input required minLength={2} maxLength={150} value={form.name} onChange={event => change('name', event.target.value)} placeholder="Your registered company name" /></label>
                    <label>Industry <input maxLength={120} value={form.industry} onChange={event => change('industry', event.target.value)} placeholder="e.g. Software & IT Services" /></label>
                    <label>Company location <CityLocationAutocomplete maxLength={150} value={form.location} onChange={value => change('location', value)} placeholder="City, State, India" ariaLabel="Company location" /></label>
                    <label>Company website <input type="url" maxLength={500} value={form.website} onChange={event => change('website', event.target.value)} placeholder="https://example.com" /></label>
                    <label className="wide">Company logo URL <input type="url" maxLength={1000} value={form.logoUrl} onChange={event => change('logoUrl', event.target.value)} placeholder="https://example.com/logo.png (optional)" /><small>When no logo is supplied, HireFlow displays company initials.</small></label>
                    <label className="wide">Company overview <textarea rows={6} maxLength={3000} value={form.description} onChange={event => change('description', event.target.value)} placeholder="Describe your organization, products, team and working culture…" /></label>
                </div>
                <div className="hr-company-form-footer"><p>{company ? 'Changes to company information are reviewed again before the updated profile is publicly displayed.' : 'New company profiles start as Pending until an Admin reviews them.'}</p><button type="submit" disabled={saving}>{saving ? 'Saving…' : company ? 'Save and resubmit →' : 'Create company profile →'}</button></div>
            </form>
        </section>
    )
}
