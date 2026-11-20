import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSavedJobs } from '../context/useSavedJobs'
import './SavedJobCollectionsPage.css'
import SkeletonLoader from '../components/SkeletonLoader.jsx'

function SavedJobCollectionsPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const {
        savedItems,
        collections,
        loadingSavedJobs,
        createCollection,
        renameCollection,
        deleteCollection,
        getCollection,
        addJobToCollection,
        removeJobFromCollection,
        toggleSaved,
        refreshSavedJobs,
    } = useSavedJobs()

    const requestedJobId = new URLSearchParams(location.search).get('job')
    const [activeCollectionId, setActiveCollectionId] = useState('all')
    const [activeCollection, setActiveCollection] = useState(null)
    const [collectionLoading, setCollectionLoading] = useState(false)
    const [collectionError, setCollectionError] = useState('')
    const [name, setName] = useState('')
    const [editName, setEditName] = useState('')
    const [notice, setNotice] = useState('')
    const [busy, setBusy] = useState(false)
    const [confirmAction, setConfirmAction] = useState(null)
    const confirmCancelRef = useRef(null)
    const confirmButtonRef = useRef(null)
    const busyRef = useRef(busy)

    useEffect(() => {
        busyRef.current = busy
    }, [busy])

    const allItems = useMemo(() => savedItems, [savedItems])
    const activeItems = activeCollectionId === 'all'
        ? allItems
        : (activeCollection?.jobs || []).map(item => ({
            jobId: item.jobId,
            job: item.job,
            isAvailable: item.isAvailable,
            unavailableReason: item.unavailableReason,
        }))

    useEffect(() => {
        if (!confirmAction) return undefined

        const previousOverflow = document.body.style.overflow
        const previouslyFocused = document.activeElement
        document.body.style.overflow = 'hidden'

        function handleDialogKeyDown(event) {
            if (event.key === 'Escape' && !busyRef.current) {
                event.preventDefault()
                setConfirmAction(null)
                return
            }

            if (event.key === 'Tab') {
                const first = confirmCancelRef.current
                const last = confirmButtonRef.current
                if (!first || !last) return

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first.focus()
                }
            }
        }

        document.addEventListener('keydown', handleDialogKeyDown)
        confirmCancelRef.current?.focus()

        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', handleDialogKeyDown)
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus()
            }
        }
    }, [confirmAction])

    useEffect(() => {
        if (activeCollectionId === 'all') return undefined

        let active = true
        Promise.resolve().then(async () => {
            if (!active) return
            setCollectionLoading(true)
            setCollectionError('')
            try {
                const data = await getCollection(activeCollectionId)
                if (active) setActiveCollection(data)
            } catch (error) {
                if (active) setCollectionError(error.message || 'Could not load this collection.')
            } finally {
                if (active) setCollectionLoading(false)
            }
        })
        return () => { active = false }
    }, [activeCollectionId, getCollection])

    const requestedJobIsSaved = requestedJobId && savedItems.some(item => String(item.jobId) === String(requestedJobId))

    async function handleCreate(event) {
        event.preventDefault()
        const value = name.trim()
        if (!value) return
        setBusy(true)
        setNotice('')
        try {
            const created = await createCollection(value)
            setName('')
            setActiveCollectionId(String(created.id))
            if (requestedJobId) {
                await addJobToCollection(created.id, Number(requestedJobId))
                setNotice('Collection created and job added.')
            } else {
                setNotice('Collection created.')
            }
        } catch (error) {
            setNotice(error.message || 'Unable to create this collection.')
        } finally {
            setBusy(false)
        }
    }

    async function handleRename(event) {
        event.preventDefault()
        if (!activeCollectionId || activeCollectionId === 'all' || !editName.trim()) return
        setBusy(true)
        try {
            await renameCollection(activeCollectionId, editName.trim())
            const updated = await getCollection(activeCollectionId)
            setActiveCollection(updated)
            setNotice('Collection renamed.')
        } catch (error) {
            setNotice(error.message || 'Unable to rename this collection.')
        } finally {
            setBusy(false)
        }
    }

    function handleDeleteCollection() {
        if (activeCollectionId === 'all' || busy) return
        const target = collections.find(item => String(item.id) === String(activeCollectionId))
        const collectionName = target?.name || activeCollection?.name || 'this collection'

        setConfirmAction({
            type: 'delete-collection',
            collectionId: activeCollectionId,
            title: 'Delete this collection?',
            message: `Are you sure you want to delete “${collectionName}”? Saved jobs will remain in All Saved Jobs.`,
            confirmLabel: 'Delete collection',
        })
    }

    async function handleAddRequestedJob(collectionId) {
        if (!requestedJobId) return
        setBusy(true)
        try {
            const isSaved = savedItems.some(item => String(item.jobId) === String(requestedJobId))
            if (!isSaved) await toggleSaved(Number(requestedJobId))
            await addJobToCollection(collectionId, Number(requestedJobId))
            await refreshSavedJobs()
            setNotice('Job added to the selected collection.')
        } catch (error) {
            setNotice(error.message || 'Unable to add this job to the collection.')
        } finally {
            setBusy(false)
        }
    }

    function handleRemove(jobId) {
        if (activeCollectionId === 'all' || busy) return

        setConfirmAction({
            type: 'remove-job',
            collectionId: activeCollectionId,
            jobId,
            title: 'Remove this saved job?',
            message: 'This job will be removed from this collection only. It will remain in All Saved Jobs.',
            confirmLabel: 'Remove job',
        })
    }

    async function confirmPendingAction() {
        if (!confirmAction || busy) return

        const action = confirmAction
        setBusy(true)
        setNotice('')

        try {
            if (action.type === 'delete-collection') {
                await deleteCollection(action.collectionId)
                setActiveCollection(null)
                setActiveCollectionId('all')
                setEditName('')
                setNotice('Collection deleted. Your saved jobs were kept.')
            } else if (action.type === 'remove-job') {
                await removeJobFromCollection(action.collectionId, action.jobId)
                setActiveCollection(await getCollection(action.collectionId))
                setNotice('Job removed from this collection only.')
            }
        } catch (error) {
            const fallback = action.type === 'delete-collection'
                ? 'Unable to delete this collection.'
                : 'Unable to remove this job from the collection.'
            setNotice(error.message || fallback)
        } finally {
            setBusy(false)
            setConfirmAction(null)
        }
    }

    return (
        <main className="hf-collections-page">
            <div className="hf-collections-shell">
                <button type="button" className="hf-collections-back" onClick={() => navigate('/saved-jobs')}>← Back to saved jobs</button>
                <header className="hf-collections-heading">
                    <span className="hf-collections-eyebrow">YOUR JOB ORGANIZER</span>
                    <h1>Saved job <em>collections.</em></h1>
                    <p>Create private collections to organize roles you want to revisit. One saved job can belong to multiple collections.</p>
                </header>

                {notice && <div className="hf-collections-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
                {collectionError && <div className="hf-collections-error" role="alert">{collectionError}</div>}

                <div className="hf-collections-layout">
                    <aside className="hf-collections-sidebar">
                        <span className="hf-collections-sidebar-title">COLLECTIONS</span>
                        <button type="button" className={`hf-collection-nav-item ${activeCollectionId === 'all' ? 'active' : ''}`} onClick={() => { setActiveCollection(null); setActiveCollectionId('all') }}><span>▦</span><span>All Saved Jobs</span><b>{savedItems.length}</b></button>
                        {collections.map(collection => <button type="button" key={collection.id} className={`hf-collection-nav-item ${String(activeCollectionId) === String(collection.id) ? 'active' : ''}`} onClick={() => { setActiveCollection(null); setActiveCollectionId(String(collection.id)); setEditName(collection.name) }}><span>▱</span><span>{collection.name}</span><b>{collection.jobCount}</b></button>)}
                        <form className="hf-create-collection-form" onSubmit={handleCreate}><label htmlFor="new-collection-name">Create a collection</label><input id="new-collection-name" value={name} onChange={event => setName(event.target.value)} maxLength={40} minLength={2} placeholder="e.g. Remote .NET roles" required /><button type="submit" disabled={busy || name.trim().length < 2}>+ Create collection</button></form>
                    </aside>

                    <section className="hf-collection-content">
                        <div className="hf-collection-content-heading"><div><span className="hf-collections-eyebrow">{activeCollectionId === 'all' ? 'EVERY BOOKMARK' : 'CUSTOM COLLECTION'}</span><h2>{activeCollectionId === 'all' ? 'All Saved Jobs' : activeCollection?.name || collections.find(item => String(item.id) === String(activeCollectionId))?.name || 'Collection'}</h2><p>{activeCollectionId === 'all' ? 'All jobs saved to your HireFlow account.' : 'Organize and revisit the opportunities in this collection.'}</p></div>{activeCollectionId !== 'all' && <div className="hf-collection-tools"><form onSubmit={handleRename}><input value={editName} onChange={event => setEditName(event.target.value)} aria-label="Rename collection" maxLength={40} /><button type="submit" disabled={busy || editName.trim().length < 2}>Rename</button></form><button type="button" className="danger" onClick={handleDeleteCollection} disabled={busy}>Delete collection</button></div>}</div>

                        {requestedJobId && <div className="hf-collection-add-callout"><strong>Organize a saved job</strong><p>{requestedJobIsSaved ? 'Add the selected job to a collection. It can belong to more than one.' : 'This job is not saved yet. Save it first, or add it to a collection below.'}</p><div>{collections.map(collection => <button type="button" key={collection.id} disabled={busy} onClick={() => handleAddRequestedJob(collection.id)}>+ {collection.name}</button>)}</div></div>}

                        {loadingSavedJobs || collectionLoading ? <SkeletonLoader variant="collections" count={4} /> : activeItems.length ? <div className="hf-collection-job-list">{activeItems.map(item => <article key={item.jobId}><div className="hf-collection-job-brand">{String(item.job?.company || 'H').trim().slice(0, 1).toUpperCase()}</div><div className="hf-collection-job-copy"><strong>{item.job?.title || 'Job opportunity'}</strong><span>{item.job?.company || 'Company'} · {item.job?.location || 'Location not specified'}</span>{!item.isAvailable && <em>{item.unavailableReason || 'Unavailable'}</em>}</div><button type="button" onClick={() => navigate(`/jobs/${item.jobId}`)}>View job ↗</button>{activeCollectionId !== 'all' && <button type="button" className="hf-collection-remove" disabled={busy} onClick={() => handleRemove(item.jobId)}>Remove from collection</button>}</article>)}</div> : <div className="hf-collections-empty"><span>▱</span><strong>{activeCollectionId === 'all' ? 'No saved jobs yet' : 'This collection is empty'}</strong><p>Save a job from the discovery feed, then organize it here.</p><button type="button" onClick={() => navigate('/jobs')}>Explore jobs →</button></div>}
                    </section>
                </div>
            </div>

            {confirmAction && (
                <div
                    className="hf-collections-confirm-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !busy) {
                            setConfirmAction(null)
                        }
                    }}
                >
                    <section
                        className="hf-collections-confirm-dialog"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="hf-collections-confirm-title"
                        aria-describedby="hf-collections-confirm-message"
                    >
                        <div className="hf-collections-confirm-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M4 7h16M9 7V4.8h6V7m-9 0 1 13h10l1-13M10 11v5m4-5v5" />
                            </svg>
                        </div>
                        <span className="hf-collections-confirm-eyebrow">CONFIRM ACTION</span>
                        <h2 id="hf-collections-confirm-title">{confirmAction.title}</h2>
                        <p id="hf-collections-confirm-message">{confirmAction.message}</p>
                        <div className="hf-collections-confirm-actions">
                            <button
                                ref={confirmCancelRef}
                                type="button"
                                className="hf-collections-confirm-cancel"
                                onClick={() => setConfirmAction(null)}
                                disabled={busy}
                            >
                                Cancel
                            </button>
                            <button
                                ref={confirmButtonRef}
                                type="button"
                                className="hf-collections-confirm-delete"
                                onClick={confirmPendingAction}
                                disabled={busy}
                            >
                                {busy ? 'Working…' : confirmAction.confirmLabel}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    )
}

export default SavedJobCollectionsPage
