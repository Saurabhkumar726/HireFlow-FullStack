import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import './HireFlowAiAgent.css'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

const QUICK_ACTIONS = {
    Student: [
        { label: 'Find matching jobs', icon: '🎯' },
        { label: 'Check my applications', icon: '📋' },
        { label: 'Current tech hiring trends', icon: '📊' },
        { label: 'Interview prep tips', icon: '💡' },
    ],
    HR: [
        { label: 'Draft a new Job Description', icon: '✍️' },
        { label: 'Summarize my applicants', icon: '👥' },
        { label: 'Market salary & hiring trends', icon: '📈' },
    ],
    Guest: [
        { label: 'Explore trending jobs', icon: '🔍' },
        { label: 'Salary & skill trends', icon: '💰' },
        { label: 'How HireFlow works', icon: '🚀' },
    ],
}

let messageCounter = 0
function generateMessageId(prefix = 'm') {
    messageCounter += 1
    return `${prefix}-${messageCounter}-${Math.random().toString(36).slice(2, 7)}`
}

function getInitialGreeting(role, userName) {
    const name = userName ? ` ${userName}` : ''
    if (role === 'Student') {
        return `Hi${name}! I'm your **HireFlow Career Copilot**.\n\nI can help you:\n• Discover verified job opportunities\n• Track your submitted applications & interview status\n• Analyze real-time tech hiring trends & salary benchmarks\n• Prepare for upcoming interviews`
    }
    if (role === 'HR') {
        return `Hello${name}! I'm your **HireFlow Recruitment Copilot**.\n\nAsk me to:\n• Draft high-converting Job Descriptions\n• Summarize your candidate pipeline\n• Review market compensation benchmarks`
    }
    return `Welcome to **HireFlow**! I'm your AI Copilot.\n\nAsk me to explore trending job openings, analyze live tech salary data, or learn how HireFlow accelerates your hiring journey.`
}

/**
 * Lightweight, safe React-based markdown formatter.
 * Converts **bold**, bullets, and line breaks into native React elements.
 */
function renderFormattedText(text) {
    if (!text) return null
    const paragraphs = String(text).split(/\n\s*\n/)

    return paragraphs.map((para, pIdx) => {
        const lines = para.split('\n')
        return (
            <div key={pIdx} className="hf-ai-para">
                {lines.map((line, lIdx) => {
                    const isBullet = /^[\s]*[•*-]\s+(.*)/.exec(line)
                    const content = isBullet ? isBullet[1] : line

                    const parts = []
                    const regex = /\*\*(.*?)\*\*/g
                    let lastIndex = 0
                    let match
                    while ((match = regex.exec(content)) !== null) {
                        if (match.index > lastIndex) {
                            parts.push(content.slice(lastIndex, match.index))
                        }
                        parts.push(<strong key={match.index}>{match[1]}</strong>)
                        lastIndex = regex.lastIndex
                    }
                    if (lastIndex < content.length) {
                        parts.push(content.slice(lastIndex))
                    }

                    if (isBullet) {
                        return (
                            <div key={lIdx} className="hf-ai-bullet-item">
                                <span className="hf-ai-bullet-dot">•</span>
                                <span className="hf-ai-bullet-content">{parts}</span>
                            </div>
                        )
                    }

                    return (
                        <div key={lIdx} className="hf-ai-line">
                            {parts}
                        </div>
                    )
                })}
            </div>
        )
    })
}

