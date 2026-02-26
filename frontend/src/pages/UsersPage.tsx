import { useState, useEffect } from 'react'
import {
    Users as UsersIcon,
    Plus,
    Search,
    Edit2,
    Trash2,
    Shield,
    ShieldAlert,
    ShieldCheck,
    UserCheck,
    Loader2,
    X,
    AlertCircle,
    CheckCircle2
} from 'lucide-react'
import { useAuthStore, type UserRole } from '@/stores/authStore'
import PageHeader from '@/shared/ui/PageHeader'
import AppTextButton from '@/shared/ui/AppTextButton'
import AppLoader from '@/shared/ui/AppLoader'

interface UserItem {
    ID: string
    Username: string
    FullName: string
    Role: UserRole
    CreatedAt: string
}

const roleConfig: Record<UserRole, { label: string, icon: any, color: string, bg: string }> = {
    SUPER_ADMIN: { label: 'Super Admin', icon: ShieldAlert, color: 'text-purple-700', bg: 'bg-purple-100' },
    ADMIN_KEUANGAN: { label: 'Admin Keuangan', icon: ShieldCheck, color: 'text-blue-700', bg: 'bg-blue-100' },
    PPK: { label: 'PPK', icon: UserCheck, color: 'text-emerald-700', bg: 'bg-emerald-100' },
    PENGAWAS: { label: 'Pengawas', icon: Shield, color: 'text-slate-700', bg: 'bg-slate-100' },
}

export default function UsersPage() {
    const currentUser = useAuthStore(s => s.user)
    const [users, setUsers] = useState<UserItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<UserItem | null>(null)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        username: '',
        full_name: '',
        password: '',
        role: 'PENGAWAS' as UserRole
    })

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/v1/users', { credentials: 'include' })
            if (!res.ok) throw new Error('Gagal mengambil daftar pengguna')
            const data = await res.json()
            setUsers(data || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    const handleOpenModal = (user: UserItem | null = null) => {
        if (user) {
            setEditingUser(user)
            setFormData({
                username: user.Username,
                full_name: user.FullName,
                password: '',
                role: user.Role
            })
        } else {
            setEditingUser(null)
            setFormData({
                username: '',
                full_name: '',
                password: '',
                role: 'PENGAWAS'
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try {
            const url = editingUser ? `/api/v1/users/${editingUser.ID}` : '/api/v1/users'
            const method = editingUser ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || 'Gagal menyimpan data pengguna')
            }

            setSuccess(editingUser ? 'Data pengguna berhasil diperbarui' : 'Pengguna baru berhasil ditambahkan')
            setIsModalOpen(false)
            fetchUsers()
            setTimeout(() => setSuccess(null), 3000)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return

        try {
            const res = await fetch(`/api/v1/users/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            if (!res.ok) throw new Error('Gagal menghapus pengguna')

            setSuccess('Pengguna berhasil dihapus')
            fetchUsers()
            setTimeout(() => setSuccess(null), 3000)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        }
    }

    const filteredUsers = users.filter(u =>
        (u.Username?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (u.FullName?.toLowerCase() || '').includes(search.toLowerCase())
    )

    if (currentUser?.Role !== 'SUPER_ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShieldAlert size={48} className="text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-900">Akses Dibatasi</h2>
                <p className="text-slate-500 mt-2">Halaman ini hanya dapat diakses oleh Super Admin.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Manajemen Pengguna"
                description="Kelola akun dan peran pengguna sistem"
                actions={<AppTextButton label="Tambah Pengguna" icon={<Plus size={16} />} onClick={() => handleOpenModal()} color="primary" />}
            />

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-medium">{success}</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari nama atau username..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <AppLoader label="Memuat data pengguna..." />
                    ) : filteredUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <UsersIcon size={32} className="text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-medium font-outfit">Belum ada pengguna</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left text-slate-500 font-semibold border-b border-slate-100">
                                    <th className="px-6 py-4">Nama Lengkap / Username</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Tanggal Dibuat</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map((user, idx) => {
                                    const roleKey = user.Role as UserRole
                                    const cfg = roleConfig[roleKey] || roleConfig['PENGAWAS']
                                    const Icon = cfg.icon
                                    return (
                                        <tr key={user.ID || idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-800">{user.FullName}</div>
                                                <div className="text-xs text-slate-400 mt-0.5 font-mono">@{user.Username}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                                                    <Icon size={12} />
                                                    {cfg.label}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {new Date(user.CreatedAt).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(user)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium transition-colors border border-indigo-200"
                                                        title="Edit Pengguna"
                                                    >
                                                        <Edit2 size={14} />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user.ID)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Hapus"
                                                        disabled={currentUser.Username === user.Username}
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>Hapus</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
                            <h3 className="text-lg font-bold text-slate-900 font-outfit">
                                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    disabled={editingUser !== null}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 font-mono"
                                    placeholder="username"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Nama Lengkap"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                    {editingUser ? 'Ganti Password (Kosongkan jika tidak)' : 'Password'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Role / Peran</label>
                                <select
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none bg-white"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                >
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                    <option value="ADMIN_KEUANGAN">Admin Keuangan</option>
                                    <option value="PPK">PPK (Pejabat Pembuat Komitmen)</option>
                                    <option value="PENGAWAS">Pengawas / Pemeriksa</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        'Simpan Data'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
