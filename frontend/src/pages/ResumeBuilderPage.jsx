import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ResumeAtsModal from '../components/ResumeAtsModal.jsx'
import CoverLetterModal from '../components/CoverLetterModal.jsx'
import { generateQrSvgPath } from '../utils/qrGenerator.js'
import './ResumeBuilderPage.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

function renderInlineMarkdown(text) {
    if (!text) return null
    const str = String(text)
    const parts = []
    const regex = /\*\*(.*?)\*\*/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) {
            parts.push(str.slice(lastIndex, match.index))
        }
        parts.push(<strong key={match.index}>{match[1]}</strong>)
        lastIndex = regex.lastIndex
    }
    if (lastIndex < str.length) {
        parts.push(str.slice(lastIndex))
    }
    return parts
}

const DEFAULT_SKILL_CATEGORIES = [
    {
        id: 'cat-frontend',
        category: 'Frontend',
        icon: '💻',
        skills: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Redux Toolkit']
    },
    {
        id: 'cat-backend',
        category: 'Backend',
        icon: '⚙️',
        skills: ['C#', '.NET 10', 'ASP.NET Core', 'REST APIs', 'Node.js']
    },
    {
        id: 'cat-db-cloud',
        category: 'Databases & Cloud',
        icon: '🗄️',
        skills: ['PostgreSQL', 'Redis', 'Docker', 'AWS', 'EF Core']
    },
    {
        id: 'cat-tools',
        category: 'Tools & Architecture',
        icon: '🛠️',
        skills: ['Git', 'Microservices', 'CI/CD Pipelines', 'Clean Architecture']
    }
]

const BULLET_STYLE_OPTIONS = [
    { id: 'disc', label: 'Classic Dot', symbol: '•' },
    { id: 'square', label: 'Square', symbol: '▪' },
    { id: 'arrow', label: 'Arrow', symbol: '▸' },
    { id: 'dash', label: 'Dash', symbol: '–' },
    { id: 'diamond', label: 'Diamond', symbol: '◆' },
    { id: 'check', label: 'Checkmark', symbol: '✓' },
    { id: 'circle', label: 'Circle', symbol: '○' }
]

const DEFAULT_SECTION_ORDER = ['summary', 'skills', 'experience', 'education', 'projects']

const SECTION_METADATA = {
    summary: { key: 'summary', label: 'Professional Summary', icon: '📝', shortLabel: 'Summary' },
    skills: { key: 'skills', label: 'Core Skills', icon: '💻', shortLabel: 'Skills' },
    experience: { key: 'experience', label: 'Work Experience', icon: '💼', shortLabel: 'Experience' },
    education: { key: 'education', label: 'Education', icon: '🎓', shortLabel: 'Education' },
    projects: { key: 'projects', label: 'Key Projects', icon: '🚀', shortLabel: 'Projects' }
}

function getDefaultResumeData(user) {
    return {
        fullName: user?.fullName || 'Alex Morgan',
        title: 'Full Stack Software Engineer',
        email: user?.email || 'alex.morgan@example.com',
        phone: '+91 98765 43210',
        location: 'Bengaluru, India',
        linkedIn: 'linkedin.com/in/alexmorgan',
        github: 'github.com/alexmorgan',
        summary:
            'Results-driven Full Stack Engineer with 3+ years of experience designing and deploying high-throughput cloud microservices with ASP.NET Core, React, and PostgreSQL. Passionate about developer tooling, clean architecture, and reducing API p99 latency.',
        skillCategories: DEFAULT_SKILL_CATEGORIES,
        sectionOrder: DEFAULT_SECTION_ORDER,
        expBulletStyle: 'disc',
        projBulletStyle: 'disc',
        experience: [
            {
                id: 1,
                role: 'Senior Software Engineer',
                company: 'TechFlow Systems',
                period: '2024 – Present',
                bullets: [
                    'Architected real-time messaging pipeline handling 100K+ daily websocket events with sub-20ms latency.',
                    'Engineered automated CI/CD deployment workflows in Docker reducing release cycle times by 45%.',
                    'Mentored 4 junior engineers on clean domain-driven design and integration testing methodologies.'
                ]
            },
            {
                id: 2,
                role: 'Software Engineer',
                company: 'Innovate Labs',
                period: '2022 – 2024',
                bullets: [
                    'Developed responsive user interfaces in React Vite serving 50,000+ monthly active users.',
                    'Optimized PostgreSQL query execution plans, slashing query latency by 60% on heavy reports.',
                    'Implemented JWT-based authentication and role-based access control across 15+ microservice endpoints.'
                ]
            }
        ],
        education: [
            {
                id: 1,
                degree: 'B.Tech in Computer Science & Engineering',
                institution: 'National Institute of Technology',
                year: '2018 – 2022',
                score: 'CGPA: 8.9 / 10'
            }
        ],
        projects: [
            {
                id: 1,
                name: 'HireFlow Platform',
                tech: 'ASP.NET Core, React, Entity Framework Core',
                description: 'Full-stack recruitment and talent intelligence engine with ATS keyword scoring, SignalR websockets, and Kanban pipelines.',
                bullets: [
                    'Engineered talent intelligence platform with automated ATS keyword matching and scoring.',
                    'Integrated SignalR real-time event pipeline delivering sub-30ms notifications to candidates.'
                ]
            }
        ]
    }
}

