import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle size={32} />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 mb-2">Terjadi Kesalahan</h1>
                        <p className="text-sm text-slate-500 mb-6">
                            Aplikasi mengalami kesalahan yang tidak terduga. Silakan muat ulang halaman atau coba lagi.
                        </p>
                        {this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 font-medium">
                                    Detail teknis
                                </summary>
                                <pre className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-red-600 overflow-auto max-h-32 border border-slate-100">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Coba Lagi
                            </button>
                            <button
                                onClick={() => window.location.assign('/')}
                                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all shadow-md"
                            >
                                Ke Beranda
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
