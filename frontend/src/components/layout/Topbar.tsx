import { Bell, ChevronRight, LogOut, User } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useState, useRef, useEffect } from 'react'

const breadcrumbMap: Record<string, string> = {
    '/anggaran': 'Integrasi Anggaran',
    '/paket': 'Paket Pekerjaan',
    '/paket/tambah': 'Tambah Paket',
    '/progres': 'Progres & Dokumen',
    '/kurva-s': 'Kurva-S',
    '/ews': 'Early Warning System',
    '/users': 'Manajemen User',
}

export default function Topbar() {
    const location = useLocation()
    const user = useAuthStore((s) => s.user)
    const logout = useAuthStore((s) => s.logout)
    const isCollapsed = useSidebarStore((s) => s.isCollapsed)
    const [showProfileMenu, setShowProfileMenu] = useState(false)
    const profileRef = useRef<HTMLDivElement>(null)

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setShowProfileMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    // Build breadcrumbs
    const pathParts = location.pathname.split('/').filter(Boolean)
    const crumbs = [{ label: 'Dashboard', path: '/' }]
    let accumulated = ''
    for (const part of pathParts) {
        accumulated += `/${part}`
        if (breadcrumbMap[accumulated]) {
            crumbs.push({ label: breadcrumbMap[accumulated], path: accumulated })
        }
    }

    return (
        <header
            className={`fixed top-0 right-0 h-[60px] bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30 transition-all duration-300 ${isCollapsed ? 'left-[72px]' : 'left-[250px]'
                }`}
        >
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1 text-sm text-slate-500">
                {crumbs.map((crumb, i) => (
                    <span key={crumb.path} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
                        <span
                            className={
                                i === crumbs.length - 1
                                    ? 'text-slate-800 font-semibold'
                                    : 'hover:text-primary-600 cursor-pointer'
                            }
                        >
                            {crumb.label}
                        </span>
                    </span>
                ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
                {/* Notifications */}
                <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                </button>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <User size={16} className="text-primary-600" />
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-sm font-medium text-slate-700 leading-tight">
                                {user?.fullName}
                            </p>
                            <p className="text-xs text-slate-400">{user?.role}</p>
                        </div>
                    </button>

                    {showProfileMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 animate-in fade-in slide-in-from-top-1">
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut size={16} />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
