import { create } from 'zustand'

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_KEUANGAN' | 'PPK' | 'AUDITOR'

interface User {
    id: string
    username: string
    fullName: string
    role: UserRole
}

interface AuthState {
    user: User | null
    isAuthenticated: boolean
    login: (user: User) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: {
        id: '1',
        username: 'admin',
        fullName: 'Administrator',
        role: 'SUPER_ADMIN',
    },
    isAuthenticated: true,
    login: (user) => set({ user, isAuthenticated: true }),
    logout: () => set({ user: null, isAuthenticated: false }),
}))
