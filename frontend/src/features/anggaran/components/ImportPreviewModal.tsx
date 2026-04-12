import { useState, useRef, useCallback } from 'react'
import {
    Upload, X, AlertCircle, CheckCircle2, Loader2,
    ChevronDown, ChevronRight, Trash2, GripVertical,
    FileSpreadsheet, ArrowLeft, ArrowRight, Eye, Save,
    Edit3, Check, XCircle, Calculator
} from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { PreviewNode, PreviewResult } from '@/features/anggaran/application/useAnggaran'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'
import { formatCurrency } from '@/lib/formatCurrency'

interface ImportPreviewModalProps {
    onClose: () => void
    onImported: (tahun: number) => void
    previewMutation: UseMutationResult<PreviewResult, Error, { file: File }>
    confirmImportMutation: UseMutationResult<{ nodes_upserted: number }, Error, { tahun_anggaran: number, nodes: PreviewNode[] }>
}

type Step = 'upload' | 'preview' | 'saving'

const FORMAT_LABELS: Record<string, string> = {
    fa_detail: 'Laporan FA Detail (16 Segmen)',
    emon: 'Pagu Realisasi EMON',
    unknown: 'Format Tidak Dikenal'
}

const JENIS_COLORS: Record<string, string> = {
    PROGRAM: 'bg-violet-100 text-violet-700 border-violet-200',
    KEGIATAN: 'bg-blue-100 text-blue-700 border-blue-200',
    KRO: 'bg-blue-100 text-blue-700 border-blue-200',
    OUTPUT_GROUP: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    OUTPUT: 'bg-teal-100 text-teal-700 border-teal-200',
    RO: 'bg-teal-100 text-teal-700 border-teal-200',
    SUBOUTPUT_GROUP: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    SUBOUTPUT: 'bg-green-100 text-green-700 border-green-200',
    AKUN: 'bg-amber-100 text-amber-700 border-amber-200',
    ITEM: 'bg-orange-100 text-orange-700 border-orange-200',
    PAKET: 'bg-orange-100 text-orange-700 border-orange-200',
    TRANSAKSI: 'bg-slate-100 text-slate-600 border-slate-200',
}

// Build a tree from the flat preview nodes for display
interface TreePreviewNode extends PreviewNode {
    children: TreePreviewNode[]
}

function buildPreviewTree(nodes: PreviewNode[]): TreePreviewNode[] {
    const map = new Map<string, TreePreviewNode>()
    const roots: TreePreviewNode[] = []

    for (const node of nodes) {
        const treeNode: TreePreviewNode = { ...node, children: [] }
        map.set(node.temp_id, treeNode)
    }

    for (const node of nodes) {
        const treeNode = map.get(node.temp_id)!
        if (node.parent_temp_id && map.has(node.parent_temp_id)) {
            map.get(node.parent_temp_id)!.children.push(treeNode)
        } else {
            roots.push(treeNode)
        }
    }

    return roots
}

// Flatten tree back to array preserving parent references


// Inline editable cell
function EditableCell({
    value,
    onChange,
    type = 'text',
    className = '',
}: {
    value: string
    onChange: (val: string) => void
    type?: 'text' | 'number'
    className?: string
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)

    const startEdit = () => {
        setDraft(value)
        setEditing(true)
        setTimeout(() => inputRef.current?.focus(), 50)
    }

    const commitEdit = () => {
        onChange(draft)
        setEditing(false)
    }

    const cancelEdit = () => {
        setDraft(value)
        setEditing(false)
    }

    if (editing) {
        return (
            <div className="flex items-center gap-1">
                <input
                    ref={inputRef}
                    type={type}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') cancelEdit()
                    }}
                    className={`border border-primary-300 rounded px-1.5 py-0.5 text-xs w-full bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 ${className}`}
                />
                <button onClick={commitEdit} className="text-emerald-600 hover:text-emerald-700 shrink-0">
                    <Check size={12} />
                </button>
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 shrink-0">
                    <XCircle size={12} />
                </button>
            </div>
        )
    }

    return (
        <span
            onClick={startEdit}
            title="Klik untuk mengedit"
            className={`cursor-pointer hover:bg-primary-50 hover:text-primary-700 px-1 py-0.5 rounded transition-colors ${className}`}
        >
            {value || <span className="text-slate-300 italic">kosong</span>}
        </span>
    )
}

