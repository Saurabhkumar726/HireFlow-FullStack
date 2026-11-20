import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { SavedJobsContext } from './saved-jobs-context'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

async function apiRequest(path, token, options = {}) {
    const headers = {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
    }

    const response = await fetch(`${API_URL}${path}`, { ...options, headers })
    if (response.status === 204) return null

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(payload.message || payload.title || `Request failed (${response.status}).`)
    }
    return payload
}

function SavedJobsProvider({ children }) {
    const { token, user, isAuthenticated } = useAuth()
    const isStudent = isAuthenticated && String(user?.role || '').toLowerCase() === 'student'
    const [savedItems, setSavedItems] = useState([])
    const [collections, setCollections] = useState([])
    const [loadingSavedJobs, setLoadingSavedJobs] = useState(false)
    const [savedJobsError, setSavedJobsError] = useState('')

    const refreshSavedJobs = useCallback(async () => {
        if (!isStudent || !token) {
            setSavedItems([])
            return []
        }

        setLoadingSavedJobs(true)
        setSavedJobsError('')
        try {
            const data = await apiRequest('/SavedJobs', token)
            const items = Array.isArray(data) ? data : []
            setSavedItems(items)
            return items
        } catch (error) {
            setSavedJobsError(error.message || 'Unable to load your saved jobs.')
            throw error
        } finally {
            setLoadingSavedJobs(false)
        }
    }, [isStudent, token])

    const refreshCollections = useCallback(async () => {
        if (!isStudent || !token) {
            setCollections([])
            return []
        }
        const data = await apiRequest('/SavedJobs/collections', token)
        const items = Array.isArray(data) ? data : []
        setCollections(items)
        return items
    }, [isStudent, token])

    useEffect(() => {
        if (!isStudent || !token) {
            let active = true
            Promise.resolve().then(() => {
                if (!active) return
                setSavedItems([])
                setCollections([])
                setSavedJobsError('')
                setLoadingSavedJobs(false)
            })
            return () => { active = false }
        }

        let active = true
        Promise.resolve().then(async () => {
            if (!active) return
            setLoadingSavedJobs(true)
            setSavedJobsError('')
            try {
                const [saved, customCollections] = await Promise.all([
                    apiRequest('/SavedJobs', token),
                    apiRequest('/SavedJobs/collections', token),
                ])
                if (!active) return
                setSavedItems(Array.isArray(saved) ? saved : [])
                setCollections(Array.isArray(customCollections) ? customCollections : [])
            } catch (error) {
                if (active) setSavedJobsError(error.message || 'Unable to load saved jobs from your account.')
            } finally {
                if (active) setLoadingSavedJobs(false)
            }
        })

        return () => { active = false }
    }, [isStudent, token])

    const savedJobs = useMemo(() => savedItems.map(item => item.jobId), [savedItems])

    const toggleSaved = useCallback(async (jobId) => {
        if (!isStudent || !token) throw new Error('Sign in with a Student account to save jobs.')
        const alreadySaved = savedItems.some(item => String(item.jobId) === String(jobId))
        if (alreadySaved) {
            await apiRequest(`/SavedJobs/${encodeURIComponent(jobId)}`, token, { method: 'DELETE' })
        } else {
            await apiRequest('/SavedJobs', token, {
                method: 'POST',
                body: JSON.stringify({ jobId: Number(jobId) }),
            })
        }
        await Promise.all([refreshSavedJobs(), refreshCollections()])
        return !alreadySaved
    }, [isStudent, token, savedItems, refreshSavedJobs, refreshCollections])

    const createCollection = useCallback(async (name) => {
        if (!isStudent || !token) throw new Error('Sign in with a Student account to create collections.')
        const result = await apiRequest('/SavedJobs/collections', token, {
            method: 'POST',
            body: JSON.stringify({ name }),
        })
        await refreshCollections()
        return result
    }, [isStudent, token, refreshCollections])

    const renameCollection = useCallback(async (collectionId, name) => {
        if (!isStudent || !token) throw new Error('Student sign-in is required.')
        const result = await apiRequest(`/SavedJobs/collections/${collectionId}`, token, {
            method: 'PUT',
            body: JSON.stringify({ name }),
        })
        await refreshCollections()
        return result
    }, [isStudent, token, refreshCollections])

    const deleteCollection = useCallback(async (collectionId) => {
        if (!isStudent || !token) throw new Error('Student sign-in is required.')
        await apiRequest(`/SavedJobs/collections/${collectionId}`, token, { method: 'DELETE' })
        await refreshCollections()
    }, [isStudent, token, refreshCollections])

    const getCollection = useCallback(async (collectionId) => {
        if (!isStudent || !token) throw new Error('Student sign-in is required.')
        return apiRequest(`/SavedJobs/collections/${collectionId}`, token)
    }, [isStudent, token])

    const addJobToCollection = useCallback(async (collectionId, jobId) => {
        if (!isStudent || !token) throw new Error('Student sign-in is required.')
        await apiRequest(`/SavedJobs/collections/${collectionId}/jobs/${jobId}`, token, { method: 'POST' })
        await Promise.all([refreshCollections(), refreshSavedJobs()])
    }, [isStudent, token, refreshCollections, refreshSavedJobs])

    const removeJobFromCollection = useCallback(async (collectionId, jobId) => {
        if (!isStudent || !token) throw new Error('Student sign-in is required.')
        await apiRequest(`/SavedJobs/collections/${collectionId}/jobs/${jobId}`, token, { method: 'DELETE' })
        await Promise.all([refreshCollections(), refreshSavedJobs()])
    }, [isStudent, token, refreshCollections, refreshSavedJobs])

    const value = {
        savedItems,
        savedJobs,
        collections,
        loadingSavedJobs,
        savedJobsError,
        refreshSavedJobs,
        refreshCollections,
        toggleSaved,
        createCollection,
        renameCollection,
        deleteCollection,
        getCollection,
        addJobToCollection,
        removeJobFromCollection,
    }

    return <SavedJobsContext.Provider value={value}>{children}</SavedJobsContext.Provider>
}


export default SavedJobsProvider
