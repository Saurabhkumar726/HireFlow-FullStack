const TRACKER_FLAG = '__hireFlowGlobalFetchTrackerInstalled'
const STATE_KEY = '__hireFlowGlobalFetchState'
const EVENT_NAME = 'hireflow:global-fetch-state'
const MANUAL_BEGIN_KEY = '__hireFlowBeginGlobalLoading'

function getRequestDetails(input, init) {
    const requestUrl =
        typeof Request !== 'undefined' && input instanceof Request
            ? input.url
            : input instanceof URL
                ? input.toString()
                : String(input)

    const requestMethod = String(
        init?.method ||
        (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET') ||
        'GET'
    ).toUpperCase()

    let url
    try {
        url = new URL(requestUrl, window.location.href)
    } catch {
        return null
    }

    return { url, method: requestMethod }
}

function getAuthRequestDetails(input, init) {
    const details = getRequestDetails(input, init)
    if (!details || details.method !== 'POST') return null

    const path = details.url.pathname.toLowerCase()
    const match = path.match(/\/auth\/(login|google|register)\/?$/i)
    if (!match) return null

    const action = match[1]
    const messages = {
        login: 'Signing you in...',
        google: 'Signing you in with Google...',
        register: 'Creating your account...',
    }

    return {
        isAuthRequest: true,
        message: messages[action] || 'Please wait...',
    }
}

export function installHireFlowGlobalFetchTracker() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return
    if (window[TRACKER_FLAG]) return

    const nativeFetch = window.fetch.bind(window)
    const activeRequests = new Map()
    const manualOperations = new Map()
    let nextRequestId = 0

    function publishState() {
        const allOperations = [
            ...Array.from(activeRequests.values()),
            ...Array.from(manualOperations.values()),
        ]

        const state = {
            pendingCount: allOperations.length,
            hasAuthRequest: allOperations.some(operation => operation.isAuthRequest),
            message: allOperations.length
                ? allOperations[allOperations.length - 1].message
                : '',
        }

        window[STATE_KEY] = state
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }))
    }

    // Explicit operations such as local-only logout can participate in the
    // global loader even though they do not make a network request.
    window[MANUAL_BEGIN_KEY] = function beginGlobalLoading(options = {}) {
        const operationId = `manual-${++nextRequestId}`
        manualOperations.set(operationId, {
            isAuthRequest: true,
            message: options.message || 'Please wait...',
        })
        publishState()

        let finished = false
        return function finishGlobalLoading() {
            if (finished) return
            finished = true
            manualOperations.delete(operationId)
            publishState()
        }
    }

    window.fetch = function hireFlowTrackedFetch(input, init) {
        // Only account transitions use the global overlay. Ordinary page GETs
        // are handled by their local content skeletons and won't cover refresh.
        const tracking = getAuthRequestDetails(input, init)
        if (!tracking) return nativeFetch(input, init)

        const requestId = ++nextRequestId
        activeRequests.set(requestId, tracking)
        publishState()

        let requestPromise
        try {
            requestPromise = nativeFetch(input, init)
        } catch (error) {
            activeRequests.delete(requestId)
            publishState()
            throw error
        }

        return requestPromise.finally(() => {
            activeRequests.delete(requestId)
            publishState()
        })
    }

    window[TRACKER_FLAG] = true
    window[STATE_KEY] = {
        pendingCount: 0,
        hasAuthRequest: false,
        message: '',
    }
}

export function beginHireFlowGlobalLoading(options = {}) {
    if (typeof window === 'undefined') return () => { }

    const begin = window[MANUAL_BEGIN_KEY]
    if (typeof begin !== 'function') return () => { }

    return begin(options)
}

export const HIRE_FLOW_GLOBAL_FETCH_EVENT = EVENT_NAME
export const HIRE_FLOW_GLOBAL_FETCH_STATE_KEY = STATE_KEY