import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard,
    Database,
    FolderKanban,
    ClipboardList,
    LineChart,
    ShieldAlert,
    ChevronLeft,
    ChevronRight,
    Users,
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
        label: 'Dashboard',
        path: '/',
        icon: <LayoutDashboard size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_KEUANGAN', 'PPK', 'AUDITOR'],
    },
    {
        label: 'Integrasi SAKTI',
        path: '/sakti',
        icon: <Database size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_KEUANGAN'],
    },
    {
        label: 'Paket Pekerjaan',
        path: '/paket',
        icon: <FolderKanban size={20} />,
        roles: ['SUPER_ADMIN', 'PPK', 'ADMIN_KEUANGAN'],
    },
    {
        label: 'Progres & Dokumen',
        path: '/progres',
        icon: <ClipboardList size={20} />,
        roles: ['SUPER_ADMIN', 'PPK'],
    },
    {
        label: 'Kurva-S',
        path: '/kurva-s',
        icon: <LineChart size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_KEUANGAN', 'PPK', 'AUDITOR'],
    },
    {
        label: 'EWS',
        path: '/ews',
        icon: <ShieldAlert size={20} />,
        roles: ['SUPER_ADMIN', 'PPK', 'ADMIN_KEUANGAN'],
    },
    {
        label: 'Manajemen User',
        path: '/users',
        icon: <Users size={20} />,
        roles: ['SUPER_ADMIN'],
    },
]

export default function Sidebar() {
    const user = useAuthStore((s) => s.user)
    const { isCollapsed, toggle } = useSidebarStore()

    const filteredNav = navItems.filter((item) =>
        user ? item.roles.includes(user.role) : false
    )

    return (
        <aside
            className={`fixed top-0 left-0 h-screen bg-sidebar text-white flex flex-col transition-all duration-300 z-40 ${isCollapsed ? 'w-[72px]' : 'w-[250px]'
                }`}
        >
            {/* Brand */}
            <div className="flex items-center h-[60px] px-4 border-b border-white/10">
                {!isCollapsed && (
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center font-bold text-sm">
                            SA
                        </div>
                        <span className="font-semibold text-sm tracking-tight whitespace-nowrap">
                            SiAP-BPK
                        </span>
                    </div>
                )}
                {isCollapsed && (
                    <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center font-bold text-sm mx-auto">
                        SA
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto">
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
                                {!isCollapsed && (
                                    <span className="truncate">{item.label}</span>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Collapse Toggle */}
            <button
                onClick={toggle}
                className="flex items-center justify-center h-12 border-t border-white/10 text-slate-400 hover:text-white hover:bg-sidebar-hover transition-colors"
            >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
        </aside>
    )
}
