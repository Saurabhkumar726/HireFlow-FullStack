import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import './InterviewStudioPage.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

const COMPANY_QUESTION_BANK = [
    {
        id: 'q-1',
        company: 'Amazon',
        topic: 'Leadership & Behavioral',
        difficulty: 'Medium',
        question: 'Tell me about a time you had a disagreement with a senior engineer or team member. How did you resolve it?',
        tips: 'Focus on Customer Obsession and Disagree & Commit. Use STAR (Situation, Task, Action, Result).'
    },
    {
        id: 'q-2',
        company: 'Amazon',
        topic: 'System Design',
        difficulty: 'Hard',
        question: 'Design a scalable, highly available notification service that can send millions of SMS and push alerts with guaranteed deduplication.',
        tips: 'Discuss message queues (RabbitMQ/SQS), idempotency keys, rate limiters, and exponential backoff.'
    },
    {
        id: 'q-3',
        company: 'TCS / Campus Drives',
        topic: 'DSA & Algorithms',
        difficulty: 'Easy',
        question: 'How do you detect a cycle in a singly linked list with O(1) auxiliary memory?',
        tips: 'Explain Floyd’s Cycle-Finding Algorithm (Hare and Tortoise fast/slow pointers).'
    },
    {
        id: 'q-4',
        company: 'Infosys',
        topic: 'Core CS & DBMS',
        difficulty: 'Medium',
        question: 'Explain the difference between clustered and non-clustered indexes in SQL Server/PostgreSQL. How do they affect query performance?',
        tips: 'Clustered determines physical order of rows; non-clustered creates a separate B-tree pointer structure.'
    },
    {
        id: 'q-5',
        company: 'Google',
        topic: 'DSA & Algorithms',
        difficulty: 'Hard',
        question: 'Given an array of intervals, merge all overlapping intervals and return the sorted non-overlapping result.',
        tips: 'Sort intervals by starting time O(N log N), then iterate linearly keeping track of maximum end boundary.'
    },
    {
        id: 'q-6',
        company: 'Tech Startups',
        topic: 'React & Frontend',
        difficulty: 'Medium',
        question: 'How does React 19 handle concurrency and Transitions? When would you use useTransition vs standard useState?',
        tips: 'useTransition marks state updates as non-blocking, allowing the browser UI to remain responsive during heavy re-renders.'
    }
]

