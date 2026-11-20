/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'hireflow-theme'
const ThemeContext = createContext(null)

function getInitialTheme() {
    try {
        const savedTheme = window.localStorage.getItem(STORAGE_KEY)
        if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    } catch {
        // Storage can be unavailable in private browsing; system preference is still usable.
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(getInitialTheme)

    const setTheme = useCallback((nextValue) => {
        setThemeState((current) => {
            const nextTheme = typeof nextValue === 'function' ? nextValue(current) : nextValue
            return nextTheme === 'dark' ? 'dark' : 'light'
        })
    }, [])

    const toggleTheme = useCallback(() => {
        setThemeState((current) => current === 'dark' ? 'light' : 'dark')
    }, [])

    useEffect(() => {
        const root = document.documentElement
        root.dataset.theme = theme
        root.classList.toggle('dark', theme === 'dark')
        root.style.colorScheme = theme

        try {
            window.localStorage.setItem(STORAGE_KEY, theme)
        } catch {
            // The theme remains active for the current session.
        }

        window.dispatchEvent(new CustomEvent('hireflow-theme-change', { detail: { theme } }))
    }, [theme])

    useEffect(() => {
        function handleLegacyThemeChange(event) {
            const requestedTheme = event?.detail?.theme
            if (requestedTheme === 'light' || requestedTheme === 'dark') {
                setThemeState(requestedTheme)
            }
        }

        window.addEventListener('hireflow-theme-change', handleLegacyThemeChange)
        return () => window.removeEventListener('hireflow-theme-change', handleLegacyThemeChange)
    }, [])

    const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) throw new Error('useTheme must be used within ThemeProvider.')
    return context
}

export default ThemeContext
