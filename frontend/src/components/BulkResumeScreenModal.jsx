import { useState } from 'react'
import './BulkResumeScreenModal.css'

const SAMPLE_CANDIDATES = [
    {
        name: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
        resumeText:
            'Senior Full Stack Developer with 4 years building high-concurrency cloud services in C#, .NET 10, ASP.NET Core, and React TypeScript. Extensive PostgreSQL query tuning, Docker microservice orchestration, and Redis caching. Led real-time SignalR chat pipelines.'
    },
    {
        name: 'Priya Patel',
        email: 'priya.patel@example.com',
        resumeText:
            'Frontend React Engineer with 3 years building responsive web apps with Tailwind CSS, Next.js, and TypeScript. Comfortable writing REST API endpoints in Node.js and MongoDB. Learning C# and Docker fundamentals.'
    },
    {
        name: 'Rohan Verma',
        email: 'rohan.verma@example.com',
        resumeText:
            'Python Backend Developer focused on Django, FastAPI, and PostgreSQL. Experience deploying automated CI/CD workflows and Docker containers. Familiar with basic React and Git.'
    }
]

export default function BulkResumeScreenModal({ job, onClose }) {
    const [candidates, setCandidates] = useState([
        { name: '', email: '', resumeText: '' }
    ])
    const [results, setResults] = useState(null)
    const [screening, setScreening] = useState(false)
    const [error, setError] = useState('')

    const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

    function handleAddRow() {
        setCandidates((prev) => [...prev, { name: '', email: '', resumeText: '' }])
    }

    function handleRemoveRow(index) {
        setCandidates((prev) => prev.filter((_, i) => i !== index))
    }

    function handleChange(index, field, value) {
        setCandidates((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }
            return next
        })
    }

    function handleLoadSamples() {
        setCandidates(SAMPLE_CANDIDATES)
    }

    async function handleRunScreening(e) {
        e.preventDefault()
        const validCandidates = candidates.filter((c) => c.name.trim() && c.resumeText.trim())
        if (validCandidates.length === 0) {
            setError('Please provide at least one candidate with a name and resume text.')
            return
        }

        setScreening(true)
        setError('')
        try {
            const token = localStorage.getItem('hireflow-token')
            const res = await fetch(`${API_BASE}/AiAgent/bulk-resume-screen`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    jobId: job?.id || 1,
                    candidates: validCandidates
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || 'Bulk screening failed.')
            }

            const data = await res.json()
            setResults(data)
        } catch (err) {
            setError(err.message || 'Unable to analyze resumes.')
        } finally {
            setScreening(false)
        }
    }

    return (
        <div className="hf-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="hf-bulk-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="hf-bulk-header">
                    <div>
                        <span className="hf-bulk-badge">⚡ AI Batch Screening</span>
                        <h3>Bulk Resume Screener & ATS Leaderboard</h3>
                        <p>Target role: <strong>{job?.title || 'Active Job Opening'}</strong></p>
                    </div>
                    <button type="button" className="hf-bulk-close-btn" onClick={onClose} aria-label="Close">✕</button>
                </header>

                {error && <div className="hf-bulk-alert error">{error}</div>}

                <div className="hf-bulk-body">
                    {results ? (
                        /* Leaderboard View */
                        <div className="hf-bulk-leaderboard-view">
                            <div className="hf-leaderboard-top-row">
                                <div>
                                    <h4>Ranked Candidate Leaderboard ({results.length})</h4>
                                    <p>Candidates evaluated and scored against verified job competencies.</p>
                                </div>
                                <button type="button" className="hf-btn-rescreen" onClick={() => setResults(null)}>
                                    ← Edit & Screen More
                                </button>
                            </div>

                            <div className="hf-leaderboard-table-wrap">
                                <table className="hf-leaderboard-table">
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Candidate</th>
                                            <th>ATS Match</th>
                                            <th>Key Skills</th>
                                            <th>Action Recommendation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((c, i) => (
                                            <tr key={c.email || i} className={i === 0 ? 'rank-first' : ''}>
                                                <td className="col-rank">
                                                    <span className={`hf-rank-medal rank-${i + 1}`}>#{i + 1}</span>
                                                </td>
                                                <td className="col-candidate">
                                                    <strong>{c.name}</strong>
                                                    <small>{c.email}</small>
                                                </td>
                                                <td className="col-score">
                                                    <div className="hf-tbl-score-gauge">
                                                        <span className="hf-tbl-score-val">{c.matchPercentage}%</span>
                                                        <span className={`hf-tbl-fit-pill ${c.matchPercentage >= 75 ? 'high' : c.matchPercentage >= 55 ? 'medium' : 'low'}`}>
                                                            {c.fitLevel}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="col-skills">
                                                    <div className="hf-tbl-chips">
                                                        {c.matchedSkills?.map((s) => (
                                                            <span key={s} className="skill-chip matched">✓ {s}</span>
                                                        ))}
                                                        {c.missingSkills?.slice(0, 2).map((s) => (
                                                            <span key={s} className="skill-chip missing">+ {s}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="col-action">
                                                    <span className={`hf-rec-badge rec-${c.recommendedAction.toLowerCase()}`}>
                                                        {c.recommendedAction === 'Fast-Track' ? '⭐ Fast-Track' : c.recommendedAction}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* Input & Upload Form */
                        <form className="hf-bulk-form" onSubmit={handleRunScreening}>
                            <div className="hf-bulk-form-top">
                                <div>
                                    <h4>Add Candidate Resumes to Screen</h4>
                                    <p>Paste candidate resumes or load realistic sample candidates with 1 click.</p>
                                </div>
                                <button type="button" className="hf-btn-sample" onClick={handleLoadSamples}>
                                    ✨ Load Sample Candidates
                                </button>
                            </div>

                            <div className="hf-candidates-input-list">
                                {candidates.map((c, idx) => (
                                    <div key={idx} className="hf-candidate-input-card">
                                        <div className="hf-cand-row-header">
                                            <span>Candidate #{idx + 1}</span>
                                            {candidates.length > 1 && (
                                                <button type="button" className="hf-btn-del-row" onClick={() => handleRemoveRow(idx)}>✕ Remove</button>
                                            )}
                                        </div>
                                        <div className="hf-cand-fields-row">
                                            <input
                                                type="text"
                                                placeholder="Candidate full name (e.g. Aarav Sharma)"
                                                value={c.name}
                                                onChange={(e) => handleChange(idx, 'name', e.target.value)}
                                                required
                                            />
                                            <input
                                                type="email"
                                                placeholder="Email address"
                                                value={c.email}
                                                onChange={(e) => handleChange(idx, 'email', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <textarea
                                            rows={3}
                                            placeholder="Paste candidate resume summary, skills, and work history here…"
                                            value={c.resumeText}
                                            onChange={(e) => handleChange(idx, 'resumeText', e.target.value)}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="hf-bulk-form-actions">
                                <button type="button" className="hf-btn-add-candidate" onClick={handleAddRow}>
                                    + Add Another Candidate
                                </button>
                                <button type="submit" className="hf-btn-run-screening" disabled={screening}>
                                    {screening ? 'Analyzing Resumes…' : '⚡ Run AI Batch Screening'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
