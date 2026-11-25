import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './CandidateCommunityPage.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

const ALUMNI_DIRECTORY = [
    {
        id: 1,
        name: 'Karan Mehra',
        gradYear: '2023',
        company: 'Google India',
        role: 'Software Engineer II (L4)',
        domain: 'Cloud Infrastructure & SRE',
        college: 'National Institute of Technology',
        openToReferrals: true,
        linkedIn: 'linkedin.com/in/karanmehra'
    },
    {
        id: 2,
        name: 'Sneha Patel',
        gradYear: '2024',
        company: 'Microsoft',
        role: 'Software Development Engineer',
        domain: 'Azure Cosmos DB Core',
        college: 'National Institute of Technology',
        openToReferrals: true,
        linkedIn: 'linkedin.com/in/snehapatel'
    },
    {
        id: 3,
        name: 'Rahul Deshmukh',
        gradYear: '2022',
        company: 'Amazon AWS',
        role: 'SDE-2',
        domain: 'Amazon DynamoDB Scaling',
        college: 'National Institute of Technology',
        openToReferrals: true,
        linkedIn: 'linkedin.com/in/rahuldeshmukh'
    }
]

export default function CandidateCommunityPage() {
    const [activeTab, setActiveTab] = useState('chat') // 'chat', 'discussions', 'alumni'

    // Chat State
    const [activeContactId, setActiveContactId] = useState(1)
    const [chatInput, setChatInput] = useState('')
    const [contacts, setContacts] = useState([
        {
            id: 1,
            name: 'Sarah Jenkins',
            company: 'TechFlow Systems',
            avatar: 'SJ',
            unread: false,
            messages: [
                { id: 1, sender: 'recruiter', text: 'Hi Alex! We reviewed your HireFlow resume and your 400+ GitHub commits. The team is very interested in scheduling a technical round.', time: '10:30 AM' },
                { id: 2, sender: 'candidate', text: 'Thank you Sarah! I am available this week between 2 PM and 5 PM IST.', time: '10:45 AM' },
                { id: 3, sender: 'recruiter', text: 'Great, I have scheduled Round 1 for Friday at 2:30 PM. Let me know if you need any prep tips!', time: '11:00 AM' }
            ]
        },
        {
            id: 2,
            name: 'Priya Sharma (HR)',
            company: 'Amazon Campus Team',
            avatar: 'PS',
            unread: true,
            messages: [
                { id: 1, sender: 'recruiter', text: 'Hello! Your application for the SDE-1 Graduate drive is shortlisted for Online Assessment next week.', time: 'Yesterday' }
            ]
        }
    ])

    // Discussions State
    const [discussions, setDiscussions] = useState([
        {
            id: 1,
            author: 'Anonymous Student (Batch of 2026)',
            company: 'Amazon',
            topic: 'Online Assessment (OA) Round 1',
            upvotes: 42,
            hasUpvoted: false,
            content: 'Just finished Amazon OA 2026! 2 DSA questions: 1) Variation of Sliding Window Maximum, 2) Graph BFS for connected components. Make sure to optimize for time complexity O(N log K), standard O(N^2) timeouts on test case 11.',
            date: '3 hours ago'
        },
        {
            id: 2,
            author: 'Anonymous Student (Batch of 2026)',
            company: 'Infosys / Campus Drives',
            topic: 'Technical Interview Experience',
            upvotes: 28,
            hasUpvoted: false,
            content: 'Infosys Technical Round 2: Focused 60% on projects and 40% on Core DBMS. They asked to write raw SQL queries for self-joins and explain ACID properties with dirty read examples. Be crystal clear on your resume tech stack!',
            date: 'Yesterday'
        }
    ])
    const [alumniList, setAlumniList] = useState(ALUMNI_DIRECTORY)
    const [newPostContent, setNewPostContent] = useState('')
    const [newPostCompany, setNewPostCompany] = useState('Google')

    // Referral Modal State
    const [selectedAlumni, setSelectedAlumni] = useState(null)
    const [referralSent, setReferralSent] = useState(false)

    async function handleSendReferral() {
        setReferralSent(true)
        if (!selectedAlumni) return
        try {
            await fetch(`${API_BASE}/Community/referrals/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alumniId: selectedAlumni.id,
                    targetRole: selectedAlumni.role,
                    resumeUrl: `${window.location.origin}/candidate/portfolio`
                })
            })
        } catch {
            // fallback
        }
    }

    useEffect(() => {
        let isCancelled = false
        async function fetchCommunityData() {
            try {
                const [discRes, alumniRes, contactsRes] = await Promise.all([
                    fetch(`${API_BASE}/Community/discussions`),
                    fetch(`${API_BASE}/Community/alumni`),
                    fetch(`${API_BASE}/Community/contacts`)
                ])

                if (discRes.ok && !isCancelled) {
                    const data = await discRes.json()
                    if (Array.isArray(data) && data.length > 0) {
                        setDiscussions(data.map(d => ({
                            id: d.id,
                            author: d.authorName,
                            company: d.company,
                            topic: d.role,
                            upvotes: d.upvotes,
                            hasUpvoted: false,
                            content: d.text,
                            date: d.timeAgo || 'Recently'
                        })))
                    }
                }

                if (alumniRes.ok && !isCancelled) {
                    const data = await alumniRes.json()
                    if (Array.isArray(data) && data.length > 0) {
                        setAlumniList(data)
                    }
                }

                if (contactsRes.ok && !isCancelled) {
                    const data = await contactsRes.json()
                    if (Array.isArray(data) && data.length > 0) {
                        setContacts(data)
                    }
                }
            } catch {
                // non-fatal, fallback to local seeds
            }
        }
        fetchCommunityData()
        return () => { isCancelled = true }
    }, [])

    // Chat send
    async function handleSendMessage(e) {
        e.preventDefault()
        if (!chatInput.trim()) return

        const text = chatInput.trim()
        const newMsg = {
            id: Date.now(),
            sender: 'candidate',
            text: text,
            time: 'Just now'
        }

        setContacts(prev => prev.map(c => {
            if (c.id === activeContactId) {
                return { ...c, messages: [...c.messages, newMsg] }
            }
            return c
        }))
        setChatInput('')

        try {
            await fetch(`${API_BASE}/Community/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId: activeContactId, text })
            })
        } catch {
            // fallback
        }
    }

    // Upvote discussion
    async function handleToggleUpvote(id) {
        setDiscussions(prev => prev.map(d => {
            if (d.id === id) {
                return {
                    ...d,
                    upvotes: d.hasUpvoted ? d.upvotes - 1 : d.upvotes + 1,
                    hasUpvoted: !d.hasUpvoted
                }
            }
            return d
        }))

        try {
            await fetch(`${API_BASE}/Community/discussions/${id}/upvote`, {
                method: 'POST'
            })
        } catch {
            // fallback
        }
    }

    // Create post
    async function handleCreatePost(e) {
        e.preventDefault()
        if (!newPostContent.trim()) return

        const content = newPostContent.trim()
        const company = newPostCompany

        const post = {
            id: Date.now(),
            author: 'Anonymous Student (Verified)',
            company: company,
            topic: 'Interview & Drive Insights',
            upvotes: 1,
            hasUpvoted: true,
            content: content,
            date: 'Just now'
        }
        setDiscussions([post, ...discussions])
        setNewPostContent('')

        try {
            const res = await fetch(`${API_BASE}/Community/discussions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company,
                    role: 'Interview & Drive Insights',
                    text: content,
                    isAnonymous: true
                })
            })
            if (res.ok) {
                const created = await res.json()
                setDiscussions(prev => prev.map(d => d.id === post.id ? { ...d, id: created.id } : d))
            }
        } catch {
            // fallback
        }
    }

    const currentContact = contacts.find(c => c.id === activeContactId) || contacts[0]

    return (
        <div className="hf-comm-page">
            <header className="hf-comm-header">
                <div className="hf-comm-header-inner">
                    <div className="hf-comm-breadcrumbs">
                        <Link to="/candidate/home">Candidate Home</Link>
                        <span>/</span>
                        <span>Community & Recruiter Connect</span>
                    </div>
                    <h1>Recruiter Chat, Alumni & Campus Community</h1>
                    <p>Message recruiters in real-time, ask college alumni for internal job referrals, and discuss real placement experiences.</p>
                </div>
            </header>

            <main className="hf-comm-container">
                {/* Tabs */}
                <div className="hf-comm-tabs" role="tablist">
                    <button
                        type="button"
                        className={`hf-comm-tab ${activeTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chat')}
                    >
                        💬 In-App Recruiter Direct Chat ({contacts.length})
                    </button>
                    <button
                        type="button"
                        className={`hf-comm-tab ${activeTab === 'discussions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('discussions')}
                    >
                        🤫 Anonymous Placement Insights & OAs ({discussions.length})
                    </button>
                    <button
                        type="button"
                        className={`hf-comm-tab ${activeTab === 'alumni' ? 'active' : ''}`}
                        onClick={() => setActiveTab('alumni')}
                    >
                        🎓 College Alumni Referral Hub ({alumniList.length})
                    </button>
                </div>

                {/* TAB 1: IN-APP RECRUITER CHAT */}
                {activeTab === 'chat' && (
                    <div className="hf-comm-tab-content">
                        <div className="hf-comm-chat-card">
                            <aside className="hf-comm-chat-sidebar">
                                <h3>Messages</h3>
                                <div className="hf-comm-contacts-list">
                                    {contacts.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className={`hf-comm-contact-btn ${c.id === activeContactId ? 'active' : ''}`}
                                            onClick={() => setActiveContactId(c.id)}
                                        >
                                            <div className="hf-comm-avatar">{c.avatar}</div>
                                            <div className="hf-comm-contact-meta">
                                                <strong>{c.name}</strong>
                                                <small>{c.company}</small>
                                            </div>
                                            {c.unread && <span className="hf-comm-unread-dot" />}
                                        </button>
                                    ))}
                                </div>
                            </aside>

                            <section className="hf-comm-chat-main">
                                <header className="hf-comm-chat-topbar">
                                    <div>
                                        <h4>{currentContact.name}</h4>
                                        <small>{currentContact.company} • Active on HireFlow</small>
                                    </div>
                                    <span className="hf-comm-verified-hr">✓ Verified Recruiter</span>
                                </header>

                                <div className="hf-comm-messages-scroll">
                                    {currentContact.messages.map((m) => (
                                        <div key={m.id} className={`hf-comm-msg-row ${m.sender}`}>
                                            <div className="hf-comm-bubble">
                                                <p>{m.text}</p>
                                                <span className="hf-comm-time">{m.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <form onSubmit={handleSendMessage} className="hf-comm-chat-input-bar">
                                    <input
                                        type="text"
                                        placeholder={`Message ${currentContact.name}...`}
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                    />
                                    <button type="submit" className="hf-comm-send-btn">
                                        Send 🚀
                                    </button>
                                </form>
                            </section>
                        </div>
                    </div>
                )}

                {/* TAB 2: ANONYMOUS PLACEMENT INSIGHTS */}
                {activeTab === 'discussions' && (
                    <div className="hf-comm-tab-content">
                        <div className="hf-comm-card">
                            <div className="hf-comm-post-creator">
                                <h3>Share Recent Campus Drive Insights (100% Anonymous)</h3>
                                <form onSubmit={handleCreatePost} className="hf-comm-new-post-form">
                                    <div className="hf-comm-form-row">
                                        <label>
                                            Company Name
                                            <input
                                                type="text"
                                                value={newPostCompany}
                                                onChange={(e) => setNewPostCompany(e.target.value)}
                                                placeholder="e.g. Google, Amazon, TCS"
                                            />
                                        </label>
                                    </div>
                                    <textarea
                                        rows={3}
                                        required
                                        placeholder="Share questions asked in the online assessment or interview round, difficulty level, and tips for your college peers..."
                                        value={newPostContent}
                                        onChange={(e) => setNewPostContent(e.target.value)}
                                    />
                                    <button type="submit" className="hf-comm-post-btn">
                                        🚀 Post Anonymously
                                    </button>
                                </form>
                            </div>

                            <div className="hf-comm-feed-list">
                                {discussions.map((d) => (
                                    <div key={d.id} className="hf-comm-post-item">
                                        <div className="hf-comm-post-vote">
                                            <button
                                                type="button"
                                                className={`hf-comm-upvote-btn ${d.hasUpvoted ? 'active' : ''}`}
                                                onClick={() => handleToggleUpvote(d.id)}
                                            >
                                                ▲ {d.upvotes}
                                            </button>
                                        </div>
                                        <div className="hf-comm-post-body">
                                            <div className="hf-comm-post-meta">
                                                <span className="hf-comm-post-company">{d.company}</span>
                                                <span className="hf-comm-post-author">{d.author}</span>
                                                <small>{d.date}</small>
                                            </div>
                                            <p className="hf-comm-post-text">{d.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: ALUMNI REFERRAL HUB */}
                {activeTab === 'alumni' && (
                    <div className="hf-comm-tab-content">
                        <div className="hf-comm-card">
                            <div className="hf-comm-alumni-intro">
                                <h3>Connect with College Alumni Working in Tech</h3>
                                <p>Seniors and alumni from your college willing to review resumes and provide internal referral links.</p>
                            </div>

                            <div className="hf-comm-alumni-grid">
                                {alumniList.map((alumnus) => (
                                    <div key={alumnus.id} className="hf-comm-alumni-card">
                                        <div className="hf-comm-alumni-header">
                                            <h4>{alumnus.name}</h4>
                                            <span className="hf-comm-alumni-year">Class of '{alumnus.gradYear}</span>
                                        </div>
                                        <strong className="hf-comm-alumni-role">{alumnus.role} @ {alumnus.company}</strong>
                                        <span className="hf-comm-alumni-domain">{alumnus.domain}</span>
                                        <small className="hf-comm-alumni-college">🎓 {alumnus.college}</small>

                                        <button
                                            type="button"
                                            className="hf-comm-referral-btn"
                                            onClick={() => setSelectedAlumni(alumnus)}
                                        >
                                            ✉️ Request Internal Referral
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Referral Modal */}
            {selectedAlumni && (
                <div className="hf-comm-modal-overlay" role="dialog" aria-modal="true">
                    <div className="hf-comm-modal-card">
                        <header className="hf-comm-modal-header">
                            <div>
                                <h3>Request Referral from {selectedAlumni.name}</h3>
                                <p>{selectedAlumni.role} at {selectedAlumni.company}</p>
                            </div>
                            <button
                                type="button"
                                className="hf-comm-modal-close"
                                onClick={() => {
                                    setSelectedAlumni(null)
                                    setReferralSent(false)
                                }}
                            >
                                ✕
                            </button>
                        </header>

                        {referralSent ? (
                            <div className="hf-comm-modal-success">
                                <span className="hf-comm-success-icon">✓</span>
                                <h4>Referral Request Dispatched!</h4>
                                <p>{selectedAlumni.name} will receive your pitch and HireFlow verified resume profile.</p>
                            </div>
                        ) : (
                            <div className="hf-comm-modal-body">
                                <p className="hf-comm-modal-hint">
                                    We pre-formatted a high-conversion referral pitch linking to your verified ATS resume:
                                </p>
                                <textarea
                                    rows={6}
                                    readOnly
                                    className="hf-comm-modal-preview"
                                    value={`Hi ${selectedAlumni.name},

I hope you're doing well! I'm a student at ${selectedAlumni.college} specializing in full-stack software development.

I'm applying for entry-level engineering roles at ${selectedAlumni.company} and noticed your work on the ${selectedAlumni.domain} team. I have hands-on experience in React, C#/.NET, and PostgreSQL, and maintain 400+ verified commits.

Would you be open to reviewing my HireFlow verified profile and referring me for this opening?
${window.location.origin}/candidate/portfolio

Thanks so much for your time and guidance!`}
                                />

                                <div className="hf-comm-modal-actions">
                                    <button
                                        type="button"
                                        className="hf-comm-modal-cancel"
                                        onClick={() => setSelectedAlumni(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="hf-comm-modal-send"
                                        onClick={handleSendReferral}
                                    >
                                        🚀 Send Referral Request
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
