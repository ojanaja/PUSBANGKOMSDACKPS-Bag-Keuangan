import { useState, useRef, useCallback, type DragEvent } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'

export type AcceptMap = Record<string, string[]>

interface FileDropzoneProps {
    onDrop: (files: File[]) => void
    accept?: AcceptMap
    uploading?: { progress?: string }
    label: string
    type: 'document' | 'image'
    empty?: boolean
}

function filterByAccept(files: File[], accept?: AcceptMap): File[] {
    if (!accept) return files
    const mimeKeys = Object.keys(accept)
    const extSet = new Set(Object.values(accept).flat().map(e => e.toLowerCase()))
    return files.filter(f => {
        const mimeMatch = mimeKeys.some(mime => {
            if (mime === f.type) return true
            if (mime.endsWith('/*')) {
                const prefix = mime.slice(0, mime.indexOf('/'))
                return f.type.startsWith(prefix + '/')
            }
            return false
        })
        if (mimeMatch) return true
        const ext = '.' + f.name.split('.').pop()?.toLowerCase()
        return extSet.has(ext)
    })
}

export default function FileDropzone({ onDrop, accept, uploading, label, type, empty }: FileDropzoneProps) {
    const [isDragActive, setDragActive] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const disabled = !!uploading

    const handleFiles = useCallback((fileList: FileList | null) => {
        if (!fileList || disabled) return
        const accepted = filterByAccept(Array.from(fileList), accept)
        if (accepted.length > 0) onDrop(accepted)
    }, [onDrop, accept, disabled])

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault()
        if (!disabled) setDragActive(true)
    }, [disabled])

    const handleDragLeave = useCallback(() => setDragActive(false), [])

    const handleDropEvent = useCallback((e: DragEvent) => {
        e.preventDefault()
        setDragActive(false)
        handleFiles(e.dataTransfer?.files ?? null)
    }, [handleFiles])

    const open = useCallback(() => inputRef.current?.click(), [])

    const inputAccept = accept
        ? [...Object.keys(accept), ...Object.values(accept).flat()].join(',')
        : undefined

    const hiddenInput = (
        <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept={inputAccept}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        />
    )

    if (empty) {
        return (
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDropEvent}
                className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-primary-300'}`}
            >
                {hiddenInput}
                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-primary-600">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="text-xs font-bold">Mengunggah {uploading.progress}</span>
                    </div>
                ) : (
                    <>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragActive ? 'bg-primary-100 text-primary-600' : 'bg-white text-slate-400 shadow-sm border border-slate-100'}`}>
                            {isDragActive ? <Upload size={20} /> : (type === 'document' ? <FileText size={20} /> : <Upload size={20} />)}
                        </div>
                        <p className="text-sm font-medium text-slate-700">{isDragActive ? 'Lepaskan file di sini' : label}</p>
                        <p className="text-xs text-slate-400 mt-1 mb-3">{type === 'document' ? 'Tarik & Letakkan dokumen di sini (PDF/Word/Excel/PPT/CSV, Max 500MB)' : 'Tarik & Letakkan foto di sini (JPG/PNG)'}</p>
                        <button
                            type="button"
                            onClick={open}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-200"
                        >
                            Pilih File
                        </button>
                    </>
                )}
            </div>
        )
    }

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropEvent}
            onClick={disabled ? undefined : open}
            className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-primary-600 hover:border-primary-300 hover:shadow-sm transition-all uppercase tracking-wide cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
            {hiddenInput}
            {uploading ? (
                <>
                    <Loader2 size={14} className="animate-spin" />
                    Mengunggah {uploading.progress || '...'}
                </>
            ) : (
                <>
                    {isDragActive ? <Upload size={14} className="animate-bounce" /> : <Upload size={14} />}
                    {isDragActive ? 'Lepaskan di sini' : label}
                </>
            )}
        </div>
    )
}
