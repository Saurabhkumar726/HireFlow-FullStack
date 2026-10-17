
import { useCallback, useEffect, useMemo, useState } from 'react'
import './CandidateProfileSections.css'

const API_URL = 'http://localhost:5116/api'

async function candidateRequest(path, token, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        const validation = data?.errors
            ? Object.values(data.errors).flat()[0]
            : null

        throw new Error(
            data?.message ||
            data?.title ||
            validation ||
            `Request failed (${response.status}).`
        )
    }

    return data
}

const emptyProfile = {
    resumeHeadline: '',
    profileSummary: '',
    desiredRole: '',
    desiredIndustry: '',
    employmentType: '',
    preferredLocations: '',
    workMode: '',
    expectedSalary: '',
    noticePeriod: '',
}

const sectionDefinitions = [
    {
        key: 'employments',
        title: 'Employment',
        description: 'Add your current and previous work experience.',
        endpoint: 'employment',
        empty: {
            companyName: '',
            jobTitle: '',
            employmentType: '',
            location: '',
            startDate: '',
            endDate: '',
            isCurrentlyWorking: false,
            description: '',
        },
        fields: [
            { name: 'jobTitle', label: 'Job title', required: true },
            { name: 'companyName', label: 'Company', required: true },
            {
                name: 'employmentType',
                label: 'Employment type',
                type: 'select',
                options: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'],
            },
            { name: 'location', label: 'Location' },
            { name: 'startDate', label: 'Start date', type: 'date', required: true },
            { name: 'endDate', label: 'End date', type: 'date' },
            {
                name: 'isCurrentlyWorking',
                label: 'I currently work here',
                type: 'checkbox',
            },
            { name: 'description', label: 'Description', type: 'textarea', wide: true },
        ],
        summary: item =>
            `${item.companyName || ''}${item.location ? ` · ${item.location}` : ''}`,
    },
    {
        key: 'education',
        title: 'Education',
        description: 'Include your degrees, courses, and academic background.',
        endpoint: 'education',
        empty: {
            institution: '',
            degree: '',
            specialization: '',
            educationLevel: '',
            grade: '',
            gradeType: '',
            startYear: '',
            endYear: '',
            description: '',
        },
        fields: [
            {
                name: 'institution',
                label: 'Institution / university',
                required: true,
            },
            {
                name: 'educationLevel',
                label: 'Education level',
                required: true,
                type: 'select',
                options: [
                    'High School',
                    'Diploma',
                    "Bachelor's",
                    "Master's",
                    'Doctorate',
                    'Certification',
                    'Other',
                ],
            },
            { name: 'degree', label: 'Degree / course' },
            { name: 'specialization', label: 'Specialization' },
            { name: 'startYear', label: 'Start year', type: 'number' },
            { name: 'endYear', label: 'End year', type: 'number' },
            { name: 'grade', label: 'Grade / percentage' },
            { name: 'gradeType', label: 'Grade type (CGPA, %, etc.)' },
            { name: 'description', label: 'Description', type: 'textarea', wide: true },
        ],
        summary: item =>
            [
                item.degree,
                item.specialization,
                item.startYear && item.endYear
                    ? `${item.startYear}–${item.endYear}`
                    : item.endYear || item.startYear,
            ]
                .filter(Boolean)
                .join(' · '),
    },
    {
        key: 'projects',
        title: 'Projects',
        description: 'Show projects that demonstrate your skills.',
        endpoint: 'projects',
        empty: {
            projectTitle: '',
            clientName: '',
            role: '',
            description: '',
            technologiesUsed: '',
            projectUrl: '',
            startDate: '',
            endDate: '',
        },
        fields: [
            { name: 'projectTitle', label: 'Project title', required: true },
            { name: 'role', label: 'Your role' },
            { name: 'clientName', label: 'Client / organization' },
            { name: 'technologiesUsed', label: 'Technologies used' },
            { name: 'projectUrl', label: 'Project URL', type: 'url' },
            { name: 'startDate', label: 'Start date', type: 'date' },
            { name: 'endDate', label: 'End date', type: 'date' },
            {
                name: 'description',
                label: 'Project description',
                type: 'textarea',
                wide: true,
            },
        ],
        summary: item =>
            [item.role, item.technologiesUsed].filter(Boolean).join(' · '),
    },
    {
        key: 'skills',
        title: 'Key skills',
        description: 'Add the skills you want employers to notice first.',
        endpoint: 'skills',
        category: 'KeySkill',
        empty: {
            skillName: '',
            category: 'KeySkill',
            proficiency: '',
            version: '',
        },
        fields: [
            { name: 'skillName', label: 'Skill', required: true },
            {
                name: 'proficiency',
                label: 'Proficiency',
                type: 'select',
                options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
            },
        ],
        summary: item => item.proficiency || '',
    },
    {
        key: 'itSkills',
        title: 'IT skills',
        description: 'List technologies, tools, databases, and frameworks you use.',
        endpoint: 'skills',
        category: 'ITSkill',
        empty: {
            skillName: '',
            category: 'ITSkill',
            proficiency: '',
            version: '',
        },
        fields: [
            { name: 'skillName', label: 'Technology / tool', required: true },
            { name: 'version', label: 'Version' },
            {
                name: 'proficiency',
                label: 'Proficiency',
                type: 'select',
                options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
            },
        ],
        summary: item =>
            [
                item.version ? `Version ${item.version}` : '',
                item.proficiency,
            ]
                .filter(Boolean)
                .join(' · '),
    },
    {
        key: 'accomplishments',
        title: 'Accomplishments',
        description: 'Add certifications, awards, achievements, publications, or online profiles.',
        endpoint: 'accomplishments',
        empty: {
            category: 'Certification',
            title: '',
            issuingOrganization: '',
            description: '',
            issueDate: '',
            credentialUrl: '',
        },
        fields: [
            {
                name: 'category',
                label: 'Type',
                type: 'select',
                required: true,
                options: [
                    'Certification',
                    'Award',
                    'Achievement',
                    'Publication',
                    'Online profiles',
                ],
            },
            { name: 'title', label: 'Title', required: true },
            { name: 'issuingOrganization', label: 'Issuing organization' },
            { name: 'issueDate', label: 'Issue date', type: 'date' },
            { name: 'credentialUrl', label: 'Credential URL', type: 'url' },
            { name: 'description', label: 'Description', type: 'textarea', wide: true },
        ],
        summary: item =>
            [
                item.issuingOrganization,
                item.issueDate
                    ? new Date(item.issueDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        year: 'numeric',
                    })
                    : '',
            ]
                .filter(Boolean)
                .join(' · '),
    },
]

