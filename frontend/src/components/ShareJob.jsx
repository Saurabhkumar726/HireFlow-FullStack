import { useState } from 'react'
import './ShareJob.css'

function ShareJob({ job }) {
    const [message, setMessage] = useState('')

    async function handleShare() {
        if (job?.id == null) {
            setMessage('Job link is unavailable.')
            window.setTimeout(() => setMessage(''), 2500)
            return
        }

        const title = job.title || 'Job opportunity'
        const company = job.company || 'HireFlow'
        const url = new URL(
            `/jobs/${encodeURIComponent(job.id)}`,
            window.location.origin
        ).toString()
        const text = `${title} at ${company} — found on HireFlow.`

        try {
            if (navigator.share) {
                await navigator.share({ title, text, url })
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(`${text}\n${url}`)
                setMessage('Job link copied!')
            } else {
                throw new Error('Sharing is not supported.')
            }
        } catch (error) {
            if (error?.name === 'AbortError') return

            try {
                if (!navigator.clipboard?.writeText) throw error
                await navigator.clipboard.writeText(`${text}\n${url}`)
                setMessage('Job link copied!')
            } catch {
                setMessage('Unable to share. Please try again.')
            }
        }

        window.setTimeout(() => setMessage(''), 2500)
    }

    return (
        <div className="share-job-wrapper">
            <button
                type="button"
                className="share-job-button"
                onClick={handleShare}
                aria-label={`Share ${job?.title || 'job'}`}
                title="Share job"
            >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="m8.7 10.7 6.6-4.1M8.7 13.3l6.6 4.1" />
                </svg>
            </button>
            {message && <span className="share-job-message" role="status">{message}</span>}
        </div>
    )
}

export default ShareJob
