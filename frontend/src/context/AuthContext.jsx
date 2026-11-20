
import { useState } from 'react'
import { AuthContext } from './auth-context'
import { beginHireFlowGlobalLoading } from '../utils/globalFetchTracker.js'

const API_URL = 'http://localhost:5116/api'

const ROLE_ALIASES = {
    student: 'Student',
    hr: 'HR',
    employer: 'HR',
    admin: 'Admin',
    administrator: 'Admin',
}

function normalizeRole(value) {
    const role = String(value || '').trim().toLowerCase()
    return ROLE_ALIASES[role] || ''
}

function normalizeUser(user) {
    if (!user || typeof user !== 'object') {
        return null
    }

    // Support common role property names returned by different API mappings.
    const rawRole =
        user.role ??
        user.accountRole ??
        user.AccountRole ??
        user.accountrole

    const role = normalizeRole(rawRole)

    return {
        ...user,
        ...(role ? { role } : {}),
    }
}

async function readResponse(response) {
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.title ||
            data.errors?.Email?.[0] ||
            data.errors?.Password?.[0] ||
            `Request failed (${response.status}).`
        )
    }

    return data
}

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => {
        try {
            return localStorage.getItem('hireflow-token') || ''
        } catch {
            return ''
        }
    })

    const [user, setUser] = useState(() => {
        try {
            const storedUser = JSON.parse(
                localStorage.getItem('hireflow-user') || 'null'
            )

            return normalizeUser(storedUser)
        } catch {
            return null
        }
    })

    function saveLogin(data) {
        if (!data.token || !data.user) {
            throw new Error('Unexpected login response from the server.')
        }

        const normalizedUser = normalizeUser(data.user)

        if (!normalizedUser?.role) {
            throw new Error(
                'The server did not return a valid account role. Please check the login response.'
            )
        }

        try {
            localStorage.setItem('hireflow-token', data.token)
            localStorage.setItem(
                'hireflow-user',
                JSON.stringify(normalizedUser)
            )
        } catch {
            throw new Error(
                'Unable to save your login. Check your browser storage settings.'
            )
        }

        setToken(data.token)
        setUser(normalizedUser)

        return normalizedUser
    }

    // Update the current user's details after a profile edit.
    function updateUser(updates) {
        if (!user) {
            throw new Error('Please log in to update your profile.')
        }

        const updatedUser = normalizeUser({
            ...user,
            ...updates,
        })

        try {
            localStorage.setItem(
                'hireflow-user',
                JSON.stringify(updatedUser)
            )
        } catch {
            throw new Error(
                'Unable to save your profile details in browser storage.'
            )
        }

        setUser(updatedUser)

        return updatedUser
    }

    async function login(email, password, expectedRole = 'Student') {
        const response = await fetch(`${API_URL}/Auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })

        const data = await readResponse(response)

        if (!data.token || !data.user) {
            throw new Error('Unexpected login response from the server.')
        }

        const normalizedUser = normalizeUser(data.user)
        const actualRole = normalizedUser?.role
        const selectedRole = normalizeRole(expectedRole)

        if (!actualRole || actualRole !== selectedRole) {
            const roleErrorMessages = {
                Student:
                    'This is not a Student account. Select HR / Employer to continue.',
                HR:
                    'This is not an HR account. Select Student to sign in as a student.',
                Admin:
                    'This account does not have Admin access. Please use the configured administrator account.',
            }

            throw new Error(
                roleErrorMessages[selectedRole] ||
                'Your account role does not match the selected login type.'
            )
        }

        return saveLogin({
            ...data,
            user: normalizedUser,
        })
    }

    async function loginWithGoogle(credential) {
        if (!credential) {
            throw new Error('Google did not return a valid credential.')
        }

        const response = await fetch(`${API_URL}/Auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
        })

        const data = await readResponse(response)
        const normalizedUser = normalizeUser(data.user)

        if (normalizedUser?.role !== 'Student') {
            throw new Error(
                'Google sign-in is available for Student accounts only.'
            )
        }

        return saveLogin({
            ...data,
            user: normalizedUser,
        })
    }

    async function register({
        fullName,
        email,
        password,
        role = 'Student',
    }) {
        const selectedRole = normalizeRole(role)

        if (!['Student', 'HR'].includes(selectedRole)) {
            throw new Error('Invalid account type.')
        }

        const response = await fetch(`${API_URL}/Auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName,
                email,
                password,
                role: selectedRole,
            }),
        })

        return readResponse(response)
    }

    function logout() {
        // Logout is local-only, so explicitly notify the global loader.
        const finishLoading = beginHireFlowGlobalLoading({
            message: 'Signing out securely...',
        })

        try {
            localStorage.removeItem('hireflow-token')
            localStorage.removeItem('hireflow-user')
        } finally {
            setToken('')
            setUser(null)

            // Keep the loader visible long enough for the authenticated layout
            // to transition to the public experience.
            window.setTimeout(finishLoading, 700)
        }
    }

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                isAuthenticated: Boolean(token && user),
                login,
                loginWithGoogle,
                register,
                updateUser,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}
