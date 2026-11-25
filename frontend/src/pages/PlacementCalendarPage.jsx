import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './PlacementCalendarPage.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

const UPCOMING_DRIVES = [
    {
        id: 'drive-1',
        company: 'Google India',
        role: 'Software Engineering Intern (Summer 2027)',
        type: 'Campus Drive',
        deadline: '2026-12-05T23:59:59',
        testDate: '2026-12-10T10:00:00',
        interviewDates: '2026-12-18 - 2026-12-20',
        eligibility: 'B.Tech CSE/IT, CGPA >= 7.5, Zero active backlogs',
        stipend: '₹1,25,000 / month',
        status: 'Registration Open',
        badgeColor: 'green'
    },
    {
        id: 'drive-2',
        company: 'Amazon AWS',
        role: 'SDE-1 (Graduate 2026)',
        type: 'Online Assessment (OA)',
        deadline: '2026-12-02T18:00:00',
        testDate: '2026-12-04T15:00:00',
        interviewDates: '2026-12-14 onwards',
        eligibility: 'B.Tech / MCA, CGPA >= 7.0',
        stipend: '₹28 - 32 LPA CTC',
        status: 'Closing Soon',
        badgeColor: 'amber'
    },
    {
        id: 'drive-3',
        company: 'TechFlow Systems',
        role: 'Full-Stack Developer',
        type: 'Technical Round 1',
        deadline: '2026-11-28T12:00:00',
        testDate: 'Completed',
        interviewDates: '2026-11-30T14:30:00',
        eligibility: 'React, ASP.NET Core, PostgreSQL',
        stipend: '₹14 - 18 LPA CTC',
        status: 'Interview Scheduled',
        badgeColor: 'blue'
    }
]