// Drag & drop tree row
function PreviewTreeRow({
    node,
    depth,
    expandedSet,
    toggleExpand,
    onUpdateNode,
    onDeleteNode,
    onReparent,
    dragNodeId,
    setDragNodeId,
    dropTargetId,
    setDropTargetId,
}: {
    node: TreePreviewNode
    depth: number
    expandedSet: Set<string>
    toggleExpand: (id: string) => void
    onUpdateNode: (tempId: string, field: keyof PreviewNode, value: string) => void
    onDeleteNode: (tempId: string) => void
    onReparent: (childId: string, newParentId: string) => void
    dragNodeId: string | null
    setDragNodeId: (id: string | null) => void
    dropTargetId: string | null
    setDropTargetId: (id: string | null) => void
}) {
    const isExpanded = expandedSet.has(node.temp_id)
    const hasChildren = node.children.length > 0
    const jenisColor = JENIS_COLORS[node.jenis] || 'bg-slate-100 text-slate-600 border-slate-200'
    const isDragging = dragNodeId === node.temp_id
    const isDropTarget = dropTargetId === node.temp_id

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', node.temp_id)
        setDragNodeId(node.temp_id)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        if (dragNodeId && dragNodeId !== node.temp_id) {
            setDropTargetId(node.temp_id)
        }
    }

    const handleDragLeave = () => {
        if (dropTargetId === node.temp_id) {
            setDropTargetId(null)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const childId = e.dataTransfer.getData('text/plain')
        if (childId && childId !== node.temp_id) {
            onReparent(childId, node.temp_id)
        }
        setDragNodeId(null)
        setDropTargetId(null)
    }

    const pagu = parseFloat(node.pagu_revisi) || 0
    const realisasi = parseFloat(node.realisasi_sd) || 0
    const sisa = parseFloat(node.sisa) || 0

    let sumChildrenPagu = 0
    let sumChildrenReal = 0
    if (hasChildren) {
        sumChildrenPagu = node.children.reduce((acc, child) => acc + (parseFloat(child.pagu_revisi) || 0), 0)
        sumChildrenReal = node.children.reduce((acc, child) => acc + (parseFloat(child.realisasi_sd) || 0), 0)
    }

    const isPaguMismatch = hasChildren && Math.abs(pagu - sumChildrenPagu) > 0.5
    const isRealMismatch = hasChildren && Math.abs(realisasi - sumChildrenReal) > 0.5

    return (
        <>
            <tr
                draggable
                onDragStart={handleDragStart}
                onDragEnd={() => { setDragNodeId(null); setDropTargetId(null) }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    group transition-all text-sm
                    ${isDragging ? 'opacity-40' : ''}
                    ${isDropTarget ? 'bg-primary-50 ring-2 ring-primary-400 ring-inset' : 'hover:bg-slate-50'}
                `}
            >
                {/* Drag handle + Expand/Collapse + Kode + Uraian */}
                <td className="px-3 py-2.5 border-b border-slate-100" style={{ paddingLeft: `${12 + depth * 20}px` }}>
                    <div className="flex items-center gap-1.5">
                        <span className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical size={14} />
                        </span>
                        {hasChildren ? (
                            <button
                                onClick={() => toggleExpand(node.temp_id)}
                                className="text-slate-400 hover:text-slate-600 shrink-0"
                            >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <span className="w-[14px] shrink-0" />
                        )}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${jenisColor}`}>
                            {node.jenis}
                        </span>
                        <span className="font-mono text-xs text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
                            <EditableCell
                                value={node.kode}
                                onChange={(val) => onUpdateNode(node.temp_id, 'kode', val)}
                            />
                        </span>
                        <span className="text-slate-700 text-xs truncate max-w-[300px]" title={node.uraian}>
                            <EditableCell
                                value={node.uraian}
                                onChange={(val) => onUpdateNode(node.temp_id, 'uraian', val)}
                            />
                        </span>
                    </div>
                </td>

                {/* Pagu */}
                <td className={`px-3 py-2.5 text-right border-b border-slate-100 tabular-nums text-xs transition-colors ${isPaguMismatch ? 'bg-red-50/50' : ''}`}>
                    <div className="flex items-center justify-end gap-1.5">
                        {isPaguMismatch && (
                            <span title={`Tidak sinkron dengan rincian: ${formatCurrency(sumChildrenPagu)}`}>
                                <AlertCircle size={14} className="text-red-500 shrink-0" />
                            </span>
                        )}
                        <EditableCell
                            value={node.pagu_revisi}
                            type="number"
                            onChange={(val) => onUpdateNode(node.temp_id, 'pagu_revisi', val)}
                            className={`text-right w-full ${isPaguMismatch ? 'text-red-600 font-bold' : ''}`}
                        />
                    </div>
                </td>

                {/* Realisasi */}
                <td className={`px-3 py-2.5 text-right border-b border-slate-100 tabular-nums text-xs transition-colors ${isRealMismatch ? 'bg-red-50/50' : ''}`}>
                    <div className="flex items-center justify-end gap-1.5">
                        {isRealMismatch && (
                            <span title={`Tidak sinkron dengan rincian: ${formatCurrency(sumChildrenReal)}`}>
                                <AlertCircle size={14} className="text-red-500 shrink-0" />
                            </span>
                        )}
                        <EditableCell
                            value={node.realisasi_sd}
                            type="number"
                            onChange={(val) => onUpdateNode(node.temp_id, 'realisasi_sd', val)}
                            className={`text-right w-full ${isRealMismatch ? 'text-red-600 font-bold' : ''}`}
                        />
                    </div>
                </td>

                {/* Sisa */}
                <td className={`px-3 py-2.5 text-right border-b border-slate-100 tabular-nums text-xs font-medium ${(isPaguMismatch || isRealMismatch) ? 'bg-red-50/50' : ''} ${sisa < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {formatCurrency(sisa)}
                </td>

                {/* Actions */}
                <td className="px-3 py-2.5 text-center border-b border-slate-100">
                    <button
                        onClick={() => onDeleteNode(node.temp_id)}
                        title="Hapus node ini beserta children-nya"
                        className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 size={14} />
                    </button>
                </td>
            </tr>

            {isExpanded && node.children.map((child) => (
                <PreviewTreeRow
                    key={child.temp_id}
                    node={child}
                    depth={depth + 1}
                    expandedSet={expandedSet}
                    toggleExpand={toggleExpand}
                    onUpdateNode={onUpdateNode}
                    onDeleteNode={onDeleteNode}
                    onReparent={onReparent}
                    dragNodeId={dragNodeId}
                    setDragNodeId={setDragNodeId}
                    dropTargetId={dropTargetId}
                    setDropTargetId={setDropTargetId}
                />
            ))}
        </>
    )
}

export default function ImportPreviewModal({ onClose, onImported, previewMutation, confirmImportMutation }: ImportPreviewModalProps) {
    const [step, setStep] = useState<Step>('upload')
    const [importFile, setImportFile] = useState<File | null>(null)
    const [importTahun, setImportTahun] = useState(new Date().getFullYear())
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Preview state
    const [previewData, setPreviewData] = useState<PreviewResult | null>(null)
    const [editedNodes, setEditedNodes] = useState<PreviewNode[]>([])
    const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [successResult, setSuccessResult] = useState<{ nodes_upserted: number } | null>(null)

    // Drag state for reparent
    const [dragNodeId, setDragNodeId] = useState<string | null>(null)
    const [dropTargetId, setDropTargetId] = useState<string | null>(null)

    // Step 1: Analyze file
    const handleAnalyze = async () => {
        if (!importFile) return
        setError(null)

        try {
            const data = await previewMutation.mutateAsync({ file: importFile })
            setPreviewData(data)
            setEditedNodes(data.nodes)

            // Auto-expand first 2 levels
            const autoExpand = new Set<string>()
            for (const node of data.nodes) {
                if (node.level < 2) {
                    autoExpand.add(node.temp_id)
                }
            }
            setExpandedSet(autoExpand)
            setStep('preview')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal menganalisa file')
        }
    }

    // Toggle expand 
    const toggleExpand = useCallback((id: string) => {
        setExpandedSet(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }, [])

    // Expand / Collapse all
    const expandAll = () => {
        setExpandedSet(new Set(editedNodes.map(n => n.temp_id)))
    }
    const collapseAll = () => {
        setExpandedSet(new Set())
    }

    // Update node field
    const handleUpdateNode = useCallback((tempId: string, field: keyof PreviewNode, value: string) => {
        setEditedNodes(prev => prev.map(n =>
            n.temp_id === tempId ? { ...n, [field]: value } : n
        ))
    }, [])

    // Delete node + children
    const handleDeleteNode = useCallback((tempId: string) => {
        setEditedNodes(prev => {
            // Find all descendants
            const toDelete = new Set<string>([tempId])
            let changed = true
            while (changed) {
                changed = false
                for (const node of prev) {
                    if (!toDelete.has(node.temp_id) && toDelete.has(node.parent_temp_id)) {
                        toDelete.add(node.temp_id)
                        changed = true
                    }
                }
            }
            return prev.filter(n => !toDelete.has(n.temp_id))
        })
    }, [])

    // Re-parent node via drag & drop
    const handleReparent = useCallback((childId: string, newParentId: string) => {
        setEditedNodes(prev => {
            // Check: don't allow reparenting to own descendant
            const isDescendant = (parentId: string, targetId: string): boolean => {
                if (parentId === targetId) return true
                const children = prev.filter(n => n.parent_temp_id === parentId)
                return children.some(c => isDescendant(c.temp_id, targetId))
            }
            if (isDescendant(childId, newParentId)) return prev

            return prev.map(n =>
                n.temp_id === childId ? { ...n, parent_temp_id: newParentId } : n
            )
        })
    }, [])

    // Bottom-up recalculation of summary nodes
    const handleRecalculate = () => {
        if (!confirm('Auto-kalkulasi akan menimpa nilai Program, Kegiatan, KRO, dll berdasarkan total rincian paling bawah. Lanjutkan?')) return

        setEditedNodes(prev => {
            const map = new Map<string, PreviewNode>()
            for (const node of prev) map.set(node.temp_id, { ...node })

            const childrenMap = new Map<string, string[]>()
            for (const node of prev) {
                if (node.parent_temp_id) {
                    if (!childrenMap.has(node.parent_temp_id)) childrenMap.set(node.parent_temp_id, [])
                    childrenMap.get(node.parent_temp_id)!.push(node.temp_id)
                }
            }

            // Recursive bottom up calculation
            function calc(temp_id: string): { pagu: number, real: number } {
                const node = map.get(temp_id)!
                const children = childrenMap.get(temp_id) || []

                if (children.length === 0) {
                    return { pagu: parseFloat(node.pagu_revisi) || 0, real: parseFloat(node.realisasi_sd) || 0 }
                }

                let sumPagu = 0
                let sumReal = 0
                for (const childId of children) {
                    const sums = calc(childId)
                    sumPagu += sums.pagu
                    sumReal += sums.real
                }

                node.pagu_revisi = sumPagu.toString()
                node.realisasi_sd = sumReal.toString()
                node.sisa = (sumPagu - sumReal).toString()

                return { pagu: sumPagu, real: sumReal }
            }

            // Start calculation from roots
            for (const node of prev) {
                if (!node.parent_temp_id || !map.has(node.parent_temp_id)) {
                    calc(node.temp_id)
                }
            }

            return Array.from(map.values())
        })
    }

    // Step 3: Confirm & Save
    const handleConfirm = async () => {
        setError(null)
        setStep('saving')

        try {
            const result = await confirmImportMutation.mutateAsync({
                tahun_anggaran: importTahun,
                nodes: editedNodes
            })
            setSuccessResult(result)
            onImported(importTahun)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal menyimpan data')
            setStep('preview')
        }
    }

    // Build tree for display
    const previewTree = buildPreviewTree(editedNodes)
    const currentStats = {
        total: editedNodes.length,
        byJenis: editedNodes.reduce((acc, n) => {
            acc[n.jenis] = (acc[n.jenis] || 0) + 1
            return acc
        }, {} as Record<string, number>),
        totalPagu: editedNodes.filter(n => !editedNodes.some(c => c.parent_temp_id === n.temp_id)).reduce((s, n) => s + (parseFloat(n.pagu_revisi) || 0), 0),
    }

    // Orphan detection
    const orphanNodes = editedNodes.filter(n =>
        n.parent_temp_id !== '' &&
        !editedNodes.some(p => p.temp_id === n.parent_temp_id)
    )

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const files = e.dataTransfer.files
        if (files.length > 0) {
            setImportFile(files[0])
            setError(null)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            setImportFile(files[0])
            setError(null)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${step === 'preview' ? 'w-full max-w-6xl max-h-[92vh]' : 'w-full max-w-lg max-h-[90vh]'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-xl">
                            <FileSpreadsheet size={22} className="text-primary-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">
                                {step === 'upload' && 'Import Laporan Anggaran'}
                                {step === 'preview' && 'Preview Hasil Parsing'}
                                {step === 'saving' && (successResult ? 'Import Berhasil!' : 'Menyimpan Data...')}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {step === 'upload' && 'Langkah 1: Upload file Excel'}
                                {step === 'preview' && `Langkah 2: Review dan edit ${editedNodes.length} node`}
                                {step === 'saving' && (successResult ? `${successResult.nodes_upserted} node berhasil disimpan` : 'Harap tunggu...')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* === STEP 1: UPLOAD === */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tahun Anggaran</label>
                                <select
                                    value={importTahun}
                                    onChange={(e) => setImportTahun(Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
                                >
                                    {FISCAL_YEAR_OPTIONS.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragging ? 'border-primary-400 bg-primary-50 scale-[1.02]' : importFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-primary-400 hover:bg-primary-50/50'}`}
                            >
                                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                                {importFile ? (
                                    <>
                                        <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                                        <p className="text-sm font-semibold text-emerald-700">{importFile.name}</p>
                                        <p className="text-xs text-emerald-500 mt-1">{(importFile.size / 1024).toFixed(1)} KB — Klik untuk mengganti</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={36} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-sm text-slate-600 font-medium">Seret file Excel ke sini</p>
                                        <p className="text-xs text-slate-400 mt-1">atau klik untuk memilih file (.xlsx)</p>
                                    </>
                                )}
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                <p className="text-xs font-semibold text-slate-600 mb-1.5">Format yang didukung:</p>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                                        <span className="text-xs text-slate-600">Laporan FA Detail (16 Segmen) — dari SPAN/SAKTI</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <span className="text-xs text-slate-600">Pagu Realisasi EMON (e-Monitoring)</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">Format akan dideteksi otomatis. Anda bisa mengedit hasilnya sebelum simpan.</p>
                            </div>
                        </div>
                    )}

                    {/* === STEP 2: PREVIEW === */}
                    {step === 'preview' && previewData && (
                        <div className="space-y-4">
                            {/* Stats bar */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
                                    <Eye size={16} className="text-primary-600" />
                                    <span className="text-xs font-bold text-primary-700">
                                        {FORMAT_LABELS[previewData.format_detected] || previewData.format_detected}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                    <span className="text-xs font-bold text-slate-700">{currentStats.total}</span>
                                    <span className="text-xs text-slate-500">node</span>
                                </div>

                                {Object.entries(currentStats.byJenis).slice(0, 5).map(([jenis, count]) => (
                                    <div key={jenis} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 border text-xs font-medium ${JENIS_COLORS[jenis] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        <span>{count}</span>
                                        <span>{jenis}</span>
                                    </div>
                                ))}

                                <div className="ml-auto flex items-center gap-1">
                                    <button onClick={handleRecalculate} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-3 py-1.5 hover:bg-emerald-50 rounded transition-colors border border-emerald-200">
                                        <Calculator size={14} /> Auto Kalkulasi
                                    </button>
                                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                    <button onClick={expandAll} className="text-xs text-primary-600 hover:text-primary-700 px-2 py-1.5 hover:bg-primary-50 rounded transition-colors">
                                        Buka Semua
                                    </button>
                                    <button onClick={collapseAll} className="text-xs text-primary-600 hover:text-primary-700 px-2 py-1.5 hover:bg-primary-50 rounded transition-colors">
                                        Tutup Semua
                                    </button>
                                </div>
                            </div>

                            {/* Orphan warning */}
                            {orphanNodes.length > 0 && (
                                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <AlertCircle size={16} className="text-amber-500 shrink-0" />
                                    <p className="text-xs text-amber-700">
                                        <strong>{orphanNodes.length} node</strong> tanpa parent terdeteksi. Node ini akan dijadikan root node.
                                    </p>
                                </div>
                            )}

                            {/* Edit hint */}
                            <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                                <Edit3 size={14} className="text-blue-500 shrink-0" />
                                <p className="text-[11px] text-blue-700">
                                    <strong>Tips:</strong> Klik pada teks untuk mengedit. Drag baris untuk memindahkan posisi di tree. Klik ikon sampah untuk menghapus.
                                </p>
                            </div>

                            {/* Tree table */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-3 py-2.5 text-left font-semibold text-slate-700 text-xs">Kode & Uraian</th>
                                                <th className="px-3 py-2.5 text-right font-semibold text-slate-700 text-xs w-[140px]">Pagu Revisi</th>
                                                <th className="px-3 py-2.5 text-right font-semibold text-slate-700 text-xs w-[140px]">Realisasi</th>
                                                <th className="px-3 py-2.5 text-right font-semibold text-slate-700 text-xs w-[140px]">Sisa</th>
                                                <th className="px-3 py-2.5 text-center font-semibold text-slate-700 text-xs w-[50px]"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewTree.map((node) => (
                                                <PreviewTreeRow
                                                    key={node.temp_id}
                                                    node={node}
                                                    depth={0}
                                                    expandedSet={expandedSet}
                                                    toggleExpand={toggleExpand}
                                                    onUpdateNode={handleUpdateNode}
                                                    onDeleteNode={handleDeleteNode}
                                                    onReparent={handleReparent}
                                                    dragNodeId={dragNodeId}
                                                    setDragNodeId={setDragNodeId}
                                                    dropTargetId={dropTargetId}
                                                    setDropTargetId={setDropTargetId}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === STEP 3: SAVING / SUCCESS === */}
                    {step === 'saving' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            {successResult ? (
                                <>
                                    <div className="p-4 bg-emerald-100 rounded-full mb-4">
                                        <CheckCircle2 size={48} className="text-emerald-600" />
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900 mb-2">Import Berhasil!</h4>
                                    <p className="text-sm text-slate-600 mb-1">
                                        <strong>{successResult.nodes_upserted}</strong> node anggaran berhasil disimpan
                                    </p>
                                    <p className="text-xs text-slate-400">Tahun Anggaran: {importTahun}</p>
                                </>
                            ) : (
                                <>
                                    <Loader2 size={48} className="text-primary-500 animate-spin mb-4" />
                                    <h4 className="text-lg font-bold text-slate-900 mb-1">Menyimpan Data...</h4>
                                    <p className="text-sm text-slate-500">Sedang memproses {editedNodes.length} node anggaran</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Error display */}
                    {error && (
                        <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle size={16} className="text-red-500 shrink-0" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                    <div>
                        {step === 'preview' && (
                            <span className="text-xs text-slate-400">
                                {editedNodes.length !== previewData?.nodes.length && (
                                    <span className="text-amber-600 font-medium">
                                        {(previewData?.nodes.length || 0) - editedNodes.length} node dihapus dari preview asli
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {step === 'upload' && (
                            <>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleAnalyze}
                                    disabled={!importFile || previewMutation.isPending}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    {previewMutation.isPending ? (
                                        <><Loader2 size={16} className="animate-spin" /> Menganalisa...</>
                                    ) : (
                                        <><ArrowRight size={16} /> Analisa File</>
                                    )}
                                </button>
                            </>
                        )}

                        {step === 'preview' && (
                            <>
                                <button
                                    onClick={() => setStep('upload')}
                                    disabled={confirmImportMutation.isPending}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ArrowLeft size={16} /> Kembali
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={editedNodes.length === 0 || confirmImportMutation.isPending}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    {confirmImportMutation.isPending ? (
                                        <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
                                    ) : (
                                        <><Save size={16} /> Konfirmasi & Simpan ({editedNodes.length} node)</>
                                    )}
                                </button>
                            </>
                        )}

                        {step === 'saving' && successResult && (
                            <button
                                onClick={onClose}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-all shadow-sm"
                            >
                                <CheckCircle2 size={16} /> Selesai
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
