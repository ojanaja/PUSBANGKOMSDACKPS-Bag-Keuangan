import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useSidebarStore } from '@/stores/sidebarStore'

export default function AppLayout() {
    const isCollapsed = useSidebarStore((s) => s.isCollapsed)

    return (
        <div className="min-h-screen bg-content-bg">
            <Sidebar />
            <Topbar />
            <main
                className={`pt-[60px] transition-all duration-300 ${isCollapsed ? 'ml-[72px]' : 'ml-[250px]'
                    }`}
            >
                <div className="p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