export default function PlacementCalendarPage() {
    const [activeTab, setActiveTab] = useState('calendar') // 'calendar', 'vault', 'alerts'

    // Vault State
    const [vaultDocuments, setVaultDocuments] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('hireflow-vault-docs') || '[]')
        } catch {
            return []
        }
    })
    const [newDocTitle, setNewDocTitle] = useState('')
    const [newDocType, setNewDocType] = useState('Degree / Transcript')
    const [copiedBundle, setCopiedBundle] = useState(false)

    useEffect(() => {
        let isCancelled = false
        async function fetchVaultDocs() {
            try {
                const res = await fetch(`${API_BASE}/Vault/documents`)
                if (res.ok && !isCancelled) {
                    const data = await res.json()
                    if (Array.isArray(data) && data.length > 0) {
                        const mapped = data.map(d => ({
                            id: d.id,
                            title: d.title,
                            type: d.category,
                            uploadedAt: new Date(d.createdAtUtc || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                            verified: d.verifiedByCollege
                        }))
                        setVaultDocuments(mapped)
                        localStorage.setItem('hireflow-vault-docs', JSON.stringify(mapped))
                    }
                }
            } catch {
                // fallback to localStorage
            }
        }
        fetchVaultDocs()
        return () => { isCancelled = true }
    }, [])

    // Activity Feed State
    const [activities] = useState([
        { id: 1, text: 'Recruiter from TechFlow Systems viewed your verified ATS resume.', time: '10 mins ago', type: 'view' },
        { id: 2, text: 'Your application for Full-Stack Developer was moved to "Shortlisted".', time: '2 hours ago', type: 'status' },
        { id: 3, text: 'Amazon AWS recruitment team verified your 400+ GitHub commits badge.', time: 'Yesterday', type: 'verified' },
        { id: 4, text: 'Technical interview confirmed with TechFlow for Nov 30th at 2:30 PM IST.', time: '2 days ago', type: 'interview' }
    ])

    async function handleAddDoc(e) {
        e.preventDefault()
        if (!newDocTitle.trim()) return
        const doc = {
            id: String(Date.now()),
            title: newDocTitle.trim(),
            type: newDocType,
            uploadedAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            verified: true
        }
        const next = [doc, ...vaultDocuments]
        setVaultDocuments(next)
        localStorage.setItem('hireflow-vault-docs', JSON.stringify(next))
        setNewDocTitle('')

        try {
            await fetch(`${API_BASE}/Vault/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: doc.title, category: doc.type })
            })
        } catch {
            // saved locally
        }
    }

    async function handleDeleteDoc(id) {
        const next = vaultDocuments.filter(d => d.id !== id)
        setVaultDocuments(next)
        localStorage.setItem('hireflow-vault-docs', JSON.stringify(next))

        try {
            await fetch(`${API_BASE}/Vault/documents/${id}`, {
                method: 'DELETE'
            })
        } catch {
            // deleted locally
        }
    }

    function handleCopyBundle() {
        const url = `${window.location.origin}/candidate/portfolio?verifiedBundle=true`
        navigator.clipboard.writeText(url)
        setCopiedBundle(true)
        setTimeout(() => setCopiedBundle(false), 2500)
    }

    function downloadCalendarIcs(drive) {
        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HireFlow//Placement Calendar//EN
BEGIN:VEVENT
SUMMARY:${drive.company} - ${drive.role} (${drive.type})
DESCRIPTION:Eligibility: ${drive.eligibility}\\nStipend/CTC: ${drive.stipend}\\nHireFlow Placement Drive.
DTSTART:${drive.deadline.replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${drive.deadline.replace(/[-:]/g, '').split('.')[0]}Z
END:VEVENT
END:VCALENDAR`
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${drive.company.replace(/\s+/g, '_')}_Placement_Event.ics`
        link.click()
    }

    return (
        <div className="hf-cal-page">
            <header className="hf-cal-header">
                <div className="hf-cal-header-inner">
                    <div className="hf-cal-breadcrumbs">
                        <Link to="/candidate/home">Candidate Home</Link>
                        <span>/</span>
                        <span>Placement Drives & Document Vault</span>
                    </div>
                    <h1>Placement Drive Calendar & Document Vault</h1>
                    <p>Track university campus drive timelines, countdowns to OA deadlines, and manage verified credential bundles.</p>
                </div>
            </header>

            <main className="hf-cal-container">
                {/* Tabs */}
                <div className="hf-cal-tabs" role="tablist">
                    <button
                        type="button"
                        className={`hf-cal-tab ${activeTab === 'calendar' ? 'active' : ''}`}
                        onClick={() => setActiveTab('calendar')}
                    >
                        📅 Placement Drive Calendar & Deadlines
                    </button>
                    <button
                        type="button"
                        className={`hf-cal-tab ${activeTab === 'vault' ? 'active' : ''}`}
                        onClick={() => setActiveTab('vault')}
                    >
                        🔒 Certificate & LOR Digital Vault ({vaultDocuments.length})
                    </button>
                    <button
                        type="button"
                        className={`hf-cal-tab ${activeTab === 'alerts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('alerts')}
                    >
                        🔔 Live Activity & Recruiter Radar
                    </button>
                </div>

                {/* TAB 1: PLACEMENT CALENDAR */}
                {activeTab === 'calendar' && (
                    <div className="hf-cal-tab-content">
                        <div className="hf-cal-drives-list">
                            {UPCOMING_DRIVES.map((drive) => (
                                <div key={drive.id} className="hf-cal-drive-card">
                                    <div className="hf-cal-drive-top">
                                        <div>
                                            <span className={`hf-cal-badge ${drive.badgeColor}`}>{drive.status}</span>
                                            <h3>{drive.company}</h3>
                                            <h4>{drive.role}</h4>
                                        </div>
                                        <button
                                            type="button"
                                            className="hf-cal-sync-btn"
                                            onClick={() => downloadCalendarIcs(drive)}
                                            title="Add event to Google / Apple Calendar"
                                        >
                                            📅 Add to Calendar (.ics)
                                        </button>
                                    </div>

                                    <div className="hf-cal-timeline-strip">
                                        <div className="hf-cal-timeline-milestone">
                                            <span>Registration Deadline</span>
                                            <strong>{new Date(drive.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
                                        </div>
                                        <div className="hf-cal-timeline-arrow">➔</div>
                                        <div className="hf-cal-timeline-milestone">
                                            <span>Online Assessment (OA)</span>
                                            <strong>{drive.testDate.includes('T') ? new Date(drive.testDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : drive.testDate}</strong>
                                        </div>
                                        <div className="hf-cal-timeline-arrow">➔</div>
                                        <div className="hf-cal-timeline-milestone">
                                            <span>Interview Rounds</span>
                                            <strong>{drive.interviewDates}</strong>
                                        </div>
                                    </div>

                                    <div className="hf-cal-drive-details">
                                        <span><b>Eligibility:</b> {drive.eligibility}</span>
                                        <span><b>Package / Stipend:</b> {drive.stipend}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 2: CERTIFICATE & LOR VAULT */}
                {activeTab === 'vault' && (
                    <div className="hf-cal-tab-content">
                        <div className="hf-cal-card">
                            <div className="hf-cal-vault-top">
                                <div>
                                    <h3>Verified Credential Locker</h3>
                                    <p>Organize academic transcripts, LORs, and internship certificates. Share a single verified bundle link with HR recruiters.</p>
                                </div>
                                <button
                                    type="button"
                                    className="hf-cal-bundle-btn"
                                    onClick={handleCopyBundle}
                                >
                                    {copiedBundle ? '✓ Verification Link Copied!' : '🔗 Copy Shareable Verification Link'}
                                </button>
                            </div>

                            <form onSubmit={handleAddDoc} className="hf-cal-vault-form">
                                <label>
                                    Document Title
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. B.Tech Provisional Degree Certificate"
                                        value={newDocTitle}
                                        onChange={(e) => setNewDocTitle(e.target.value)}
                                    />
                                </label>
                                <label>
                                    Category
                                    <select value={newDocType} onChange={(e) => setNewDocType(e.target.value)}>
                                        <option value="Degree / Transcript">Academic Transcript / Degree</option>
                                        <option value="Letter of Recommendation">Letter of Recommendation (LOR)</option>
                                        <option value="Internship Certificate">Internship Completion Letter</option>
                                        <option value="Course / Award">Hackathon / Certification Award</option>
                                    </select>
                                </label>
                                <button type="submit" className="hf-cal-add-doc-btn">
                                    + Add Credential
                                </button>
                            </form>

                            <div className="hf-cal-docs-grid">
                                {vaultDocuments.length === 0 ? (
                                    <div className="hf-cal-empty-vault">
                                        <span>📄</span>
                                        <p>No documents uploaded yet. Add your academic transcripts and certificates above to generate your verified bundle.</p>
                                    </div>
                                ) : (
                                    vaultDocuments.map((doc) => (
                                        <div key={doc.id} className="hf-cal-doc-card">
                                            <div className="hf-cal-doc-icon">📜</div>
                                            <div className="hf-cal-doc-info">
                                                <h4>{doc.title}</h4>
                                                <small>{doc.type} • Added {doc.uploadedAt}</small>
                                                <span className="hf-cal-doc-badge">✓ Verified Authenticity</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="hf-cal-del-doc-btn"
                                                onClick={() => handleDeleteDoc(doc.id)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: LIVE ACTIVITY RADAR */}
                {activeTab === 'alerts' && (
                    <div className="hf-cal-tab-content">
                        <div className="hf-cal-card">
                            <h3>Live Recruiter Activity & Radar</h3>
                            <p className="hf-cal-sub">Real-time alerts whenever a hiring team interacts with your profile or resume.</p>

                            <div className="hf-cal-activity-list">
                                {activities.map((a) => (
                                    <div key={a.id} className="hf-cal-activity-item">
                                        <span className="hf-cal-act-icon">
                                            {a.type === 'view' ? '👀' : a.type === 'interview' ? '📅' : a.type === 'verified' ? '🎖️' : '⚡'}
                                        </span>
                                        <div className="hf-cal-act-info">
                                            <p>{a.text}</p>
                                            <small>{a.time}</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
