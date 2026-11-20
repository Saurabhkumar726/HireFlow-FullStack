import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock3, LogOut, RefreshCw, ShieldCheck, Trash2, Users } from './AdminIcons'
import { useAuth } from '../context/useAuth'
import './AdminDashboard.css'
import AdminThemeToggle from './AdminThemeToggle'
import SkeletonLoader from '../components/SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

async function readResponse(response) {
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(data.message || data.title || `Request failed (${response.status}).`)
    }
    return data
}

function AdminDashboard() {
    const navigate = useNavigate()
    const { user, token, logout } = useAuth()
    const [pendingAccounts, setPendingAccounts] = useState([])
    const [companies, setCompanies] = useState([])
    const [activeTab, setActiveTab] = useState('hr')
    const [companiesLoading, setCompaniesLoading] = useState(false)
    const [companyBusyId, setCompanyBusyId] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [busyId, setBusyId] = useState('')

    const loadPendingAccounts = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const response = await fetch(`${API_URL}/Admin/pending-hr`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await readResponse(response)
            setPendingAccounts(Array.isArray(data) ? data : [])
        } catch (err) {
            setError(err?.message || 'Could not load pending HR accounts.')
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        Promise.resolve().then(() => loadPendingAccounts())
    }, [loadPendingAccounts])

    const loadCompanies = useCallback(async () => {
        setCompaniesLoading(true)
        setError('')
        try {
            const response = await fetch(`${API_URL}/Companies/admin`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await readResponse(response)
            setCompanies(Array.isArray(data) ? data : [])
        } catch (err) {
            setError(err?.message || 'Could not load company profiles.')
        } finally {
            setCompaniesLoading(false)
        }
    }, [token])

    useEffect(() => {
        Promise.resolve().then(() => loadCompanies())
    }, [loadCompanies])

    async function handleAccountAction(account, action) {
        const accountName = account.fullName || account.FullName || account.email || account.Email || 'this account'
        const approved = action === 'approve'
        const confirmed = window.confirm(
            approved
                ? `Approve ${accountName} and allow this HR account to access HireFlow?`
                : `Reject and permanently remove the pending HR account for ${accountName}?`
        )
        if (!confirmed) return

        const id = account.id ?? account.Id
        if (!id) {
            setError('This account does not contain a valid user ID.')
            return
        }

        setBusyId(String(id))
        setError('')
        setNotice('')
        try {
            const endpoint = approved
                ? `${API_URL}/Admin/hr/${encodeURIComponent(id)}/approve`
                : `${API_URL}/Admin/hr/${encodeURIComponent(id)}/reject`
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            })
            const result = await readResponse(response)
            setPendingAccounts((current) => current.filter((item) => String(item.id ?? item.Id) !== String(id)))
            setNotice(result.message || (approved ? 'HR account approved.' : 'HR account rejected.'))
        } catch (err) {
            setError(err?.message || `Could not ${action} this account.`)
        } finally {
            setBusyId('')
        }
    }

    async function handleCompanyReview(company, status) {
        const companyName = company.name || 'this company'
        let reason = ''
        if (status === 'Rejected' || status === 'NeedsInfo') {
            reason = window.prompt(status === 'Rejected' ? `Why are you rejecting ${companyName}?` : `What information is needed from ${companyName}?`, '') || ''
            if (!reason.trim()) return
        } else if (!window.confirm(`Approve ${companyName}'s public company profile?`)) {
            return
        }

        setCompanyBusyId(String(company.id))
        setError('')
        setNotice('')
        try {
            const response = await fetch(`${API_URL}/Companies/${company.id}/approval`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status, reason }),
            })
            const result = await readResponse(response)
            setNotice(result.message || `Company profile marked ${status}.`)
            await loadCompanies()
        } catch (err) {
            setError(err?.message || 'Could not update the company profile.')
        } finally {
            setCompanyBusyId('')
        }
    }

    async function handleCompanyFeature(company) {
        setCompanyBusyId(String(company.id))
        setError('')
        setNotice('')
        try {
            const response = await fetch(`${API_URL}/Companies/${company.id}/featured`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ isFeatured: !company.isFeatured }),
            })
            const result = await readResponse(response)
            setNotice(result.message || 'Company featuring updated.')
            await loadCompanies()
        } catch (err) {
            setError(err?.message || 'Could not update featured status.')
        } finally {
            setCompanyBusyId('')
        }
    }

    function handleLogout() {
        logout()
        navigate('/admin/login', { replace: true })
    }

    const getValue = (account, camel, pascal) => account[camel] ?? account[pascal] ?? ''

    return (
        <div className="admin-dashboard-page">
            <header className="admin-dashboard-header">
                <div className="admin-dashboard-brand-group">
                    <button type="button" className="admin-dashboard-brand" onClick={() => navigate('/admin/dashboard')}><span className="admin-brand-mark">H</span><span>hire<span>flow</span></span><small>ADMIN</small></button>
                    <AdminThemeToggle />
                </div>
                <div className="admin-dashboard-user"><div className="admin-dashboard-avatar">{(user?.fullName || 'A').trim().charAt(0).toUpperCase()}</div><div><strong>{user?.fullName || 'Administrator'}</strong><span>Administrator</span></div><button type="button" className="admin-logout-button" onClick={handleLogout}><LogOut size={17} /><span>Log out</span></button></div>
            </header>

            <main className="admin-dashboard-main">
                <div className="admin-dashboard-heading"><div><p className="admin-card-eyebrow">ADMINISTRATION / HIRE FLOW</p><h1>{activeTab === 'hr' ? 'HR account approvals' : 'Company management'}</h1><p>{activeTab === 'hr' ? 'Review employer registrations before they can use the HR workspace.' : 'Review public company profiles and control homepage featuring.'}</p></div><button type="button" className="admin-refresh-button" onClick={activeTab === 'hr' ? loadPendingAccounts : loadCompanies} disabled={loading || companiesLoading}><RefreshCw size={17} className={loading || companiesLoading ? 'admin-refresh-spinning' : ''} /> Refresh</button></div>

                <nav className="admin-management-tabs" aria-label="Admin management sections">
                    <button type="button" className={activeTab === 'hr' ? 'active' : ''} onClick={() => setActiveTab('hr')}>HR approvals <span>{pendingAccounts.length}</span></button>
                    <button type="button" className={activeTab === 'companies' ? 'active' : ''} onClick={() => setActiveTab('companies')}>Company profiles <span>{companies.filter(item => item.approvalStatus === 'Pending' || item.approvalStatus === 'NeedsInfo').length}</span></button>
                </nav>

                {error && <div className="admin-dashboard-alert admin-dashboard-alert-error" role="alert">{error}</div>}
                {notice && <div className="admin-dashboard-alert admin-dashboard-alert-success" role="status">{notice}</div>}

                {activeTab === 'hr' ? <>
                    <section className="admin-summary-card"><div className="admin-summary-icon"><Clock3 size={22} /></div><div><span>Pending review</span><strong>{loading ? '—' : pendingAccounts.length}</strong></div><div className="admin-summary-note"><ShieldCheck size={16} /> Only approved HR accounts can access protected HR tools.</div></section>
                    <section className="admin-accounts-panel">
                        <div className="admin-accounts-panel-heading"><div><h2><Users size={20} /> Pending HR registrations</h2><p>Review the details provided at registration.</p></div><span className="admin-count-pill">{pendingAccounts.length} pending</span></div>
                        {loading ? (
                            <SkeletonLoader variant="table" count={5} columns={6} />
                        ) : pendingAccounts.length === 0 ? (
                            <div className="admin-table-state"><span className="admin-empty-icon"><Check size={24} /></span><strong>You're all caught up</strong><span>There are no HR accounts waiting for approval.</span></div>
                        ) : (
                            <div className="admin-table-scroll"><table className="admin-accounts-table"><thead><tr><th>HR applicant</th><th>Email</th><th>Company</th><th>Phone</th><th>Registration date</th><th>Actions</th></tr></thead><tbody>
                                {pendingAccounts.map((account) => {
                                    const id = String(getValue(account, 'id', 'Id'))
                                    const fullName = getValue(account, 'fullName', 'FullName') || '—'
                                    const email = getValue(account, 'email', 'Email') || '—'
                                    const company = getValue(account, 'company', 'Company') || 'Not provided by current API'
                                    const phone = getValue(account, 'phoneNumber', 'PhoneNumber') || getValue(account, 'phone', 'Phone') || 'Not provided by current API'
                                    const registeredAt = getValue(account, 'createdAt', 'CreatedAt')
                                    return <tr key={id}><td><div className="admin-applicant-cell"><span className="admin-applicant-avatar">{fullName.charAt(0).toUpperCase()}</span><strong>{fullName}</strong></div></td><td>{email}</td><td>{company}</td><td>{phone}</td><td>{registeredAt ? new Date(registeredAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td><td><div className="admin-row-actions"><button type="button" className="admin-approve-button" disabled={Boolean(busyId)} onClick={() => handleAccountAction(account, 'approve')}>{busyId === id ? <span className="admin-action-spinner" /> : <Check size={15} />} Approve</button><button type="button" className="admin-reject-button" disabled={Boolean(busyId)} onClick={() => handleAccountAction(account, 'reject')}><Trash2 size={15} /> Reject</button></div></td></tr>
                                })}
                            </tbody></table></div>
                        )}
                    </section>
                    <p className="admin-dashboard-footnote"><ShieldCheck size={15} /> Admin decisions are sent to the existing protected HireFlow API. Existing HR approval behaviour is preserved.</p>
                </> : <section className="admin-accounts-panel">
                    <div className="admin-accounts-panel-heading"><div><h2><ShieldCheck size={20} /> Company profile reviews</h2><p>Approve company profiles before publishing their extended public information.</p></div><span className="admin-count-pill">{companies.length} profiles</span></div>
                    {companiesLoading ? <SkeletonLoader variant="table" count={5} columns={7} /> : companies.length === 0 ? <div className="admin-table-state"><strong>No company profiles submitted</strong><span>Employer company profiles will appear here for review.</span></div> : <div className="admin-table-scroll"><table className="admin-accounts-table"><thead><tr><th>Company</th><th>Industry</th><th>Location</th><th>Open Jobs</th><th>Status</th><th>Homepage</th><th>Actions</th></tr></thead><tbody>{companies.map(company => <tr key={company.id}><td><strong>{company.name}</strong><small className="admin-company-subline">{company.website || 'Website not supplied'}</small></td><td>{company.industry || '—'}</td><td>{company.location || '—'}</td><td>{company.activeJobsCount ?? 0}</td><td><span className={`admin-company-status ${String(company.approvalStatus || '').toLowerCase()}`}>{company.approvalStatus}</span>{company.reviewReason && <small className="admin-company-subline">{company.reviewReason}</small>}</td><td>{company.isFeatured ? 'Featured' : 'Standard'}</td><td><div className="admin-row-actions">{company.approvalStatus !== 'Approved' && <button type="button" className="admin-approve-button" disabled={Boolean(companyBusyId)} onClick={() => handleCompanyReview(company, 'Approved')}>{companyBusyId === String(company.id) ? <span className="admin-action-spinner" /> : <Check size={15} />} Approve</button>}{company.approvalStatus !== 'NeedsInfo' && company.approvalStatus !== 'Rejected' && <button type="button" className="admin-review-button" disabled={Boolean(companyBusyId)} onClick={() => handleCompanyReview(company, 'NeedsInfo')}>Request info</button>}{company.approvalStatus !== 'Rejected' && <button type="button" className="admin-reject-button" disabled={Boolean(companyBusyId)} onClick={() => handleCompanyReview(company, 'Rejected')}><Trash2 size={15} /> Reject</button>}{company.approvalStatus === 'Approved' && <button type="button" className="admin-feature-button" disabled={Boolean(companyBusyId)} onClick={() => handleCompanyFeature(company)}>{company.isFeatured ? 'Unfeature' : 'Feature'}</button>}</div></td></tr>)}</tbody></table></div>}
                </section>}
            </main>
        </div>
    )
}

export default AdminDashboard
