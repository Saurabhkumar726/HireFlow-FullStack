import { useState } from 'react'
import { Link } from 'react-router-dom'
import './CandidateOffersPage.css'

export default function CandidateOffersPage() {
    const [activeTab, setActiveTab] = useState('explainer') // 'explainer', 'compare'

    // Explainer State
    const [contractText, setContractText] = useState('')
    const [analyzingContract, setAnalyzingContract] = useState(false)
    const [contractAnalysis, setContractAnalysis] = useState(null)

    // Compare Offers State
    const [offers, setOffers] = useState([
        {
            id: 1,
            company: 'TechFlow Systems',
            role: 'Full-Stack Developer',
            baseSalary: 1400000,
            bonus: 150000,
            stocks: 200000,
            location: 'Bengaluru (Hybrid)',
            inHandEstimate: 98000
        },
        {
            id: 2,
            company: 'Innovate Cloud',
            role: 'Software Engineer',
            baseSalary: 1200000,
            bonus: 200000,
            stocks: 300000,
            location: 'Pune (Remote)',
            inHandEstimate: 86000
        }
    ])

    const [newOffer, setNewOffer] = useState({
        company: '',
        role: '',
        baseSalary: '',
        bonus: '',
        stocks: '',
        location: ''
    })

    function handleAnalyzeContract(e) {
        e.preventDefault()
        setAnalyzingContract(true)
        setTimeout(() => {
            setAnalyzingContract(false)
            setContractAnalysis({
                grossCtc: '₹16,50,000 / annum',
                inHandMonthly: '₹1,12,400 / month (approx.)',
                deductions: [
                    { name: 'Employee Provident Fund (EPF)', amount: '₹1,800 / month' },
                    { name: 'Professional Tax', amount: '₹200 / month' },
                    { name: 'Estimated Income Tax (TDS - New Regime)', amount: '₹18,500 / month' }
                ],
                securityAlerts: [
                    {
                        type: 'warning',
                        title: '⚠️ Service Agreement / Bond Clause Detected',
                        description: 'Clause 8.2 specifies a 12-month training bond requiring ₹1,00,000 compensation if leaving before 1 year.'
                    },
                    {
                        type: 'notice',
                        title: 'ℹ️ Probation Period',
                        description: 'Standard 3-month probation period with 15-day notice period during probation and 60 days thereafter.'
                    },
                    {
                        type: 'safe',
                        title: '✓ Intellectual Property & Moonlighting Terms',
                        description: 'Standard IP assignment for company time; open-source contributions permitted with manager approval.'
                    }
                ]
            })
        }, 1200)
    }

    function handleAddOffer(e) {
        e.preventDefault()
        if (!newOffer.company || !newOffer.baseSalary) return
        const base = parseFloat(newOffer.baseSalary) || 0
        const item = {
            id: Date.now(),
            company: newOffer.company,
            role: newOffer.role || 'Software Engineer',
            baseSalary: base,
            bonus: parseFloat(newOffer.bonus) || 0,
            stocks: parseFloat(newOffer.stocks) || 0,
            location: newOffer.location || 'Bengaluru',
            inHandEstimate: Math.round((base * 0.82) / 12)
        }
        setOffers([...offers, item])
        setNewOffer({ company: '', role: '', baseSalary: '', bonus: '', stocks: '', location: '' })
    }

    function handleDeleteOffer(id) {
        setOffers(offers.filter(o => o.id !== id))
    }

    return (
        <div className="hf-offers-page">
            <header className="hf-offers-header">
                <div className="hf-offers-header-inner">
                    <div className="hf-offers-breadcrumbs">
                        <Link to="/candidate/home">Candidate Home</Link>
                        <span>/</span>
                        <span>Offers & Contract Analyzer</span>
                    </div>
                    <h1>Offers & Contract Explainer</h1>
                    <p>Demystify offer letters, calculate real in-hand take-home salary, and evaluate multiple job offers side-by-side.</p>
                </div>
            </header>

            <main className="hf-offers-container">
                {/* Tabs */}
                <div className="hf-offers-tabs" role="tablist">
                    <button
                        type="button"
                        className={`hf-offers-tab ${activeTab === 'explainer' ? 'active' : ''}`}
                        onClick={() => setActiveTab('explainer')}
                    >
                        📄 AI Offer Letter & Contract Explainer
                    </button>
                    <button
                        type="button"
                        className={`hf-offers-tab ${activeTab === 'compare' ? 'active' : ''}`}
                        onClick={() => setActiveTab('compare')}
                    >
                        💰 Side-by-Side Offer Evaluator ({offers.length} Offers)
                    </button>
                </div>

                {/* TAB 1: CONTRACT EXPLAINER */}
                {activeTab === 'explainer' && (
                    <div className="hf-offers-tab-content">
                        <div className="hf-offers-card">
                            <div className="hf-offers-intro">
                                <h3>Decode Your Employment Contract</h3>
                                <p>Paste contract clauses or upload your offer letter text below. Our AI scanner detects service bonds, non-competes, and calculates real take-home cash.</p>
                            </div>

                            <form onSubmit={handleAnalyzeContract} className="hf-offers-input-form">
                                <textarea
                                    rows={5}
                                    required
                                    placeholder="Paste clauses from your offer letter (e.g. CTC breakdown, compensation annexure, probation clauses, service agreements)..."
                                    value={contractText}
                                    onChange={(e) => setContractText(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="hf-offers-analyze-btn"
                                    disabled={analyzingContract}
                                >
                                    {analyzingContract ? 'Scanning Clauses & Deductions...' : '⚡ Analyze Contract & Reveal Real In-Hand Pay'}
                                </button>
                            </form>

                            {contractAnalysis && (
                                <div className="hf-offers-analysis-results">
                                    <div className="hf-offers-salary-box">
                                        <div className="hf-offers-salary-main">
                                            <span className="hf-offers-salary-lbl">Estimated In-Hand Pay</span>
                                            <strong className="hf-offers-inhand-val">{contractAnalysis.inHandMonthly}</strong>
                                            <small>From Gross CTC: {contractAnalysis.grossCtc}</small>
                                        </div>
                                        <div className="hf-offers-deductions-list">
                                            <h5>Monthly Deductions Breakdown</h5>
                                            {contractAnalysis.deductions.map((d, i) => (
                                                <div key={i} className="hf-offers-deduction-item">
                                                    <span>{d.name}</span>
                                                    <strong>{d.amount}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <h4>Contract Security Scanner & Clause Alerts</h4>
                                    <div className="hf-offers-alerts-grid">
                                        {contractAnalysis.securityAlerts.map((alert, i) => (
                                            <div key={i} className={`hf-offers-alert-card ${alert.type}`}>
                                                <h5>{alert.title}</h5>
                                                <p>{alert.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: SIDE BY SIDE COMPARISON */}
                {activeTab === 'compare' && (
                    <div className="hf-offers-tab-content">
                        <div className="hf-offers-card">
                            <h3>Compare Job Offers Side-by-Side</h3>
                            <p className="hf-offers-sub">Evaluate compensation components, in-hand projections, and work locations across all your offers.</p>

                            <div className="hf-offers-comparison-table-wrap">
                                <table className="hf-offers-table">
                                    <thead>
                                        <tr>
                                            <th>Metric</th>
                                            {offers.map(o => (
                                                <th key={o.id}>
                                                    <div>
                                                        <strong>{o.company}</strong>
                                                        <small>{o.role}</small>
                                                        <button
                                                            type="button"
                                                            className="hf-offers-del-btn"
                                                            onClick={() => handleDeleteOffer(o.id)}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Base Salary</td>
                                            {offers.map(o => (
                                                <td key={o.id} className="highlight">
                                                    ₹{(o.baseSalary / 100000).toFixed(1)} LPA
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td>Performance Bonus</td>
                                            {offers.map(o => (
                                                <td key={o.id}>
                                                    ₹{(o.bonus / 100000).toFixed(1)} LPA
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td>Stocks / ESOPs (Year 1)</td>
                                            {offers.map(o => (
                                                <td key={o.id}>
                                                    ₹{(o.stocks / 100000).toFixed(1)} LPA
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td>Est. Monthly In-Hand Cash</td>
                                            {offers.map(o => (
                                                <td key={o.id} className="inhand-row">
                                                    ₹{o.inHandEstimate.toLocaleString('en-IN')} / mo
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td>Work Location / Mode</td>
                                            {offers.map(o => (
                                                <td key={o.id}>{o.location}</td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="hf-offers-add-section">
                                <h4>Add Another Job Offer to Compare</h4>
                                <form onSubmit={handleAddOffer} className="hf-offers-add-form">
                                    <input
                                        required
                                        type="text"
                                        placeholder="Company Name"
                                        value={newOffer.company}
                                        onChange={(e) => setNewOffer({ ...newOffer, company: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Role Title"
                                        value={newOffer.role}
                                        onChange={(e) => setNewOffer({ ...newOffer, role: e.target.value })}
                                    />
                                    <input
                                        required
                                        type="number"
                                        placeholder="Base Salary (₹ e.g. 1500000)"
                                        value={newOffer.baseSalary}
                                        onChange={(e) => setNewOffer({ ...newOffer, baseSalary: e.target.value })}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Bonus (₹ e.g. 200000)"
                                        value={newOffer.bonus}
                                        onChange={(e) => setNewOffer({ ...newOffer, bonus: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Location (e.g. Bengaluru / Remote)"
                                        value={newOffer.location}
                                        onChange={(e) => setNewOffer({ ...newOffer, location: e.target.value })}
                                    />
                                    <button type="submit" className="hf-offers-add-btn">
                                        + Compare Offer
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
