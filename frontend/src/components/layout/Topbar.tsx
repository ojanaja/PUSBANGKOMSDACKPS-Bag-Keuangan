import { Bell, ChevronRight, LogOut, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useState, useRef, useEffect } from 'react'
import AppTextButton from '@/shared/ui/AppTextButton'
import { useNotifications } from '@/features/notifications/application/useNotifications'

const breadcrumbMap: Record<string, string> = {
    '/anggaran': 'Integrasi Anggaran',
    '/progres-satker': 'Progres Satker',
    '/progres-satker/tambah': 'Tambah Paket',
    '/ews': 'Sistem Peringatan Dini',
    '/users': 'Manajemen Pengguna',
    '/audit-trail': 'Jejak Audit',
}

const dynamicBreadcrumbs: Array<{ pattern: RegExp; resolve: (path: string) => { label: string; parent?: { label: string; path: string } } }> = [
    {
        pattern: /^\/progres\/[^/]+$/,
        resolve: () => ({ label: 'Detail Progres', parent: { label: 'Progres Satker', path: '/progres-satker' } }),
    },
    {
        pattern: /^\/kurva-s\/[^/]+$/,
        resolve: () => ({ label: 'Kurva-S', parent: { label: 'Progres Satker', path: '/progres-satker' } }),
    },
]

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
    const [showNotifications, setShowNotifications] = useState(false)
    const [showProfileMenu, setShowProfileMenu] = useState(false)
    const notificationRef = useRef<HTMLDivElement>(null)
    const profileRef = useRef<HTMLDivElement>(null)
    const { notifications, isLoading } = useNotifications()

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setShowProfileMenu(false)
            }
            if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
                setShowNotifications(false)
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
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500">
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
                <div className="relative" ref={notificationRef}>
                    <button
                        title="Notifikasi"
                        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell size={18} />
                        {notifications.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                                {notifications.length > 99 ? '99+' : notifications.length}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 overflow-hidden z-50 shadow-lg">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-800">Pusat Notifikasi</span>
                                {notifications.length > 0 ? <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">{notifications.length} baru</span> : null}
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {isLoading ? (
                                    <div className="p-8 text-center text-sm text-slate-500">Memuat notifikasi...</div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <p className="text-sm text-slate-400">Tidak ada notifikasi baru</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <button
                                            key={notification.id}
                                            className="w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                                            onClick={() => {
                                                setShowNotifications(false)
                                                if (notification.paket_id) {
                                                    navigate(`/progres/${notification.paket_id}`)
                                                }
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notification.type === 'critical' ? 'bg-red-500' : notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.detail}</p>
                                                    <p className="text-[10px] text-slate-400 mt-2 uppercase font-medium tracking-wider">{notification.time}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="flex justify-end p-2 border-t border-slate-100">
                                <AppTextButton
                                    label="Lihat semua"
                                    onClick={() => {
                                        setShowNotifications(false)
                                        navigate('/ews')
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <User size={16} className="text-primary-600" />
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-sm font-medium text-slate-700 leading-tight">{user?.FullName}</p>
                            <p className="text-xs text-slate-400">{user?.Role}</p>
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
