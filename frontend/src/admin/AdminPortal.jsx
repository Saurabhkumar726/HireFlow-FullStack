import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import './AdminPortal.css'

function AdminPortal() {
    const location = useLocation()
    const { user, isAuthenticated } = useAuth()
    const isDashboard = location.pathname === '/admin/dashboard'

    useEffect(() => {
        document.title = isDashboard ? 'Admin Workspace | HireFlow' : 'HireFlow | Admin Access'
    }, [isDashboard])

    if (isDashboard) {
        if (!isAuthenticated || user?.role !== 'Admin') {
            return <Navigate to="/admin/login" replace state={{ from: location }} />
        }

        return <AdminDashboard />
    }

    if (isAuthenticated && user?.role === 'Admin' && location.pathname === '/admin/login') {
        return <Navigate to="/admin/dashboard" replace />
    }

    return <AdminLogin />
}

export default AdminPortal
