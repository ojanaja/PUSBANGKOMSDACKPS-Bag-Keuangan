import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
    BarChart3,
    FileSpreadsheet,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Users
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'

interface NavItem {
    label: string
    path: string
    icon: React.ReactNode
    permissions?: string[]
}

interface NavGroup {
    label: string
    icon: React.ReactNode
    items: NavItem[]
}

type NavEntry = NavItem | NavGroup

function isNavGroup(entry: NavEntry): entry is NavGroup {
    return 'items' in entry
}

const navEntries: NavEntry[] = [
    {
        label: 'Anggaran',
        icon: <BarChart3 size={22} />,
        items: [
            {
                label: 'Dashboard',
                path: '/anggaran',
                icon: <BarChart3 size={18} />,
            },
            {
                label: 'Import DIPA/RKKS',
                path: '/anggaran/import',
                icon: <FileSpreadsheet size={18} />,
                permissions: ['anggaran:create'],
            },
        ],
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
    const location = useLocation()
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Anggaran']))

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(label)) {
                next.delete(label)
            } else {
                next.add(label)
            }
            return next
        })
    }

    const hasPermission = (item: NavItem) =>
        user ? (!item.permissions || item.permissions.some(p => user.Permissions?.includes(p))) : false

    const filterItems = (items: NavItem[]) => items.filter(hasPermission)

    return (
        <aside
            aria-label="Navigasi utama"
            className={`fixed top-0 left-0 h-screen bg-sidebar text-white flex flex-col transition-all duration-300 z-40 ${isCollapsed ? 'w-[72px]' : 'w-[250px]'
                }`}
        >
            <div className="flex items-center h-[60px] px-4 border-b border-white/10">
                <img
                    src="/logo/logo.png"
                    alt="Keuangan Pusbangkom"
                    className="w-10 h-10 object-contain shrink-0"
                />
                {!isCollapsed && (
                    <span className="font-bold text-xl whitespace-nowrap overflow-hidden text-ellipsis ml-3">
                        Keuangan Pusbangkom
                    </span>
                )}
            </div>

            <nav className="flex-1 py-4 overflow-y-auto" aria-label="Menu utama">
                <ul className="space-y-1 px-2">
                    {navEntries.map((entry) => {
                        if (isNavGroup(entry)) {
                            const visibleItems = filterItems(entry.items)
                            if (visibleItems.length === 0) return null

                            const isGroupActive = visibleItems.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
                            const isExpanded = expandedGroups.has(entry.label)

                            if (isCollapsed) {
                                // In collapsed mode, show group icon linking to first child
                                const first = visibleItems[0]
                                return (
                                    <li key={entry.label}>
                                        <NavLink
                                            to={first.path}
                                            className={`flex items-center justify-center px-3 py-3.5 rounded-lg text-base font-medium transition-all duration-200 ${isGroupActive
                                                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                                                : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
                                                }`}
                                            title={entry.label}
                                        >
                                            <span className="flex-shrink-0">{entry.icon}</span>
                                        </NavLink>
                                    </li>
                                )
                            }

                            return (
                                <li key={entry.label}>
                                    {/* Group header */}
                                    <button
                                        onClick={() => toggleGroup(entry.label)}
                                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 ${isGroupActive
                                            ? 'text-white'
                                            : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
                                            }`}
                                    >
                                        <span className="flex-shrink-0">{entry.icon}</span>
                                        <span className="truncate flex-1 text-left">{entry.label}</span>
                                        <ChevronDown
                                            size={16}
                                            className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                                        />
                                    </button>
                                    {/* Sub-items */}
                                    {isExpanded && (
                                        <ul className="mt-1 ml-5 space-y-0.5 border-l border-white/10 pl-3">
                                            {visibleItems.map((item) => (
                                                <li key={item.path}>
                                                    <NavLink
                                                        to={item.path}
                                                        end
                                                        className={({ isActive }) =>
                                                            `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                                                                : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
                                                            }`
                                                        }
                                                    >
                                                        <span className="flex-shrink-0">{item.icon}</span>
                                                        <span className="truncate">{item.label}</span>
                                                    </NavLink>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            )
                        }

                        // Regular item
                        if (!hasPermission(entry)) return null
                        return (
                            <li key={entry.path}>
                                <NavLink
                                    to={entry.path}
                                    end={entry.path === '/'}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-3 py-3.5 rounded-lg text-base font-medium transition-all duration-200 group ${isActive
                                            ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                                            : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
                                        } ${isCollapsed ? 'justify-center' : ''}`
                                    }
                                    title={isCollapsed ? entry.label : undefined}
                                >
                                    <span className="flex-shrink-0">{entry.icon}</span>
                                    {!isCollapsed && <span className="truncate">{entry.label}</span>}
                                </NavLink>
                            </li>
                        )
                    })}
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