export default function ResumeBuilderPage() {
    const { user } = useAuth()
    const [viewTab, setViewTab] = useState('editor') // 'editor' | 'preview'
    const [template, setTemplate] = useState('minimalist') // 'minimalist' | 'executive'
    const [polishing, setPolishing] = useState(false)
    const [aiNotice, setAiNotice] = useState('')

    // Branded HireFlow Modal Dialog State
    const [confirmModal, setConfirmModal] = useState({
        open: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        danger: false,
        onConfirm: null
    })

    const storageKey = `hireflow_resume_builder_v2_${user?.id || 'guest'}`

    // Load from localStorage or fallback to default
    const [resumeData, setResumeData] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed && typeof parsed === 'object') {
                    // Normalize section order
                    const loadedOrder = Array.isArray(parsed.sectionOrder) && parsed.sectionOrder.length > 0
                        ? parsed.sectionOrder
                        : DEFAULT_SECTION_ORDER
                    const validOrder = [
                        ...loadedOrder.filter((k) => DEFAULT_SECTION_ORDER.includes(k)),
                        ...DEFAULT_SECTION_ORDER.filter((k) => !loadedOrder.includes(k))
                    ]

                    return {
                        ...getDefaultResumeData(user),
                        ...parsed,
                        sectionOrder: validOrder,
                        github: parsed.github !== undefined ? parsed.github : 'github.com/alexmorgan',
                        expBulletStyle: parsed.expBulletStyle || 'disc',
                        projBulletStyle: parsed.projBulletStyle || 'disc'
                    }
                }
            }
        } catch (e) {
            console.error('Error loading resume data from localStorage:', e)
        }
        return getDefaultResumeData(user)
    })

    // Auto-save to localStorage whenever resumeData changes
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(resumeData))
        } catch (e) {
            console.error('Error saving resume data to localStorage:', e)
        }
    }, [resumeData, storageKey])

    // Hub 1: AI ATS, Cover Letter, QR Code & Multi-Version States
    const [showAtsModal, setShowAtsModal] = useState(false)
    const [showCoverLetterModal, setShowCoverLetterModal] = useState(false)
    const [showQrCode, setShowQrCode] = useState(() => {
        try {
            const saved = localStorage.getItem('hireflow_resume_show_qr')
            return saved === 'true'
        } catch {
            return false
        }
    })
    const [selectedVersion, setSelectedVersion] = useState('fullstack')

    function handleToggleQrCode() {
        setShowQrCode((prev) => {
            const next = !prev
            try {
                localStorage.setItem('hireflow_resume_show_qr', String(next))
            } catch (e) {
                console.error('Error saving QR code toggle state:', e)
            }
            return next
        })
    }

    function handleSwitchVersion(newVersion) {
        try {
            localStorage.setItem(`hireflow-resume-data-${selectedVersion}`, JSON.stringify(resumeData))
            // Sync to backend versions API
            fetch(`${API_BASE}/ResumeVersions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    versionKey: selectedVersion,
                    title: resumeData.title || selectedVersion,
                    resumeData
                })
            }).catch(() => { })

            setSelectedVersion(newVersion)
            const saved = localStorage.getItem(`hireflow-resume-data-${newVersion}`)
            if (saved) {
                setResumeData(JSON.parse(saved))
            } else {
                const base = getDefaultResumeData(user)
                if (newVersion === 'frontend') {
                    base.title = 'Frontend / UI Engineer'
                    base.summary = 'Frontend Engineer specializing in React, TypeScript, high-performance UI components, responsive web architecture, and accessible design systems.'
                } else if (newVersion === 'backend') {
                    base.title = 'Backend & Cloud Engineer'
                    base.summary = 'Backend Engineer focused on ASP.NET Core, distributed microservices, PostgreSQL query optimization, and Docker containers.'
                }
                setResumeData(base)
            }
        } catch (e) {
            console.error('Error switching resume version:', e)
        }
    }

    function handleInjectSkill(skillName) {
        if (!skillName) return
        setResumeData((prev) => {
            const categories = [...(prev.skillCategories || [])]
            if (categories.length > 0) {
                if (!categories[0].skills.includes(skillName)) {
                    categories[0] = {
                        ...categories[0],
                        skills: [...categories[0].skills, skillName]
                    }
                }
            }
            return { ...prev, skillCategories: categories }
        })
    }

    // Skill category input states
    const [categoryInputs, setCategoryInputs] = useState({})
    const [newCategoryName, setNewCategoryName] = useState('')

    function handleFieldChange(field, value) {
        setResumeData((prev) => ({ ...prev, [field]: value }))
    }

    // --- REORDER SECTIONS UP AND DOWN ---
    function handleMoveSection(sectionKey, direction) {
        setResumeData((prev) => {
            const order = prev.sectionOrder || DEFAULT_SECTION_ORDER
            const idx = order.indexOf(sectionKey)
            if (idx === -1) return prev
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1
            if (targetIdx < 0 || targetIdx >= order.length) return prev

            const newOrder = [...order]
            const temp = newOrder[idx]
            newOrder[idx] = newOrder[targetIdx]
            newOrder[targetIdx] = temp

            return { ...prev, sectionOrder: newOrder }
        })
    }

    // --- RESET & CLEAR WITH BRANDED MODAL ---
    function handleOpenResetModal() {
        setConfirmModal({
            open: true,
            title: 'Reset to Sample Resume?',
            message: 'This will restore the default tech resume template. Any custom text you have written will be replaced with sample data.',
            confirmText: 'Reset Demo',
            cancelText: 'Keep Editing',
            danger: false,
            onConfirm: () => {
                const fresh = getDefaultResumeData(user)
                setResumeData(fresh)
                setConfirmModal((prev) => ({ ...prev, open: false }))
            }
        })
    }

    function handleOpenClearModal() {
        setConfirmModal({
            open: true,
            title: 'Clear All Sections?',
            message: 'Are you sure you want to clear all fields? You will start with a fresh, blank resume canvas.',
            confirmText: 'Clear All',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: () => {
                const empty = {
                    fullName: user?.fullName || '',
                    title: '',
                    email: user?.email || '',
                    phone: '',
                    location: '',
                    linkedIn: '',
                    github: '',
                    summary: '',
                    skillCategories: [
                        { id: 'cat-frontend', category: 'Frontend', icon: '💻', skills: [] },
                        { id: 'cat-backend', category: 'Backend', icon: '⚙️', skills: [] },
                        { id: 'cat-db-cloud', category: 'Databases & Cloud', icon: '🗄️', skills: [] },
                        { id: 'cat-tools', category: 'Tools & Architecture', icon: '🛠️', skills: [] }
                    ],
                    sectionOrder: DEFAULT_SECTION_ORDER,
                    expBulletStyle: 'disc',
                    projBulletStyle: 'disc',
                    experience: [],
                    education: [],
                    projects: []
                }
                setResumeData(empty)
                setConfirmModal((prev) => ({ ...prev, open: false }))
            }
        })
    }

    // --- SKILLS MANAGEMENT ---
    function handleCategoryInputChange(catId, value) {
        setCategoryInputs((prev) => ({ ...prev, [catId]: value }))
    }

    function handleAddSkillToCategory(catId) {
        const val = (categoryInputs[catId] || '').trim()
        if (!val) return

        setResumeData((prev) => ({
            ...prev,
            skillCategories: prev.skillCategories.map((cat) => {
                if (cat.id !== catId) return cat
                if (cat.skills.includes(val)) return cat
                return { ...cat, skills: [...cat.skills, val] }
            })
        }))
        setCategoryInputs((prev) => ({ ...prev, [catId]: '' }))
    }

    function handleRemoveSkillFromCategory(catId, skillToRemove) {
        setResumeData((prev) => ({
            ...prev,
            skillCategories: prev.skillCategories.map((cat) => {
                if (cat.id !== catId) return cat
                return { ...cat, skills: cat.skills.filter((s) => s !== skillToRemove) }
            })
        }))
    }

    function handleAddNewCategory(nameToAdd) {
        const title = (nameToAdd || newCategoryName).trim()
        if (!title) return

        const exists = resumeData.skillCategories.some(
            (c) => c.category.toLowerCase() === title.toLowerCase()
        )
        if (exists) {
            setNewCategoryName('')
            return
        }

        const newCat = {
            id: `cat-${Date.now()}`,
            category: title,
            icon: '⚡',
            skills: []
        }

        setResumeData((prev) => ({
            ...prev,
            skillCategories: [...prev.skillCategories, newCat]
        }))
        setNewCategoryName('')
    }

    function handleRemoveCategory(catId) {
        setResumeData((prev) => ({
            ...prev,
            skillCategories: prev.skillCategories.filter((c) => c.id !== catId)
        }))
    }

    // --- WORK EXPERIENCE MANAGEMENT ---
    function handleAddExperience() {
        const newExp = {
            id: Date.now(),
            role: '',
            company: '',
            period: '',
            bullets: []
        }
        setResumeData((prev) => ({
            ...prev,
            experience: [newExp, ...prev.experience]
        }))
    }

    function handleUpdateExperience(id, field, value) {
        setResumeData((prev) => ({
            ...prev,
            experience: prev.experience.map((exp) => {
                if (exp.id !== id) return exp
                if (field === 'bulletsText') {
                    const bullets = value
                        .split('\n')
                        .map((b) => b.trim())
                        .filter(Boolean)
                    return { ...exp, bulletsText: value, bullets }
                }
                return { ...exp, [field]: value }
            })
        }))
    }

    function handleRemoveExperience(id) {
        setResumeData((prev) => ({
            ...prev,
            experience: prev.experience.filter((exp) => exp.id !== id)
        }))
    }

    // --- EDUCATION MANAGEMENT ---
    function handleAddEducation() {
        const newEdu = {
            id: Date.now(),
            degree: '',
            institution: '',
            year: '',
            score: ''
        }
        setResumeData((prev) => ({
            ...prev,
            education: [...prev.education, newEdu]
        }))
    }

    function handleUpdateEducation(id, field, value) {
        setResumeData((prev) => ({
            ...prev,
            education: prev.education.map((edu) => {
                if (edu.id !== id) return edu
                return { ...edu, [field]: value }
            })
        }))
    }

    function handleRemoveEducation(id) {
        setResumeData((prev) => ({
            ...prev,
            education: prev.education.filter((edu) => edu.id !== id)
        }))
    }

    // --- KEY PROJECTS MANAGEMENT ---
    function handleAddProject() {
        const newProj = {
            id: Date.now(),
            name: '',
            tech: '',
            description: '',
            bullets: []
        }
        setResumeData((prev) => ({
            ...prev,
            projects: [...prev.projects, newProj]
        }))
    }

    function handleUpdateProject(id, field, value) {
        setResumeData((prev) => ({
            ...prev,
            projects: prev.projects.map((proj) => {
                if (proj.id !== id) return proj
                if (field === 'bulletsText') {
                    const lines = value
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean)
                    return {
                        ...proj,
                        bulletsText: value,
                        bullets: lines,
                        description: value
                    }
                }
                return { ...proj, [field]: value }
            })
        }))
    }

    function handleRemoveProject(id) {
        setResumeData((prev) => ({
            ...prev,
            projects: prev.projects.filter((proj) => proj.id !== id)
        }))
    }

    // --- AI POLISH ---
    async function handlePolishSummary() {
        if (!resumeData.summary.trim() || polishing) return
        setPolishing(true)
        setAiNotice('')
        try {
            const prompt = `Please rewrite and polish the following candidate professional summary to make it compelling, impactful, and keyword-rich for an ATS recruiter in modern tech:\n\n"${resumeData.summary}"\n\nReturn ONLY the polished professional summary paragraph without preamble or conversational filler.`
            const response = await fetch(`${API_BASE}/AiAgent/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: prompt, history: [] }),
            })
            if (!response.ok) throw new Error('AI service busy.')
            const data = await response.json()
            if (data?.reply) {
                setResumeData((prev) => ({ ...prev, summary: data.reply.trim() }))
                setAiNotice('Summary polished with AI!')
                setTimeout(() => setAiNotice(''), 4000)
            }
        } catch {
            setAiNotice('Could not polish right now. Keep typing or try again.')
        } finally {
            setPolishing(false)
        }
    }

    function handlePrint() {
        const originalTitle = document.title
        const namePart = (resumeData.fullName || 'Candidate').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
        document.title = `${namePart}_Resume_HireFlow`
        window.print()
        setTimeout(() => {
            document.title = originalTitle
        }, 1200)
    }

    const hasAnySkills = resumeData.skillCategories?.some((cat) => cat.skills?.length > 0)
    const sectionOrder = resumeData.sectionOrder || DEFAULT_SECTION_ORDER

    // Helper: Render section reorder buttons for a card
    function renderCardReorderControls(secKey) {
        const idx = sectionOrder.indexOf(secKey)
        const isFirst = idx === 0
        const isLast = idx === sectionOrder.length - 1

        return (
            <div className="hf-rb-sec-reorder-ctrls" title="Section sequence on resume">
                <span className="hf-rb-sec-pos-badge">#{idx + 1}</span>
                <button
                    type="button"
                    className="hf-rb-arrow-btn"
                    disabled={isFirst}
                    onClick={() => handleMoveSection(secKey, 'up')}
                    title={`Move ${SECTION_METADATA[secKey]?.label || 'section'} up in resume`}
                    aria-label={`Move up`}
                >
                    ▲
                </button>
                <button
                    type="button"
                    className="hf-rb-arrow-btn"
                    disabled={isLast}
                    onClick={() => handleMoveSection(secKey, 'down')}
                    title={`Move ${SECTION_METADATA[secKey]?.label || 'section'} down in resume`}
                    aria-label={`Move down`}
                >
                    ▼
                </button>
            </div>
        )
    }

    // --- PAPER SECTION RENDERERS ---
    function renderPaperSummary() {
        if (!resumeData.summary) return null
        return (
            <section key="summary" className="hf-resume-section hf-paper-section-movable">
                <div className="hf-paper-section-bar no-print">
                    <span className="hf-paper-sec-label">Summary</span>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('summary') === 0}
                        onClick={() => handleMoveSection('summary', 'up')}
                        title="Move Summary up"
                    >
                        ▲ Up
                    </button>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('summary') === sectionOrder.length - 1}
                        onClick={() => handleMoveSection('summary', 'down')}
                        title="Move Summary down"
                    >
                        ▼ Down
                    </button>
                </div>
                <h2 className="hf-section-title">Professional Summary</h2>
                <p className="hf-resume-summary">{renderInlineMarkdown(resumeData.summary)}</p>
            </section>
        )
    }

    function renderPaperSkills() {
        if (!hasAnySkills) return null
        return (
            <section key="skills" className="hf-resume-section hf-paper-section-movable">
                <div className="hf-paper-section-bar no-print">
                    <span className="hf-paper-sec-label">Skills</span>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('skills') === 0}
                        onClick={() => handleMoveSection('skills', 'up')}
                        title="Move Skills up"
                    >
                        ▲ Up
                    </button>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('skills') === sectionOrder.length - 1}
                        onClick={() => handleMoveSection('skills', 'down')}
                        title="Move Skills down"
                    >
                        ▼ Down
                    </button>
                </div>
                <h2 className="hf-section-title">Technical Competencies</h2>
                <div className="hf-resume-skills-block">
                    {resumeData.skillCategories
                        .filter((cat) => cat.skills && cat.skills.length > 0)
                        .map((cat) => (
                            <div key={cat.id} className="hf-resume-skills-line">
                                <strong>{cat.category}:</strong> {cat.skills.join(', ')}
                            </div>
                        ))}
                </div>
            </section>
        )
    }

    function renderPaperExperience() {
        if (!resumeData.experience || resumeData.experience.length === 0) return null
        return (
            <section key="experience" className="hf-resume-section hf-paper-section-movable">
                <div className="hf-paper-section-bar no-print">
                    <span className="hf-paper-sec-label">Experience</span>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('experience') === 0}
                        onClick={() => handleMoveSection('experience', 'up')}
                        title="Move Experience up"
                    >
                        ▲ Up
                    </button>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('experience') === sectionOrder.length - 1}
                        onClick={() => handleMoveSection('experience', 'down')}
                        title="Move Experience down"
                    >
                        ▼ Down
                    </button>
                </div>
                <h2 className="hf-section-title">Work Experience</h2>
                {resumeData.experience.map((exp) => (
                    <div key={exp.id} className="hf-resume-item">
                        <div className="hf-item-header">
                            <div>
                                <span className="hf-item-title">{exp.role || 'Role'}</span>
                                {exp.company && <span className="hf-item-sub"> — {exp.company}</span>}
                            </div>
                            {exp.period && <span className="hf-item-date">{exp.period}</span>}
                        </div>
                        {exp.bullets && exp.bullets.length > 0 && (
                            <ul className={`hf-item-bullets hf-bullets-${resumeData.expBulletStyle || 'disc'}`}>
                                {exp.bullets.map((b, i) => (
                                    <li key={i}>{renderInlineMarkdown(b)}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
            </section>
        )
    }

    function renderPaperEducation() {
        if (!resumeData.education || resumeData.education.length === 0) return null
        return (
            <section key="education" className="hf-resume-section hf-paper-section-movable">
                <div className="hf-paper-section-bar no-print">
                    <span className="hf-paper-sec-label">Education</span>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('education') === 0}
                        onClick={() => handleMoveSection('education', 'up')}
                        title="Move Education up"
                    >
                        ▲ Up
                    </button>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('education') === sectionOrder.length - 1}
                        onClick={() => handleMoveSection('education', 'down')}
                        title="Move Education down"
                    >
                        ▼ Down
                    </button>
                </div>
                <h2 className="hf-section-title">Education</h2>
                {resumeData.education.map((edu) => (
                    <div key={edu.id} className="hf-resume-item">
                        <div className="hf-item-header">
                            <div>
                                <span className="hf-item-title">{edu.degree || 'Degree'}</span>
                                {edu.institution && <span className="hf-item-sub"> — {edu.institution}</span>}
                            </div>
                            {edu.year && <span className="hf-item-date">{edu.year}</span>}
                        </div>
                        {edu.score && <div className="hf-item-score">{edu.score}</div>}
                    </div>
                ))}
            </section>
        )
    }

    function renderPaperProjects() {
        if (!resumeData.projects || resumeData.projects.length === 0) return null
        return (
            <section key="projects" className="hf-resume-section hf-paper-section-movable">
                <div className="hf-paper-section-bar no-print">
                    <span className="hf-paper-sec-label">Projects</span>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('projects') === 0}
                        onClick={() => handleMoveSection('projects', 'up')}
                        title="Move Projects up"
                    >
                        ▲ Up
                    </button>
                    <button
                        type="button"
                        disabled={sectionOrder.indexOf('projects') === sectionOrder.length - 1}
                        onClick={() => handleMoveSection('projects', 'down')}
                        title="Move Projects down"
                    >
                        ▼ Down
                    </button>
                </div>
                <h2 className="hf-section-title">Key Projects</h2>
                {resumeData.projects.map((proj) => {
                    const projectBullets = proj.bullets && proj.bullets.length > 0
                        ? proj.bullets
                        : (proj.description && proj.description.includes('\n')
                            ? proj.description.split('\n').map((l) => l.trim()).filter(Boolean)
                            : null)

                    return (
                        <div key={proj.id} className="hf-resume-item">
                            <div className="hf-item-header">
                                <span className="hf-item-title">{proj.name || 'Project'}</span>
                                {proj.tech && <span className="hf-item-tech">[{proj.tech}]</span>}
                            </div>
                            {projectBullets && projectBullets.length > 0 ? (
                                <ul className={`hf-item-bullets hf-bullets-${resumeData.projBulletStyle || 'disc'}`}>
                                    {projectBullets.map((b, i) => (
                                        <li key={i}>{renderInlineMarkdown(b)}</li>
                                    ))}
                                </ul>
                            ) : proj.description ? (
                                <p className="hf-item-desc">{renderInlineMarkdown(proj.description)}</p>
                            ) : null}
                        </div>
                    )
                })}
            </section>
        )
    }

    return (
        <div className="hf-rb-page">
            <header className="hf-rb-header no-print">
                <div className="hf-rb-header-inner">
                    <div className="hf-rb-header-top">
                        <div className="hf-rb-header-title-col">
                            <div className="hf-rb-breadcrumbs">
                                <Link to="/candidate/home">Candidate Portal</Link>
                                <span>/</span>
                                <span>AI Resume Builder</span>
                            </div>
                            <h1>ATS Resume Builder</h1>
                            <p>Build, polish, and export an industry-standard, ATS-optimized resume. All changes save automatically to your browser.</p>
                        </div>

                        <div className="hf-rb-header-main-actions">
                            <div className="hf-rb-template-selector" role="group" aria-label="Resume template">
                                <button
                                    type="button"
                                    className={`hf-rb-tpl-btn ${template === 'minimalist' ? 'active' : ''}`}
                                    onClick={() => setTemplate('minimalist')}
                                >
                                    Minimalist
                                </button>
                                <button
                                    type="button"
                                    className={`hf-rb-tpl-btn ${template === 'executive' ? 'active' : ''}`}
                                    onClick={() => setTemplate('executive')}
                                >
                                    Executive
                                </button>
                            </div>

                            <button
                                type="button"
                                className="hf-rb-secondary-btn"
                                onClick={handleOpenResetModal}
                                title="Reset all sections to sample tech resume data"
                            >
                                ↺ Reset
                            </button>

                            <button
                                type="button"
                                className="hf-rb-secondary-btn danger"
                                onClick={handleOpenClearModal}
                                title="Clear all fields to start fresh"
                            >
                                ✕ Clear
                            </button>

                            <button type="button" className="hf-rb-print-btn" onClick={handlePrint}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span>Download PDF</span>
                            </button>
                        </div>
                    </div>

                    <div className="hf-rb-header-tools">
                        <div className="hf-rb-tools-group">
                            <select
                                className="hf-rb-version-select"
                                value={selectedVersion}
                                onChange={(e) => handleSwitchVersion(e.target.value)}
                                title="Target resume profile version"
                            >
                                <option value="fullstack">Target: Full-Stack Engineer</option>
                                <option value="frontend">Target: Frontend Developer</option>
                                <option value="backend">Target: Backend & Cloud</option>
                            </select>

                            <button
                                type="button"
                                className="hf-rb-hub-btn ats"
                                onClick={() => setShowAtsModal(true)}
                                title="Scan resume against employer ATS keywords & score"
                            >
                                🎯 ATS Matcher
                            </button>

                            <button
                                type="button"
                                className="hf-rb-hub-btn cl"
                                onClick={() => setShowCoverLetterModal(true)}
                                title="Generate 1-click tailored cover letter or cold pitch"
                            >
                                📝 AI Cover Letter
                            </button>

                            <Link
                                to="/candidate/portfolio"
                                target="_blank"
                                className="hf-rb-hub-btn portfolio"
                                title="Open public shareable portfolio"
                            >
                                🌐 Portfolio
                            </Link>

                            <button
                                type="button"
                                className={`hf-rb-qr-toggle ${showQrCode ? 'active' : ''}`}
                                onClick={handleToggleQrCode}
                                title="Toggle scannable QR Code on printed resume"
                            >
                                {showQrCode ? '📱 QR: ON' : '📱 QR: OFF'}
                            </button>
                        </div>

                        <span className="hf-rb-autosave-pill">
                            <span>●</span> All changes saved automatically
                        </span>
                    </div>
                </div>

                {/* Mobile View Toggle */}
                <div className="hf-rb-mobile-toggle no-print" role="tablist">
                    <button
                        type="button"
                        className={viewTab === 'editor' ? 'active' : ''}
                        onClick={() => setViewTab('editor')}
                    >
                        ✏️ Edit Content
                    </button>
                    <button
                        type="button"
                        className={viewTab === 'preview' ? 'active' : ''}
                        onClick={() => setViewTab('preview')}
                    >
                        📄 Live Resume Preview
                    </button>
                </div>
            </header>

            <div className="hf-rb-container">
                {/* Left: Editor Panel */}
                <section className={`hf-rb-editor no-print ${viewTab === 'preview' ? 'hide-mobile' : ''}`}>
                    {/* Auto-save status bar */}
                    <div className="hf-rb-storage-notice">
                        <span className="hf-rb-autosave-badge">
                            <span className="hf-rb-save-dot">●</span> Auto-saved locally (persists on refresh)
                        </span>
                    </div>

                    {/* Section Order Bar (Quick Up / Down Adjuster) */}
                    <div className="hf-rb-reorder-bar">
                        <div className="hf-rb-reorder-header">
                            <div className="hf-rb-reorder-title">
                                <span>📐</span>
                                <strong>Resume Section Order</strong>
                            </div>
                            <span className="hf-rb-reorder-hint">Use ▲ / ▼ to rearrange section positions in the resume</span>
                        </div>
                        <div className="hf-rb-reorder-pills">
                            {sectionOrder.map((secKey, idx) => {
                                const meta = SECTION_METADATA[secKey]
                                if (!meta) return null
                                const isFirst = idx === 0
                                const isLast = idx === sectionOrder.length - 1

                                return (
                                    <div key={secKey} className="hf-rb-order-pill">
                                        <span className="hf-rb-order-num">{idx + 1}</span>
                                        <span className="hf-rb-order-name">{meta.icon} {meta.shortLabel}</span>
                                        <div className="hf-rb-order-arrows">
                                            <button
                                                type="button"
                                                disabled={isFirst}
                                                onClick={() => handleMoveSection(secKey, 'up')}
                                                title={`Move ${meta.label} up in resume`}
                                                aria-label={`Move ${meta.label} up`}
                                            >
                                                ▲
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isLast}
                                                onClick={() => handleMoveSection(secKey, 'down')}
                                                title={`Move ${meta.label} down in resume`}
                                                aria-label={`Move ${meta.label} down`}
                                            >
                                                ▼
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Contact & Header */}
                    <div className="hf-rb-section-card">
                        <h3>Contact & Header</h3>
                        <div className="hf-rb-form-grid">
                            <label>
                                Full Name
                                <input
                                    type="text"
                                    value={resumeData.fullName}
                                    placeholder="e.g. Alex Morgan"
                                    onChange={(e) => handleFieldChange('fullName', e.target.value)}
                                />
                            </label>
                            <label>
                                Professional Title
                                <input
                                    type="text"
                                    value={resumeData.title}
                                    placeholder="e.g. Full Stack Developer"
                                    onChange={(e) => handleFieldChange('title', e.target.value)}
                                />
                            </label>
                            <label>
                                Email Address
                                <input
                                    type="email"
                                    value={resumeData.email}
                                    placeholder="e.g. alex.morgan@example.com"
                                    onChange={(e) => handleFieldChange('email', e.target.value)}
                                />
                            </label>
                            <label>
                                Phone Number
                                <input
                                    type="tel"
                                    value={resumeData.phone}
                                    placeholder="e.g. +91 98765 43210"
                                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                                />
                            </label>
                            <label>
                                Location
                                <input
                                    type="text"
                                    value={resumeData.location}
                                    placeholder="e.g. Bengaluru, India"
                                    onChange={(e) => handleFieldChange('location', e.target.value)}
                                />
                            </label>
                            <label>
                                LinkedIn Profile
                                <input
                                    type="text"
                                    value={resumeData.linkedIn}
                                    placeholder="e.g. linkedin.com/in/alexmorgan"
                                    onChange={(e) => handleFieldChange('linkedIn', e.target.value)}
                                />
                            </label>
                            <label className="hf-rb-field-full">
                                GitHub Profile
                                <input
                                    type="text"
                                    value={resumeData.github || ''}
                                    placeholder="e.g. github.com/alexmorgan"
                                    onChange={(e) => handleFieldChange('github', e.target.value)}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Professional Summary */}
                    <div className="hf-rb-section-card">
                        <div className="hf-rb-card-header-row">
                            <div className="hf-rb-card-title-group">
                                <h3>Professional Summary</h3>
                                {renderCardReorderControls('summary')}
                            </div>
                            <button
                                type="button"
                                className="hf-rb-ai-btn"
                                onClick={handlePolishSummary}
                                disabled={polishing}
                            >
                                {polishing ? 'Polishing…' : '✨ Polish with AI'}
                            </button>
                        </div>
                        {aiNotice && <span className="hf-rb-ai-badge">{aiNotice}</span>}
                        <textarea
                            rows={4}
                            value={resumeData.summary}
                            onChange={(e) => handleFieldChange('summary', e.target.value)}
                            placeholder="Briefly state your core technical background, years of experience, and signature strengths…"
                        />
                    </div>

                    {/* Core Skills (Categorized with Add Buttons) */}
                    <div className="hf-rb-section-card">
                        <div className="hf-rb-card-header-row">
                            <div>
                                <div className="hf-rb-card-title-group">
                                    <h3>Core Skills & Competencies</h3>
                                    {renderCardReorderControls('skills')}
                                </div>
                                <p className="hf-rb-card-desc">Group your skills into categories like Frontend, Backend, Cloud, etc. so ATS scanners and recruiters can parse them instantly.</p>
                            </div>
                        </div>

                        <div className="hf-rb-cat-list">
                            {resumeData.skillCategories.map((cat) => (
                                <div key={cat.id} className="hf-rb-cat-card">
                                    <div className="hf-rb-cat-header">
                                        <div className="hf-rb-cat-title">
                                            <span className="hf-rb-cat-icon">{cat.icon || '🏷️'}</span>
                                            <strong>{cat.category}</strong>
                                            <span className="hf-rb-cat-count">({cat.skills.length})</span>
                                        </div>
                                        {resumeData.skillCategories.length > 1 && (
                                            <button
                                                type="button"
                                                className="hf-rb-cat-del-btn"
                                                onClick={() => handleRemoveCategory(cat.id)}
                                                title={`Remove ${cat.category} category`}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {/* Skill chips */}
                                    <div className="hf-rb-skill-chips">
                                        {cat.skills.map((skill) => (
                                            <span key={skill} className="hf-rb-chip">
                                                {skill}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSkillFromCategory(cat.id, skill)}
                                                    title={`Remove ${skill}`}
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        ))}
                                        {cat.skills.length === 0 && (
                                            <span className="hf-rb-chip-empty">No skills yet. Add one below!</span>
                                        )}
                                    </div>

                                    {/* Add skill input and button for this category */}
                                    <div className="hf-rb-cat-input-row">
                                        <input
                                            type="text"
                                            value={categoryInputs[cat.id] || ''}
                                            onChange={(e) => handleCategoryInputChange(cat.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddSkillToCategory(cat.id)
                                                }
                                            }}
                                            placeholder={`Add ${cat.category} skill (e.g. ${cat.category === 'Frontend' ? 'Vue.js, Svelte' : cat.category === 'Backend' ? 'Go, Python, Java' : cat.category.includes('Database') ? 'MongoDB, MySQL' : 'Kubernetes, Linux'})…`}
                                        />
                                        <button
                                            type="button"
                                            className="hf-rb-add-skill-btn"
                                            onClick={() => handleAddSkillToCategory(cat.id)}
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add New Category Control */}
                        <div className="hf-rb-add-cat-box">
                            <span className="hf-rb-add-cat-label">+ Create Custom Category:</span>
                            <div className="hf-rb-add-cat-row">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleAddNewCategory()
                                        }
                                    }}
                                    placeholder="e.g. Mobile Apps, Machine Learning, Testing & QA…"
                                />
                                <button
                                    type="button"
                                    className="hf-rb-create-cat-btn"
                                    onClick={() => handleAddNewCategory()}
                                >
                                    + Add Category
                                </button>
                            </div>

                            {/* Quick Add category suggestions */}
                            <div className="hf-rb-quick-cat-suggestions">
                                <span className="hf-rb-suggest-label">Quick suggestions:</span>
                                {['Mobile (Flutter / React Native)', 'AI & Machine Learning', 'DevOps & CI/CD', 'Testing & Automation', 'Soft Skills'].map((sug) => {
                                    const exists = resumeData.skillCategories.some((c) => c.category.toLowerCase() === sug.toLowerCase())
                                    if (exists) return null
                                    return (
                                        <button
                                            key={sug}
                                            type="button"
                                            className="hf-rb-sug-pill"
                                            onClick={() => handleAddNewCategory(sug)}
                                        >
                                            + {sug}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Work Experience */}
                    <div className="hf-rb-section-card">
                        <div className="hf-rb-card-header-row">
                            <div>
                                <div className="hf-rb-card-title-group">
                                    <h3>Work Experience</h3>
                                    {renderCardReorderControls('experience')}
                                </div>
                                <p className="hf-rb-card-desc">Highlight relevant internships, software projects, or full-time roles.</p>
                            </div>
                            <button
                                type="button"
                                className="hf-rb-add-item-btn"
                                onClick={handleAddExperience}
                            >
                                + Add Position
                            </button>
                        </div>

                        {/* Bullet Style Picker for Work Experience */}
                        <div className="hf-rb-bullet-picker-bar">
                            <div className="hf-rb-bullet-picker-label">
                                <span className="hf-rb-bp-title">Bullet Style:</span>
                                <span className="hf-rb-bp-hint">Choose how job accomplishments are formatted</span>
                            </div>
                            <div className="hf-rb-bullet-pills" role="group" aria-label="Work Experience Bullet Style">
                                {BULLET_STYLE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        className={`hf-rb-bullet-pill ${(resumeData.expBulletStyle || 'disc') === opt.id ? 'active' : ''}`}
                                        onClick={() => handleFieldChange('expBulletStyle', opt.id)}
                                        title={`${opt.label} (${opt.symbol})`}
                                    >
                                        <span className="hf-rb-bullet-icon">{opt.symbol}</span>
                                        <span className="hf-rb-bullet-txt">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {resumeData.experience.length === 0 ? (
                            <div className="hf-rb-empty-state">
                                <p>No work experience added yet. Students and freshers can click <strong>"+ Add Position"</strong> to add internships, freelance, or research roles.</p>
                            </div>
                        ) : (
                            <div className="hf-rb-items-list">
                                {resumeData.experience.map((exp, index) => (
                                    <div key={exp.id} className="hf-rb-item-card">
                                        <div className="hf-rb-item-card-header">
                                            <span className="hf-rb-item-num">
                                                <span className="hf-rb-badge-idx">#{index + 1}</span>
                                                {exp.role || exp.company ? `${exp.role || 'Role'} at ${exp.company || 'Company'}` : 'New Position'}
                                            </span>
                                            <button
                                                type="button"
                                                className="hf-rb-item-del-btn"
                                                onClick={() => handleRemoveExperience(exp.id)}
                                                title="Delete this position"
                                            >
                                                ✕ Delete
                                            </button>
                                        </div>

                                        <div className="hf-rb-form-grid">
                                            <label>
                                                Job Title / Role
                                                <input
                                                    type="text"
                                                    value={exp.role}
                                                    placeholder="e.g. Full Stack Developer Intern"
                                                    onChange={(e) => handleUpdateExperience(exp.id, 'role', e.target.value)}
                                                />
                                            </label>
                                            <label>
                                                Company / Organization
                                                <input
                                                    type="text"
                                                    value={exp.company}
                                                    placeholder="e.g. Acme Tech Solutions"
                                                    onChange={(e) => handleUpdateExperience(exp.id, 'company', e.target.value)}
                                                />
                                            </label>
                                        </div>

                                        <div className="hf-rb-field-single">
                                            <label>
                                                Employment Period
                                                <input
                                                    type="text"
                                                    value={exp.period}
                                                    placeholder="e.g. Jan 2024 – Present or Jun 2023 – Dec 2023"
                                                    onChange={(e) => handleUpdateExperience(exp.id, 'period', e.target.value)}
                                                />
                                            </label>
                                        </div>

                                        <div className="hf-rb-field-single">
                                            <label>
                                                <span>Key Responsibilities & Achievements <span className="hf-rb-hint">(Write each bullet on a new line; use **bold** to highlight)</span></span>
                                                <textarea
                                                    rows={4}
                                                    value={exp.bulletsText !== undefined ? exp.bulletsText : (exp.bullets || []).join('\n')}
                                                    placeholder="Architected high-throughput REST APIs handling 10,000+ requests/sec.&#10;Integrated React and Tailwind UI reducing customer load time by 35%.&#10;Collaborated with cross-functional team in 2-week agile sprints."
                                                    onChange={(e) => handleUpdateExperience(exp.id, 'bulletsText', e.target.value)}
                                                />
                                            </label>
                                            <span className="hf-rb-bullet-counter">
                                                {exp.bullets?.length || 0} bullet point{(exp.bullets?.length || 0) !== 1 ? 's' : ''} detected
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Education */}
                    <div className="hf-rb-section-card">
                        <div className="hf-rb-card-header-row">
                            <div>
                                <div className="hf-rb-card-title-group">
                                    <h3>Education</h3>
                                    {renderCardReorderControls('education')}
                                </div>
                                <p className="hf-rb-card-desc">Degrees, diplomas, university, and academic scores.</p>
                            </div>
                            <button
                                type="button"
                                className="hf-rb-add-item-btn"
                                onClick={handleAddEducation}
                            >
                                + Add Education
                            </button>
                        </div>

                        {resumeData.education.length === 0 ? (
                            <div className="hf-rb-empty-state">
                                <p>No education entries added yet. Click <strong>"+ Add Education"</strong> to add your degree or diploma.</p>
                            </div>
                        ) : (
                            <div className="hf-rb-items-list">
                                {resumeData.education.map((edu, index) => (
                                    <div key={edu.id} className="hf-rb-item-card">
                                        <div className="hf-rb-item-card-header">
                                            <span className="hf-rb-item-num">
                                                <span className="hf-rb-badge-idx">#{index + 1}</span>
                                                {edu.degree || edu.institution ? `${edu.degree || 'Degree'} — ${edu.institution || 'College'}` : 'New Education'}
                                            </span>
                                            <button
                                                type="button"
                                                className="hf-rb-item-del-btn"
                                                onClick={() => handleRemoveEducation(edu.id)}
                                                title="Delete this education"
                                            >
                                                ✕ Delete
                                            </button>
                                        </div>

                                        <div className="hf-rb-form-grid">
                                            <label>
                                                Degree / Field of Study
                                                <input
                                                    type="text"
                                                    value={edu.degree}
                                                    placeholder="e.g. B.Tech in Computer Science & Engineering"
                                                    onChange={(e) => handleUpdateEducation(edu.id, 'degree', e.target.value)}
                                                />
                                            </label>
                                            <label>
                                                University / Institution
                                                <input
                                                    type="text"
                                                    value={edu.institution}
                                                    placeholder="e.g. National Institute of Technology"
                                                    onChange={(e) => handleUpdateEducation(edu.id, 'institution', e.target.value)}
                                                />
                                            </label>
                                            <label>
                                                Graduation Year / Period
                                                <input
                                                    type="text"
                                                    value={edu.year}
                                                    placeholder="e.g. 2020 – 2024"
                                                    onChange={(e) => handleUpdateEducation(edu.id, 'year', e.target.value)}
                                                />
                                            </label>
                                            <label>
                                                CGPA / Percentage / Honors
                                                <input
                                                    type="text"
                                                    value={edu.score}
                                                    placeholder="e.g. CGPA: 8.9 / 10"
                                                    onChange={(e) => handleUpdateEducation(edu.id, 'score', e.target.value)}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Key Projects */}
                    <div className="hf-rb-section-card">
                        <div className="hf-rb-card-header-row">
                            <div>
                                <div className="hf-rb-card-title-group">
                                    <h3>Key Projects</h3>
                                    {renderCardReorderControls('projects')}
                                </div>
                                <p className="hf-rb-card-desc">Showcase capstone projects, open-source repositories, or hackathon apps.</p>
                            </div>
                            <button
                                type="button"
                                className="hf-rb-add-item-btn"
                                onClick={handleAddProject}
                            >
                                + Add Project
                            </button>
                        </div>

                        {/* Bullet Style Picker for Key Projects */}
                        <div className="hf-rb-bullet-picker-bar">
                            <div className="hf-rb-bullet-picker-label">
                                <span className="hf-rb-bp-title">Bullet Style:</span>
                                <span className="hf-rb-bp-hint">Choose how project achievements are formatted</span>
                            </div>
                            <div className="hf-rb-bullet-pills" role="group" aria-label="Key Projects Bullet Style">
                                {BULLET_STYLE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        className={`hf-rb-bullet-pill ${(resumeData.projBulletStyle || 'disc') === opt.id ? 'active' : ''}`}
                                        onClick={() => handleFieldChange('projBulletStyle', opt.id)}
                                        title={`${opt.label} (${opt.symbol})`}
                                    >
                                        <span className="hf-rb-bullet-icon">{opt.symbol}</span>
                                        <span className="hf-rb-bullet-txt">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {resumeData.projects.length === 0 ? (
                            <div className="hf-rb-empty-state">
                                <p>No projects added yet. Click <strong>"+ Add Project"</strong> to describe your best technical builds.</p>
                            </div>
                        ) : (
                            <div className="hf-rb-items-list">
                                {resumeData.projects.map((proj, index) => {
                                    const projBulletsCount = proj.bullets?.length || (proj.description ? proj.description.split('\n').filter(Boolean).length : 0)

                                    return (
                                        <div key={proj.id} className="hf-rb-item-card">
                                            <div className="hf-rb-item-card-header">
                                                <span className="hf-rb-item-num">
                                                    <span className="hf-rb-badge-idx">#{index + 1}</span>
                                                    {proj.name || 'New Project'}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="hf-rb-item-del-btn"
                                                    onClick={() => handleRemoveProject(proj.id)}
                                                    title="Delete this project"
                                                >
                                                    ✕ Delete
                                                </button>
                                            </div>

                                            <div className="hf-rb-form-grid">
                                                <label>
                                                    Project Name
                                                    <input
                                                        type="text"
                                                        value={proj.name}
                                                        placeholder="e.g. HireFlow AI Platform"
                                                        onChange={(e) => handleUpdateProject(proj.id, 'name', e.target.value)}
                                                    />
                                                </label>
                                                <label>
                                                    Tech Stack Used
                                                    <input
                                                        type="text"
                                                        value={proj.tech}
                                                        placeholder="e.g. React, ASP.NET Core, PostgreSQL, Docker"
                                                        onChange={(e) => handleUpdateProject(proj.id, 'tech', e.target.value)}
                                                    />
                                                </label>
                                            </div>

                                            <div className="hf-rb-field-single">
                                                <label>
                                                    <span>Project Highlights & Bullets <span className="hf-rb-hint">(Write each point on a new line; use **bold** for key metrics)</span></span>
                                                    <textarea
                                                        rows={3}
                                                        value={proj.bulletsText !== undefined ? proj.bulletsText : (proj.bullets?.length ? proj.bullets.join('\n') : (proj.description || ''))}
                                                        placeholder="Engineered end-to-end talent platform featuring automated ATS ranking...&#10;Slashing query latency by 45% with indexed PostgreSQL queries..."
                                                        onChange={(e) => handleUpdateProject(proj.id, 'bulletsText', e.target.value)}
                                                    />
                                                </label>
                                                <span className="hf-rb-bullet-counter">
                                                    {projBulletsCount} bullet point{projBulletsCount !== 1 ? 's' : ''} detected
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* Right: Live Paper Sheet */}
                <section className={`hf-rb-preview-area ${viewTab === 'editor' ? 'hide-mobile' : ''}`}>
                    <div className={`hf-rb-paper hf-template-${template}`} id="hf-printable-resume">
                        {/* Header: Candidate Details - Always renders and prints cleanly at top */}
                        <div className="hf-resume-header">
                            <div className="hf-resume-header-row">
                                <div className="hf-resume-header-main">
                                    <h1 className="hf-resume-name">{resumeData.fullName || 'Your Name'}</h1>
                                    {resumeData.title && <div className="hf-resume-title">{resumeData.title}</div>}
                                    <div className="hf-resume-contacts">
                                        {resumeData.email && (
                                            <a href={`mailto:${resumeData.email}`} className="hf-contact-item hf-contact-link" title="Send email">
                                                {resumeData.email}
                                            </a>
                                        )}
                                        {resumeData.phone && (
                                            <>
                                                <span className="hf-contact-dot">•</span>
                                                <a href={`tel:${resumeData.phone.replace(/[^+\d]/g, '')}`} className="hf-contact-item hf-contact-link" title="Call candidate">
                                                    {resumeData.phone}
                                                </a>
                                            </>
                                        )}
                                        {resumeData.location && (
                                            <>
                                                <span className="hf-contact-dot">•</span>
                                                <span className="hf-contact-item">{resumeData.location}</span>
                                            </>
                                        )}
                                        {resumeData.linkedIn && (
                                            <>
                                                <span className="hf-contact-dot">•</span>
                                                <a
                                                    href={resumeData.linkedIn.startsWith('http') ? resumeData.linkedIn : `https://${resumeData.linkedIn}`}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    className="hf-contact-item hf-contact-link"
                                                    title="Open LinkedIn profile"
                                                >
                                                    {resumeData.linkedIn.replace(/^https?:\/\/(www\.)?/, '')}
                                                </a>
                                            </>
                                        )}
                                        {resumeData.github && (
                                            <>
                                                <span className="hf-contact-dot">•</span>
                                                <a
                                                    href={resumeData.github.startsWith('http') ? resumeData.github : `https://${resumeData.github}`}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    className="hf-contact-item hf-contact-link"
                                                    title="Open GitHub profile"
                                                >
                                                    {resumeData.github.replace(/^https?:\/\/(www\.)?/, '')}
                                                </a>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {showQrCode && (
                                    <div className="hf-resume-qr-badge" title="Scan to open candidate portfolio & verified projects">
                                        {(() => {
                                            const pUrl = typeof window !== 'undefined'
                                                ? `${window.location.origin}/candidate/portfolio`
                                                : 'https://hireflow.app/candidate/portfolio'
                                            const qr = generateQrSvgPath(pUrl, 100)
                                            return (
                                                <>
                                                    <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="hf-resume-qr-svg" role="img" aria-label="Portfolio QR Code">
                                                        <path d={qr.path} fill="#111827" />
                                                    </svg>
                                                    <span className="hf-resume-qr-label">Scan Portfolio</span>
                                                </>
                                            )
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dynamically Ordered Resume Sections */}
                        {sectionOrder.map((sectionKey) => {
                            switch (sectionKey) {
                                case 'summary':
                                    return renderPaperSummary()
                                case 'skills':
                                    return renderPaperSkills()
                                case 'experience':
                                    return renderPaperExperience()
                                case 'education':
                                    return renderPaperEducation()
                                case 'projects':
                                    return renderPaperProjects()
                                default:
                                    return null
                            }
                        })}
                    </div>
                </section>
            </div>

            {/* Hub 1: AI ATS Optimization Modal */}
            <ResumeAtsModal
                isOpen={showAtsModal}
                onClose={() => setShowAtsModal(false)}
                resumeData={resumeData}
                onInjectSkill={handleInjectSkill}
            />

            {/* Hub 1: AI Cover Letter & Cold Email Modal */}
            <CoverLetterModal
                isOpen={showCoverLetterModal}
                onClose={() => setShowCoverLetterModal(false)}
                resumeData={resumeData}
            />

            {/* Branded Confirmation Modal */}
            <ConfirmDialog
                open={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                danger={confirmModal.danger}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
            />
        </div>
    )
}
