import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard,
    Database,
    FolderKanban,
    ShieldAlert,
    ChevronLeft,
    ChevronRight,
    Users,
    History,
} from 'lucide-react'
import { useAuthStore, type UserRole } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'

interface NavItem {
    label: string
    path: string
    icon: React.ReactNode
    roles: UserRole[]
}

const navItems: NavItem[] = [
    {
        label: 'Beranda',
        path: '/',
        icon: <LayoutDashboard size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_KEUANGAN', 'PPK', 'PENGAWAS'],
    },
    {
        label: 'Integrasi Anggaran',
        path: '/anggaran',
        icon: <Database size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_KEUANGAN'],
    },
    {
        label: 'Progres Satker',
        path: '/progres-satker',
        icon: <FolderKanban size={20} />,
        roles: ['SUPER_ADMIN', 'PPK', 'ADMIN_KEUANGAN', 'PENGAWAS'],
    },
    {
        label: 'Sistem Peringatan Dini',
        path: '/ews',
        icon: <ShieldAlert size={20} />,
        roles: ['SUPER_ADMIN', 'PPK', 'ADMIN_KEUANGAN'],
    },
    {
        label: 'Manajemen Pengguna',
        path: '/users',
        icon: <Users size={20} />,
        roles: ['SUPER_ADMIN'],
    },
    {
        label: 'Jejak Audit',
        path: '/audit-trail',
        icon: <History size={20} />,
        roles: ['SUPER_ADMIN'],
    },
]

export default function Sidebar() {
    const user = useAuthStore((s) => s.user)
    const { isCollapsed, toggle } = useSidebarStore()

    const filteredNav = navItems.filter((item) => (user ? item.roles.includes(user.Role) : false))

    return (
        <aside
            aria-label="Navigasi utama"
            className={`fixed top-0 left-0 h-screen bg-sidebar text-white flex flex-col transition-all duration-300 z-40 ${isCollapsed ? 'w-[72px]' : 'w-[250px]'
                }`}
        >
            <div className="flex items-center h-[60px] px-4 border-b border-white/10">
                <div
                    className={`w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0 transition-opacity ${isCollapsed ? 'opacity-100' : ''
                        }`}
                >
                    KP
                </div>
                {!isCollapsed && (
                    <span className="font-bold text-lg whitespace-nowrap overflow-hidden text-ellipsis ml-3">
                        Keuangan Pusbangkom
                    </span>
                )}
            </div>

            <nav className="flex-1 py-4 overflow-y-auto" aria-label="Menu utama">
                <ul className="space-y-1 px-2">
                    {filteredNav.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${isActive
                                        ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                                        : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
                                    } ${isCollapsed ? 'justify-center' : ''}`
                                }
                                title={isCollapsed ? item.label : undefined}
                            >
                                <span className="flex-shrink-0">{item.icon}</span>
                                {!isCollapsed && <span className="truncate">{item.label}</span>}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="h-12 border-t border-white/10 flex items-center justify-center">
                <button
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    onClick={toggle}
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>
        </aside>
    )
}
