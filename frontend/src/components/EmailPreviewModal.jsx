import { useEffect, useState } from 'react'
import './EmailPreviewModal.css'

export default function EmailPreviewModal({ application, onClose }) {
    const [selectedType, setSelectedType] = useState('JobOffer')
    const [emailData, setEmailData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState('')

    const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

    useEffect(() => {
        let isMounted = true
        async function fetchPreview() {
            setLoading(true)
            setError('')
            try {
                const token = localStorage.getItem('hireflow-token')
                const res = await fetch(
                    `${API_BASE}/ApplicantManagement/applications/${application?.id || 1}/email-preview?type=${encodeURIComponent(selectedType)}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: 'application/json'
                        }
                    }
                )
                if (!res.ok) throw new Error('Could not generate email preview.')
                const data = await res.json()
                if (isMounted) setEmailData(data)
            } catch (err) {
                if (isMounted) setError(err.message || 'Error loading preview.')
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchPreview()
        return () => { isMounted = false }
    }, [application, selectedType, API_BASE])

    function handleCopyHtml() {
        if (!emailData?.htmlContent) return
        navigator.clipboard.writeText(emailData.htmlContent)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const TEMPLATES = [
        { key: 'JobOffer', label: '🎉 Job Offer Letter' },
        { key: 'InterviewInvitation', label: '📅 Interview Invite' },
        { key: 'ApplicationReceived', label: '📄 Application Received' },
        { key: 'StatusUpdate', label: '🔄 Status Update' }
    ]

    return (
        <div className="hf-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="hf-email-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="hf-email-modal-header">
                    <div className="hf-email-header-info">
                        <span className="hf-email-badge">📧 Candidate Notification Preview</span>
                        <h3>Transactional Email Simulator</h3>
                        <p>Recipient: <strong>{application?.applicantName || 'Candidate'}</strong> ({application?.applicantEmail || 'email@example.com'})</p>
                    </div>
                    <button type="button" className="hf-email-close-btn" onClick={onClose} aria-label="Close">✕</button>
                </header>

                {/* Template Tabs */}
                <div className="hf-email-tabs" role="tablist">
                    {TEMPLATES.map((tpl) => (
                        <button
                            key={tpl.key}
                            type="button"
                            className={`hf-email-tab ${selectedType === tpl.key ? 'active' : ''}`}
                            onClick={() => setSelectedType(tpl.key)}
                        >
                            {tpl.label}
                        </button>
                    ))}
                </div>

                {error && <div className="hf-email-alert error">{error}</div>}

                {/* Email Client Shell */}
                <div className="hf-email-body-wrap">
                    <div className="hf-email-client-shell">
                        <div className="hf-email-headers-bar">
                            <div className="hf-email-hdr-row">
                                <span className="hdr-lbl">From:</span>
                                <span className="hdr-val">HireFlow Notifications &lt;no-reply@hireflow.app&gt;</span>
                            </div>
                            <div className="hf-email-hdr-row">
                                <span className="hdr-lbl">To:</span>
                                <span className="hdr-val">{emailData?.recipientName} &lt;{emailData?.recipientEmail}&gt;</span>
                            </div>
                            <div className="hf-email-hdr-row">
                                <span className="hdr-lbl">Subject:</span>
                                <strong className="hdr-val-subject">{emailData?.subject || 'Loading subject…'}</strong>
                            </div>
                        </div>

                        {/* Rendered HTML Container */}
                        <div className="hf-email-preview-canvas">
                            {loading ? (
                                <div className="hf-email-loading">
                                    <div className="hf-email-spinner" />
                                    <p>Generating responsive email preview…</p>
                                </div>
                            ) : (
                                <div
                                    className="hf-email-html-content"
                                    dangerouslySetInnerHTML={{ __html: emailData?.htmlContent || '' }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <footer className="hf-email-modal-footer">
                    <button type="button" className="hf-btn-copy-html" onClick={handleCopyHtml}>
                        {copied ? '✓ HTML Copied to Clipboard!' : '📋 Copy Email HTML'}
                    </button>
                    <button type="button" className="hf-btn-close-preview" onClick={onClose}>
                        Close
                    </button>
                </footer>
            </div>
        </div>
    )
}
