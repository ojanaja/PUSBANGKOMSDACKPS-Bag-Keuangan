import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Lock, User, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import AppTextButton from '@/shared/ui/AppTextButton'

export default function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const { login, isLoading, error } = useAuthStore()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const success = await login(username, password)
        if (success) {
            navigate('/', { replace: true })
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary-200/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            <div
                className="absolute inset-0 opacity-[0.4]"
                style={{
                    backgroundImage: `linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            <div className="relative z-10 w-full max-w-md px-6 py-12">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-xl shadow-primary-500/10 mb-6 border border-slate-100">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-600 flex items-center justify-center shadow-inner">
                            <Lock className="w-7 h-7 text-white" />
                        </div>
                    </div>
                </div>

                <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-3xl p-8 shadow-2xl shadow-slate-200/50">
                    <div className="mb-8 text-center">
                        <h2 className="text-xl font-bold text-slate-800">Selamat Datang</h2>
                        <p className="text-sm text-slate-500 mt-1">Silakan masuk untuk melanjutkan</p>
                    </div>

                    {error && (
                        <div className="flex items-start gap-3 p-4 mb-6 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span className="font-medium text-red-800">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="group">
                            <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2 ml-1">
                                Username
                            </label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Username anda"
                                    required
                                    autoComplete="username"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2 ml-1">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 focus:bg-white transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <AppTextButton
                                type="submit"
                                disabled={isLoading || !username || !password}
                                fullWidth
                                label={isLoading ? 'Memverifikasi akun...' : 'Masuk ke portal'}
                                icon={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}
                                sx={{ py: 1.5, fontWeight: 700 }}
                            />
                        </div>
                    </form>
                </div>

                <div className="mt-10 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        PUSBANGKOMSDACKPS
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                        © 2026 Kementerian Pekerjaan Umum dan Perumahan Rakyat
                    </p>
                </div>
            </div>
        </div>
    )
}
