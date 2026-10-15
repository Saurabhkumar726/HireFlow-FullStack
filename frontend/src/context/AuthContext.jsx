
import { useState } from 'react'
import { AuthContext } from './auth-context'

const API_URL = 'http://localhost:5116/api'

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
            return JSON.parse(localStorage.getItem('hireflow-user') || 'null')
        } catch {
            return null
        }
    })

    function saveLogin(data) {
        if (!data.token || !data.user) {
            throw new Error('Unexpected login response from the server.')
        }

        try {
            localStorage.setItem('hireflow-token', data.token)
            localStorage.setItem('hireflow-user', JSON.stringify(data.user))
        } catch {
            throw new Error(
                'Unable to save your login. Check your browser storage settings.'
            )
        }

        setToken(data.token)
        setUser(data.user)

        return data.user
    }

    // Update the current user's details after a profile edit.
    function updateUser(updates) {
        if (!user) {
            throw new Error('Please log in to update your profile.')
        }

        const updatedUser = {
            ...user,
            ...updates,
        }

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

        if (data.user.role !== expectedRole) {
            throw new Error(
                expectedRole === 'HR'
                    ? 'This is not an HR account. Select Student to sign in as a student.'
                    : 'This is not a Student account. Select HR / Employer to continue.'
            )
        }

        return saveLogin(data)
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

        if (data.user?.role !== 'Student') {
            throw new Error(
                'Google sign-in is available for Student accounts only.'
            )
        }

        return saveLogin(data)
    }

    async function register({
        fullName,
        email,
        password,
        role = 'Student',
    }) {
        if (!['Student', 'HR'].includes(role)) {
            throw new Error('Invalid account type.')
        }

        const response = await fetch(`${API_URL}/Auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, password, role }),
        })

        return readResponse(response)
    }

    function logout() {
        try {
            localStorage.removeItem('hireflow-token')
            localStorage.removeItem('hireflow-user')
        } finally {
            setToken('')
            setUser(null)
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
