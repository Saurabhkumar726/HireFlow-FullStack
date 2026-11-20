import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSavedJobs } from '../context/useSavedJobs'
import './JobCollectionPicker.css'

export default function JobCollectionPicker({ jobId, isSaved }) {
    const { collections, savedItems, createCollection, addJobToCollection, removeJobFromCollection } = useSavedJobs()
    const [open, setOpen] = useState(false)
    const [busyId, setBusyId] = useState('')
    const [newName, setNewName] = useState('')
    const [error, setError] = useState('')

    const savedItem = useMemo(() => savedItems.find(item => String(item.jobId) === String(jobId)), [savedItems, jobId])
    const selectedIds = useMemo(() => new Set((savedItem?.collections || []).map(item => Number(item.id))), [savedItem])

    async function handleToggle(collection) {
        setBusyId(String(collection.id))
        setError('')
        try {
            if (selectedIds.has(Number(collection.id))) await removeJobFromCollection(collection.id, jobId)
            else await addJobToCollection(collection.id, jobId)
        } catch (requestError) {
            setError(requestError.message || 'Unable to update this collection.')
        } finally {
            setBusyId('')
        }
    }

    async function handleCreate(event) {
        event.preventDefault()
        if (!newName.trim()) return
        setBusyId('new')
        setError('')
        try {
            const created = await createCollection(newName.trim())
            await addJobToCollection(created.id, jobId)
            setNewName('')
        } catch (requestError) {
            setError(requestError.message || 'Unable to create this collection.')
        } finally {
            setBusyId('')
        }
    }

    return (
        <div className="hf-collection-picker-wrap">
            <button
                type="button"
                className="hf-collection-picker-trigger"
                disabled={!isSaved}
                title={isSaved ? 'Organize in collections' : 'Save this job first to organize it'}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label="Organize saved job in collections"
                onClick={() => setOpen(value => !value)}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
            </button>
            {open && <div className="hf-collection-picker-panel" role="dialog" aria-label="Job collections">
                <div className="hf-collection-picker-heading"><strong>Add to collections</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close collection menu">×</button></div>
                {collections.length ? collections.map(collection => <label className="hf-collection-picker-row" key={collection.id}><input type="checkbox" checked={selectedIds.has(Number(collection.id))} disabled={Boolean(busyId)} onChange={() => handleToggle(collection)} /><span>{collection.name}</span><small>{collection.jobCount}</small></label>) : <p className="hf-collection-picker-empty">Create a custom collection to organize this job.</p>}
                <form className="hf-collection-picker-create" onSubmit={handleCreate}><input value={newName} onChange={event => setNewName(event.target.value)} maxLength={40} minLength={2} placeholder="New collection name" aria-label="New collection name" /><button type="submit" disabled={Boolean(busyId) || newName.trim().length < 2}>{busyId === 'new' ? 'Saving…' : '+'}</button></form>
                {error && <p className="hf-collection-picker-error" role="alert">{error}</p>}
                <Link to="/candidate/collections" onClick={() => setOpen(false)}>Manage all collections ↗</Link>
            </div>}
        </div>
    )
}
