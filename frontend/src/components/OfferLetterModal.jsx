import { useEffect, useState } from 'react'
import './OfferLetterModal.css'

export default function OfferLetterModal({
    application,
    initialOffer,
    isHr = false,
    onClose,
    onOfferIssued,
    onOfferResponded
}) {
    const job = application?.job || application?.Job || {}
    const applicantName = application?.applicantName || application?.ApplicantName || 'Candidate'
    const applicantEmail = application?.applicantEmail || application?.ApplicantEmail || ''
    const company = job?.company || job?.Company || initialOffer?.company || 'HireFlow Partner'
    const defaultRole = job?.title || job?.Title || initialOffer?.roleTitle || 'Software Engineer'

    // Form state (for HR generation)
    const [roleTitle, setRoleTitle] = useState(initialOffer?.roleTitle || defaultRole)
    const [baseSalary, setBaseSalary] = useState(initialOffer?.baseSalary || '₹18,00,000 / annum')
    const [bonus, setBonus] = useState(initialOffer?.bonus || '₹2,00,000 performance bonus')
    const [joiningDate, setJoiningDate] = useState(initialOffer?.joiningDate || '15th December 2026')
    const [expiryDate, setExpiryDate] = useState(initialOffer?.expiryDate || '30th November 2026')
    const [reportingManager, setReportingManager] = useState(initialOffer?.reportingManager || 'VP of Engineering')
    const [workMode, setWorkMode] = useState(initialOffer?.workMode || job?.workMode || 'Hybrid - Bengaluru')
    const [terms, setTerms] = useState(
        initialOffer?.terms ||
        'Standard 3-month probation period applies. Comprehensive medical insurance for employee and dependents is provided along with 22 days annual paid leave.'
    )

    // Interaction state
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [candidateNote, setCandidateNote] = useState('')
    const [showDeclinePrompt, setShowDeclinePrompt] = useState(false)
    const [acceptedCelebration, setAcceptedCelebration] = useState(false)

    const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

    async function handleIssueOffer(e) {
        e.preventDefault()
        setSubmitting(true)
        setError('')
        try {
            const token = localStorage.getItem('hireflow-token')
            const res = await fetch(`${API_BASE}/ApplicantManagement/applications/${application.id}/generate-offer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    applicationId: application.id,
                    roleTitle,
                    baseSalary,
                    bonus,
                    joiningDate,
                    expiryDate,
                    reportingManager,
                    workMode,
                    terms
                })
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || 'Failed to issue offer letter.')
            }
            const savedOffer = await res.json()
            onOfferIssued?.(savedOffer)
            onClose?.()
        } catch (err) {
            setError(err.message || 'Unable to issue offer.')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleRespond(decision) {
        setSubmitting(true)
        setError('')
        try {
            const token = localStorage.getItem('hireflow-token')
            const res = await fetch(`${API_BASE}/JobApplications/${application.id}/respond-offer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    decision,
                    candidateNote
                })
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || 'Failed to submit response.')
            }
            const data = await res.json()
            if (decision === 'Accept') {
                setAcceptedCelebration(true)
                setTimeout(() => {
                    onOfferResponded?.(data.offer || { ...initialOffer, status: 'Accepted', candidateDecision: 'Accepted' })
                    onClose?.()
                }, 1800)
            } else {
                onOfferResponded?.(data.offer || { ...initialOffer, status: 'Declined', candidateDecision: 'Declined' })
                onClose?.()
            }
        } catch (err) {
            setError(err.message || 'Could not record response.')
            setSubmitting(false)
        }
    }

    function fallbackPrint(title) {
        const originalTitle = document.title
        document.title = title
        document.body.classList.add('hf-printing-offer')
        window.print()
        setTimeout(() => {
            document.title = originalTitle
            document.body.classList.remove('hf-printing-offer')
        }, 1200)
    }

    function handlePrint() {
        const printableElement = document.getElementById('hf-printable-offer')
        const title = `${applicantName.replace(/\s+/g, '_')}_Offer_Letter_${company.replace(/\s+/g, '_')}`

        if (!printableElement) {
            fallbackPrint(title)
            return
        }

        try {
            const iframe = document.createElement('iframe')
            iframe.style.position = 'fixed'
            iframe.style.right = '0'
            iframe.style.bottom = '0'
            iframe.style.width = '0'
            iframe.style.height = '0'
            iframe.style.border = '0'
            iframe.setAttribute('title', 'Print Offer Letter')
            document.body.appendChild(iframe)

            const iframeDoc = iframe.contentWindow?.document
            if (!iframeDoc) {
                fallbackPrint(title)
                return
            }

            iframeDoc.open()
            iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 14mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            background: #ffffff;
            color: #0f172a;
            font-family: 'Times New Roman', Times, Georgia, serif;
            font-size: 13px;
            line-height: 1.5;
            padding: 8px;
        }
        .hf-offer-sheet {
            width: 100%;
            max-width: 100%;
            border: 1.5px solid #0f172a;
            border-radius: 4px;
            padding: 24px 28px;
            background: #ffffff;
        }
        .hf-sheet-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 20px;
        }
        .hf-sheet-brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .hf-sheet-logo-badge {
            width: 44px;
            height: 44px;
            background: #0f172a !important;
            color: #ffffff !important;
            font-weight: 800;
            font-size: 22px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .hf-sheet-company {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
        }
        .hf-sheet-sub {
            font-size: 12px;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .hf-sheet-meta {
            font-size: 12px;
            color: #334155;
            text-align: right;
            line-height: 1.4;
        }
        .hf-sheet-salutation {
            margin-bottom: 16px;
            font-size: 13px;
            line-height: 1.5;
        }
        .hf-sheet-body {
            font-size: 13px;
            line-height: 1.6;
        }
        .hf-sheet-body p {
            margin-bottom: 12px;
        }
        .hf-sheet-section-title {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 16px 0 8px;
            color: #0f172a;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
        }
        .hf-sheet-table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0 18px;
            font-size: 12.5px;
        }
        .hf-sheet-table th,
        .hf-sheet-table td {
            border: 1px solid #cbd5e1;
            padding: 7px 12px;
            text-align: left;
        }
        .hf-sheet-table th {
            width: 38%;
            background: #f8fafc !important;
            color: #334155;
            font-weight: 600;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .hf-sheet-terms {
            background: #f8fafc !important;
            border-left: 3px solid #0f172a;
            padding: 10px 14px;
            margin: 14px 0;
            border-radius: 0 4px 4px 0;
            font-size: 12px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .hf-sheet-terms h4 {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
            color: #0f172a;
        }
        .hf-sheet-stamp {
            margin: 18px auto 0;
            padding: 8px 18px;
            display: inline-block;
            font-weight: 800;
            font-size: 13px;
            letter-spacing: 1px;
            text-transform: uppercase;
            border: 2px solid currentColor;
            border-radius: 4px;
            transform: rotate(-2deg);
        }
        .hf-sheet-stamp.accepted {
            color: #059669;
            background: #ecfdf5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .hf-sheet-stamp.declined {
            color: #dc2626;
            background: #fef2f2 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .hf-sheet-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 36px;
            padding-top: 18px;
            border-top: 1px solid #cbd5e1;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .hf-sheet-signature {
            display: flex;
            flex-direction: column;
            gap: 3px;
            font-size: 12px;
            color: #334155;
            min-width: 180px;
        }
        .hf-sig-line {
            margin-bottom: 8px;
            color: #64748b;
        }
        .hf-digital-sig {
            font-family: 'Brush Script MT', cursive, Georgia, serif;
            font-size: 18px;
            color: #059669;
            font-weight: 700;
        }
    </style>
</head>
<body>
    ${printableElement.outerHTML}
</body>
</html>`)
            iframeDoc.close()

            setTimeout(() => {
                try {
                    iframe.contentWindow?.focus()
                    iframe.contentWindow?.print()
                } catch {
                    fallbackPrint(title)
                } finally {
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe)
                        }
                    }, 2500)
                }
            }, 300)
        } catch {
            fallbackPrint(title)
        }
    }

    useEffect(() => {
        function cleanupPrint() {
            document.body.classList.remove('hf-printing-offer')
        }
        window.addEventListener('afterprint', cleanupPrint)
        return () => {
            document.body.classList.remove('hf-printing-offer')
            window.removeEventListener('afterprint', cleanupPrint)
        }
    }, [])

    const currentDecision = initialOffer?.candidateDecision

    return (
        <div className="hf-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="hf-offer-modal" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <header className="hf-offer-modal-header no-print">
                    <div className="hf-offer-header-left">
                        <span className="hf-offer-badge">📜 Formal Employment Offer</span>
                        <h2>{company} · Offer Letter</h2>
                    </div>
                    <div className="hf-offer-header-actions">
                        <button type="button" className="hf-offer-btn-print" onClick={handlePrint} title="Download / Print PDF">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 6 2 18 2 18 9" />
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                <rect x="6" y="14" width="12" height="8" />
                            </svg>
                            <span>Print / PDF</span>
                        </button>
                        <button type="button" className="hf-offer-btn-close" onClick={onClose} aria-label="Close modal">✕</button>
                    </div>
                </header>

                {error && <div className="hf-offer-alert error no-print">{error}</div>}

                {acceptedCelebration ? (
                    <div className="hf-offer-celebration">
                        <div className="hf-celeb-icon">🎊 🎉 🥂</div>
                        <h3>Offer Accepted!</h3>
                        <p>Congratulations, <strong>{applicantName}</strong>! Your official acceptance has been confirmed with <strong>{company}</strong>.</p>
                        <small>Updating your application status...</small>
                    </div>
                ) : (
                    <div className="hf-offer-modal-body">
                        {/* HR Configuration Sidebar (Only if HR and not yet decided) */}
                        {isHr && !currentDecision && (
                            <form className="hf-offer-edit-form no-print" onSubmit={handleIssueOffer}>
                                <h3>Customize Offer Terms</h3>
                                <label>
                                    Designation / Role
                                    <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} required />
                                </label>
                                <label>
                                    Base Salary (CTC)
                                    <input type="text" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} required />
                                </label>
                                <label>
                                    Bonus / Variable
                                    <input type="text" value={bonus} onChange={(e) => setBonus(e.target.value)} />
                                </label>
                                <div className="hf-offer-form-row">
                                    <label>
                                        Joining Date
                                        <input type="text" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required />
                                    </label>
                                    <label>
                                        Offer Validity
                                        <input type="text" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                                    </label>
                                </div>
                                <div className="hf-offer-form-row">
                                    <label>
                                        Reporting Manager
                                        <input type="text" value={reportingManager} onChange={(e) => setReportingManager(e.target.value)} />
                                    </label>
                                    <label>
                                        Work Location / Mode
                                        <input type="text" value={workMode} onChange={(e) => setWorkMode(e.target.value)} />
                                    </label>
                                </div>
                                <label>
                                    Key Terms & Conditions
                                    <textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
                                </label>
                                <button type="submit" className="hf-offer-submit-btn" disabled={submitting}>
                                    {submitting ? 'Issuing Offer…' : '✓ Issue / Update Official Offer'}
                                </button>
                            </form>
                        )}

                        {/* Letterhead Paper Sheet */}
                        <div className="hf-offer-sheet-wrapper">
                            <article className="hf-offer-sheet" id="hf-printable-offer">
                                <header className="hf-sheet-header">
                                    <div className="hf-sheet-brand">
                                        <div className="hf-sheet-logo-badge">{company.charAt(0).toUpperCase()}</div>
                                        <div>
                                            <h1 className="hf-sheet-company">{company}</h1>
                                            <span className="hf-sheet-sub">Official Letter of Employment</span>
                                        </div>
                                    </div>
                                    <div className="hf-sheet-meta">
                                        <div>Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                        <div>Ref: HF-OFFER-{application?.id || '001'}</div>
                                    </div>
                                </header>

                                <div className="hf-sheet-salutation">
                                    <p>To,<br />
                                        <strong>{applicantName}</strong><br />
                                        {applicantEmail}<br />
                                        {application?.applicantLocation || 'India'}
                                    </p>
                                </div>

                                <div className="hf-sheet-body">
                                    <p>Dear <strong>{applicantName}</strong>,</p>
                                    <p>
                                        On behalf of <strong>{company}</strong>, we are pleased to offer you the position of <strong>{roleTitle}</strong>.
                                        We were thoroughly impressed by your background, technical qualifications, and interviews with our team.
                                    </p>

                                    <h3 className="hf-sheet-section-title">Summary of Compensation & Terms</h3>
                                    <table className="hf-sheet-table">
                                        <tbody>
                                            <tr>
                                                <th>Position / Title</th>
                                                <td>{roleTitle}</td>
                                            </tr>
                                            <tr>
                                                <th>Base Compensation</th>
                                                <td><strong>{baseSalary}</strong></td>
                                            </tr>
                                            {bonus && (
                                                <tr>
                                                    <th>Variable / Bonus</th>
                                                    <td>{bonus}</td>
                                                </tr>
                                            )}
                                            <tr>
                                                <th>Expected Joining Date</th>
                                                <td>{joiningDate}</td>
                                            </tr>
                                            <tr>
                                                <th>Work Mode & Location</th>
                                                <td>{workMode}</td>
                                            </tr>
                                            {reportingManager && (
                                                <tr>
                                                    <th>Reporting To</th>
                                                    <td>{reportingManager}</td>
                                                </tr>
                                            )}
                                            {expiryDate && (
                                                <tr>
                                                    <th>Offer Expiration</th>
                                                    <td>{expiryDate}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>

                                    {terms && (
                                        <div className="hf-sheet-terms">
                                            <h4>Terms of Employment</h4>
                                            <p>{terms}</p>
                                        </div>
                                    )}

                                    <p>
                                        We look forward to having you on board and creating great impact together.
                                    </p>
                                </div>

                                {/* Decision Watermark / Status Stamp */}
                                {currentDecision && (
                                    <div className={`hf-sheet-stamp ${currentDecision.toLowerCase()}`}>
                                        {currentDecision === 'Accepted' ? '✓ OFFER ACCEPTED' : '✕ OFFER DECLINED'}
                                    </div>
                                )}

                                <footer className="hf-sheet-footer">
                                    <div className="hf-sheet-signature">
                                        <div className="hf-sig-line">__________________________</div>
                                        <strong>Authorized Signatory</strong>
                                        <span>{company} Human Resources</span>
                                    </div>
                                    <div className="hf-sheet-signature">
                                        <div className="hf-sig-line">
                                            {currentDecision === 'Accepted' ? (
                                                <span className="hf-digital-sig">✍ {applicantName} (Digitally Signed)</span>
                                            ) : (
                                                '__________________________'
                                            )}
                                        </div>
                                        <strong>Candidate Acceptance</strong>
                                        <span>{applicantName}</span>
                                    </div>
                                </footer>
                            </article>

                            {/* Candidate Acceptance Bar */}
                            {!isHr && !currentDecision && (
                                <div className="hf-candidate-action-bar no-print">
                                    {showDeclinePrompt ? (
                                        <div className="hf-decline-box">
                                            <p>Please share a brief note for declining this offer (optional):</p>
                                            <textarea
                                                rows={2}
                                                value={candidateNote}
                                                onChange={(e) => setCandidateNote(e.target.value)}
                                                placeholder="e.g. Accepted another opportunity, compensation mismatch…"
                                            />
                                            <div className="hf-decline-actions">
                                                <button
                                                    type="button"
                                                    className="hf-btn-cancel-decline"
                                                    onClick={() => setShowDeclinePrompt(false)}
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    type="button"
                                                    className="hf-btn-confirm-decline"
                                                    onClick={() => handleRespond('Decline')}
                                                    disabled={submitting}
                                                >
                                                    Confirm Decline
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="hf-decision-buttons">
                                            <button
                                                type="button"
                                                className="hf-btn-decline"
                                                onClick={() => setShowDeclinePrompt(true)}
                                                disabled={submitting}
                                            >
                                                Decline Offer
                                            </button>
                                            <button
                                                type="button"
                                                className="hf-btn-accept"
                                                onClick={() => handleRespond('Accept')}
                                                disabled={submitting}
                                            >
                                                {submitting ? 'Recording Acceptance…' : '🎉 Accept Offer & Sign'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
