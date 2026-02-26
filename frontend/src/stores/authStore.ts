import { create } from 'zustand'

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

const API_BASE = '/api/v1/auth'

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    error: null,

    login: async (username: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
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
            await fetch(`${API_BASE}/logout`, {
                method: 'POST',
                credentials: 'include',
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
            const res = await fetch(`${API_BASE}/me`, {
                credentials: 'include',
            })

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
