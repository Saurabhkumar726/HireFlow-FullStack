
import { useCallback, useEffect, useRef, useState } from 'react'
import './StudentDashboard.css'
import CandidateProfileSections from './CandidateProfileSections'
import { useAuth } from '../context/useAuth'
import ConfirmDialog from './ConfirmDialog'

const API_URL = 'http://localhost:5116/api'
const API_ORIGIN = 'http://localhost:5116'


function apiImageUrl(value) {
    if (!value || typeof value !== 'string') return ''
    if (/^(https?:|data:|blob:)/i.test(value)) return value
    return `${API_ORIGIN}/${value.replace(/^\/+/, '')}`
}

const tabs = [
    { id: 'overview', label: 'Overview', icon: '▦' },
    { id: 'profile', label: 'My Profile', icon: '♙' },
    { id: 'resume', label: 'My Resume', icon: '▤' },
    { id: 'applications', label: 'My Applications', icon: '▣' },
]

const profileSectionLinks = [
    { id: 'candidate-resume-headline', label: 'Resume headline', icon: '↗' },
    { id: 'candidate-profile-summary', label: 'Profile summary', icon: '☷' },
    { id: 'candidate-career-profile', label: 'Career profile', icon: '◎' },
    { id: 'candidate-employments', label: 'Employment', icon: '▣' },
    { id: 'candidate-education', label: 'Education', icon: '▤' },
    { id: 'candidate-projects', label: 'Projects', icon: '⌘' },
    { id: 'candidate-key-skills', label: 'Key skills', icon: '✦' },
    { id: 'candidate-it-skills', label: 'IT skills', icon: '⌘' },
    { id: 'candidate-accomplishments', label: 'Accomplishments', icon: '★' },
]

function getErrorMessage(data, fallback) {
    return (
        data?.message ||
        data?.title ||
        data?.errors?.Email?.[0] ||
        data?.errors?.FullName?.[0] ||
        fallback
    )
}

async function apiRequest(path, token, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body instanceof FormData
                ? {}
                : options.body
                    ? { 'Content-Type': 'application/json' }
                    : {}),
            ...options.headers,
        },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        throw new Error(
            getErrorMessage(data, `Request failed (${response.status}).`)
        )
    }

    return data
}

function getStatusClass(status) {
    const value = String(status || 'Pending').toLowerCase()

    if (value.includes('shortlist')) return 'status-shortlisted'
    if (value.includes('reject')) return 'status-rejected'
    if (value.includes('accept') || value.includes('selected')) {
        return 'status-accepted'
    }
    if (value.includes('review')) return 'status-review'

    return 'status-pending'
}

function formatDate(value) {
    if (!value) return '—'

    const date = new Date(value)

    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
}

function formatProfileLastUpdated(value) {
    if (!value) return 'Not updated yet'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not updated yet'

    const today = new Date()
    const updatedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const days = Math.round((todayDay.getTime() - updatedDay.getTime()) / 86400000)

    if (days <= 0) return 'Today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
}

function getFileName(value) {
    if (!value) return ''

    try {
        return decodeURIComponent(
            String(value).split('?')[0].split('/').pop()
        )
    } catch {
        return String(value).split('/').pop()
    }
}

