import { NavLink } from 'react-router-dom'
import {
    Database,
    ChevronLeft,
    ChevronRight,
    Users
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'

interface NavItem {
    label: string
    path: string
    icon: React.ReactNode
    permissions?: string[] // if empty/undefined, accessible to all logged-in users
}

const navItems: NavItem[] = [
    {
        label: 'Pemantauan Anggaran',
        path: '/anggaran',
        icon: <Database size={22} />,
    },
    {
        label: 'Manajemen Pengguna',
        path: '/users',
        icon: <Users size={22} />,
        permissions: ['users:manage'],
    },
]

export default function Sidebar() {
    const user = useAuthStore((s) => s.user)
    const { isCollapsed, toggle } = useSidebarStore()

    const filteredNav = navItems.filter((item) => 
        (user ? (!item.permissions || item.permissions.some(p => user.Permissions?.includes(p))) : false)
    )

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
                    <span className="font-bold text-xl whitespace-nowrap overflow-hidden text-ellipsis ml-3">
                        Keuangan Pusbangkom
                    </span>
                )}
            </div>

            <nav className="flex-1 py-4 overflow-y-auto" aria-label="Menu utama">
                <ul className="space-y-2 px-2">
                    {filteredNav.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-3.5 rounded-lg text-base font-medium transition-all duration-200 group ${isActive
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
