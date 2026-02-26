interface AppLoaderProps {
    fullscreen?: boolean
    label?: string
}

export default function AppLoader({ fullscreen = false, label = 'Memuat data...' }: AppLoaderProps) {
    return (
        <div className={fullscreen ? 'min-h-screen flex items-center justify-center bg-slate-900' : 'flex items-center justify-center h-64'}>
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className={fullscreen ? 'text-sm text-slate-400' : 'text-sm text-slate-500'}>{label}</p>
            </div>
        </div>
    )
}
