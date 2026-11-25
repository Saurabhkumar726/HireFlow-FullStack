import { useState } from 'react'
import './CoverLetterModal.css'

export default function CoverLetterModal({
    isOpen,
    onClose,
    resumeData
}) {
    const [targetCompany, setTargetCompany] = useState('Google / TechCorp')
    const [targetRole, setTargetRole] = useState(resumeData?.title || 'Software Engineer')
    const [tone, setTone] = useState('professional') // 'graduate', 'professional', 'creative'
    const [activeTab, setActiveTab] = useState('coverLetter') // 'coverLetter', 'coldMessage'
    const [copied, setCopied] = useState(false)

    if (!isOpen) return null

    const studentName = resumeData?.fullName || 'Candidate'
    const email = resumeData?.email || 'student@example.com'
    const phone = resumeData?.phone || '+91 98765 43210'
    const location = resumeData?.location || 'Bengaluru, India'
    const topSkills = (resumeData?.skillCategories || []).flatMap(c => c.skills).slice(0, 5).join(', ') || 'React, .NET, SQL, REST APIs'
    const experienceItem = resumeData?.experience?.[0]
    const recentExp = experienceItem ? `${experienceItem.title} at ${experienceItem.company}` : 'Academic software engineering projects'

    // Generate Cover Letter Text based on tone
    function getGeneratedCoverLetter() {
        if (tone === 'graduate') {
            return `Dear Hiring Team at ${targetCompany},

I am writing to express my strong enthusiasm for the ${targetRole} position at ${targetCompany}. As a driven software engineer with hands-on proficiency in ${topSkills}, I have developed a solid foundation in building resilient web applications and modern backend services.

During my work as ${recentExp}, I gained valuable practical experience implementing clean, modular code, collaborating on agile sprint deliverables, and optimizing database queries. My academic background and technical projects have equipped me with both the architectural principles and problem-solving mindset necessary to contribute to ${targetCompany}'s technical excellence from day one.

I am particularly excited about ${targetCompany}'s culture of innovation and would welcome the opportunity to discuss how my technical skills and eagerness to learn align with your team's goals.

Thank you for your time and consideration.

Sincerely,
${studentName}
${email} | ${phone} | ${location}`
        }

        if (tone === 'creative') {
            return `Hello ${targetCompany} Team,

Great software is built at the intersection of technical precision and user empathy. That is precisely why I am eager to bring my capabilities as a ${targetRole} to ${targetCompany}.

Equipped with practical experience in ${topSkills}, I specialize in transforming complex requirements into reliable, intuitive products. In my recent role as ${recentExp}, I focused on writing clean, testable code and shipping impactful features that deliver measurable performance improvements.

I admire how ${targetCompany} is pushing boundaries, and I would love the opportunity to contribute my energy, adaptability, and engineering craftsmanship to your upcoming initiatives.

Looking forward to speaking with your team!

Best regards,
${studentName}
${email} | ${phone}`
        }

        // Professional (default)
        return `Dear Hiring Manager,

Please accept this letter and attached resume as an application for the ${targetRole} opportunity at ${targetCompany}. With a demonstrated track record in full-stack engineering and expertise in ${topSkills}, I am confident in my ability to deliver immediate value to your engineering department.

Throughout my experience as ${recentExp}, I have spearheaded the design and implementation of production-grade services, resolved critical architectural bottlenecks, and collaborated across cross-functional teams to deliver on ambitious engineering roadmaps. I pride myself on disciplined test-driven development, high code quality, and proactive communication.

I welcome the chance to further discuss how my technical background and dedication to scalable solutions will support ${targetCompany}'s continued growth.

Thank you for reviewing my application.

Sincerely,
${studentName}
${email} | ${phone} | ${location}`
    }

    // Generate Cold Outreach Pitch for LinkedIn / Email
    function getGeneratedColdPitch() {
        return `Hi [Hiring Manager / Recruiter Name],

I hope you're having a productive week!

I came across the ${targetRole} opening at ${targetCompany} and was immediately drawn to the impact your team is making. I am a software engineer with hands-on experience in ${topSkills}, and most recently delivered key full-stack initiatives as ${recentExp}.

Given ${targetCompany}'s current focus on engineering scalability, I'd love to connect for a quick 5-minute chat to see if my background might be a strong match for your team.

You can review my live portfolio and projects here: ${window.location.origin}/candidate/resume-builder

Best regards,
${studentName}
${email}`
    }

    const currentText = activeTab === 'coverLetter' ? getGeneratedCoverLetter() : getGeneratedColdPitch()

    function handleCopy() {
        navigator.clipboard.writeText(currentText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    function handlePrint() {
        const win = window.open('', '_blank')
        win.document.write(`
            <html>
                <head>
                    <title>${studentName} - Cover Letter for ${targetCompany}</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; padding: 40px; color: #111; max-width: 700px; margin: 0 auto; white-space: pre-wrap; font-size: 14px; }
                    </style>
                </head>
                <body>${currentText}</body>
            </html>
        `)
        win.document.close()
        win.print()
    }

    return (
        <div className="hf-cl-overlay" role="dialog" aria-modal="true">
            <div className="hf-cl-card">
                <header className="hf-cl-header">
                    <div>
                        <span className="hf-cl-badge">📝 AI Pitch & Letter Studio</span>
                        <h2>1-Click AI Cover Letter & Cold Email Generator</h2>
                        <p>Generate perfectly tailored cover letters and recruiter outreach messages using your active resume data.</p>
                    </div>
                    <button type="button" className="hf-cl-close-btn" onClick={onClose} aria-label="Close">✕</button>
                </header>

                <div className="hf-cl-toolbar">
                    <div className="hf-cl-inputs">
                        <label>
                            Target Company
                            <input
                                type="text"
                                value={targetCompany}
                                onChange={(e) => setTargetCompany(e.target.value)}
                                placeholder="e.g. Google, Microsoft, StartupX"
                            />
                        </label>
                        <label>
                            Target Role
                            <input
                                type="text"
                                value={targetRole}
                                onChange={(e) => setTargetRole(e.target.value)}
                                placeholder="e.g. Full-Stack Engineer"
                            />
                        </label>
                    </div>

                    <div className="hf-cl-tones">
                        <span className="hf-cl-tone-label">Select Tone:</span>
                        <div className="hf-cl-tone-buttons">
                            <button
                                type="button"
                                className={`hf-cl-tone-btn ${tone === 'professional' ? 'active' : ''}`}
                                onClick={() => setTone('professional')}
                            >
                                💼 Direct & Professional
                            </button>
                            <button
                                type="button"
                                className={`hf-cl-tone-btn ${tone === 'graduate' ? 'active' : ''}`}
                                onClick={() => setTone('graduate')}
                            >
                                🎓 Enthusiastic Graduate
                            </button>
                            <button
                                type="button"
                                className={`hf-cl-tone-btn ${tone === 'creative' ? 'active' : ''}`}
                                onClick={() => setTone('creative')}
                            >
                                🚀 Creative & Startup
                            </button>
                        </div>
                    </div>
                </div>

                <div className="hf-cl-tab-bar">
                    <button
                        type="button"
                        className={`hf-cl-tab ${activeTab === 'coverLetter' ? 'active' : ''}`}
                        onClick={() => setActiveTab('coverLetter')}
                    >
                        📄 Formal Cover Letter
                    </button>
                    <button
                        type="button"
                        className={`hf-cl-tab ${activeTab === 'coldMessage' ? 'active' : ''}`}
                        onClick={() => setActiveTab('coldMessage')}
                    >
                        💬 LinkedIn / Cold Email DM (High Response Rate)
                    </button>
                </div>

                <div className="hf-cl-content">
                    <textarea
                        readOnly
                        value={currentText}
                        rows={14}
                        className="hf-cl-preview-text"
                    />
                </div>

                <footer className="hf-cl-footer">
                    <div className="hf-cl-footer-actions">
                        <button
                            type="button"
                            className="hf-cl-copy-btn"
                            onClick={handleCopy}
                        >
                            {copied ? '✓ Copied to Clipboard!' : '📋 Copy to Clipboard'}
                        </button>
                        {activeTab === 'coverLetter' && (
                            <button
                                type="button"
                                className="hf-cl-print-btn"
                                onClick={handlePrint}
                            >
                                🖨️ Print / Save as PDF
                            </button>
                        )}
                    </div>
                    <button type="button" className="hf-cl-done-btn" onClick={onClose}>
                        Close
                    </button>
                </footer>
            </div>
        </div>
    )
}
