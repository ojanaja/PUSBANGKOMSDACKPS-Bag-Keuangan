import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import { useSidebarStore } from '@/stores/sidebarStore'

vi.mock('@/stores/sidebarStore', () => ({
    useSidebarStore: vi.fn(),
}))

vi.mock('@/components/layout/Sidebar', () => ({
    default: () => <aside data-testid="sidebar">Sidebar</aside>,
}))

vi.mock('@/components/layout/Topbar', () => ({
    default: () => <header data-testid="topbar">Topbar</header>,
}))

function renderWithRoute(isCollapsed: boolean) {
    vi.mocked(useSidebarStore).mockImplementation((selector) => selector({ isCollapsed } as never))

    return render(
        <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route element={<AppLayout />}>
                    <Route index element={<div>Outlet Content</div>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    )
}

describe('AppLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders sidebar, topbar, and outlet content', () => {
        renderWithRoute(false)

        expect(screen.getByTestId('sidebar')).toBeInTheDocument()
        expect(screen.getByTestId('topbar')).toBeInTheDocument()
        expect(screen.getByText('Outlet Content')).toBeInTheDocument()
    })

    it('uses expanded margin class when sidebar is open', () => {
        const { container } = renderWithRoute(false)
        const main = container.querySelector('main')

        expect(main).toHaveClass('ml-[250px]')
    })

    it('uses collapsed margin class when sidebar is collapsed', () => {
        const { container } = renderWithRoute(true)
        const main = container.querySelector('main')

        expect(main).toHaveClass('ml-[72px]')
    })
})
