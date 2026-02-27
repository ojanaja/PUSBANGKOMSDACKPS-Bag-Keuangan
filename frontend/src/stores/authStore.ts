import { create } from 'zustand'
import { apiFetch } from '@/shared/api/httpClient'

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_KEUANGAN' | 'PPK' | 'PENGAWAS'

interface User {
    ID: string
    Username: string
    FullName: string
    Role: UserRole
}

interface AuthState {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    isInitialized: boolean
    error: string | null
    login: (username: string, password: string) => Promise<boolean>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    error: null,

    login: async (username: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                set({
                    isLoading: false,
                    error: data.message || 'Login gagal. Periksa username dan password.',
                })
                return false
            }

            const data = await res.json()
            set({
                user: data.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            })
            return true
        } catch {
            set({
                isLoading: false,
                error: 'Koneksi ke server gagal. Coba lagi nanti.',
            })
            return false
        }
    },

    logout: async () => {
        try {
            await apiFetch('/auth/logout', {
                method: 'POST',
            })
        } catch {
        }
        set({ user: null, isAuthenticated: false, isLoading: false, error: null })
    },

    checkAuth: async () => {
        const { isInitialized } = useAuthStore.getState()
        if (isInitialized) return

        set({ isLoading: true })
        try {
            const res = await apiFetch('/auth/me')

            if (!res.ok) {
                set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true })
                return
            }

            const user = await res.json()
            set({ user, isAuthenticated: true, isLoading: false, isInitialized: true })
        } catch {
            set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true })
        }
    },
}))