function CropModal({ file, source, onCancel, onSave, saving }) {
    const [imageDimensions, setImageDimensions] = useState(null)
    const [frameSize, setFrameSize] = useState(300)
    const [zoom, setZoom] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [dragging, setDragging] = useState(false)
    const [dragStart, setDragStart] = useState(null)
    const imageRef = useRef(null)
    const frameRef = useRef(null)

    const getImageMetrics = useCallback(() => {
        const image = imageRef.current
        const frame = frameRef.current
        if (!image || !frame || !image.naturalWidth || !image.naturalHeight) return null

        const frameSize = frame.clientWidth
        const baseScale = Math.max(
            frameSize / image.naturalWidth,
            frameSize / image.naturalHeight
        )
        const scale = baseScale * zoom
        return {
            frameSize,
            renderedWidth: image.naturalWidth * scale,
            renderedHeight: image.naturalHeight * scale,
        }
    }, [zoom])

    function startDrag(event) {
        event.preventDefault()
        setDragging(true)
        setDragStart({
            x: event.clientX,
            y: event.clientY,
            offsetX: offset.x,
            offsetY: offset.y,
        })
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }

    function moveDrag(event) {
        if (!dragging || !dragStart) return
        const metrics = getImageMetrics()
        if (!metrics) return

        const maxX = Math.max(0, (metrics.renderedWidth - metrics.frameSize) / 2)
        const maxY = Math.max(0, (metrics.renderedHeight - metrics.frameSize) / 2)
        setOffset({
            x: Math.max(-maxX, Math.min(maxX, dragStart.offsetX + event.clientX - dragStart.x)),
            y: Math.max(-maxY, Math.min(maxY, dragStart.offsetY + event.clientY - dragStart.y)),
        })
    }

    function endDrag() {
        setDragging(false)
        setDragStart(null)
    }

    async function saveCrop() {
        const image = imageRef.current
        const metrics = getImageMetrics()
        if (!image || !metrics) return

        const canvas = document.createElement('canvas')
        const outputSize = 600
        canvas.width = outputSize
        canvas.height = outputSize
        const context = canvas.getContext('2d')
        if (!context) {
            onCancel()
            return
        }

        const scale = metrics.renderedWidth / image.naturalWidth
        const sourceSize = metrics.frameSize / scale
        const sourceX = (image.naturalWidth - sourceSize) / 2 - offset.x / scale
        const sourceY = (image.naturalHeight - sourceSize) / 2 - offset.y / scale

        context.drawImage(
            image,
            Math.max(0, sourceX),
            Math.max(0, sourceY),
            sourceSize,
            sourceSize,
            0,
            0,
            outputSize,
            outputSize
        )

        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.92)
        )
        if (!blob) return

        const croppedFile = new File(
            [blob],
            `${file.name.replace(/\.[^.]+$/, '')}-profile.jpg`,
            { type: 'image/jpeg', lastModified: Date.now() }
        )
        onSave(croppedFile)
    }

    return (
        <div className="profile-crop-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) onCancel()
        }}>
            <section
                className="profile-crop-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-crop-title"
            >
                <div className="profile-crop-heading">
                    <div>
                        <p className="profile-eyebrow">PERSONALIZE YOUR PHOTO</p>
                        <h2 id="profile-crop-title">Crop profile picture</h2>
                        <p>Drag to reposition, then adjust the zoom.</p>
                    </div>
                    <button type="button" className="profile-icon-button" onClick={onCancel} disabled={saving} aria-label="Close crop editor">×</button>
                </div>

                <div
                    className="profile-crop-frame"
                    ref={frameRef}
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onLostPointerCapture={endDrag}
                    style={{ cursor: dragging ? 'grabbing' : 'grab' }}
                >
                    {source && (
                        <img
                            ref={imageRef}
                            src={source}
                            alt="Crop preview"
                            draggable="false"
                            onLoad={(event) => {
                                setFrameSize(frameRef.current?.clientWidth || 300)
                                setImageDimensions({
                                    width: event.currentTarget.naturalWidth,
                                    height: event.currentTarget.naturalHeight,
                                })
                                setOffset({ x: 0, y: 0 })
                            }}
                            style={{
                                width: imageDimensions
                                    ? `${imageDimensions.width * Math.max(frameSize / imageDimensions.width, frameSize / imageDimensions.height)}px`
                                    : 'auto',
                                height: imageDimensions
                                    ? `${imageDimensions.height * Math.max(frameSize / imageDimensions.width, frameSize / imageDimensions.height)}px`
                                    : 'auto',
                                maxWidth: 'none',
                                maxHeight: 'none',
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                minWidth: 0,
                                minHeight: 0,
                                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                                transformOrigin: 'center',
                                pointerEvents: 'none',
                            }}
                        />
                    )}
                    <span className="profile-crop-circle" aria-hidden="true" />
                </div>

                <label className="profile-zoom-control">
                    <span>Zoom</span>
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={zoom}
                        onChange={(event) => {
                            setZoom(Number(event.target.value))
                            setOffset({ x: 0, y: 0 })
                        }}
                    />
                    <span>{zoom.toFixed(1)}×</span>
                </label>

                <div className="profile-crop-actions">
                    <button type="button" className="profile-secondary-button" onClick={onCancel} disabled={saving}>Cancel</button>
                    <button type="button" className="profile-primary-button" onClick={saveCrop} disabled={saving || !source}>
                        {saving ? 'Saving…' : 'Crop and save'}
                    </button>
                </div>
            </section>
        </div>
    )
}


