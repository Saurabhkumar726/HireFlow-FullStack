import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import GlobalLoader from './components/GlobalLoader.jsx'
import { installHireFlowGlobalFetchTracker } from './utils/globalFetchTracker.js'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import SavedJobsProvider from './context/SavedJobsContext.jsx'

// Install once before React mounts so public, Student, HR and Admin API reads
// can all be observed without editing individual pages.
installHireFlowGlobalFetchTracker()

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <ThemeProvider>
                    <SavedJobsProvider>
                        <>
                            <App />
                            <GlobalLoader />
                        </>
                    </SavedJobsProvider>
                </ThemeProvider>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
)
