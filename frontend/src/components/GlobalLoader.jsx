import { useEffect, useState } from 'react'
import './GlobalLoader.css'
import {
    HIRE_FLOW_GLOBAL_FETCH_EVENT,
    HIRE_FLOW_GLOBAL_FETCH_STATE_KEY,
} from '../utils/globalFetchTracker.js'

const DEFAULT_MESSAGE = 'Loading your workspace...'

export default function GlobalLoader() {
    const [visible, setVisible] = useState(false)
    const [message, setMessage] = useState(DEFAULT_MESSAGE)

    useEffect(() => {
        let showTimer = null
        let hideTimer = null
        let shownAt = 0
        let isVisible = false

        const clearShowTimer = () => {
            if (showTimer !== null) {
                window.clearTimeout(showTimer)
                showTimer = null
            }
        }

        const clearHideTimer = () => {
            if (hideTimer !== null) {
                window.clearTimeout(hideTimer)
                hideTimer = null
            }
        }

        const handleFetchState = event => {
            const state = event?.detail || window[HIRE_FLOW_GLOBAL_FETCH_STATE_KEY] || {}
            const pendingCount = Number(state.pendingCount || 0)

            if (pendingCount > 0) {
                clearHideTimer()
                setMessage(state.message || DEFAULT_MESSAGE)

                if (isVisible) return

                if (showTimer === null) {
                    // A short delay avoids flashing for very fast sign-in requests.
                    showTimer = window.setTimeout(() => {
                        showTimer = null
                        isVisible = true
                        shownAt = Date.now()
                        setVisible(true)
                    }, 70)
                }

                return
            }

            clearShowTimer()

            if (isVisible) {
                const minimumVisibleMs = 520
                const remaining = Math.max(0, minimumVisibleMs - (Date.now() - shownAt))

                clearHideTimer()
                hideTimer = window.setTimeout(() => {
                    hideTimer = null
                    isVisible = false
                    setVisible(false)
                    setMessage(DEFAULT_MESSAGE)
                }, remaining)
            }
        }

        window.addEventListener(HIRE_FLOW_GLOBAL_FETCH_EVENT, handleFetchState)

        handleFetchState({
            detail: window[HIRE_FLOW_GLOBAL_FETCH_STATE_KEY] || {
                pendingCount: 0,
                hasAuthRequest: false,
                message: '',
            },
        })

        return () => {
            window.removeEventListener(HIRE_FLOW_GLOBAL_FETCH_EVENT, handleFetchState)
            clearShowTimer()
            clearHideTimer()
        }
    }, [])

    if (!visible) return null

    return (
        <div
            className="hf-global-loader"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={message}
        >
            <div className="hf-global-loader__card">
                <span className="hf-global-loader__spinner" aria-hidden="true" />
                <div className="hf-global-loader__copy">
                    <strong>HireFlow</strong>
                    <span>{message}</span>
                </div>
            </div>
        </div>
    )
}