export default function StudentDashboard() {
    const { user, token, updateUser } = useAuth()

    const [activeTab, setActiveTab] = useState('overview')
    const [profile, setProfile] = useState({
        fullName: user?.fullName || '',
        email: user?.email || '',
        phoneNumber: user?.phoneNumber || '',
        profilePictureUrl: user?.profilePictureUrl || '',
        resumeUrl: user?.resumeUrl || '',
        profileLastUpdatedAt: user?.profileLastUpdatedAt || null,
        resumeLastUpdatedAt: user?.resumeLastUpdatedAt || null,
    })

    const [applications, setApplications] = useState([])
    const [loading, setLoading] = useState(true)
    const [savingProfile, setSavingProfile] = useState(false)
    const [uploadingResume, setUploadingResume] = useState(false)
    const [uploadingPicture, setUploadingPicture] = useState(false)
    const [deletingPicture, setDeletingPicture] = useState(false)
    const [deletingResume, setDeletingResume] = useState(false)
    const [confirmDeleteType, setConfirmDeleteType] = useState(null)
    const [confirmDeleteLoading, setConfirmDeleteLoading] = useState(false)
    const [cropFile, setCropFile] = useState(null)
    const [cropSource, setCropSource] = useState('')
    const [pageError, setPageError] = useState('')
    const [profileMessage, setProfileMessage] = useState('')
    const [resumeMessage, setResumeMessage] = useState('')
    const [pictureMessage, setPictureMessage] = useState('')

    const loadDashboard = useCallback(async () => {
        if (!token) {
            setLoading(false)
            setPageError('Please log in to view your student dashboard.')
            return
        }

        setLoading(true)
        setPageError('')

        const results = await Promise.allSettled([
            apiRequest('/Profile', token),
            apiRequest('/JobApplications', token),
        ])

        if (results[0].status === 'fulfilled') {
            const data = results[0].value
            const profileData = data.user || data.profile || data

            setProfile((current) => ({
                ...current,
                ...profileData,
                fullName: profileData.fullName ?? current.fullName,
                email: profileData.email ?? current.email,
                phoneNumber: profileData.phoneNumber ?? current.phoneNumber,
                profilePictureUrl:
                    profileData.profilePictureUrl !== undefined
                        ? profileData.profilePictureUrl
                        : current.profilePictureUrl,
                resumeUrl:
                    profileData.resumeUrl !== undefined
                        ? profileData.resumeUrl
                        : current.resumeUrl,
                profileLastUpdatedAt:
                    profileData.profileLastUpdatedAt ?? current.profileLastUpdatedAt,
                resumeLastUpdatedAt:
                    profileData.resumeLastUpdatedAt ?? current.resumeLastUpdatedAt,
            }))
        } else {
            console.error('Profile loading failed:', results[0].reason)
            setPageError(results[0].reason.message || 'Unable to load your profile.')
        }

        if (results[1].status === 'fulfilled') {
            const data = results[1].value
            setApplications(Array.isArray(data) ? data : data.items || [])
        } else {
            console.error('Applications loading failed:', results[1].reason)
        }

        setLoading(false)
    }, [token])

    useEffect(() => {
        let cancelled = false
        const scheduleId = window.setTimeout(() => {
            if (!cancelled) void loadDashboard()
        }, 0)

        return () => {
            cancelled = true
            window.clearTimeout(scheduleId)
        }
    }, [loadDashboard])

    function handleProfileChange(event) {
        const { name, value } = event.target

        setProfile((current) => ({
            ...current,
            [name]: value,
        }))
    }

    async function saveProfile(event) {
        event.preventDefault()
        setSavingProfile(true)
        setProfileMessage('')

        try {
            const data = await apiRequest('/Profile', token, {
                method: 'PUT',
                body: JSON.stringify({
                    fullName: profile.fullName.trim(),
                    phoneNumber: (profile.phoneNumber || '').trim(),
                }),
            })

            const updated = data.user || data.profile || data

            setProfile((current) => ({
                ...current,
                ...updated,
                fullName: updated.fullName ?? current.fullName,
                phoneNumber: updated.phoneNumber ?? current.phoneNumber,
                profileLastUpdatedAt: updated.profileLastUpdatedAt ?? current.profileLastUpdatedAt,
                resumeLastUpdatedAt: updated.resumeLastUpdatedAt ?? current.resumeLastUpdatedAt,
            }))

            updateUser({
                fullName: updated.fullName ?? profile.fullName.trim(),
                phoneNumber: updated.phoneNumber ?? profile.phoneNumber.trim(),
                profilePictureUrl:
                    updated.profilePictureUrl ?? profile.profilePictureUrl,
                resumeUrl: updated.resumeUrl ?? profile.resumeUrl,
            })

            setProfileMessage('Profile updated successfully.')
        } catch (error) {
            setProfileMessage(error.message || 'Could not update your profile.')
        } finally {
            setSavingProfile(false)
        }
    }

    function uploadPicture(event) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
            setPictureMessage('Choose a JPG, PNG, or WebP image.')
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setPictureMessage('Your profile picture must be 2 MB or smaller.')
            return
        }

        setPictureMessage('')
        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setCropSource(reader.result)
                setCropFile(file)
            } else {
                setPictureMessage('Could not preview this image. Please choose another file.')
            }
        }
        reader.onerror = () => {
            setPictureMessage('Could not read this image. Please choose another file.')
        }
        reader.readAsDataURL(file)
    }

    async function uploadCroppedPicture(file) {
        setUploadingPicture(true)
        setPictureMessage('')

        try {
            const formData = new FormData()
            formData.append('file', file)
            const data = await apiRequest('/Profile/upload-picture', token, {
                method: 'POST',
                body: formData,
            })

            const pictureUrl = data.profilePictureUrl || data.url || data.pictureUrl
            if (!pictureUrl) {
                throw new Error('The server did not return a profile picture URL.')
            }

            setProfile((current) => ({
                ...current,
                profilePictureUrl: pictureUrl,
                profileLastUpdatedAt: data.profileLastUpdatedAt ?? new Date().toISOString(),
            }))
            updateUser({ profilePictureUrl: pictureUrl })
            setCropFile(null)
            setCropSource('')
            setPictureMessage('Profile picture cropped and uploaded successfully.')
        } catch (error) {
            setPictureMessage(error.message || 'Profile picture upload failed.')
        } finally {
            setUploadingPicture(false)
        }
    }

    function deleteProfilePicture() {
        if (!profile.profilePictureUrl || deletingPicture || uploadingPicture) return
        setConfirmDeleteType('picture')
    }

    async function confirmDashboardDelete() {
        if (!confirmDeleteType || confirmDeleteLoading) return

        const type = confirmDeleteType
        setConfirmDeleteLoading(true)

        if (type === 'picture') {
            setDeletingPicture(true)
            setPictureMessage('')

            try {
                const data = await apiRequest('/Profile/picture', token, {
                    method: 'DELETE',
                })

                setProfile((current) => ({
                    ...current,
                    profilePictureUrl: data.profilePictureUrl ?? null,
                    profileLastUpdatedAt: data.profileLastUpdatedAt ?? new Date().toISOString(),
                }))
                updateUser({ profilePictureUrl: data.profilePictureUrl ?? null })
                setPictureMessage('Profile picture deleted.')
                setConfirmDeleteType(null)
            } catch (error) {
                setPictureMessage(error.message || 'Profile picture could not be deleted.')
                setConfirmDeleteType(null)
            } finally {
                setDeletingPicture(false)
                setConfirmDeleteLoading(false)
            }

            return
        }

        if (type === 'resume') {
            setDeletingResume(true)
            setResumeMessage('')

            try {
                const data = await apiRequest('/Resume', token, {
                    method: 'DELETE',
                })

                setProfile((current) => ({
                    ...current,
                    resumeUrl: data.resumeUrl ?? null,
                    resumeLastUpdatedAt: data.resumeLastUpdatedAt ?? new Date().toISOString(),
                }))
                updateUser({ resumeUrl: data.resumeUrl ?? null })
                setResumeMessage('Resume deleted successfully.')
                setConfirmDeleteType(null)
            } catch (error) {
                setResumeMessage(error.message || 'Resume could not be deleted.')
                setConfirmDeleteType(null)
            } finally {
                setDeletingResume(false)
                setConfirmDeleteLoading(false)
            }
        }
    }

    async function uploadResume(event) {
        const file = event.target.files?.[0]
        event.target.value = ''

        if (!file) return

        const extension = file.name.split('.').pop()?.toLowerCase()
        const allowedExtensions = ['pdf', 'doc', 'docx']

        if (!allowedExtensions.includes(extension)) {
            setResumeMessage('Choose a PDF, DOC, or DOCX file.')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setResumeMessage('Your resume must be 5 MB or smaller.')
            return
        }

        setUploadingResume(true)
        setResumeMessage('')

        try {
            const formData = new FormData()
            formData.append('file', file)

            const data = await apiRequest('/Resume/upload', token, {
                method: 'POST',
                body: formData,
            })

            const resumeUrl =
                data.resumeUrl ||
                data.url ||
                data.fileUrl

            if (resumeUrl) {
                setProfile((current) => ({
                    ...current,
                    resumeUrl,
                    resumeLastUpdatedAt: data.resumeLastUpdatedAt ?? new Date().toISOString(),
                }))

                updateUser({ resumeUrl })
            } else {
                await loadDashboard()
            }

            setResumeMessage('Resume uploaded successfully.')
        } catch (error) {
            setResumeMessage(error.message || 'Resume upload failed.')
        } finally {
            setUploadingResume(false)
        }
    }

    function deleteResume() {
        if (!profile.resumeUrl || deletingResume || uploadingResume) return
        setConfirmDeleteType('resume')
    }

    const totalApplications = applications.length
    const pendingApplications = applications.filter((application) =>
        String(application.status || 'Pending').toLowerCase().includes('pending')
    ).length
    const shortlistedApplications = applications.filter((application) =>
        String(application.status || '').toLowerCase().includes('shortlist')
    ).length

    const firstName = profile.fullName.trim().split(/\s+/)[0] || 'there'

    return (
        <section className="student-dashboard" id="student-dashboard">
            <div className="student-dashboard-header">
                <div>
                    <p className="eyebrow">STUDENT WORKSPACE</p>
                    <h1>Welcome back, <span>{firstName}.</span></h1>
                    <p>Manage your profile, resume, and job applications in one place.</p>
                </div>

                <button
                    className="student-refresh-button"
                    type="button"
                    onClick={loadDashboard}
                    disabled={loading}
                >
                    {loading ? 'Refreshing…' : '↻ Refresh'}
                </button>
            </div>

            <div className="student-dashboard-layout">
                <aside className="student-sidebar">
                    <div className="student-sidebar-profile">
                        {profile.profilePictureUrl ? (
                            <img
                                className="student-avatar"
                                src={apiImageUrl(profile.profilePictureUrl)}
                                alt="Your profile"
                            />
                        ) : (
                            <div className="student-avatar student-avatar-placeholder">
                                {(profile.fullName || profile.email || 'S')
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>
                        )}

                        <strong>{profile.fullName || 'Student'}</strong>
                        <span>{profile.email || user?.email || ''}</span>
                        <span className="student-profile-last-updated">
                            Profile last updated - <strong>{formatProfileLastUpdated(profile.profileLastUpdatedAt || profile.createdAt)}</strong>
                        </span>
                    </div>

                    <nav className="student-dashboard-nav" aria-label="Student dashboard">
                        {tabs.map((tab) => (
                            <button
                                type="button"
                                key={tab.id}
                                className={activeTab === tab.id ? 'active' : ''}
                                onClick={() => {
                                    setActiveTab(tab.id)
                                    setProfileMessage('')
                                    setResumeMessage('')
                                    setPictureMessage('')
                                }}
                            >
                                <span aria-hidden="true">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    {activeTab === 'profile' && (
                        <div className="student-profile-section-nav">
                            <p>PROFILE SECTIONS</p>
                            <nav aria-label="Candidate profile sections">
                                {profileSectionLinks.map((section) => (
                                    <button
                                        type="button"
                                        key={section.id}
                                        onClick={() => {
                                            setActiveTab('profile')
                                            document.getElementById(section.id)?.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'start',
                                            })
                                        }}
                                    >
                                        <span aria-hidden="true">{section.icon}</span>
                                        {section.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    )}
                </aside>

                <div className="student-dashboard-content">
                    {pageError && (
                        <div className="student-notice student-notice-error" role="alert">
                            {pageError}
                        </div>
                    )}

                    {loading && (
                        <div className="student-loading">
                            <span className="loading-spinner" />
                            <p>Loading your dashboard…</p>
                        </div>
                    )}

                    {!loading && activeTab === 'overview' && (
                        <div className="student-tab-content">
                            <div className="student-section-heading">
                                <div>
                                    <h2>Your overview</h2>
                                    <p>Here's where things stand with your job search.</p>
                                </div>
                            </div>

                            <div className="student-stats-grid">
                                <article className="student-stat-card">
                                    <span className="student-stat-icon">▣</span>
                                    <span>Total applications</span>
                                    <strong>{totalApplications}</strong>
                                </article>

                                <article className="student-stat-card">
                                    <span className="student-stat-icon">◷</span>
                                    <span>Pending applications</span>
                                    <strong>{pendingApplications}</strong>
                                </article>

                                <article className="student-stat-card">
                                    <span className="student-stat-icon">✦</span>
                                    <span>Shortlisted</span>
                                    <strong>{shortlistedApplications}</strong>
                                </article>
                            </div>

                            <div className="student-panel">
                                <div className="student-section-heading">
                                    <div>
                                        <h3>Recent applications</h3>
                                        <p>Keep track of your latest submissions.</p>
                                    </div>

                                    <button
                                        className="student-text-button"
                                        type="button"
                                        onClick={() => setActiveTab('applications')}
                                    >
                                        View all →
                                    </button>
                                </div>

                                {applications.length === 0 ? (
                                    <div className="student-empty-state">
                                        <span>▤</span>
                                        <h3>No applications yet</h3>
                                        <p>Explore open jobs and submit your first application.</p>
                                    </div>
                                ) : (
                                    <div className="student-application-list">
                                        {applications.slice(0, 4).map((application) => (
                                            <article
                                                className="student-application-row"
                                                key={application.id}
                                            >
                                                <div className="student-application-main">
                                                    <strong>
                                                        {application.job?.title ||
                                                            application.jobTitle ||
                                                            `Application #${application.id}`}
                                                    </strong>
                                                    <span>
                                                        {application.job?.company ||
                                                            application.company ||
                                                            'Company'}
                                                        {' · '}
                                                        Applied {formatDate(application.appliedAt)}
                                                    </span>
                                                </div>

                                                <span
                                                    className={`student-status ${getStatusClass(application.status)}`}
                                                >
                                                    {application.status || 'Pending'}
                                                </span>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="student-quick-actions">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('profile')}
                                >
                                    <span>♙</span>
                                    <strong>Complete your profile</strong>
                                    <small>Keep your contact details up to date.</small>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('resume')}
                                >
                                    <span>▤</span>
                                    <strong>Update your resume</strong>
                                    <small>Keep your latest resume ready to use.</small>
                                </button>
                            </div>
                        </div>
                    )}

                    {!loading && activeTab === 'profile' && (
                        <div className="student-tab-content">
                            <div className="student-section-heading">
                                <div>
                                    <h2>My profile</h2>
                                    <p>Keep your personal and contact details up to date.</p>
                                </div>
                            </div>

                            <form className="student-panel student-profile-form" onSubmit={saveProfile}>
                                <div className="student-picture-editor">
                                    {profile.profilePictureUrl ? (
                                        <img
                                            className="student-avatar student-avatar-large"
                                            src={apiImageUrl(profile.profilePictureUrl)}
                                            alt="Your profile"
                                        />
                                    ) : (
                                        <div className="student-avatar student-avatar-large student-avatar-placeholder">
                                            {(profile.fullName || 'S')
                                                .trim()
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                    )}

                                    <div>
                                        <strong>Profile picture</strong>
                                        <p>JPG, PNG, or WebP. Maximum size 2 MB.</p>
                                        <div className="student-upload-actions">
                                            <label className="student-upload-button">
                                                {uploadingPicture ? 'Uploading…' : 'Change picture'}
                                                <input
                                                    type="file"
                                                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                                    onChange={uploadPicture}
                                                    disabled={uploadingPicture || deletingPicture}
                                                />
                                            </label>
                                            {profile.profilePictureUrl && (
                                                <button
                                                    type="button"
                                                    className="student-delete-button"
                                                    onClick={deleteProfilePicture}
                                                    disabled={deletingPicture || uploadingPicture}
                                                >
                                                    {deletingPicture ? 'Deleting…' : 'Delete photo'}
                                                </button>
                                            )}
                                        </div>
                                        {pictureMessage && (
                                            <p className="student-form-message" role="status">
                                                {pictureMessage}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="student-form-grid">
                                    <label>
                                        Full name
                                        <input
                                            name="fullName"
                                            value={profile.fullName}
                                            onChange={handleProfileChange}
                                            maxLength={100}
                                            required
                                        />
                                    </label>

                                    <label>
                                        Email address
                                        <input
                                            type="email"
                                            value={profile.email}
                                            readOnly
                                            disabled
                                        />
                                        <small>Your account email cannot be changed here.</small>
                                    </label>

                                    <label>
                                        Phone number
                                        <input
                                            name="phoneNumber"
                                            type="tel"
                                            value={profile.phoneNumber || ''}
                                            onChange={handleProfileChange}
                                            maxLength={20}
                                            placeholder="Enter your phone number"
                                        />
                                    </label>
                                </div>

                                {profileMessage && (
                                    <p
                                        className={`student-form-message ${profileMessage.includes('successfully')
                                            ? 'is-success'
                                            : 'is-error'
                                            }`}
                                        role="status"
                                    >
                                        {profileMessage}
                                    </p>
                                )}

                                <button
                                    className="button-primary student-save-button"
                                    type="submit"
                                    disabled={savingProfile}
                                >
                                    {savingProfile ? 'Saving…' : 'Save changes →'}
                                </button>
                            </form>

                            <CandidateProfileSections token={token} onProfileUpdated={loadDashboard} />
                        </div>
                    )}

                    {!loading && activeTab === 'resume' && (
                        <div className="student-tab-content">
                            <div className="student-section-heading">
                                <div>
                                    <h2>My resume</h2>
                                    <p>Upload the resume you want to use when applying for jobs.</p>
                                </div>
                            </div>

                            <div className="student-panel student-resume-panel">
                                <div className="student-resume-icon">▤</div>
                                <div className="student-resume-info">
                                    <h3>{profile.resumeUrl ? 'Resume uploaded' : 'No resume uploaded yet'}</h3>
                                    <p>
                                        {profile.resumeUrl
                                            ? getFileName(profile.resumeUrl) || 'Your resume is saved.'
                                            : 'Upload a PDF, DOC, or DOCX file, up to 5 MB.'}
                                    </p>
                                    {profile.resumeUrl && (
                                        <p className="student-resume-last-updated">
                                            Resume last updated - <strong>{formatProfileLastUpdated(profile.resumeLastUpdatedAt || profile.createdAt)}</strong>
                                        </p>
                                    )}
                                    {profile.resumeUrl && (
                                        <div className="student-resume-actions">
                                            <span className="student-resume-ready">
                                                ✓ Resume available
                                            </span>
                                            <button
                                                type="button"
                                                className="student-delete-button"
                                                onClick={deleteResume}
                                                disabled={deletingResume || uploadingResume}
                                            >
                                                {deletingResume ? 'Deleting…' : 'Delete resume'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="student-panel student-upload-panel">
                                <div className="student-upload-dropzone">
                                    <span className="student-upload-symbol">↑</span>
                                    <h3>{uploadingResume ? 'Uploading resume…' : 'Upload your resume'}</h3>
                                    <p>Accepted formats: PDF, DOC, DOCX · Maximum 5 MB</p>

                                    <label className="button-primary student-resume-upload-button">
                                        {uploadingResume ? 'Uploading…' : 'Choose file'}
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                            onChange={uploadResume}
                                            disabled={uploadingResume}
                                        />
                                    </label>
                                </div>

                                {resumeMessage && (
                                    <p
                                        className={`student-form-message ${resumeMessage.includes('successfully')
                                            ? 'is-success'
                                            : 'is-error'
                                            }`}
                                        role="status"
                                    >
                                        {resumeMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {!loading && activeTab === 'applications' && (
                        <div className="student-tab-content">
                            <div className="student-section-heading">
                                <div>
                                    <h2>My applications</h2>
                                    <p>Track your applications and their latest statuses.</p>
                                </div>
                                <span className="student-application-count">
                                    {totalApplications} total
                                </span>
                            </div>

                            <div className="student-panel">
                                {applications.length === 0 ? (
                                    <div className="student-empty-state">
                                        <span>▤</span>
                                        <h3>No applications yet</h3>
                                        <p>Your submitted job applications will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="student-application-list">
                                        {applications.map((application) => (
                                            <article
                                                className="student-application-row"
                                                key={application.id}
                                            >
                                                <div className="student-application-main">
                                                    <strong>
                                                        {application.job?.title ||
                                                            application.jobTitle ||
                                                            `Application #${application.id}`}
                                                    </strong>
                                                    <span>
                                                        {application.job?.company ||
                                                            application.company ||
                                                            'Company'}
                                                    </span>
                                                    <small>
                                                        Applied on {formatDate(application.appliedAt)}
                                                    </small>
                                                </div>

                                                <span
                                                    className={`student-status ${getStatusClass(application.status)}`}
                                                >
                                                    {application.status || 'Pending'}
                                                </span>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <p className="student-status-help">
                                Application statuses are updated when the employer reviews your application.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {cropFile && (
                <CropModal
                    file={cropFile}
                    source={cropSource}
                    onCancel={() => {
                        if (!uploadingPicture) {
                            setCropFile(null)
                            setCropSource('')
                        }
                    }}
                    onSave={uploadCroppedPicture}
                    saving={uploadingPicture}
                />
            )}

            <ConfirmDialog
                open={confirmDeleteType !== null}
                title={confirmDeleteType === 'picture' ? 'Delete profile picture?' : 'Delete uploaded resume?'}
                message={confirmDeleteType === 'picture'
                    ? 'Your profile picture will be removed. This action cannot be undone.'
                    : 'Your uploaded resume will be removed. This action cannot be undone.'}
                confirmText="Delete"
                cancelText="Cancel"
                danger
                loading={confirmDeleteLoading}
                onConfirm={confirmDashboardDelete}
                onCancel={() => {
                    if (!confirmDeleteLoading) setConfirmDeleteType(null)
                }}
            />
        </section>
    )
}
