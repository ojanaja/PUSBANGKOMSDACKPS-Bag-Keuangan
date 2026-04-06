import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'

vi.mock('@/stores/authStore', () => ({
    useAuthStore: vi.fn(),
}))

vi.mock('@/stores/sidebarStore', () => ({
    useSidebarStore: vi.fn(),
}))

type Role = 'SUPER_ADMIN' | 'ADMIN_KEUANGAN' | 'PPK' | 'PENGAWAS'

function mockStores({ role, isCollapsed = false, toggle = vi.fn() }: { role: Role; isCollapsed?: boolean; toggle?: () => void }) {
    const authState = {
        user: {
            ID: 'u-1',
            Username: 'tester',
            FullName: 'Tester',
            Role: role,
            Permissions: role === 'SUPER_ADMIN' ? ['users:manage'] : [],
        },
    }

    vi.mocked(useAuthStore).mockImplementation((selector) => selector(authState as never))

    const sidebarState = { isCollapsed, toggle }
    vi.mocked(useSidebarStore).mockImplementation((selector?: (s: typeof sidebarState) => unknown) => {
        if (typeof selector === 'function') {
            return selector(sidebarState)
        }
        return sidebarState
    })

    return { toggle }
}

describe('Sidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows role-allowed menus for SUPER_ADMIN', () => {
        mockStores({ role: 'SUPER_ADMIN' })

        render(
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>,
        )

        expect(screen.getByText('Pemantauan Anggaran')).toBeInTheDocument()
        expect(screen.getByText('Manajemen Pengguna')).toBeInTheDocument()
    })

    it('hides SUPER_ADMIN-only menus for PPK', () => {
        mockStores({ role: 'PPK' })

        render(
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>,
        )

        expect(screen.getByText('Pemantauan Anggaran')).toBeInTheDocument()
        expect(screen.queryByText('Manajemen Pengguna')).not.toBeInTheDocument()
    })

    it('renders collapsed variant and uses title tooltip labels', () => {
        mockStores({ role: 'SUPER_ADMIN', isCollapsed: true })

        render(
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>,
        )

        expect(screen.queryByText('Keuangan Pusbangkom')).not.toBeInTheDocument()
        expect(screen.getByTitle('Pemantauan Anggaran')).toBeInTheDocument()
        expect(screen.getByTitle('Manajemen Pengguna')).toBeInTheDocument()
    })

    it('calls toggle when collapse button is clicked', async () => {
        const user = userEvent.setup()
        const { toggle } = mockStores({ role: 'SUPER_ADMIN' })

        render(
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>,
        )

        const buttons = screen.getAllByRole('button')
        const toggleButton = buttons[0]
        await user.click(toggleButton)

        expect(toggle).toHaveBeenCalledTimes(1)
    })

    it('renders no menu items when user is not available', () => {
        vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: null } as never))

        const sidebarState = { isCollapsed: false, toggle: vi.fn() }
        vi.mocked(useSidebarStore).mockImplementation((selector?: (s: typeof sidebarState) => unknown) => {
            if (typeof selector === 'function') {
                return selector(sidebarState)
            }
            return sidebarState
        })

        render(
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>,
        )

        expect(screen.queryByText('Pemantauan Anggaran')).not.toBeInTheDocument()
        expect(screen.queryByText('Manajemen Pengguna')).not.toBeInTheDocument()
    })
})
