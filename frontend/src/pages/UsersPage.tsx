import { useState } from 'react'
import {
    Users as UsersIcon,
    Plus,
    Search,
    Edit2,
    Trash2,
    ShieldAlert,
    Loader2,
    X,
    AlertCircle,
    CheckCircle2
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import PageHeader from '@/shared/ui/PageHeader'
import AppTextButton from '@/shared/ui/AppTextButton'
import AppLoader from '@/shared/ui/AppLoader'
import ConfirmDialog from '@/shared/ui/ConfirmDialog'
import { useToast } from '@/shared/hooks/useToast'
import { useUsers, type UserItem } from '@/features/users/application/useUsers'

export default function UsersPage() {
    const currentUser = useAuthStore(s => s.user)
    const { showToast } = useToast()
    const [search, setSearch] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<UserItem | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [formError, setFormError] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    const { query, saveMutation, deleteMutation } = useUsers()
    const users = query.data || []
    const loading = query.isLoading

    const [formData, setFormData] = useState<{
        username: string,
        full_name: string,
        password: string,
        Permissions: string[]
    }>({
        username: '',
        full_name: '',
        password: '',
        Permissions: []
    })

    const handleOpenModal = (user: UserItem | null = null) => {
        setFormError(null)
        if (user) {
            setEditingUser(user)
            setFormData({
                username: user.Username,
                full_name: user.FullName,
                password: '',
                Permissions: user.Permissions || []
            })
        } else {
            setEditingUser(null)
            setFormData({
                username: '',
                full_name: '',
                password: '',
                Permissions: []
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormError(null)
        try {
            await saveMutation.mutateAsync({ id: editingUser?.ID, data: formData })
            setSuccess(editingUser ? 'Data pengguna berhasil diperbarui' : 'Pengguna baru berhasil ditambahkan')
            setIsModalOpen(false)
            setTimeout(() => setSuccess(null), 3000)
        } catch (e) {
            setFormError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        }
    }

    const handleDelete = async (id: string) => {
        setDeleteTarget(id)
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteMutation.mutateAsync(deleteTarget)
            setSuccess('Pengguna berhasil dihapus')
            setTimeout(() => setSuccess(null), 3000)
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Terjadi kesalahan', 'error')
        } finally {
            setDeleteTarget(null)
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
                            <caption className="sr-only">Daftar Pengguna</caption>
                            <thead>
                                <tr>
                                    <th className="px-6 py-4">Nama Lengkap / Username</th>
                                    <th className="px-6 py-4">Tanggal Dibuat</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map((user, idx) => (
                                        <tr key={user.ID || idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-800">{user.FullName}</div>
                                                <div className="text-xs text-slate-400 mt-0.5 font-mono">@{user.Username}</div>
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
                                ))}
                            </tbody>
                        </table>
                    )}
            </div>
        </div>

            {
        isModalOpen && (
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
                        {formError && (
                            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <AlertCircle size={16} />
                                {formError}
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
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Hak Akses Fitur (Fitur Anggaran)</label>
                            <div className="space-y-3">
                                {/* Resource: Data Anggaran */}
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-700 uppercase">Data Anggaran</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'anggaran:create', label: 'Create' },
                                            { id: 'anggaran:read', label: 'Read' },
                                            { id: 'anggaran:update', label: 'Update' },
                                            { id: 'anggaran:delete', label: 'Delete' }
                                        ].map(feat => (
                                            <label key={feat.id} className="flex items-start justify-start gap-3 cursor-pointer group">
                                                <div className="flex items-center h-5">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                                                        checked={formData.Permissions.includes(feat.id)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                Permissions: checked 
                                                                    ? [...prev.Permissions, feat.id]
                                                                    : prev.Permissions.filter(p => p !== feat.id)
                                                            }))
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-tight">{feat.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Resource: Dokumen Bukti */}
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-700 uppercase">Dokumen Bukti</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'dokumen:create', label: 'Create' },
                                            { id: 'dokumen:read', label: 'Read' },
                                            { id: 'dokumen:update', label: 'Update' },
                                            { id: 'dokumen:delete', label: 'Delete' }
                                        ].map(feat => (
                                            <label key={feat.id} className="flex items-start justify-start gap-3 cursor-pointer group">
                                                <div className="flex items-center h-5">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                                                        checked={formData.Permissions.includes(feat.id)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                Permissions: checked 
                                                                    ? [...prev.Permissions, feat.id]
                                                                    : prev.Permissions.filter(p => p !== feat.id)
                                                            }))
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-tight">{feat.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Resource: Manajemen Sistem */}
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-700 uppercase">Sistem Lanjutan</span>
                                    </div>
                                    <div className="p-4 flex flex-col gap-3">
                                        {[
                                            { id: 'users:manage', label: 'Manajemen Pengguna (Tambah, Edit, Hapus User)' }
                                        ].map(feat => (
                                            <label key={feat.id} className="flex items-start justify-start gap-3 cursor-pointer group">
                                                <div className="flex items-center h-5">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                                                        checked={formData.Permissions.includes(feat.id)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                Permissions: checked 
                                                                    ? [...prev.Permissions, feat.id]
                                                                    : prev.Permissions.filter(p => p !== feat.id)
                                                            }))
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-tight">{feat.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
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
                                disabled={saveMutation.isPending}
                                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
                            >
                                {saveMutation.isPending ? (
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
        )
    }

    <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Pengguna?"
        message="Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
    />
        </div >
    )
}