export default function HireFlowAiAgent() {
    const { user, token } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    // Determine normalized user role
    const rawRole = String(user?.role || '').trim().toLowerCase()
    const userRole = rawRole === 'student'
        ? 'Student'
        : (rawRole === 'hr' || rawRole === 'employer' ? 'HR' : (rawRole === 'admin' ? 'HR' : 'Guest'))

    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState(() => [
        {
            id: generateMessageId('init'),
            role: 'assistant',
            text: getInitialGreeting(userRole, user?.fullName || user?.name),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
    ])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [hasUnread, setHasUnread] = useState(false)
    const [copiedDraftId, setCopiedDraftId] = useState(null)

    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    // Scroll to bottom on new message
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isOpen, isLoading])

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => inputRef.current?.focus(), 150)
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    // Close on Escape key
    useEffect(() => {
        function handleKeyDown(e) {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    // Lock body scroll on mobile when full-screen drawer is open
    useEffect(() => {
        if (isOpen && window.innerWidth <= 640) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    async function handleSendMessage(textToSend) {
        const text = (textToSend || inputValue).trim()
        if (!text || isLoading) return

        setError('')
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const userMsg = {
            id: generateMessageId('user'),
            role: 'user',
            text,
            timestamp: timeNow,
        }

        const nextMessages = [...messages, userMsg]
        setMessages(nextMessages)
        setInputValue('')
        setIsLoading(true)

        // Try extracting activeJobId from route if on /jobs/:id
        const isJobDetailRoute = /^\/jobs\/[^/]+/.test(location.pathname)
        const activeJobId = isJobDetailRoute ? parseInt(location.pathname.split('/')[2], 10) || null : null

        try {
            const history = nextMessages
                .filter((m) => !m.isError)
                .slice(-6)
                .map((m) => ({
                    role: m.role,
                    content: m.text,
                }))

            const response = await fetch(`${API_URL}/AiAgent/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    message: text,
                    history,
                    currentRoute: location.pathname,
                    activeJobId,
                }),
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.message || `Request failed with status ${response.status}`)
            }

            const data = await response.json()

            const assistantMsg = {
                id: generateMessageId('assistant'),
                role: 'assistant',
                text: data.reply || 'Here is what I found for you:',
                jobs: data.jobs || null,
                trends: data.trends || null,
                applications: data.applications || null,
                jobDraft: data.jobDraft || null,
                applicantSummary: data.applicantSummary || null,
                suggestedActions: data.suggestedActions || null,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }

            setMessages((prev) => [...prev, assistantMsg])
            if (!isOpen) setHasUnread(true)
        } catch (err) {
            setError(err.message || 'Failed to connect to AI Copilot. Please try again.')
            const errorMsg = {
                id: generateMessageId('error'),
                role: 'assistant',
                text: 'Sorry, I encountered an issue processing your request. Please try again.',
                isError: true,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
            setMessages((prev) => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }

    function handleResetConversation() {
        setMessages([
            {
                id: generateMessageId('reset'),
                role: 'assistant',
                text: getInitialGreeting(userRole, user?.fullName || user?.name),
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ])
        setError('')
    }

    function handleUseJobDraft(draft) {
        navigate('/hr/jobs/new', {
            state: { prefillJob: draft },
        })
        setIsOpen(false)
    }

    function handleCopyJobDraft(draft, msgId) {
        if (!draft) return
        const textToCopy = `Job Title: ${draft.title || ''}\nCompany: ${draft.company || ''}\nLocation: ${draft.location || ''}\nJob Type: ${draft.jobType || ''}\nWork Mode: ${draft.workMode || ''}\n\nDescription:\n${draft.description || ''}\n\nRequirements:\n${draft.requirements || ''}\n\nResponsibilities:\n${draft.responsibilities || ''}`

        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopiedDraftId(msgId)
            setTimeout(() => setCopiedDraftId(null), 2500)
        }).catch(() => { })
    }

    function handleViewJob(jobId) {
        navigate(`/jobs/${jobId}`)
        setIsOpen(false)
    }

    const currentQuickActions = QUICK_ACTIONS[userRole] || QUICK_ACTIONS.Guest

    return (
        <aside className="hf-ai-agent-container" aria-label="HireFlow AI Copilot">
            {/* Floating Trigger Button (Hidden on mobile when drawer is open) */}
            <button
                type="button"
                className={`hf-ai-trigger-btn ${isOpen ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                onClick={() => {
                    setIsOpen((prev) => {
                        const next = !prev
                        if (next) setHasUnread(false)
                        return next
                    })
                }}
                aria-label={isOpen ? 'Close AI Copilot' : 'Open HireFlow AI Copilot'}
                title="HireFlow AI Copilot"
            >
                <div className="hf-ai-trigger-glow" aria-hidden="true" />
                <div className="hf-ai-trigger-icon">
                    {isOpen ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    ) : (
                        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" />
                            <path d="M18 14v1a6 6 0 0 1-12 0v-1" />
                            <circle cx="12" cy="19" r="2" />
                            <path d="m5 8-2 2" />
                            <path d="m19 8 2 2" />
                        </svg>
                    )}
                </div>
                {!isOpen && (
                    <span className="hf-ai-trigger-label">
                        <span className="hf-ai-sparkle">✦</span> Copilot
                    </span>
                )}
                {hasUnread && !isOpen && <span className="hf-ai-unread-dot" />}
            </button>

            {/* Chat Drawer */}
            {isOpen && (
                <div className="hf-ai-drawer" role="dialog" aria-modal="true" aria-label="HireFlow AI Chat">
                    {/* Drawer Header */}
                    <div className="hf-ai-header">
                        <div className="hf-ai-header-info">
                            <div className="hf-ai-avatar">
                                <span className="hf-ai-avatar-sparkle">✦</span>
                                <span className="hf-ai-avatar-status" />
                            </div>
                            <div className="hf-ai-header-text">
                                <div className="hf-ai-title-row">
                                    <h2 className="hf-ai-title">HireFlow Copilot</h2>
                                    <span className="hf-ai-live-pill">Live</span>
                                </div>
                                <span className="hf-ai-role-badge">
                                    {userRole === 'Student' ? 'Candidate Copilot' : (userRole === 'HR' ? 'Recruiter Copilot' : 'Career Intelligence')}
                                </span>
                            </div>
                        </div>

                        <div className="hf-ai-header-actions">
                            <button
                                type="button"
                                className="hf-ai-btn-icon"
                                onClick={handleResetConversation}
                                title="Reset conversation"
                                aria-label="Reset conversation"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="1 4 1 10 7 10"></polyline>
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                </svg>
                            </button>
                            <button
                                type="button"
                                className="hf-ai-btn-icon hf-ai-btn-close"
                                onClick={() => setIsOpen(false)}
                                title="Close"
                                aria-label="Close chat"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages Body */}
                    <div className="hf-ai-messages" tabIndex="0">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`hf-ai-message-row ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="hf-ai-msg-avatar" aria-hidden="true">✦</div>
                                )}
                                <div className="hf-ai-message-bubble-wrapper">
                                    <div className="hf-ai-message-bubble">
                                        <div className="hf-ai-message-text">
                                            {renderFormattedText(msg.text)}
                                        </div>

                                        {/* Rich Jobs List */}
                                        {msg.jobs && msg.jobs.length > 0 && (
                                            <div className="hf-ai-cards-container">
                                                <div className="hf-ai-cards-header">
                                                    <span className="hf-ai-cards-icon">💼</span>
                                                    <span>Matching Opportunities ({msg.jobs.length})</span>
                                                </div>
                                                <div className="hf-ai-jobs-grid">
                                                    {msg.jobs.map((job) => (
                                                        <div key={job.id} className="hf-ai-job-card">
                                                            <div className="hf-ai-job-top">
                                                                <div className="hf-ai-company-info">
                                                                    <div className="hf-ai-company-badge">
                                                                        {(job.company || 'H')[0].toUpperCase()}
                                                                    </div>
                                                                    <span className="hf-ai-job-company">{job.company}</span>
                                                                </div>
                                                                {job.isFeatured && <span className="hf-ai-badge-featured">⭐ Featured</span>}
                                                            </div>
                                                            <h4 className="hf-ai-job-title">{job.title}</h4>
                                                            <div className="hf-ai-job-tags">
                                                                <span className="hf-ai-tag">📍 {job.location}</span>
                                                                <span className="hf-ai-tag">💼 {job.jobType}</span>
                                                                {job.workMode && job.workMode !== 'Not specified' && (
                                                                    <span className={`hf-ai-tag tag-mode-${String(job.workMode).toLowerCase()}`}>
                                                                        🏢 {job.workMode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {job.salary > 0 && (
                                                                <div className="hf-ai-job-salary">
                                                                    💰 ₹{job.salary.toLocaleString('en-IN')} {job.salaryMax ? `– ₹${job.salaryMax.toLocaleString('en-IN')}` : ''} / {job.salaryPeriod || 'Mo'}
                                                                </div>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className="hf-ai-btn-action full"
                                                                onClick={() => handleViewJob(job.id)}
                                                            >
                                                                <span>View Opportunity</span>
                                                                <span className="hf-ai-arrow">→</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Rich Hiring Trends Card */}
                                        {msg.trends && (
                                            <div className="hf-ai-trends-card">
                                                <div className="hf-ai-trends-header">
                                                    <div className="hf-ai-trends-badge">
                                                        <span>📊</span>
                                                        <span>Live Market Intelligence</span>
                                                    </div>
                                                </div>

                                                {/* Stat counters */}
                                                <div className="hf-ai-stats-row">
                                                    <div className="hf-ai-stat-box stat-accent">
                                                        <span className="hf-ai-stat-val">{msg.trends.totalActiveJobs}</span>
                                                        <span className="hf-ai-stat-lbl">Active Jobs</span>
                                                    </div>
                                                    <div className="hf-ai-stat-box stat-cyan">
                                                        <span className="hf-ai-stat-val">{msg.trends.totalCompaniesHiring}</span>
                                                        <span className="hf-ai-stat-lbl">Companies</span>
                                                    </div>
                                                    <div className="hf-ai-stat-box stat-emerald">
                                                        <span className="hf-ai-stat-val">{msg.trends.totalApplicationsCount}</span>
                                                        <span className="hf-ai-stat-lbl">Applications</span>
                                                    </div>
                                                </div>

                                                {/* In Demand Skills */}
                                                {msg.trends.topSkills && msg.trends.topSkills.length > 0 && (
                                                    <div className="hf-ai-trends-section">
                                                        <h5 className="hf-ai-section-title">🔥 Most In-Demand Skills</h5>
                                                        <div className="hf-ai-skills-list">
                                                            {msg.trends.topSkills.map((sk) => (
                                                                <div key={sk.skill} className="hf-ai-skill-item">
                                                                    <div className="hf-ai-skill-info">
                                                                        <span className="hf-ai-skill-name">{sk.skill}</span>
                                                                        <span className="hf-ai-skill-pct">{sk.demandPercentage}%</span>
                                                                    </div>
                                                                    <div className="hf-ai-progress-track">
                                                                        <div
                                                                            className="hf-ai-progress-fill"
                                                                            style={{ width: `${Math.min(100, sk.demandPercentage || 40)}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Top Roles & Salaries */}
                                                {msg.trends.topJobRoles && msg.trends.topJobRoles.length > 0 && (
                                                    <div className="hf-ai-trends-section">
                                                        <h5 className="hf-ai-section-title">💼 Top In-Demand Roles</h5>
                                                        <div className="hf-ai-roles-list">
                                                            {msg.trends.topJobRoles.map((role) => (
                                                                <div key={role.roleTitle} className="hf-ai-role-item">
                                                                    <div className="hf-ai-role-main">
                                                                        <span className="hf-ai-role-title">{role.roleTitle}</span>
                                                                        <span className="hf-ai-role-count">{role.openCount} open positions</span>
                                                                    </div>
                                                                    <span className="hf-ai-role-salary">{role.avgSalaryRange}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Salary Insights */}
                                                {msg.trends.salaryInsights && (
                                                    <div className="hf-ai-trends-insight">
                                                        <span className="hf-ai-insight-bulb">💡</span>
                                                        <div>
                                                            <strong>Market Benchmark:</strong> {msg.trends.salaryInsights}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Rich Student Applications Card */}
                                        {msg.applications && msg.applications.length > 0 && (
                                            <div className="hf-ai-apps-card">
                                                <div className="hf-ai-cards-header">
                                                    <span className="hf-ai-cards-icon">📄</span>
                                                    <span>Your Submitted Applications</span>
                                                </div>
                                                <div className="hf-ai-apps-list">
                                                    {msg.applications.map((app) => (
                                                        <div key={app.id} className="hf-ai-app-item">
                                                            <div className="hf-ai-app-row">
                                                                <h5 className="hf-ai-app-title">{app.jobTitle}</h5>
                                                                <span className={`hf-ai-status-pill status-${(app.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                                                                    <span className="hf-ai-pill-dot" />
                                                                    {app.status}
                                                                </span>
                                                            </div>
                                                            <div className="hf-ai-app-sub">
                                                                <span>{app.company}</span> • <span>{new Date(app.appliedAt).toLocaleDateString()}</span>
                                                            </div>
                                                            {app.interviewDetails && (
                                                                <div className="hf-ai-app-interview">
                                                                    <span>📅</span>
                                                                    <div><strong>Interview:</strong> {app.interviewDetails}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    className="hf-ai-btn-action full"
                                                    onClick={() => {
                                                        navigate('/candidate/applications')
                                                        setIsOpen(false)
                                                    }}
                                                >
                                                    <span>Open Applications Dashboard</span>
                                                    <span className="hf-ai-arrow">→</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Rich HR Job Draft Card */}
                                        {msg.jobDraft && (
                                            <div className="hf-ai-draft-card">
                                                <div className="hf-ai-draft-header">
                                                    <span className="hf-ai-draft-badge">✨ Generated Job Posting</span>
                                                    <button
                                                        type="button"
                                                        className="hf-ai-btn-copy"
                                                        onClick={() => handleCopyJobDraft(msg.jobDraft, msg.id)}
                                                        title="Copy Job Description"
                                                    >
                                                        {copiedDraftId === msg.id ? '✓ Copied!' : '📋 Copy'}
                                                    </button>
                                                </div>
                                                <h4 className="hf-ai-draft-title">{msg.jobDraft.title}</h4>
                                                <div className="hf-ai-draft-tags">
                                                    <span>🏢 {msg.jobDraft.company}</span>
                                                    <span>📍 {msg.jobDraft.location}</span>
                                                    <span>💼 {msg.jobDraft.jobType}</span>
                                                    <span>🌐 {msg.jobDraft.workMode}</span>
                                                </div>
                                                <p className="hf-ai-draft-desc">{msg.jobDraft.description}</p>
                                                {msg.jobDraft.requirements && (
                                                    <div className="hf-ai-draft-preview">
                                                        <strong>Key Requirements:</strong>
                                                        <pre>{msg.jobDraft.requirements}</pre>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    className="hf-ai-btn-action primary full"
                                                    onClick={() => handleUseJobDraft(msg.jobDraft)}
                                                >
                                                    <span>Use in Post a Job</span>
                                                    <span className="hf-ai-arrow">↗</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Rich HR Applicant Summary Card */}
                                        {msg.applicantSummary && (
                                            <div className="hf-ai-applicant-summary-card">
                                                <div className="hf-ai-cards-header">
                                                    <span className="hf-ai-cards-icon">👥</span>
                                                    <span>Applicant Pipeline Overview</span>
                                                </div>
                                                <div className="hf-ai-pipeline-badges">
                                                    {Object.entries(msg.applicantSummary.statusBreakdown || {}).map(([status, count]) => (
                                                        <div key={status} className="hf-ai-pipeline-chip">
                                                            <span className="hf-ai-chip-lbl">{status}</span>
                                                            <span className="hf-ai-chip-val">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {msg.applicantSummary.recentApplicants?.length > 0 && (
                                                    <div className="hf-ai-recent-applicants">
                                                        <h5 className="hf-ai-section-title">Recent Submissions:</h5>
                                                        {msg.applicantSummary.recentApplicants.map((c) => (
                                                            <div key={c.applicationId} className="hf-ai-recent-candidate">
                                                                <span className="candidate-name">{c.applicantName}</span>
                                                                <span className="candidate-status">{c.status}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    className="hf-ai-btn-action full"
                                                    onClick={() => {
                                                        navigate(msg.applicantSummary.jobId ? `/hr/jobs/${msg.applicantSummary.jobId}/applicants` : '/hr/applicants')
                                                        setIsOpen(false)
                                                    }}
                                                >
                                                    <span>Manage in HR Workspace</span>
                                                    <span className="hf-ai-arrow">→</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Rich ATS Match Score Card */}
                                        {msg.atsMatch && (
                                            <div className="hf-ai-ats-card">
                                                <div className="hf-ai-cards-header">
                                                    <span className="hf-ai-cards-icon">🎯</span>
                                                    <span>ATS Resume & Skills Match</span>
                                                </div>
                                                <div className="hf-ai-ats-score-row">
                                                    <div className={`hf-ai-ats-gauge ${msg.atsMatch.matchPercentage >= 80 ? 'high' : msg.atsMatch.matchPercentage >= 60 ? 'medium' : 'low'}`}>
                                                        <span className="hf-ai-ats-number">{msg.atsMatch.matchPercentage}%</span>
                                                        <span className="hf-ai-ats-fit">{msg.atsMatch.fitLevel}</span>
                                                    </div>
                                                    <div className="hf-ai-ats-meta">
                                                        <h4>{msg.atsMatch.jobTitle}</h4>
                                                        <p>{msg.atsMatch.company}</p>
                                                        <small>{msg.atsMatch.isProfileBased ? 'Calculated from your verified profile skills' : 'Keyword & qualification scan'}</small>
                                                    </div>
                                                </div>
                                                <div className="hf-ai-ats-skills-wrap">
                                                    {msg.atsMatch.matchedSkills?.length > 0 && (
                                                        <div className="hf-ai-ats-skills-group">
                                                            <span className="group-title match">✓ Matched Keywords ({msg.atsMatch.matchedSkills.length})</span>
                                                            <div className="hf-ai-skills-chips">
                                                                {msg.atsMatch.matchedSkills.map((s) => (
                                                                    <span key={s} className="skill-chip matched">{s}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {msg.atsMatch.missingSkills?.length > 0 && (
                                                        <div className="hf-ai-ats-skills-group">
                                                            <span className="group-title missing">+ Missing Competencies ({msg.atsMatch.missingSkills.length})</span>
                                                            <div className="hf-ai-skills-chips">
                                                                {msg.atsMatch.missingSkills.map((s) => (
                                                                    <span key={s} className="skill-chip missing">{s}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {msg.atsMatch.topRecommendations?.length > 0 && (
                                                    <div className="hf-ai-ats-recs">
                                                        <strong>Tailored Application Tips:</strong>
                                                        <ul>
                                                            {msg.atsMatch.topRecommendations.map((r, i) => (
                                                                <li key={i}>{r}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    className="hf-ai-btn-action full primary"
                                                    onClick={() => handleViewJob(msg.atsMatch.jobId)}
                                                >
                                                    <span>Review & Apply to Role</span>
                                                    <span className="hf-ai-arrow">↗</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {msg.timestamp && (
                                        <span className="hf-ai-msg-time">{msg.timestamp}</span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Loading Typing Indicator */}
                        {isLoading && (
                            <div className="hf-ai-message-row assistant">
                                <div className="hf-ai-msg-avatar" aria-hidden="true">✦</div>
                                <div className="hf-ai-message-bubble-wrapper">
                                    <div className="hf-ai-message-bubble loading">
                                        <div className="hf-ai-typing-indicator" aria-label="Thinking">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick-Action Chips */}
                    <div className="hf-ai-chips-wrapper">
                        <div className="hf-ai-chips-container">
                            {currentQuickActions.map((action) => (
                                <button
                                    key={action.label}
                                    type="button"
                                    className="hf-ai-chip-btn"
                                    onClick={() => handleSendMessage(action.label)}
                                    disabled={isLoading}
                                >
                                    <span className="hf-ai-chip-icon">{action.icon}</span>
                                    <span>{action.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="hf-ai-error-banner" role="alert">
                            <div className="hf-ai-error-text">
                                <span>⚠️</span>
                                <span>{error}</span>
                            </div>
                            <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
                        </div>
                    )}

                    {/* Chat Input Footer */}
                    <form
                        className="hf-ai-input-form"
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleSendMessage()
                        }}
                    >
                        <div className="hf-ai-input-wrapper">
                            <input
                                ref={inputRef}
                                type="text"
                                className="hf-ai-input-field"
                                placeholder={userRole === 'HR' ? 'Ask about applicants, JDs, or trends...' : 'Ask about jobs, applications, or trends...'}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                className="hf-ai-send-btn"
                                disabled={!inputValue.trim() || isLoading}
                                aria-label="Send message"
                                title="Send message (Enter)"
                            >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </aside>
    )
}
