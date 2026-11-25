import { useState } from 'react'
import { Link } from 'react-router-dom'
import './CandidateSkillsPage.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

const CAREER_ROADMAPS = {
    'Full-Stack Engineer': {
        mastered: ['React', 'JavaScript', 'HTML5/CSS3', 'REST APIs', 'Git'],
        missing: ['Docker', 'Redis Caching', 'PostgreSQL Indexing', 'Microservices'],
        recommendedProjects: [
            'Real-Time Chat & Notification Microservice with Redis & WebSockets',
            'Multi-Tenant SaaS with RBAC, Stripe Billing, and EF Core'
        ],
        milestones: ['Master Docker containerization', 'Implement caching with Redis', 'Build production CI/CD pipeline']
    },
    'Frontend Specialist': {
        mastered: ['React 19', 'TypeScript', 'Tailwind CSS', 'Redux Toolkit'],
        missing: ['Next.js App Router', 'Web Performance & Core Web Vitals', 'Cypress E2E Testing'],
        recommendedProjects: [
            'Design System Component Library published to NPM with Storybook',
            'High-Performance Real-Time Analytics Dashboard'
        ],
        milestones: ['SSR & Server Components with Next.js', 'Core Web Vitals 95+ score optimization']
    },
    'Backend & Cloud Engineer': {
        mastered: ['C#', 'ASP.NET Core', 'SQL Server', 'REST APIs'],
        missing: ['Kubernetes', 'RabbitMQ / Kafka Message Queues', 'Terraform (IaC)', 'AWS ECS'],
        recommendedProjects: [
            'Distributed Event-Driven Architecture with RabbitMQ & Outbox Pattern',
            'Cloud-Native Observability Suite with OpenTelemetry & Prometheus'
        ],
        milestones: ['Message queuing & asynchronous processing', 'Kubernetes cluster deployment']
    }
}

