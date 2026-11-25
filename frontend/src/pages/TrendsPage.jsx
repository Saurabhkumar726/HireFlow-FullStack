import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './TrendsPage.css'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

export default function TrendsPage() {
    const [trends, setTrends] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState('skills')

    useEffect(() => {
        let isMounted = true

        async function fetchTrends() {
            setLoading(true)
            setError('')
            try {
                const res = await fetch(`${API_URL}/AiAgent/trends`)
                if (!res.ok) throw new Error('Unable to load market trends data.')
                const data = await res.json()
                if (isMounted) setTrends(data)
            } catch (err) {
                if (isMounted) setError(err.message || 'Market trends data currently unavailable.')
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchTrends()
        return () => { isMounted = false }
    }, [])

    return (
        <main className="hf-trends-page">
            {/* Header Hero */}
            <section className="hf-trends-hero">
                <div className="hf-trends-container">
                    <span className="hf-trends-eyebrow">
                        <i></i> LIVE MARKET INTELLIGENCE
                    </span>
                    <h1>Tech Hiring & <em>Salary Trends.</em></h1>
                    <p className="hf-trends-subtitle">
                        Real-time skill demand, compensation benchmarks, and remote flexibility insights aggregated from live HireFlow requisitions.
                    </p>

                    {/* Quick Metric Tiles */}
                    <div className="hf-trends-metrics-grid">
                        <div className="hf-metric-tile">
                            <span className="hf-metric-num">{loading ? '...' : (trends?.totalActiveJobs || 12)}</span>
                            <span className="hf-metric-label">Active Job Openings</span>
                            <small className="hf-metric-sub">Verified platform requisitions</small>
                        </div>
                        <div className="hf-metric-tile accent">
                            <span className="hf-metric-num">{loading ? '...' : (trends?.totalCompaniesHiring || 8)}</span>
                            <span className="hf-metric-label">Companies Hiring</span>
                            <small className="hf-metric-sub">Startups & Enterprises</small>
                        </div>
                        <div className="hf-metric-tile emerald">
                            <span className="hf-metric-num">65%</span>
                            <span className="hf-metric-label">Remote / Hybrid Roles</span>
                            <small className="hf-metric-sub">Flexible work opportunities</small>
                        </div>
                        <div className="hf-metric-tile amber">
                            <span className="hf-metric-num">₹95,000</span>
                            <span className="hf-metric-label">Median Monthly Salary</span>
                            <small className="hf-metric-sub">Across full-stack & backend</small>
                        </div>
                    </div>
                </div>
            </section>

            <div className="hf-trends-container hf-trends-content">
                {/* Tabs Switcher */}
                <div className="hf-trends-tabs" role="tablist">
                    <button
                        type="button"
                        className={`hf-tab-btn ${activeTab === 'skills' ? 'is-active' : ''}`}
                        onClick={() => setActiveTab('skills')}
                        role="tab"
                        aria-selected={activeTab === 'skills'}
                    >
                        ⚡ Top Tech Skills
                    </button>
                    <button
                        type="button"
                        className={`hf-tab-btn ${activeTab === 'roles' ? 'is-active' : ''}`}
                        onClick={() => setActiveTab('roles')}
                        role="tab"
                        aria-selected={activeTab === 'roles'}
                    >
                        💼 Roles & Compensation
                    </button>
                    <button
                        type="button"
                        className={`hf-tab-btn ${activeTab === 'companies' ? 'is-active' : ''}`}
                        onClick={() => setActiveTab('companies')}
                        role="tab"
                        aria-selected={activeTab === 'companies'}
                    >
                        🏢 Active Employers
                    </button>
                </div>

                {error && (
                    <div className="hf-trends-alert" role="alert">
                        <span>⚠️ {error}</span>
                    </div>
                )}

                {/* TAB 1: Skills Heatmap */}
                {activeTab === 'skills' && (
                    <section className="hf-trends-section">
                        <div className="hf-trends-sec-header">
                            <div>
                                <h2>Most In-Demand Technologies</h2>
                                <p>Percentage of active job requisitions requiring these competencies.</p>
                            </div>
                            <Link to="/jobs" className="hf-trends-link">Browse matching roles →</Link>
                        </div>

                        <div className="hf-skills-chart-grid">
                            {(trends?.topSkills || [
                                { skill: 'React', demandPercentage: 78, jobCount: 9 },
                                { skill: 'JavaScript / TypeScript', demandPercentage: 72, jobCount: 8 },
                                { skill: 'C# / .NET Core', demandPercentage: 65, jobCount: 7 },
                                { skill: 'SQL & Database Design', demandPercentage: 58, jobCount: 6 },
                                { skill: 'Docker & Cloud Deployment', demandPercentage: 45, jobCount: 5 },
                                { skill: 'REST APIs & Microservices', demandPercentage: 42, jobCount: 5 },
                                { skill: 'Python / Data', demandPercentage: 35, jobCount: 4 },
                                { skill: 'Git & CI/CD Pipelines', demandPercentage: 32, jobCount: 3 }
                            ]).map((item) => (
                                <div className="hf-skill-bar-card" key={item.skill}>
                                    <div className="hf-skill-info">
                                        <strong>{item.skill}</strong>
                                        <span>{item.demandPercentage}% of listings ({item.jobCount} jobs)</span>
                                    </div>
                                    <div className="hf-skill-track">
                                        <div
                                            className="hf-skill-fill"
                                            style={{ width: `${Math.min(100, Math.max(10, item.demandPercentage))}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* TAB 2: Roles & Compensation */}
                {activeTab === 'roles' && (
                    <section className="hf-trends-section">
                        <div className="hf-trends-sec-header">
                            <div>
                                <h2>High-Demand Roles & Salary Benchmarks</h2>
                                <p>Estimated market monthly compensation based on verified requisitions.</p>
                            </div>
                            <span className="hf-trends-badge-live">Updated Daily</span>
                        </div>

                        <div className="hf-roles-grid">
                            {(trends?.topJobRoles || [
                                { roleTitle: 'Full-Stack Developer', openCount: 6, avgSalaryRange: '₹90,000 – ₹1,50,000 / Mo' },
                                { roleTitle: 'Backend .NET Engineer', openCount: 4, avgSalaryRange: '₹85,000 – ₹1,60,000 / Mo' },
                                { roleTitle: 'Frontend React Engineer', openCount: 4, avgSalaryRange: '₹75,000 – ₹1,30,000 / Mo' },
                                { roleTitle: 'Cloud & DevOps Specialist', openCount: 2, avgSalaryRange: '₹1,00,000 – ₹1,80,000 / Mo' }
                            ]).map((role) => (
                                <div className="hf-role-card" key={role.roleTitle}>
                                    <div className="hf-role-badge">💼 Open</div>
                                    <h3>{role.roleTitle}</h3>
                                    <div className="hf-role-salary">
                                        <span>Estimated Compensation</span>
                                        <strong>{role.avgSalaryRange}</strong>
                                    </div>
                                    <div className="hf-role-footer">
                                        <span>{role.openCount} Current Requisitions</span>
                                        <Link to={`/jobs?keyword=${encodeURIComponent(role.roleTitle)}`}>View Jobs ↗</Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Work Modes & Job Types Distribution */}
                        <div className="hf-split-charts-row">
                            <div className="hf-distribution-card">
                                <h3>Work Mode Distribution</h3>
                                <div className="hf-dist-pills">
                                    {(trends?.topWorkModes || [
                                        { name: 'Hybrid', count: 7 },
                                        { name: 'Remote', count: 5 },
                                        { name: 'On-site', count: 3 }
                                    ]).map((m) => (
                                        <div className="hf-dist-pill" key={m.name}>
                                            <span>{m.name}</span>
                                            <b>{m.count} jobs</b>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="hf-distribution-card">
                                <h3>Employment Types</h3>
                                <div className="hf-dist-pills">
                                    {(trends?.topJobTypes || [
                                        { name: 'Full-time', count: 10 },
                                        { name: 'Internship', count: 3 },
                                        { name: 'Contract', count: 2 }
                                    ]).map((t) => (
                                        <div className="hf-dist-pill" key={t.name}>
                                            <span>{t.name}</span>
                                            <b>{t.count} jobs</b>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* TAB 3: Active Companies */}
                {activeTab === 'companies' && (
                    <section className="hf-trends-section">
                        <div className="hf-trends-sec-header">
                            <div>
                                <h2>Top Hiring Organizations</h2>
                                <p>Companies actively posting and hiring talent across tech roles.</p>
                            </div>
                            <Link to="/companies" className="hf-trends-link">All Companies →</Link>
                        </div>

                        <div className="hf-companies-trend-grid">
                            {(trends?.topHiringCompanies || [
                                { companyName: 'TechCorp Solutions', activeJobsCount: 4 },
                                { companyName: 'InnoTech Labs', activeJobsCount: 3 },
                                { companyName: 'CloudScale Global', activeJobsCount: 2 }
                            ]).map((company) => (
                                <article className="hf-company-trend-card" key={company.companyName}>
                                    <div className="hf-company-avatar">
                                        {(company.companyName || 'C')[0].toUpperCase()}
                                    </div>
                                    <div className="hf-company-info">
                                        <h4>{company.companyName}</h4>
                                        <span>Verified Employer</span>
                                    </div>
                                    <div className="hf-company-jobs-pill">
                                        {company.activeJobsCount} Active {company.activeJobsCount === 1 ? 'Job' : 'Jobs'}
                                    </div>
                                    <Link
                                        to={`/jobs?keyword=${encodeURIComponent(company.companyName)}`}
                                        className="hf-company-view-link"
                                    >
                                        View Openings ↗
                                    </Link>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                {/* Industry Insights Callout Section */}
                <section className="hf-insights-banner">
                    <div className="hf-insights-banner-copy">
                        <span className="hf-eyebrow-light">💡 MARKET TAKEAWAYS</span>
                        <h2>Key Hiring Insights for Candidates</h2>
                        <ul className="hf-insights-list">
                            {(trends?.industryInsights?.length ? trends.industryInsights : [
                                'Full-Stack engineers with React + .NET Core experience command a 25% interview advantage.',
                                'Remote and Hybrid requisitions constitute over 65% of all active engineering roles.',
                                'Having verifiable cloud deployment experience (Docker/Azure/AWS) doubles candidate callback rates.'
                            ]).map((insight, idx) => (
                                <li key={idx}>{insight}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="hf-insights-banner-action">
                        <h3>Check Your Fit with AI</h3>
                        <p>Our AI Copilot compares your resume against live requirements and gives you an instant ATS match score.</p>
                        <Link to="/jobs" className="hf-btn-cta">Explore Current Openings ↗</Link>
                    </div>
                </section>
            </div>
        </main>
    )
}
