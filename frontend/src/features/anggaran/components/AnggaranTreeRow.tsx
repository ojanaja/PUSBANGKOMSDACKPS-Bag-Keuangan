import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/formatCurrency'
import type { TreeNode } from '@/features/anggaran/application/useAnggaran'

interface TreeRowProps {
    node: TreeNode
    level?: number
}

export default function AnggaranTreeRow({ node, level = 0 }: TreeRowProps) {
    const [open, setOpen] = useState(level < 1)
    const hasChildren = node.children && node.children.length > 0

    return (
        <>
            <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3" style={{ paddingLeft: `${24 + level * 24}px` }}>
                    <div className="flex items-center gap-2">
                        {hasChildren ? (
                            <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-slate-600">
                                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                        ) : (
                            <span className="w-4" />
                        )}
                        <span className="font-mono text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{node.kode}</span>
                        <span className="text-sm text-slate-700">{node.uraian}</span>
                    </div>
                </td>
                <td className="px-6 py-3 text-right text-sm tabular-nums">{formatCurrency(node.pagu)}</td>
                <td className="px-6 py-3 text-right text-sm tabular-nums">{formatCurrency(node.realisasi)}</td>
                <td className={`px-6 py-3 text-right text-sm tabular-nums font-semibold ${node.sisa < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {formatCurrency(node.sisa)}
                </td>
            </tr>
            {open && hasChildren && node.children!.map((child, index) => (
                <AnggaranTreeRow key={child.id || `child-${index}`} node={child} level={level + 1} />
            ))}
        </>
    )
}
