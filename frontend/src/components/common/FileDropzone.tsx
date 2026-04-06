import React, { useState, useRef } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'

interface FileDropzoneProps {
    onDrop: (files: File[]) => void
    label?: string
    accept?: string
    multiple?: boolean
    uploading?: { progress: string }
    type?: 'document' | 'image'
    empty?: boolean
}

export default function FileDropzone({ 
    onDrop, 
    label = 'Unggah Berkas', 
    accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg', 
    multiple = false,
    uploading,
    type = 'document'
}: FileDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onDrop(Array.from(e.dataTransfer.files))
        }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onDrop(Array.from(e.target.files))
        }
    }

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
                relative cursor-pointer transition-all duration-300
                border-2 border-dashed rounded-2xl p-8
                flex flex-col items-center justify-center text-center
                ${isDragging 
                    ? 'border-primary-500 bg-primary-50 scale-[1.02] shadow-lg' 
                    : 'border-slate-200 bg-slate-50 hover:border-primary-400 hover:bg-white'
                }
                ${uploading ? 'pointer-events-none opacity-80' : ''}
            `}
        >
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={accept}
                multiple={multiple}
                onChange={handleFileInputChange}
            />

            <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300
                ${isDragging ? 'scale-110 bg-primary-500 text-white' : 'bg-white shadow-sm text-primary-500'}
            `}>
                {uploading ? (
                    <Loader2 size={32} className="animate-spin" />
                ) : type === 'document' ? (
                    <FileText size={32} />
                ) : (
                    <Upload size={32} />
                )}
            </div>

            <div className="space-y-1">
                <p className="text-base font-bold text-slate-900">{label}</p>
                <p className="text-sm text-slate-500">
                    {multiple ? 'Tarik & lepas beberapa berkas di sini' : 'Tarik & lepas berkas di sini atau klik untuk mencari'}
                </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 bg-white px-2 py-0.5 rounded">PDF</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 bg-white px-2 py-0.5 rounded">EXCEL</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 bg-white px-2 py-0.5 rounded">WORD</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 bg-white px-2 py-0.5 rounded">IMAGE</span>
            </div>

            {uploading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-2xl">
                    <Loader2 size={32} className="text-primary-600 animate-spin mb-3" />
                    <p className="text-sm font-bold text-slate-800">Sedang mengunggah...</p>
                    <p className="text-xs text-slate-500 mt-1">{uploading.progress}</p>
                </div>
            )}
        </div>
    )
}