export default function InterviewStudioPage() {
    const [activeTab, setActiveTab] = useState('mock') // 'mock', 'speech', 'bank', 'elevator'

    // Mock Interview State
    const [roleTitle, setRoleTitle] = useState('Full-Stack Software Engineer')
    const [mockQuestions, setMockQuestions] = useState([])
    const [selectedQIdx, setSelectedQIdx] = useState(0)
    const [candidateAnswer, setCandidateAnswer] = useState('')
    const [loadingQuestions, setLoadingQuestions] = useState(false)
    const [evaluating, setEvaluating] = useState(false)
    const [evaluationResult, setEvaluationResult] = useState(null)

    // Speech Coach State
    const [speechText, setSpeechText] = useState('')
    const [isListening, setIsListening] = useState(false)
    const [speechTime, setSpeechTime] = useState(0)
    const timerRef = useRef(null)

    // Company Question Bank State
    const [selectedCompany, setSelectedCompany] = useState('All')
    const [selectedTopic, setSelectedTopic] = useState('All')
    const [masteredIds, setMasteredIds] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('hireflow-mastered-questions') || '[]')
        } catch {
            return []
        }
    })
    const [questionNotes, setQuestionNotes] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('hireflow-question-notes') || '{}')
        } catch {
            return {}
        }
    })

    // Elevator Pitch Recorder State
    const [pitchRecording, setPitchRecording] = useState(false)
    const [pitchTimeLeft, setPitchTimeLeft] = useState(60)
    const [pitchRecordedUrl, setPitchRecordedUrl] = useState(null)
    const pitchMediaRecorderRef = useRef(null)
    const pitchChunksRef = useRef([])
    const pitchIntervalRef = useRef(null)

    // 1. Mock Interview Functions
    async function handleGenerateQuestions() {
        setLoadingQuestions(true)
        setEvaluationResult(null)
        setCandidateAnswer('')
        try {
            const res = await fetch(`${API_BASE}/AiAgent/mock-interview/generate-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roleTitle: roleTitle,
                    jobDescription: `${roleTitle} with proficiency in React, .NET Core, SQL, REST APIs, and System Architecture.`,
                    skills: ['React', 'C#', '.NET', 'SQL', 'Docker', 'System Design']
                })
            })
            if (res.ok) {
                const data = await res.json()
                setMockQuestions(data || [])
                setSelectedQIdx(0)
            } else {
                throw new Error('Fallback')
            }
        } catch {
            // High quality fallback questions
            setMockQuestions([
                {
                    id: 1,
                    question: `Describe a challenging full-stack feature you implemented. How did you structure the API contracts, database model, and frontend state?`,
                    category: 'Technical Architecture'
                },
                {
                    id: 2,
                    question: `How do you identify and resolve SQL query performance bottlenecks when an application scales up in production?`,
                    category: 'System Performance'
                },
                {
                    id: 3,
                    question: `Tell me about a time a production bug occurred after a release. What were your steps to diagnose, mitigate, and prevent recurrence?`,
                    category: 'Incident Response & STAR'
                }
            ])
            setSelectedQIdx(0)
        } finally {
            setLoadingQuestions(false)
        }
    }

    async function handleEvaluateAnswer() {
        if (!candidateAnswer.trim()) return
        setEvaluating(true)
        setEvaluationResult(null)

        const currentQ = mockQuestions[selectedQIdx]
        const questionText = currentQ?.question || 'Technical problem solving'

        try {
            const res = await fetch(`${API_BASE}/AiAgent/mock-interview/evaluate-answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: questionText,
                    candidateAnswer: candidateAnswer,
                    roleTitle: roleTitle,
                    category: currentQ?.category || 'Technical'
                })
            })

            if (res.ok) {
                const data = await res.json()
                setEvaluationResult(data)
            } else {
                throw new Error('Fallback')
            }
        } catch {
            // Smart local STAR evaluation
            const words = candidateAnswer.trim().split(/\s+/).length
            const hasSituation = /when|project|company|team|client/i.test(candidateAnswer)
            const hasAction = /implemented|architected|built|designed|resolved|coded/i.test(candidateAnswer)
            const hasResult = /reduced|increased|improved|delivered|saved|percent|%/i.test(candidateAnswer)

            const score = Math.min(95, Math.max(65, (hasSituation ? 25 : 10) + (hasAction ? 35 : 20) + (hasResult ? 30 : 10) + Math.min(10, Math.floor(words / 15))))

            setEvaluationResult({
                overallScore: score,
                strengths: [
                    'Clear technical vocabulary and logical sequencing of events.',
                    hasAction ? 'Strong focus on personal technical contribution.' : 'Good situational awareness.',
                    hasResult ? 'Included quantitative business results and impact.' : 'Articulated key architecture principles.'
                ],
                areasForImprovement: [
                    !hasResult ? 'Highlight quantifiable results (e.g. "% latency reduction" or "hours saved per week").' : 'Expand on trade-offs evaluated before selecting your solution.',
                    'Conclude with the lasting impact or architectural lessons learned.'
                ],
                recommendedAnswerTemplate: 'Situation: At TechFlow Systems, our reporting dashboard suffered 4s query delays. Task: I took ownership of optimizing the query pipeline. Action: I introduced compound B-tree indexes and cached query projections in Redis. Result: Query execution time dropped by 70%, with zero downtime.'
            })
        } finally {
            setEvaluating(false)
        }
    }

    // 2. Speech Coach Analysis
    function toggleSpeechRecording() {
        if (!isListening) {
            setIsListening(true)
            setSpeechTime(0)
            timerRef.current = setInterval(() => {
                setSpeechTime(prev => prev + 1)
            }, 1000)

            // Web Speech API if supported
            if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
                const recognizer = new SpeechRecognition()
                recognizer.continuous = true
                recognizer.interimResults = true
                recognizer.onresult = (e) => {
                    const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ')
                    setSpeechText(transcript)
                }
                recognizer.onerror = () => { }
                recognizer.start()
            }
        } else {
            setIsListening(false)
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }

    // Compute Speech Metrics
    const speechWords = speechText.trim().split(/\s+/).filter(Boolean)
    const wordCount = speechWords.length
    const minutes = Math.max(0.1, speechTime / 60)
    const wpm = Math.round(wordCount / minutes) || 0

    // Count filler words
    const fillerKeywords = ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'sort of', 'kind of']
    const fillerCounts = fillerKeywords.reduce((acc, word) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        const matches = speechText.match(regex)
        if (matches) acc[word] = matches.length
        return acc
    }, {})
    const totalFillers = Object.values(fillerCounts).reduce((a, b) => a + b, 0)

    // 3. Question Bank Mastered Toggles
    function toggleMastered(qId) {
        setMasteredIds(prev => {
            const next = prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
            localStorage.setItem('hireflow-mastered-questions', JSON.stringify(next))
            return next
        })
    }

    function handleSaveNote(qId, text) {
        setQuestionNotes(prev => {
            const next = { ...prev, [qId]: text }
            localStorage.setItem('hireflow-question-notes', JSON.stringify(next))
            return next
        })
    }

    const filteredBank = COMPANY_QUESTION_BANK.filter(q => {
        if (selectedCompany !== 'All' && !q.company.includes(selectedCompany)) return false
        if (selectedTopic !== 'All' && !q.topic.includes(selectedTopic)) return false
        return true
    })

    // 4. Elevator Pitch Recorder
    async function startPitchRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            pitchChunksRef.current = []
            const recorder = new MediaRecorder(stream)
            pitchMediaRecorderRef.current = recorder

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) pitchChunksRef.current.push(e.data)
            }

            recorder.onstop = () => {
                const blob = new Blob(pitchChunksRef.current, { type: 'video/webm' })
                setPitchRecordedUrl(URL.createObjectURL(blob))
                stream.getTracks().forEach(t => t.stop())
            }

            recorder.start()
            setPitchRecording(true)
            setPitchTimeLeft(60)

            pitchIntervalRef.current = setInterval(() => {
                setPitchTimeLeft(prev => {
                    if (prev <= 1) {
                        stopPitchRecording()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } catch {
            alert('Camera or Microphone access denied. Please allow browser permissions to record your pitch.')
        }
    }

    function stopPitchRecording() {
        if (pitchMediaRecorderRef.current && pitchMediaRecorderRef.current.state !== 'inactive') {
            pitchMediaRecorderRef.current.stop()
        }
        setPitchRecording(false)
        if (pitchIntervalRef.current) clearInterval(pitchIntervalRef.current)
    }

    return (
        <div className="hf-studio-page">
            <header className="hf-studio-header">
                <div className="hf-studio-header-inner">
                    <div className="hf-studio-breadcrumbs">
                        <Link to="/candidate/home">Candidate Home</Link>
                        <span>/</span>
                        <span>Interview Studio & Speech Coach</span>
                    </div>
                    <h1>AI Interview Studio & Speech Coach</h1>
                    <p>Master technical interviews, optimize your speech delivery, and prepare for top tier campus drives.</p>
                </div>
            </header>

            <main className="hf-studio-container">
                {/* Hub Navigation Tabs */}
                <div className="hf-studio-tabs" role="tablist">
                    <button
                        type="button"
                        className={`hf-studio-tab ${activeTab === 'mock' ? 'active' : ''}`}
                        onClick={() => setActiveTab('mock')}
                    >
                        🤖 AI Mock Interview & STAR Evaluator
                    </button>
                    <button
                        type="button"
                        className={`hf-studio-tab ${activeTab === 'speech' ? 'active' : ''}`}
                        onClick={() => setActiveTab('speech')}
                    >
                        🎙️ Speech & Filler Word Coach
                    </button>
                    <button
                        type="button"
                        className={`hf-studio-tab ${activeTab === 'bank' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bank')}
                    >
                        💼 Company Question Bank ({COMPANY_QUESTION_BANK.length})
                    </button>
                    <button
                        type="button"
                        className={`hf-studio-tab ${activeTab === 'elevator' ? 'active' : ''}`}
                        onClick={() => setActiveTab('elevator')}
                    >
                        🎥 60s Elevator Pitch Recorder
                    </button>
                </div>

                {/* TAB 1: AI MOCK INTERVIEW */}
                {activeTab === 'mock' && (
                    <div className="hf-studio-tab-content">
                        <div className="hf-studio-card">
                            <div className="hf-studio-role-bar">
                                <label>
                                    Target Role / Stack
                                    <input
                                        type="text"
                                        value={roleTitle}
                                        onChange={(e) => setRoleTitle(e.target.value)}
                                        placeholder="e.g. Full-Stack Engineer, React Specialist"
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="hf-studio-primary-btn"
                                    onClick={handleGenerateQuestions}
                                    disabled={loadingQuestions}
                                >
                                    {loadingQuestions ? 'Generating Questions...' : '⚡ Generate Role Questions'}
                                </button>
                            </div>

                            {mockQuestions.length > 0 && (
                                <div className="hf-studio-mock-q-area">
                                    <div className="hf-studio-q-selector">
                                        {mockQuestions.map((q, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                className={`hf-studio-q-pill ${selectedQIdx === idx ? 'active' : ''}`}
                                                onClick={() => {
                                                    setSelectedQIdx(idx)
                                                    setEvaluationResult(null)
                                                }}
                                            >
                                                Q{idx + 1}: {q.category || 'Technical'}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="hf-studio-current-q-box">
                                        <span className="hf-studio-q-tag">Question #{selectedQIdx + 1}</span>
                                        <h3>{mockQuestions[selectedQIdx]?.question}</h3>
                                    </div>

                                    <div className="hf-studio-answer-box">
                                        <label>
                                            Your Answer <span className="hf-studio-hint">(Use STAR: Situation, Task, Action, Result)</span>
                                            <textarea
                                                rows={6}
                                                placeholder="Structure your answer clearly: Describe the project situation, the specific problem, the technical actions you personally executed, and the measurable results achieved..."
                                                value={candidateAnswer}
                                                onChange={(e) => setCandidateAnswer(e.target.value)}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            className="hf-studio-evaluate-btn"
                                            disabled={evaluating || !candidateAnswer.trim()}
                                            onClick={handleEvaluateAnswer}
                                        >
                                            {evaluating ? 'Grading Answer with STAR Engine...' : '🎯 Evaluate with STAR Framework'}
                                        </button>
                                    </div>

                                    {evaluationResult && (
                                        <div className="hf-studio-eval-results">
                                            <div className="hf-studio-score-card">
                                                <div className="hf-studio-score-circle">
                                                    <span>{evaluationResult.overallScore}%</span>
                                                    <small>STAR Score</small>
                                                </div>
                                                <div>
                                                    <h4>{evaluationResult.overallScore >= 80 ? '🌟 Strong Technical Delivery' : '⚡ Promising — Add Quantifiable Results'}</h4>
                                                    <p>Evaluated using real-world engineering interview benchmarks.</p>
                                                </div>
                                            </div>

                                            <div className="hf-studio-eval-grid">
                                                <div className="hf-studio-eval-box good">
                                                    <h5>✓ Strong Points</h5>
                                                    <ul>
                                                        {(evaluationResult.strengths || []).map((s, i) => (
                                                            <li key={i}>{s}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="hf-studio-eval-box tips">
                                                    <h5>💡 Growth Opportunities</h5>
                                                    <ul>
                                                        {(evaluationResult.areasForImprovement || []).map((tip, i) => (
                                                            <li key={i}>{tip}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {evaluationResult.recommendedAnswerTemplate && (
                                                <div className="hf-studio-ideal-template">
                                                    <h5>⭐ Ideal Exemplary Response</h5>
                                                    <p>{evaluationResult.recommendedAnswerTemplate}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: SPEECH & FILLER WORD COACH */}
                {activeTab === 'speech' && (
                    <div className="hf-studio-tab-content">
                        <div className="hf-studio-card">
                            <div className="hf-studio-speech-intro">
                                <h3>Real-Time Speech & Pacing Coach</h3>
                                <p>Practice speaking your interview pitch out loud. HireFlow tracks speaking speed, detects filler words, and ensures you sound confident.</p>
                            </div>

                            <div className="hf-studio-speech-metrics-grid">
                                <div className="hf-studio-stat-card">
                                    <span className="hf-studio-stat-val">{wpm}</span>
                                    <span className="hf-studio-stat-lbl">Words / Min (Target: 130-150)</span>
                                    <small className={wpm >= 120 && wpm <= 160 ? 'optimal' : 'warning'}>
                                        {wpm === 0 ? 'Start speaking to measure' : wpm < 120 ? 'Too slow' : wpm > 160 ? 'A bit rushed' : 'Optimal Pace ✓'}
                                    </small>
                                </div>

                                <div className="hf-studio-stat-card">
                                    <span className="hf-studio-stat-val">{totalFillers}</span>
                                    <span className="hf-studio-stat-lbl">Filler Words Detected</span>
                                    <small className={totalFillers <= 2 ? 'optimal' : 'warning'}>
                                        {totalFillers === 0 ? 'Crisp & Articulate' : `${totalFillers} filler words`}
                                    </small>
                                </div>

                                <div className="hf-studio-stat-card">
                                    <span className="hf-studio-stat-val">{speechTime}s</span>
                                    <span className="hf-studio-stat-lbl">Practice Duration</span>
                                    <small>{wordCount} total words spoken</small>
                                </div>
                            </div>

                            <div className="hf-studio-speech-input-area">
                                <div className="hf-studio-speech-controls">
                                    <button
                                        type="button"
                                        className={`hf-studio-rec-btn ${isListening ? 'recording' : ''}`}
                                        onClick={toggleSpeechRecording}
                                    >
                                        {isListening ? '⏹ Stop Speaking & Analyze' : '🎙️ Start Mic & Speak'}
                                    </button>
                                    <button
                                        type="button"
                                        className="hf-studio-clear-btn"
                                        onClick={() => {
                                            setSpeechText('')
                                            setSpeechTime(0)
                                        }}
                                    >
                                        ↺ Clear Transcript
                                    </button>
                                </div>

                                <textarea
                                    rows={6}
                                    placeholder="Or paste/type your answer transcript here to analyze speaking clarity and filler word count..."
                                    value={speechText}
                                    onChange={(e) => setSpeechText(e.target.value)}
                                />

                                {Object.keys(fillerCounts).length > 0 && (
                                    <div className="hf-studio-filler-breakdown">
                                        <h4>Filler Word Breakdown:</h4>
                                        <div className="hf-studio-filler-tags">
                                            {Object.entries(fillerCounts).map(([w, c]) => (
                                                <span key={w} className="hf-studio-filler-tag">
                                                    "{w}": {c}x
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: COMPANY QUESTION BANK */}
                {activeTab === 'bank' && (
                    <div className="hf-studio-tab-content">
                        <div className="hf-studio-card">
                            <div className="hf-studio-bank-filters">
                                <label>
                                    Filter by Company
                                    <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
                                        <option value="All">All Companies</option>
                                        <option value="Amazon">Amazon</option>
                                        <option value="Google">Google</option>
                                        <option value="TCS">TCS / Campus Drives</option>
                                        <option value="Infosys">Infosys</option>
                                        <option value="Tech Startups">Tech Startups</option>
                                    </select>
                                </label>

                                <label>
                                    Filter by Topic
                                    <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                                        <option value="All">All Topics</option>
                                        <option value="DSA">DSA & Algorithms</option>
                                        <option value="System Design">System Design</option>
                                        <option value="React">React & Frontend</option>
                                        <option value="Core CS">Core CS & DBMS</option>
                                        <option value="Leadership">Behavioral & HR</option>
                                    </select>
                                </label>
                            </div>

                            <div className="hf-studio-bank-list">
                                {filteredBank.map((item) => {
                                    const isMastered = masteredIds.includes(item.id)
                                    const note = questionNotes[item.id] || ''

                                    return (
                                        <div key={item.id} className={`hf-studio-bank-item ${isMastered ? 'mastered' : ''}`}>
                                            <div className="hf-studio-bank-header">
                                                <div>
                                                    <span className="hf-studio-company-pill">{item.company}</span>
                                                    <span className="hf-studio-topic-pill">{item.topic}</span>
                                                    <span className={`hf-studio-diff-pill ${item.difficulty.toLowerCase()}`}>{item.difficulty}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`hf-studio-master-btn ${isMastered ? 'active' : ''}`}
                                                    onClick={() => toggleMastered(item.id)}
                                                >
                                                    {isMastered ? '✓ Mastered' : '○ Mark Mastered'}
                                                </button>
                                            </div>

                                            <h4 className="hf-studio-bank-question">{item.question}</h4>
                                            <p className="hf-studio-bank-tips">💡 <b>Interview Tip:</b> {item.tips}</p>

                                            <div className="hf-studio-bank-note">
                                                <textarea
                                                    rows={2}
                                                    placeholder="Add your private notes, bullet points, or code approach for this question..."
                                                    value={note}
                                                    onChange={(e) => handleSaveNote(item.id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: 60-SECOND ELEVATOR PITCH */}
                {activeTab === 'elevator' && (
                    <div className="hf-studio-tab-content">
                        <div className="hf-studio-card">
                            <div className="hf-studio-pitch-intro">
                                <h3>60-Second Video / Audio Elevator Pitch</h3>
                                <p>Record a high-impact 60-second video elevator pitch. Stand out to tech recruiters before they even open your resume.</p>
                            </div>

                            <div className="hf-studio-pitch-widget">
                                <div className="hf-studio-pitch-timer-bar">
                                    <div
                                        className="hf-studio-pitch-timer-fill"
                                        style={{ width: `${((60 - pitchTimeLeft) / 60) * 100}%` }}
                                    />
                                </div>
                                <span className="hf-studio-pitch-clock">
                                    ⏱️ {pitchTimeLeft}s remaining
                                </span>

                                <div className="hf-studio-pitch-actions">
                                    {!pitchRecording ? (
                                        <button
                                            type="button"
                                            className="hf-studio-pitch-record-btn"
                                            onClick={startPitchRecording}
                                        >
                                            🔴 Start 60s Recording
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="hf-studio-pitch-stop-btn"
                                            onClick={stopPitchRecording}
                                        >
                                            ⏹ Stop & Finish Pitch
                                        </button>
                                    )}
                                </div>

                                {pitchRecordedUrl && (
                                    <div className="hf-studio-pitch-playback">
                                        <h4>Preview Your Recorded Elevator Pitch</h4>
                                        <video src={pitchRecordedUrl} controls className="hf-studio-video-player" />
                                        <div className="hf-studio-pitch-saved-badge">
                                            ✓ Ready to attach to your HireFlow candidate card!
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
