import { FileQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileQuestion size={40} />
                </div>
                <h1 className="text-6xl font-bold text-slate-200 mb-2">404</h1>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Halaman Tidak Ditemukan</h2>
                <p className="text-sm text-slate-500 mb-8">
                    Halaman yang Anda cari tidak ada atau telah dipindahkan.
                </p>
                <Link
                    to="/"
                    className="inline-flex px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all shadow-md shadow-primary-600/20"
                >
                    Kembali ke Beranda
                </Link>
            </div>
        </div>
    )
}
