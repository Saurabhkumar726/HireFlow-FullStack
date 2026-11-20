import { useEffect, useState } from 'react'
import { Moon, Sun } from './AdminIcons'
import './AdminThemeToggle.css'

function readTheme() {
    try { return localStorage.getItem('hireflow-theme') || document.documentElement.dataset.theme || 'light' }
    catch { return document.documentElement.dataset.theme || 'light' }
}

export default function AdminThemeToggle() {
    const [theme, setTheme] = useState(readTheme)

    useEffect(() => {
        const syncTheme = (event) => setTheme(event?.detail?.theme || readTheme())
        window.addEventListener('hireflow-theme-change', syncTheme)
        return () => window.removeEventListener('hireflow-theme-change', syncTheme)
    }, [])

    function toggleTheme() {
        const nextTheme = theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = nextTheme
        try { localStorage.setItem('hireflow-theme', nextTheme) } catch { /* Theme remains active for this session. */ }
        setTheme(nextTheme)
        window.dispatchEvent(new CustomEvent('hireflow-theme-change', { detail: { theme: nextTheme } }))
    }

    return (
        <button type="button" className="admin-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
    )
}