function normalizeDate(value) {
    if (!value) return ''
    return String(value).slice(0, 10)
}

function EditorFields({ fields, value, onChange }) {
    return (
        <div className="candidate-editor-grid">
            {fields.map(field => (
                <label
                    className={
                        field.wide
                            ? 'candidate-field candidate-field-wide'
                            : 'candidate-field'
                    }
                    key={field.name}
                >
                    <span>
                        {field.label}
                        {field.required ? ' *' : ''}
                    </span>

                    {field.type === 'textarea' ? (
                        <textarea
                            rows="4"
                            maxLength={
                                field.name === 'description' ? 3000 : undefined
                            }
                            value={value[field.name] ?? ''}
                            required={field.required}
                            onChange={e =>
                                onChange(field.name, e.target.value)
                            }
                        />
                    ) : field.type === 'checkbox' ? (
                        <input
                            type="checkbox"
                            checked={Boolean(value[field.name])}
                            onChange={e =>
                                onChange(field.name, e.target.checked)
                            }
                        />
                    ) : field.type === 'select' ? (
                        <select
                            value={value[field.name] ?? ''}
                            required={field.required}
                            onChange={e =>
                                onChange(field.name, e.target.value)
                            }
                        >
                            <option value="">
                                Select {field.label.toLowerCase()}
                            </option>
                            {field.options.map(option => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type={field.type || 'text'}
                            value={
                                field.type === 'date'
                                    ? normalizeDate(value[field.name])
                                    : value[field.name] ?? ''
                            }
                            required={field.required}
                            maxLength={field.type === 'url' ? 500 : undefined}
                            onChange={e =>
                                onChange(field.name, e.target.value)
                            }
                        />
                    )}
                </label>
            ))}
        </div>
    )
}

function CandidateEntryCard({ item, definition, onEdit, onDelete }) {
    const [expanded, setExpanded] = useState(false)

    const description = item.description || ''
    const isLongDescription = description.length > 180

    const isOnlineProfile =
        definition.key === 'accomplishments' &&
        item.category === 'Online profiles'

    const title = isOnlineProfile
        ? 'Online Profile'
        : (
            item.jobTitle ||
            item.institution ||
            item.projectTitle ||
            item.skillName ||
            item.title ||
            'Profile entry'
        )

    return (
        <article className="candidate-entry">
            <div className="candidate-entry-copy">
                <strong>{title}</strong>

                <span>
                    {isOnlineProfile
                        ? item.title || 'Social profile'
                        : definition.summary(item) || definition.title}
                </span>

                {isOnlineProfile && item.credentialUrl && (
                    <a
                        className="candidate-entry-url"
                        href={item.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {item.credentialUrl}
                    </a>
                )}

                {description && (
                    <p
                        className={
                            !expanded && isLongDescription
                                ? 'candidate-entry-description is-collapsed'
                                : 'candidate-entry-description'
                        }
                    >
                        {description}
                    </p>
                )}

                {isLongDescription && (
                    <button
                        type="button"
                        className="candidate-link-button candidate-more-button"
                        onClick={() => setExpanded(value => !value)}
                    >
                        {expanded ? 'Show less' : 'More'}
                    </button>
                )}

                {item.isCurrentlyWorking && (
                    <small>Currently working here</small>
                )}
            </div>

            <div className="candidate-entry-actions">
                <button
                    type="button"
                    className="candidate-link-button"
                    onClick={() => onEdit(item)}
                >
                    Edit
                </button>

                <button
                    type="button"
                    className="candidate-link-button candidate-remove-link"
                    onClick={() => onDelete(item)}
                >
                    Delete
                </button>
            </div>
        </article>
    )
}

function EditableListSection({
    definition,
    items,
    token,
    onReload,
    setGlobalMessage,
    sectionId,
}) {
    const [editingId, setEditingId] = useState(null)
    const [draft, setDraft] = useState(definition.empty)
    const [saving, setSaving] = useState(false)
    const [adding, setAdding] = useState(false)
    const [localError, setLocalError] = useState('')

    // Custom delete confirmation modal state
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)

    function startAdd() {
        setEditingId(null)
        setDraft({ ...definition.empty })
        setAdding(true)
        setLocalError('')
    }

    function startEdit(item) {
        const next = { ...definition.empty, ...item }

        for (const field of definition.fields) {
            if (field.type === 'date' && next[field.name]) {
                next[field.name] = normalizeDate(next[field.name])
            }
        }

        setDraft(next)
        setEditingId(item.id)
        setAdding(false)
        setLocalError('')
    }

    function cancelEdit() {
        setEditingId(null)
        setAdding(false)
        setDraft({ ...definition.empty })
        setLocalError('')
    }

    function change(name, value) {
        setDraft(current => ({ ...current, [name]: value }))
    }

    async function save(event) {
        event.preventDefault()
        setSaving(true)
        setLocalError('')

        const body = { ...draft, userId: 'client-supplied' }

        // The API uses the authenticated account as the actual UserId.
        if (definition.category) {
            body.category = definition.category
        }

        if (body.startDate === '') body.startDate = null
        if (body.endDate === '') body.endDate = null
        if (body.issueDate === '') body.issueDate = null

        if (body.grade === '') body.grade = null
        else if (body.grade !== undefined && body.grade !== null) {
            body.grade = Number(body.grade)
        }

        if (body.startYear === '') body.startYear = null
        else if (body.startYear !== undefined && body.startYear !== null) {
            body.startYear = Number(body.startYear)
        }

        if (body.endYear === '') body.endYear = null
        else if (body.endYear !== undefined && body.endYear !== null) {
            body.endYear = Number(body.endYear)
        }

        if (body.isCurrentlyWorking) body.endDate = null

        try {
            const path =
                `/CandidateProfile/${definition.endpoint}` +
                (editingId ? `/${editingId}` : '')

            await candidateRequest(path, token, {
                method: editingId ? 'PUT' : 'POST',
                body: JSON.stringify(body),
            })

            cancelEdit()
            await onReload()
            setGlobalMessage(`${definition.title} saved successfully.`)
        } catch (error) {
            setLocalError(
                error.message ||
                `Could not save ${definition.title.toLowerCase()}.`
            )
        } finally {
            setSaving(false)
        }
    }

    // Open the custom confirmation instead of window.confirm().
    function remove(item) {
        setLocalError('')
        setDeleteTarget(item)
    }

    async function confirmDelete() {
        if (!deleteTarget || deleting) return

        setDeleting(true)
        setLocalError('')

        try {
            await candidateRequest(
                `/CandidateProfile/${definition.endpoint}/${deleteTarget.id}`,
                token,
                { method: 'DELETE' }
            )

            setDeleteTarget(null)
            await onReload()
            setGlobalMessage(`${definition.title} entry deleted.`)
        } catch (error) {
            setLocalError(error.message || 'Could not delete this entry.')
            setDeleteTarget(null)
        } finally {
            setDeleting(false)
        }
    }

    const visibleItems = definition.category
        ? items.filter(item => item.category === definition.category)
        : items

    const isOnlineProfile =
        definition.key === 'accomplishments' &&
        draft.category === 'Online profiles'

    const editorFields =
        definition.key === 'accomplishments'
            ? definition.fields.map(field => {
                if (field.name === 'title') {
                    return {
                        ...field,
                        label: isOnlineProfile ? 'Social profile' : 'Title',
                        required: true,
                    }
                }

                if (field.name === 'credentialUrl') {
                    return {
                        ...field,
                        label: isOnlineProfile ? 'URL' : 'Credential URL',
                        required: isOnlineProfile,
                    }
                }

                if (field.name === 'issuingOrganization') {
                    return { ...field, required: false }
                }

                if (field.name === 'issueDate') {
                    return { ...field, required: false }
                }

                if (field.name === 'description') {
                    return {
                        ...field,
                        label: 'Description',
                        required: false,
                    }
                }

                return field
            })
            : definition.fields

    const formOpen = adding || editingId !== null

    const resolvedSectionId =
        sectionId ||
        (definition.key === 'skills'
            ? 'candidate-key-skills'
            : definition.key === 'itSkills'
                ? 'candidate-it-skills'
                : undefined)

    return (
        <section
            id={resolvedSectionId}
            className="candidate-section-card candidate-anchor-section"
        >
            <div className="candidate-section-heading">
                <div>
                    <h3>{definition.title}</h3>
                    <p>{definition.description}</p>
                </div>

                {!formOpen && (
                    <button
                        className="candidate-outline-button"
                        type="button"
                        onClick={startAdd}
                    >
                        ＋ Add
                    </button>
                )}
            </div>

            {localError && (
                <p
                    className="candidate-message candidate-message-error"
                    role="alert"
                >
                    {localError}
                </p>
            )}

            {/* Modern delete confirmation modal */}
            {deleteTarget && (
                <div
                    className="candidate-confirm-backdrop"
                    role="presentation"
                    onMouseDown={event => {
                        if (
                            event.target === event.currentTarget &&
                            !deleting
                        ) {
                            setDeleteTarget(null)
                        }
                    }}
                >
                    <section
                        className="candidate-confirm-modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="candidate-delete-title"
                        aria-describedby="candidate-delete-description"
                    >
                        <div
                            className="candidate-confirm-icon"
                            aria-hidden="true"
                        >
                            <svg viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>

                        <h3 id="candidate-delete-title">
                            Delete this entry?
                        </h3>

                        <p id="candidate-delete-description">
                            Are you sure you want to delete this{' '}
                            {definition.title.toLowerCase()} entry? This action
                            cannot be undone.
                        </p>

                        <div className="candidate-confirm-actions">
                            <button
                                type="button"
                                className="candidate-confirm-cancel"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="candidate-confirm-delete"
                                onClick={confirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <>
                                        <span className="candidate-confirm-spinner" />
                                        Deleting…
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                        Delete entry
                                    </>
                                )}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {formOpen && (
                <form className="candidate-editor" onSubmit={save}>
                    <EditorFields
                        fields={editorFields}
                        value={draft}
                        onChange={change}
                    />

                    <div className="candidate-editor-actions">
                        <button
                            className="candidate-outline-button"
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                        >
                            Cancel
                        </button>

                        <button
                            className="candidate-primary-button"
                            type="submit"
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Save section'}
                        </button>
                    </div>
                </form>
            )}

            {visibleItems.length === 0 && !formOpen ? (
                <div className="candidate-empty">
                    Nothing added yet. Use <strong>＋ Add</strong> to complete
                    this section.
                </div>
            ) : (
                <div className="candidate-entry-list">
                    {visibleItems.map(item => (
                        <CandidateEntryCard
                            key={item.id}
                            item={item}
                            definition={definition}
                            onEdit={startEdit}
                            onDelete={remove}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

/* Main component: StudentDashboard.jsx imports this default export. */
export default function CandidateProfileSections({ token, onProfileUpdated }) {
    const [data, setData] = useState({
        ...emptyProfile,
        employments: [],
        education: [],
        projects: [],
        skills: [],
        accomplishments: [],
    })

    const [loading, setLoading] = useState(true)
    const [savingScalars, setSavingScalars] = useState(false)
    const [editingHeadline, setEditingHeadline] = useState(false)
    const [editingSummary, setEditingSummary] = useState(false)
    const [editingCareer, setEditingCareer] = useState(false)
    const [scalarDraft, setScalarDraft] = useState({ ...emptyProfile })
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const reload = useCallback(async () => {
        if (!token) {
            setLoading(false)
            return
        }

        try {
            const result = await candidateRequest('/CandidateProfile', token)
            const normalized = {
                ...emptyProfile,
                ...result,
                expectedSalary: result.expectedSalary ?? '',
            }

            setData(normalized)
            setScalarDraft({
                ...emptyProfile,
                ...normalized,
                expectedSalary: normalized.expectedSalary ?? '',
            })
            setError('')
            await onProfileUpdated?.()
        } catch (requestError) {
            setError(
                requestError.message ||
                'Could not load candidate profile sections.'
            )
        } finally {
            setLoading(false)
        }
    }, [token, onProfileUpdated])

    useEffect(() => {
        let cancelled = false

        async function loadInitialProfile() {
            if (!token) {
                if (!cancelled) setLoading(false)
                return
            }

            try {
                const result = await candidateRequest('/CandidateProfile', token)

                if (cancelled) return

                const normalized = {
                    ...emptyProfile,
                    ...result,
                    expectedSalary: result.expectedSalary ?? '',
                }

                setData(normalized)
                setScalarDraft({
                    ...emptyProfile,
                    ...normalized,
                    expectedSalary: normalized.expectedSalary ?? '',
                })
                setError('')
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        requestError.message ||
                        'Could not load candidate profile sections.'
                    )
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadInitialProfile()

        return () => {
            cancelled = true
        }
    }, [token])

    function editScalars(which) {
        setScalarDraft({
            ...emptyProfile,
            ...data,
            expectedSalary: data.expectedSalary ?? '',
        })

        setMessage('')
        setError('')

        if (which === 'headline') setEditingHeadline(true)
        if (which === 'summary') setEditingSummary(true)
        if (which === 'career') setEditingCareer(true)
    }

    async function saveScalars(event, which) {
        event.preventDefault()
        setSavingScalars(true)
        setMessage('')
        setError('')

        try {
            const payload = {
                ...emptyProfile,
                ...data,
                ...scalarDraft,
            }

            payload.expectedSalary =
                payload.expectedSalary === '' ||
                    payload.expectedSalary === null
                    ? null
                    : Number(payload.expectedSalary)

            await candidateRequest('/CandidateProfile', token, {
                method: 'PUT',
                body: JSON.stringify(payload),
            })

            await reload()

            if (which === 'headline') setEditingHeadline(false)
            if (which === 'summary') setEditingSummary(false)
            if (which === 'career') setEditingCareer(false)

            setMessage('Profile details saved successfully.')
        } catch (requestError) {
            setError(
                requestError.message || 'Could not save profile details.'
            )
        } finally {
            setSavingScalars(false)
        }
    }

    const completion = useMemo(() => {
        const checks = [
            data.resumeHeadline,
            data.profileSummary,
            data.employments?.length,
            data.education?.length,
            data.projects?.length,
            data.skills?.length,
            data.accomplishments?.length,
            data.desiredRole,
        ]

        return Math.round(
            (checks.filter(Boolean).length / checks.length) * 100
        )
    }, [data])

    return (
        <div className="candidate-profile-sections">
            <div className="candidate-profile-intro">
                <div>
                    <p className="candidate-kicker">CAREER PROFILE</p>
                    <h2>Build your professional profile</h2>
                    <p>
                        Keep these sections updated to help employers understand
                        your experience and strengths.
                    </p>
                </div>

                <div className="candidate-completion">
                    <strong>{completion}%</strong>
                    <span>profile sections</span>
                    <div>
                        <i style={{ width: `${completion}%` }} />
                    </div>
                </div>
            </div>

            {message && (
                <p
                    className="candidate-message candidate-message-success"
                    role="status"
                >
                    {message}
                </p>
            )}

            {error && (
                <p
                    className="candidate-message candidate-message-error"
                    role="alert"
                >
                    {error}
                </p>
            )}

            {loading ? (
                <div className="candidate-loading">
                    Loading your career profile…
                </div>
            ) : (
                <>
                    <section
                        id="candidate-resume-headline"
                        className="candidate-section-card candidate-anchor-section"
                    >
                        <div className="candidate-section-heading">
                            <div>
                                <h3>Resume headline</h3>
                                <p>
                                    A short line that describes your role and
                                    professional focus.
                                </p>
                            </div>

                            {!editingHeadline && (
                                <button
                                    type="button"
                                    className="candidate-outline-button"
                                    onClick={() => editScalars('headline')}
                                >
                                    {data.resumeHeadline ? 'Edit' : '＋ Add'}
                                </button>
                            )}
                        </div>

                        {editingHeadline ? (
                            <form
                                className="candidate-editor"
                                onSubmit={event =>
                                    saveScalars(event, 'headline')
                                }
                            >
                                <label className="candidate-field">
                                    <span>Headline</span>
                                    <input
                                        maxLength="250"
                                        value={scalarDraft.resumeHeadline || ''}
                                        onChange={event =>
                                            setScalarDraft(current => ({
                                                ...current,
                                                resumeHeadline: event.target.value,
                                            }))
                                        }
                                        placeholder="e.g. Full Stack .NET Developer | React.js | SQL Server"
                                    />
                                </label>

                                <div className="candidate-editor-actions">
                                    <button
                                        className="candidate-outline-button"
                                        type="button"
                                        onClick={() =>
                                            setEditingHeadline(false)
                                        }
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        className="candidate-primary-button"
                                        disabled={savingScalars}
                                    >
                                        {savingScalars
                                            ? 'Saving…'
                                            : 'Save headline'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <p
                                className={
                                    data.resumeHeadline
                                        ? 'candidate-rich-text'
                                        : 'candidate-placeholder'
                                }
                            >
                                {data.resumeHeadline ||
                                    'Add a concise headline that summarizes your expertise.'}
                            </p>
                        )}
                    </section>

                    <section
                        id="candidate-profile-summary"
                        className="candidate-section-card candidate-anchor-section"
                    >
                        <div className="candidate-section-heading">
                            <div>
                                <h3>Profile summary</h3>
                                <p>
                                    Introduce your experience, strengths, and
                                    career goals.
                                </p>
                            </div>

                            {!editingSummary && (
                                <button
                                    type="button"
                                    className="candidate-outline-button"
                                    onClick={() => editScalars('summary')}
                                >
                                    {data.profileSummary ? 'Edit' : '＋ Add'}
                                </button>
                            )}
                        </div>

                        {editingSummary ? (
                            <form
                                className="candidate-editor"
                                onSubmit={event =>
                                    saveScalars(event, 'summary')
                                }
                            >
                                <label className="candidate-field">
                                    <span>Summary</span>
                                    <textarea
                                        rows="6"
                                        maxLength="4000"
                                        value={scalarDraft.profileSummary || ''}
                                        onChange={event =>
                                            setScalarDraft(current => ({
                                                ...current,
                                                profileSummary: event.target.value,
                                            }))
                                        }
                                        placeholder="Describe your background, key strengths, and what you are looking for."
                                    />
                                </label>

                                <div className="candidate-editor-actions">
                                    <button
                                        className="candidate-outline-button"
                                        type="button"
                                        onClick={() =>
                                            setEditingSummary(false)
                                        }
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        className="candidate-primary-button"
                                        disabled={savingScalars}
                                    >
                                        {savingScalars
                                            ? 'Saving…'
                                            : 'Save summary'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <p
                                className={
                                    data.profileSummary
                                        ? 'candidate-rich-text'
                                        : 'candidate-placeholder'
                                }
                            >
                                {data.profileSummary ||
                                    'Add a professional summary to help recruiters understand your profile.'}
                            </p>
                        )}
                    </section>

                    <section
                        id="candidate-career-profile"
                        className="candidate-section-card candidate-anchor-section"
                    >
                        <div className="candidate-section-heading">
                            <div>
                                <h3>Career profile</h3>
                                <p>Set your target role and job preferences.</p>
                            </div>

                            {!editingCareer && (
                                <button
                                    type="button"
                                    className="candidate-outline-button"
                                    onClick={() => editScalars('career')}
                                >
                                    Edit preferences
                                </button>
                            )}
                        </div>

                        {editingCareer ? (
                            <form
                                className="candidate-editor"
                                onSubmit={event =>
                                    saveScalars(event, 'career')
                                }
                            >
                                <div className="candidate-editor-grid">
                                    <label className="candidate-field">
                                        <span>Desired role</span>
                                        <input
                                            maxLength="150"
                                            value={scalarDraft.desiredRole || ''}
                                            onChange={e =>
                                                setScalarDraft(current => ({
                                                    ...current,
                                                    desiredRole: e.target.value,
                                                }))
                                            }
                                            placeholder="e.g. Full Stack Developer"
                                        />
                                    </label>

                                    <label className="candidate-field">
                                        <span>Desired industry</span>
                                        <input
                                            maxLength="150"
                                            value={scalarDraft.desiredIndustry || ''}
                                            onChange={e =>
                                                setScalarDraft(current => ({
                                                    ...current,
                                                    desiredIndustry: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>

                                    <label className="candidate-field">
                                        <span>Employment type</span>
                                        <select
                                            value={scalarDraft.employmentType || ''}
                                            onChange={e =>
                                                setScalarDraft(current => ({
                                                    ...current,
                                                    employmentType: e.target.value,
                                                }))
                                            }
                                        >
                                            <option value="">Select</option>
                                            {[
                                                'Full-time',
                                                'Part-time',
                                                'Internship',
                                                'Contract',
                                                'Freelance',
                                            ].map(value => (
                                                <option key={value}>
                                                    {value}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="candidate-field">
                                        <span>Work mode</span>
                                        <select
                                            value={scalarDraft.workMode || ''}
                                            onChange={e =>
                                                setScalarDraft(current => ({
                                                    ...current,
                                                    workMode: e.target.value,
                                                }))
                                            }
                                        >
                                            <option value="">Select</option>
                                            {[
                                                'On-site',
                                                'Hybrid',
                                                'Remote',
                                                'Flexible',
                                            ].map(value => (
                                                <option key={value}>
                                                    {value}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="candidate-field">
                                        <span>Preferred locations</span>
                                        <input
                                            maxLength="300"
                                            value={
                                                scalarDraft.preferredLocations || ''
                                            }
                                            onChange={e =>
                                                setScalarDraft(current => ({
                                                    ...current,
                                                    preferredLocations:
                                                        e.target.value,
                                                }))
                                            }
                                            placeholder="Separate locations with commas"
                                        />
                                    </label>

                                    <label className="candidate-field">
                                        <span>Expected annual salary (INR)</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1000"
                                            value={scalarDraft.expectedSalary ?? ''}
                                            onChange={e =>
                                                setScalarDraft(current => ({
                                                    ...current,
                                                    expectedSalary: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>

                                    <label className="candidate-field">
                                        <span>Notice period</span>
                                        <select
                                            value={scalarDraft.noticePeriod || ''}
                                            onChange={e =>
                                                setScalarDraft(current => ({
                                                    ...current,
                                                    noticePeriod: e.target.value,
                                                }))
                                            }
                                        >
                                            <option value="">Select</option>
                                            {[
                                                'Immediate',
                                                '15 days',
                                                '30 days',
                                                '45 days',
                                                '60 days',
                                                '90 days',
                                                'Serving notice period',
                                            ].map(value => (
                                                <option key={value}>
                                                    {value}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="candidate-editor-actions">
                                    <button
                                        className="candidate-outline-button"
                                        type="button"
                                        onClick={() => setEditingCareer(false)}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        className="candidate-primary-button"
                                        disabled={savingScalars}
                                    >
                                        {savingScalars
                                            ? 'Saving…'
                                            : 'Save career profile'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="candidate-career-summary">
                                {[
                                    ['Desired role', data.desiredRole],
                                    ['Industry', data.desiredIndustry],
                                    ['Employment type', data.employmentType],
                                    ['Work mode', data.workMode],
                                    ['Preferred locations', data.preferredLocations],
                                    [
                                        'Expected salary',
                                        data.expectedSalary
                                            ? `₹${Number(
                                                data.expectedSalary
                                            ).toLocaleString('en-IN')} per year`
                                            : '',
                                    ],
                                    ['Notice period', data.noticePeriod],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <span>{label}</span>
                                        <strong>{value || 'Not specified'}</strong>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {sectionDefinitions.map(definition => (
                        <EditableListSection
                            key={definition.key}
                            definition={definition}
                            items={data[definition.key] || []}
                            token={token}
                            onReload={reload}
                            setGlobalMessage={setMessage}
                            sectionId={{
                                employments: 'candidate-employments',
                                education: 'candidate-education',
                                projects: 'candidate-projects',
                                skills: null,
                                itSkills: null,
                                accomplishments: 'candidate-accomplishments',
                            }[definition.key]}
                        />
                    ))}
                </>
            )}
        </div>
    )
}
