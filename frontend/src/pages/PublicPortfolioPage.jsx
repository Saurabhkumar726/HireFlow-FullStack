import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import './PublicPortfolioPage.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

export default function PublicPortfolioPage() {
    const { user } = useAuth()
    const [contactModalOpen, setContactModalOpen] = useState(false)
    const [contactSent, setContactSent] = useState(false)
    const [recruiterMessage, setRecruiterMessage] = useState({
        name: '',
        company: '',
        email: '',
        message: 'We were impressed by your portfolio and would love to schedule an introductory technical interview with our team!'
    })

    const profile = useMemo(() => {
        // Load candidate resume data from localStorage or fallback to student demo
        try {
            const saved = localStorage.getItem('hireflow-resume-builder-data')
            if (saved) {
                return JSON.parse(saved)
            }
        } catch {
            // fallback
        }

        // Demo profile fallback
        return {
            fullName: user?.fullName || 'Alex Morgan',
            title: 'Full-Stack Software Engineer',
            email: user?.email || 'alex.morgan@hireflow.app',
            phone: '+91 98765 43210',
            location: 'Bengaluru, India',
            linkedIn: 'linkedin.com/in/alexmorgan',
            github: 'github.com/alexmorgan',
            summary: 'Full-Stack Software Engineer with 2+ years of experience designing and deploying high-performance cloud applications using ASP.NET Core, React, and PostgreSQL.',
            skillCategories: [
                { category: 'Frontend', skills: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Redux Toolkit'] },
                { category: 'Backend', skills: ['C#', '.NET 10', 'ASP.NET Core', 'REST APIs', 'Node.js'] },
                { category: 'Databases & Cloud', skills: ['PostgreSQL', 'Redis', 'Docker', 'AWS', 'EF Core'] },
                { category: 'Architecture', skills: ['Microservices', 'Clean Architecture', 'CI/CD Pipelines', 'System Design'] }
            ],
            experience: [
                {
                    id: 1,
                    title: 'Senior Software Engineer',
                    company: 'TechFlow Systems',
                    period: '2024 - Present',
                    bullets: [
                        'Architected distributed microservices backend handling 50,000+ monthly active users.',
                        'Optimized PostgreSQL query execution pipelines, reducing query latency by 42% on heavy reports.',
                        'Mentored junior engineers and instituted automated CI/CD checks.'
                    ]
                },
                {
                    id: 2,
                    title: 'Software Engineer',
                    company: 'Innovate Labs',
                    period: '2022 - 2024',
                    bullets: [
                        'Developed responsive web interfaces using React, Redux, and Tailwind CSS.',
                        'Implemented JWT authentication and role-based access control (RBAC).',
                        'Collaborated with product teams to deliver sprint features with 98% on-time completion.'
                    ]
                }
            ],
            education: [
                {
                    id: 1,
                    degree: 'B.Tech in Computer Science & Engineering',
                    institution: 'National Institute of Technology',
                    year: '2018 - 2022',
                    score: 'CGPA: 8.8 / 10.0'
                }
            ],
            projects: [
                {
                    id: 1,
                    name: 'HireFlow Talent Intelligence Platform',
                    tech: 'React, ASP.NET Core, PostgreSQL, Docker',
                    description: 'Engineered end-to-end talent platform with automated ATS resume ranking and candidate scoring.'
                },
                {
                    id: 2,
                    name: 'Distributed Event Bus & Task Orchestrator',
                    tech: 'C#, RabbitMQ, Redis, Kubernetes',
                    description: 'Designed fault-tolerant asynchronous event queue with sub-10ms delivery guarantees.'
                }
            ]
        }
    }, [user])

    if (!profile) return null

    function handleSendContact(e) {
        e.preventDefault()
        setContactSent(true)
        try {
            fetch(`${API_BASE}/ResumeVersions/portfolio/alexmorgan/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recruiterMessage)
            }).catch(() => { })
        } catch {
            // fallback
        }
        setTimeout(() => {
            setContactSent(false)
            setContactModalOpen(false)
        }, 2500)
    }

    return (
        <div className="hf-portfolio-page">
            <header className="hf-portfolio-nav">
                <div className="hf-portfolio-nav-inner">
                    <Link to="/" className="hf-portfolio-brand">
                        <span>Hire<span>Flow</span></span>
                        <span className="hf-portfolio-verified-tag">✓ Verified Student Portfolio</span>
                    </Link>

                    <div className="hf-portfolio-nav-actions">
                        <Link to="/candidate/resume-builder" className="hf-portfolio-edit-btn">
                            ✏️ Edit in Resume Builder
                        </Link>
                        <button
                            type="button"
                            className="hf-portfolio-contact-btn"
                            onClick={() => setContactModalOpen(true)}
                        >
                            ✉️ Contact / Invite to Interview
                        </button>
                    </div>
                </div>
            </header>

            <main className="hf-portfolio-container">
                {/* Hero Section */}
                <section className="hf-portfolio-hero">
                    <div className="hf-portfolio-avatar">
                        {(profile.fullName || 'Candidate').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="hf-portfolio-hero-info">
                        <div className="hf-portfolio-hero-title-row">
                            <h1>{profile.fullName}</h1>
                            <span className="hf-portfolio-available-pill">🟢 Actively Interviewing</span>
                        </div>
                        <h2>{profile.title}</h2>
                        <p className="hf-portfolio-location">📍 {profile.location}</p>

                        <div className="hf-portfolio-contacts-row">
                            {profile.email && <span className="hf-portfolio-chip">📧 {profile.email}</span>}
                            {profile.github && (
                                <a
                                    href={profile.github.startsWith('http') ? profile.github : `https://${profile.github}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hf-portfolio-chip link"
                                >
                                    🐙 GitHub
                                </a>
                            )}
                            {profile.linkedIn && (
                                <a
                                    href={profile.linkedIn.startsWith('http') ? profile.linkedIn : `https://${profile.linkedIn}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hf-portfolio-chip link"
                                >
                                    💼 LinkedIn
                                </a>
                            )}
                        </div>
                    </div>
                </section>

                {/* Badges Bar */}
                <section className="hf-portfolio-badges">
                    <div className="hf-portfolio-badge-item">
                        <span className="hf-portfolio-badge-icon">⭐</span>
                        <div>
                            <strong>Verified Top Talent</strong>
                            <small>HireFlow ATS Verified</small>
                        </div>
                    </div>
                    <div className="hf-portfolio-badge-item">
                        <span className="hf-portfolio-badge-icon">⚡</span>
                        <div>
                            <strong>Fast Responder</strong>
                            <small>&lt; 24h Response Rate</small>
                        </div>
                    </div>
                    <div className="hf-portfolio-badge-item">
                        <span className="hf-portfolio-badge-icon">🏆</span>
                        <div>
                            <strong>Full-Stack Certified</strong>
                            <small>C#, React, SQL Assessment</small>
                        </div>
                    </div>
                </section>

                {/* About & Summary */}
                <section className="hf-portfolio-section">
                    <h3>About Me</h3>
                    <p className="hf-portfolio-summary-text">{profile.summary}</p>
                </section>

                {/* Core Competencies */}
                <section className="hf-portfolio-section">
                    <h3>Core Skills & Technical Arsenal</h3>
                    <div className="hf-portfolio-skills-grid">
                        {(profile.skillCategories || []).map((cat, idx) => (
                            <div key={idx} className="hf-portfolio-skill-card">
                                <h4>{cat.category}</h4>
                                <div className="hf-portfolio-skill-tags">
                                    {(cat.skills || []).map((skill) => (
                                        <span key={skill} className="hf-portfolio-tag">{skill}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Featured Projects */}
                <section className="hf-portfolio-section">
                    <h3>Featured Projects</h3>
                    <div className="hf-portfolio-projects-grid">
                        {(profile.projects || []).map((proj) => (
                            <div key={proj.id} className="hf-portfolio-project-card">
                                <h4>{proj.name}</h4>
                                <span className="hf-portfolio-project-tech">{proj.tech}</span>
                                <p>{proj.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Experience & Education Grid */}
                <div className="hf-portfolio-timeline-grid">
                    <section className="hf-portfolio-section">
                        <h3>Work Experience</h3>
                        <div className="hf-portfolio-timeline">
                            {(profile.experience || []).map((exp) => (
                                <div key={exp.id} className="hf-portfolio-timeline-item">
                                    <div className="hf-portfolio-timeline-dot" />
                                    <h4>{exp.title}</h4>
                                    <span className="hf-portfolio-timeline-sub">{exp.company} • {exp.period}</span>
                                    {exp.bullets?.length > 0 && (
                                        <ul>
                                            {exp.bullets.map((b, i) => (
                                                <li key={i}>{b}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="hf-portfolio-section">
                        <h3>Education</h3>
                        <div className="hf-portfolio-timeline">
                            {(profile.education || []).map((edu) => (
                                <div key={edu.id} className="hf-portfolio-timeline-item">
                                    <div className="hf-portfolio-timeline-dot" />
                                    <h4>{edu.degree}</h4>
                                    <span className="hf-portfolio-timeline-sub">{edu.institution} • {edu.year}</span>
                                    {edu.score && <p className="hf-portfolio-score">{edu.score}</p>}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>

            {/* Recruiter Contact Modal */}
            {contactModalOpen && (
                <div className="hf-portfolio-modal-overlay" role="dialog" aria-modal="true">
                    <div className="hf-portfolio-modal-card">
                        <header className="hf-portfolio-modal-header">
                            <div>
                                <h3>Connect with {profile.fullName}</h3>
                                <p>Send an interview invitation or direct message to this candidate.</p>
                            </div>
                            <button
                                type="button"
                                className="hf-portfolio-modal-close"
                                onClick={() => setContactModalOpen(false)}
                            >
                                ✕
                            </button>
                        </header>

                        {contactSent ? (
                            <div className="hf-portfolio-modal-success">
                                <span className="hf-portfolio-success-icon">✓</span>
                                <h4>Message & Interview Request Sent!</h4>
                                <p>{profile.fullName} has been notified and will receive your inquiry directly.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSendContact} className="hf-portfolio-modal-form">
                                <label>
                                    Your Name / Recruiter Name
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Sarah Jenkins"
                                        value={recruiterMessage.name}
                                        onChange={(e) => setRecruiterMessage({ ...recruiterMessage, name: e.target.value })}
                                    />
                                </label>

                                <div className="hf-portfolio-form-row">
                                    <label>
                                        Company Name
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g. Acme Innovations"
                                            value={recruiterMessage.company}
                                            onChange={(e) => setRecruiterMessage({ ...recruiterMessage, company: e.target.value })}
                                        />
                                    </label>
                                    <label>
                                        Your Work Email
                                        <input
                                            required
                                            type="email"
                                            placeholder="recruiter@acme.com"
                                            value={recruiterMessage.email}
                                            onChange={(e) => setRecruiterMessage({ ...recruiterMessage, email: e.target.value })}
                                        />
                                    </label>
                                </div>

                                <label>
                                    Interview Invitation / Opportunity Details
                                    <textarea
                                        rows={4}
                                        value={recruiterMessage.message}
                                        onChange={(e) => setRecruiterMessage({ ...recruiterMessage, message: e.target.value })}
                                    />
                                </label>

                                <div className="hf-portfolio-modal-actions">
                                    <button
                                        type="button"
                                        className="hf-portfolio-modal-cancel"
                                        onClick={() => setContactModalOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="hf-portfolio-modal-submit"
                                    >
                                        🚀 Send Interview Invitation
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