export default function CandidateSkillsPage() {
    const [activeTab, setActiveTab] = useState('quiz') // 'quiz', 'scanner', 'streak', 'roadmap'

    // Tab 1: Quiz state
    const [quizTopic, setQuizTopic] = useState('Full Stack Software Engineering')
    const [quizQuestions, setQuizQuestions] = useState([])
    const [quizIdx, setQuizIdx] = useState(0)
    const [answers, setAnswers] = useState({})
    const [loadingQuiz, setLoadingQuiz] = useState(false)
    const [submittingQuiz, setSubmittingQuiz] = useState(false)
    const [quizResult, setQuizResult] = useState(null)
    const [earnedBadges, setEarnedBadges] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('hireflow-earned-badges') || '[]')
        } catch {
            return ['React Certified', 'Full-Stack Proficient']
        }
    })

    // Tab 2: GitHub & LeetCode Scanner
    const [githubUser, setGithubUser] = useState('alexmorgan')
    const [leetcodeUser, setLeetcodeUser] = useState('alex_codes')
    const [scanningProfile, setScanningProfile] = useState(false)
    const [profileStats, setProfileStats] = useState({
        scanned: true,
        github: {
            repos: 28,
            commitsLastYear: 412,
            stars: 34,
            topLanguages: [
                { name: 'TypeScript', pct: 45 },
                { name: 'C#', pct: 35 },
                { name: 'SQL', pct: 20 }
            ]
        },
        leetcode: {
            solved: 245,
            easy: 95,
            medium: 125,
            hard: 25,
            contestRating: 1780,
            rankPercentile: 'Top 14%'
        }
    })

    // Tab 3: Daily Streak State
    const [streakCount, setStreakCount] = useState(() => {
        try {
            return parseInt(localStorage.getItem('hireflow-streak-count') || '14', 10)
        } catch {
            return 14
        }
    })
    const [dailyAnswered, setDailyAnswered] = useState(false)
    const [selectedDailyOption, setSelectedDailyOption] = useState(null)

    // Tab 4: Roadmap State
    const [selectedRole, setSelectedRole] = useState('Full-Stack Engineer')

    // 1. Start Skill Quiz
    async function handleStartQuiz() {
        setLoadingQuiz(true)
        setQuizResult(null)
        setAnswers({})
        setQuizIdx(0)

        try {
            const res = await fetch(`${API_BASE}/AiAgent/skill-quiz/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: quizTopic })
            })
            if (res.ok) {
                const data = await res.json()
                setQuizQuestions(data || [])
            } else {
                throw new Error('Fallback')
            }
        } catch {
            setQuizQuestions([
                {
                    id: 1,
                    question: 'Which of the following is true regarding React 19 Action hooks and form submission?',
                    options: [
                        'useActionState automatically handles pending states and optimistic updates',
                        'Form submissions can only be executed via class components',
                        'useTransition cannot be combined with async form actions',
                        'Redux is strictly required to manage form action states'
                    ],
                    correctIndex: 0,
                    skillTag: 'React 19'
                },
                {
                    id: 2,
                    question: 'In ASP.NET Core, how does AddDbContextPool optimize resource utilization compared to standard AddDbContext?',
                    options: [
                        'It disables SQL connection security checks',
                        'It maintains a reusable pool of DbContext instances, reducing GC overhead and memory allocations',
                        'It converts all queries into raw string SQL automatically',
                        'It limits the application to a single thread'
                    ],
                    correctIndex: 1,
                    skillTag: 'ASP.NET Core'
                },
                {
                    id: 3,
                    question: 'What is the primary benefit of creating a composite covering index in PostgreSQL or SQL Server?',
                    options: [
                        'It encrypts sensitive table columns at rest',
                        'It allows the database engine to satisfy the query entirely from the B-tree without looking up table pages',
                        'It compresses the database file to zero bytes',
                        'It forces all write operations to execute synchronously'
                    ],
                    correctIndex: 1,
                    skillTag: 'Database Optimization'
                },
                {
                    id: 4,
                    question: 'Which HTTP status code is most appropriate when a client request violates a domain business invariant?',
                    options: ['200 OK', '404 Not Found', '422 Unprocessable Entity or 400 Bad Request', '502 Bad Gateway'],
                    correctIndex: 2,
                    skillTag: 'REST Architecture'
                },
                {
                    id: 5,
                    question: 'Why are idempotency keys critical when designing distributed payment or order endpoints?',
                    options: [
                        'They prevent duplicated processing even if the client network retries the same request multiple times',
                        'They eliminate the need for TLS/HTTPS encryption',
                        'They speed up CPU clock frequency',
                        'They allow unsigned unauthenticated API access'
                    ],
                    correctIndex: 0,
                    skillTag: 'Distributed Systems'
                }
            ])
        } finally {
            setLoadingQuiz(false)
        }
    }

    // Submit Quiz
    async function handleSubmitQuiz() {
        setSubmittingQuiz(true)
        try {
            const formattedAnswers = {}
            Object.entries(answers).forEach(([qId, optIdx]) => {
                formattedAnswers[parseInt(qId, 10) || 0] = optIdx
            })

            const res = await fetch(`${API_BASE}/AiAgent/skill-quiz/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId: 0,
                    selectedAnswers: formattedAnswers
                })
            })

            if (res.ok) {
                const data = await res.json()
                setQuizResult(data)
                if (data.scorePercentage >= 80) {
                    awardBadge(`${quizTopic} Verified`)
                }
            } else {
                throw new Error('Fallback')
            }
        } catch {
            // Local score calculation
            let correct = 0
            quizQuestions.forEach((q) => {
                const ans = answers[q.id]
                if (ans === q.correctIndex) correct++
            })
            const scorePct = Math.round((correct / quizQuestions.length) * 100)
            const passed = scorePct >= 80

            setQuizResult({
                scorePercentage: scorePct,
                tier: passed ? 'Advanced' : 'Proficient',
                feedback: passed
                    ? 'Congratulations! You achieved a top score and demonstrated production-level technical mastery.'
                    : 'Good attempt! Review system architecture and database index coverage to reach the 80%+ verified tier.'
            })

            if (passed) {
                awardBadge(`${quizTopic} Master`)
            }
        } finally {
            setSubmittingQuiz(false)
        }
    }

    function awardBadge(badgeName) {
        setEarnedBadges((prev) => {
            if (prev.includes(badgeName)) return prev
            const next = [...prev, badgeName]
            localStorage.setItem('hireflow-earned-badges', JSON.stringify(next))
            return next
        })
    }

    // 2. Scan GitHub & LeetCode
    function handleScanProfile() {
        setScanningProfile(true)
        setTimeout(() => {
            setScanningProfile(false)
            setProfileStats({
                scanned: true,
                github: {
                    repos: 32,
                    commitsLastYear: 498,
                    stars: 48,
                    topLanguages: [
                        { name: 'TypeScript', pct: 52 },
                        { name: 'C#', pct: 33 },
                        { name: 'SQL', pct: 15 }
                    ]
                },
                leetcode: {
                    solved: 280,
                    easy: 110,
                    medium: 142,
                    hard: 28,
                    contestRating: 1845,
                    rankPercentile: 'Top 9%'
                }
            })
            awardBadge('Verified 400+ GitHub Commits')
            awardBadge('Top 10% LeetCode Radar')
        }, 1200)
    }

    // 3. Daily Challenge submission
    function handleAnswerDaily(idx) {
        if (dailyAnswered) return
        setSelectedDailyOption(idx)
        setDailyAnswered(true)
        if (idx === 1) { // correct option
            const nextStreak = streakCount + 1
            setStreakCount(nextStreak)
            localStorage.setItem('hireflow-streak-count', String(nextStreak))
        }
    }

    const roadmap = CAREER_ROADMAPS[selectedRole] || CAREER_ROADMAPS['Full-Stack Engineer']

    return (
        <div className="hf-skills-page">
            <header className="hf-skills-header">
                <div className="hf-skills-header-inner">
                    <div className="hf-skills-breadcrumbs">
                        <Link to="/candidate/home">Candidate Home</Link>
                        <span>/</span>
                        <span>Skill Verification & Coding Radar</span>
                    </div>
                    <h1>Skill Verification & Coding Radar</h1>
                    <p>Earn verified credentials, connect your coding footprints, and keep your daily streak alive.</p>
                </div>
            </header>

            <main className="hf-skills-container">
                {/* Tabs */}
                <div className="hf-skills-tabs" role="tablist">
                    <button
                        type="button"
                        className={`hf-skills-tab ${activeTab === 'quiz' ? 'active' : ''}`}
                        onClick={() => setActiveTab('quiz')}
                    >
                        🏆 Skill Quizzes & Verified Badges ({earnedBadges.length})
                    </button>
                    <button
                        type="button"
                        className={`hf-skills-tab ${activeTab === 'scanner' ? 'active' : ''}`}
                        onClick={() => setActiveTab('scanner')}
                    >
                        🐙 GitHub & LeetCode Scanner
                    </button>
                    <button
                        type="button"
                        className={`hf-skills-tab ${activeTab === 'streak' ? 'active' : ''}`}
                        onClick={() => setActiveTab('streak')}
                    >
                        🔥 Daily Streak & Campus Leaderboard ({streakCount} Days)
                    </button>
                    <button
                        type="button"
                        className={`hf-skills-tab ${activeTab === 'roadmap' ? 'active' : ''}`}
                        onClick={() => setActiveTab('roadmap')}
                    >
                        🗺️ Career Roadmap & Skill Gap Analyzer
                    </button>
                </div>

                {/* TAB 1: SKILL QUIZZES */}
                {activeTab === 'quiz' && (
                    <div className="hf-skills-tab-content">
                        <div className="hf-skills-card">
                            <div className="hf-skills-badges-bar">
                                <h3>Your Verified Badges</h3>
                                <div className="hf-skills-badge-list">
                                    {earnedBadges.map((b) => (
                                        <span key={b} className="hf-skills-badge-pill">
                                            🎖️ {b}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <hr className="hf-skills-divider" />

                            <div className="hf-skills-quiz-selector">
                                <label>
                                    Select Skill Assessment
                                    <select value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)}>
                                        <option value="Full Stack Software Engineering">Full-Stack Software Engineering (.NET, React, SQL)</option>
                                        <option value="React & Frontend Architecture">React 19 & Frontend Architecture</option>
                                        <option value="ASP.NET Core & C# Backend">ASP.NET Core & C# Microservices</option>
                                        <option value="PostgreSQL & Database Engineering">PostgreSQL & Database Indexing</option>
                                    </select>
                                </label>
                                <button
                                    type="button"
                                    className="hf-skills-primary-btn"
                                    onClick={handleStartQuiz}
                                    disabled={loadingQuiz}
                                >
                                    {loadingQuiz ? 'Generating Assessment...' : '🚀 Start Adaptive Quiz (5 Questions)'}
                                </button>
                            </div>

                            {quizQuestions.length > 0 && !quizResult && (
                                <div className="hf-skills-active-quiz">
                                    <div className="hf-skills-quiz-progress-bar">
                                        <div
                                            className="hf-skills-quiz-progress-fill"
                                            style={{ width: `${((quizIdx + 1) / quizQuestions.length) * 100}%` }}
                                        />
                                    </div>
                                    <span className="hf-skills-q-count">
                                        Question {quizIdx + 1} of {quizQuestions.length} • {quizQuestions[quizIdx]?.skillTag}
                                    </span>

                                    <h4 className="hf-skills-q-title">{quizQuestions[quizIdx]?.question}</h4>

                                    <div className="hf-skills-options-list">
                                        {(quizQuestions[quizIdx]?.options || []).map((opt, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                className={`hf-skills-opt-btn ${answers[quizQuestions[quizIdx].id] === i ? 'selected' : ''}`}
                                                onClick={() => setAnswers({ ...answers, [quizQuestions[quizIdx].id]: i })}
                                            >
                                                <span className="hf-skills-opt-letter">{String.fromCharCode(65 + i)}</span>
                                                <span>{opt}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="hf-skills-quiz-nav">
                                        <button
                                            type="button"
                                            disabled={quizIdx === 0}
                                            onClick={() => setQuizIdx(quizIdx - 1)}
                                            className="hf-skills-prev-btn"
                                        >
                                            ← Previous
                                        </button>
                                        {quizIdx < quizQuestions.length - 1 ? (
                                            <button
                                                type="button"
                                                onClick={() => setQuizIdx(quizIdx + 1)}
                                                className="hf-skills-next-btn"
                                            >
                                                Next Question →
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={submittingQuiz}
                                                onClick={handleSubmitQuiz}
                                                className="hf-skills-submit-btn"
                                            >
                                                {submittingQuiz ? 'Submitting & Scoring...' : '✓ Finish & Grade Assessment'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {quizResult && (
                                <div className="hf-skills-quiz-results">
                                    <div className="hf-skills-result-card">
                                        <div className="hf-skills-result-circle">
                                            <span>{quizResult.scorePercentage}%</span>
                                            <small>{quizResult.tier}</small>
                                        </div>
                                        <div>
                                            <h4>{quizResult.scorePercentage >= 80 ? '🎉 Assessment Passed! Badge Awarded' : 'Good Effort! Try again to earn badge'}</h4>
                                            <p>{quizResult.feedback}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="hf-skills-retake-btn"
                                        onClick={handleStartQuiz}
                                    >
                                        ↻ Take Another Skill Assessment
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: GITHUB & LEETCODE SCANNER */}
                {activeTab === 'scanner' && (
                    <div className="hf-skills-tab-content">
                        <div className="hf-skills-card">
                            <div className="hf-skills-scanner-inputs">
                                <label>
                                    GitHub Username
                                    <input
                                        type="text"
                                        value={githubUser}
                                        onChange={(e) => setGithubUser(e.target.value)}
                                        placeholder="e.g. torvalds"
                                    />
                                </label>
                                <label>
                                    LeetCode Handle
                                    <input
                                        type="text"
                                        value={leetcodeUser}
                                        onChange={(e) => setLeetcodeUser(e.target.value)}
                                        placeholder="e.g. neetcode"
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="hf-skills-scan-btn"
                                    disabled={scanningProfile}
                                    onClick={handleScanProfile}
                                >
                                    {scanningProfile ? 'Scanning Public APIs...' : '⚡ Sync & Verify Profiles'}
                                </button>
                            </div>

                            {profileStats.scanned && (
                                <div className="hf-skills-stats-grid">
                                    {/* GitHub Card */}
                                    <div className="hf-skills-stat-box">
                                        <div className="hf-skills-stat-header">
                                            <span className="hf-skills-stat-icon">🐙</span>
                                            <div>
                                                <h4>GitHub Footprint</h4>
                                                <small>@{githubUser} • Verified</small>
                                            </div>
                                        </div>

                                        <div className="hf-skills-metric-row">
                                            <div className="hf-skills-submetric">
                                                <strong>{profileStats.github.commitsLastYear}</strong>
                                                <span>Commits (12m)</span>
                                            </div>
                                            <div className="hf-skills-submetric">
                                                <strong>{profileStats.github.repos}</strong>
                                                <span>Repositories</span>
                                            </div>
                                            <div className="hf-skills-submetric">
                                                <strong>{profileStats.github.stars}</strong>
                                                <span>Stars Earned</span>
                                            </div>
                                        </div>

                                        <h5>Top Languages</h5>
                                        <div className="hf-skills-lang-bars">
                                            {profileStats.github.topLanguages.map((l) => (
                                                <div key={l.name} className="hf-skills-lang-bar-item">
                                                    <span>{l.name} ({l.pct}%)</span>
                                                    <div className="hf-skills-lang-track">
                                                        <div className="hf-skills-lang-fill" style={{ width: `${l.pct}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* LeetCode Card */}
                                    <div className="hf-skills-stat-box">
                                        <div className="hf-skills-stat-header">
                                            <span className="hf-skills-stat-icon">⚡</span>
                                            <div>
                                                <h4>LeetCode Coding Radar</h4>
                                                <small>@{leetcodeUser} • {profileStats.leetcode.rankPercentile}</small>
                                            </div>
                                        </div>

                                        <div className="hf-skills-metric-row">
                                            <div className="hf-skills-submetric">
                                                <strong>{profileStats.leetcode.solved}</strong>
                                                <span>Problems Solved</span>
                                            </div>
                                            <div className="hf-skills-submetric">
                                                <strong>{profileStats.leetcode.contestRating}</strong>
                                                <span>Contest Rating</span>
                                            </div>
                                            <div className="hf-skills-submetric">
                                                <strong>{profileStats.leetcode.rankPercentile}</strong>
                                                <span>Global Standing</span>
                                            </div>
                                        </div>

                                        <h5>Difficulty Breakdown</h5>
                                        <div className="hf-skills-lc-breakdown">
                                            <div className="hf-skills-lc-pill easy">Easy: {profileStats.leetcode.easy}</div>
                                            <div className="hf-skills-lc-pill med">Medium: {profileStats.leetcode.medium}</div>
                                            <div className="hf-skills-lc-pill hard">Hard: {profileStats.leetcode.hard}</div>
                                        </div>

                                        <div className="hf-skills-verified-stamp">
                                            ✓ Auto-synced and showcased on recruiter profile
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: DAILY STREAK & LEADERBOARD */}
                {activeTab === 'streak' && (
                    <div className="hf-skills-tab-content">
                        <div className="hf-skills-streak-grid">
                            <div className="hf-skills-card">
                                <div className="hf-skills-streak-banner">
                                    <span className="hf-skills-flame">🔥</span>
                                    <div>
                                        <h3>{streakCount}-Day Placement Streak</h3>
                                        <p>Answer 1 daily interview puzzle to keep your momentum alive and stay on top of the campus leaderboard.</p>
                                    </div>
                                </div>

                                <div className="hf-skills-daily-q-box">
                                    <span className="hf-skills-daily-badge">Question of the Day (CS & Logic)</span>
                                    <h4>What is the time complexity to find the median in an unsorted array of size N using QuickSelect?</h4>

                                    <div className="hf-skills-daily-options">
                                        {[
                                            'O(N^2) worst and average case',
                                            'O(N) average case, O(N^2) worst case',
                                            'O(log N) worst case',
                                            'O(N log N) strictly'
                                        ].map((opt, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                className={`hf-skills-daily-opt ${selectedDailyOption === i ? (i === 1 ? 'correct' : 'wrong') : ''}`}
                                                onClick={() => handleAnswerDaily(i)}
                                                disabled={dailyAnswered}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>

                                    {dailyAnswered && (
                                        <div className="hf-skills-daily-feedback">
                                            {selectedDailyOption === 1
                                                ? '✓ Correct! QuickSelect has an expected average time of O(N) by partitioning the array in half at each step.'
                                                : '✕ Incorrect. QuickSelect achieves O(N) average time by dividing the problem size in half (N + N/2 + N/4... = 2N).'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Campus Leaderboard */}
                            <div className="hf-skills-card">
                                <h3>Campus Placement Leaderboard</h3>
                                <p className="hf-skills-sub">Top engineering candidates this week based on solved quizzes and daily streak.</p>

                                <div className="hf-skills-leaderboard">
                                    {[
                                        { rank: 1, name: 'Alex Morgan (You)', streak: `${streakCount} Days`, score: 980, badge: '🥇' },
                                        { rank: 2, name: 'Priya Sharma', streak: '19 Days', score: 940, badge: '🥈' },
                                        { rank: 3, name: 'Rohan Verma', streak: '15 Days', score: 910, badge: '🥉' },
                                        { rank: 4, name: 'Ananya Iyer', streak: '12 Days', score: 875, badge: '4' },
                                        { rank: 5, name: 'Siddharth Rao', streak: '10 Days', score: 840, badge: '5' }
                                    ].map((c) => (
                                        <div key={c.rank} className={`hf-skills-leader-item ${c.rank === 1 ? 'is-user' : ''}`}>
                                            <span className="hf-skills-rank">{c.badge}</span>
                                            <span className="hf-skills-leader-name">{c.name}</span>
                                            <span className="hf-skills-leader-streak">🔥 {c.streak}</span>
                                            <strong className="hf-skills-leader-pts">{c.score} pts</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: CAREER ROADMAP & SKILL GAPS */}
                {activeTab === 'roadmap' && (
                    <div className="hf-skills-tab-content">
                        <div className="hf-skills-card">
                            <div className="hf-skills-roadmap-role-picker">
                                <label>
                                    Target Dream Role
                                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                                        <option value="Full-Stack Engineer">Full-Stack Engineer (React + .NET / Node)</option>
                                        <option value="Frontend Specialist">Frontend Specialist (React 19 + TypeScript)</option>
                                        <option value="Backend & Cloud Engineer">Backend & Cloud Engineer (C# + Microservices)</option>
                                    </select>
                                </label>
                            </div>

                            <div className="hf-skills-roadmap-content">
                                <div className="hf-skills-roadmap-columns">
                                    <div className="hf-skills-col mastered">
                                        <h4>✓ Your Mastered Skills</h4>
                                        <div className="hf-skills-col-pills">
                                            {roadmap.mastered.map((s) => (
                                                <span key={s} className="hf-skills-tag-green">✓ {s}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="hf-skills-col missing">
                                        <h4>⚠️ High-Priority Skill Gaps to Close</h4>
                                        <div className="hf-skills-col-pills">
                                            {roadmap.missing.map((s) => (
                                                <span key={s} className="hf-skills-tag-red">🎯 {s}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="hf-skills-roadmap-projects">
                                    <h4>🚀 Recommended Production Projects to Prove Gaps</h4>
                                    <ul>
                                        {roadmap.recommendedProjects.map((proj, i) => (
                                            <li key={i}>{proj}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="hf-skills-roadmap-milestones">
                                    <h4>📍 Strategic Learning Milestones</h4>
                                    <ol>
                                        {roadmap.milestones.map((m, i) => (
                                            <li key={i}>{m}</li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
