import { ChevronRight, LogOut, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useState, useRef, useEffect } from 'react'

const breadcrumbMap: Record<string, string> = {
    '/anggaran': 'Pemantauan Anggaran',
    '/users': 'Manajemen Pengguna',
}

const dynamicBreadcrumbs: Array<{ pattern: RegExp; resolve: (path: string) => { label: string; parent?: { label: string; path: string } } }> = []

function resolveBreadcrumbs(pathname: string) {
    const crumbs = [{ label: 'Beranda', path: '/' }]

    for (const { pattern, resolve } of dynamicBreadcrumbs) {
        if (pattern.test(pathname)) {
            const { label, parent } = resolve(pathname)
            if (parent) crumbs.push(parent)
            crumbs.push({ label, path: pathname })
            return crumbs
        }
    }

    const pathParts = pathname.split('/').filter(Boolean)
    let accumulated = ''
    for (const part of pathParts) {
        accumulated += `/${part}`
        if (breadcrumbMap[accumulated]) {
            crumbs.push({ label: breadcrumbMap[accumulated], path: accumulated })
        }
    }
    return crumbs
}

export default function Topbar() {
    const location = useLocation()
    const user = useAuthStore((s) => s.user)
    const logout = useAuthStore((s) => s.logout)
    const navigate = useNavigate()
    const isCollapsed = useSidebarStore((s) => s.isCollapsed)
    
    const [showProfileMenu, setShowProfileMenu] = useState(false)
    const profileRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setShowProfileMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const crumbs = resolveBreadcrumbs(location.pathname)

    return (
        <header
            className={`fixed top-0 right-0 h-[60px] bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30 transition-all duration-300 ${isCollapsed ? 'left-[72px]' : 'left-[250px]'
                }`}
        >
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-base text-slate-600">
                {crumbs.map((crumb, i) => (
                    <span key={crumb.path} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
                        <span className={i === crumbs.length - 1 ? 'text-slate-800 font-semibold' : 'hover:text-primary-600 cursor-pointer'}>
                            {crumb.label}
                        </span>
                    </span>
                ))}
            </nav>

            <div className="flex items-center gap-3">

                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <User size={20} className="text-primary-600" />
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-base font-medium text-slate-700 leading-tight">{user?.FullName}</p>
                            <p className="text-sm text-slate-500">{user?.Role}</p>
                        </div>
                    </button>

                    {showProfileMenu && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg border border-slate-200 shadow-lg z-50 py-1">
                            <button
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={async () => {
                                    setShowProfileMenu(false)
                                    await logout()
                                    navigate('/login', { replace: true })
                                }}
                            >
                                <LogOut size={16} />
                                Keluar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
