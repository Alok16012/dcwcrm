'use client'
import { useState, useTransition, useRef } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Building2, School, X, Check, IndianRupee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/types/app.types'

interface SubSectionRow { id: string; name: string; is_active: boolean; department_id: string }
interface DepartmentRow { id: string; name: string; is_active: boolean; department_sub_sections: SubSectionRow[]; dept_fund?: number | null }

function InlineEdit({ value, onSave, onCancel, placeholder }: {
    value: string; onSave: (v: string) => void; onCancel: () => void; placeholder?: string
}) {
    const [text, setText] = useState(value)
    return (
        <div className="flex items-center gap-2 flex-1">
            <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSave(text); if (e.key === 'Escape') onCancel() }}
                placeholder={placeholder}
                className="h-8 text-sm border-blue-300 focus:border-blue-500"
            />
            <button onClick={() => onSave(text)} className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 flex-shrink-0">
                <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={onCancel} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}

function AddSubSectionsPanel({ departmentId, onSave, onCancel, saving }: {
    departmentId: string
    onSave: (names: string[]) => void
    onCancel: () => void
    saving: boolean
}) {
    const [rows, setRows] = useState<string[]>([''])
    const lastInputRef = useRef<HTMLInputElement>(null)

    function updateRow(i: number, val: string) {
        setRows((prev) => prev.map((r, idx) => idx === i ? val : r))
    }
    function addRow() {
        setRows((prev) => [...prev, ''])
        setTimeout(() => lastInputRef.current?.focus(), 50)
    }
    function removeRow(i: number) {
        if (rows.length === 1) { setRows(['']); return }
        setRows((prev) => prev.filter((_, idx) => idx !== i))
    }
    function handleKeyDown(e: React.KeyboardEvent, i: number) {
        if (e.key === 'Enter') { e.preventDefault(); addRow() }
        if (e.key === 'Escape') onCancel()
    }
    function handleSave() {
        const names = rows.map((r) => r.trim()).filter(Boolean)
        if (!names.length) { onCancel(); return }
        onSave(names)
    }

    return (
        <div className="border-t border-purple-200 bg-purple-50/40 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5" /> Add University / Board
                <span className="text-purple-500 font-normal normal-case">(Press Enter for new row)</span>
            </p>
            <div className="space-y-1.5">
                {rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-purple-500 font-bold w-5 text-right flex-shrink-0">{i + 1}.</span>
                        <Input
                            ref={i === rows.length - 1 ? lastInputRef : undefined}
                            value={row}
                            onChange={(e) => updateRow(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, i)}
                            placeholder={`University / Board ${i + 1} name...`}
                            className="h-8 text-sm bg-white border-purple-200 focus:border-purple-400"
                            autoFocus={i === 0}
                        />
                        <button onClick={() => removeRow(i)} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
            <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium mt-1 px-1">
                <Plus className="w-3.5 h-3.5" /> Add another
            </button>
            <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={handleSave} disabled={saving || rows.every((r) => !r.trim())} className="bg-purple-600 hover:bg-purple-700 h-8 text-xs px-4">
                    {saving ? 'Saving...' : `Save ${rows.filter((r) => r.trim()).length} Item${rows.filter((r) => r.trim()).length !== 1 ? 's' : ''}`}
                </Button>
                <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
            </div>
        </div>
    )
}

export function DepartmentsClient({ departments: initial }: { departments: DepartmentRow[] }) {
    const [departments, setDepartments] = useState(initial)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [editingDept, setEditingDept] = useState<string | null>(null)
    const [editingSub, setEditingSub] = useState<string | null>(null)
    const [addingSubTo, setAddingSubTo] = useState<string | null>(null)
    const [addingDept, setAddingDept] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'dept' | 'sub'; id: string; name: string; deptId?: string } | null>(null)
    const [editFundDept, setEditFundDept] = useState<DepartmentRow | null>(null)
    const [fundValue, setFundValue] = useState('')
    const [isPending, startTransition] = useTransition()
    const supabase = createClient()

    function toggleExpand(id: string) {
        setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }

    async function saveDept(id: string, name: string) {
        if (!name.trim()) return
        startTransition(async () => {
            const { error } = await supabase.from('departments').update({ name: name.trim() } as never).eq('id', id)
            if (error) { toast.error('Failed to update'); return }
            setDepartments((prev) => prev.map((d) => d.id === id ? { ...d, name: name.trim() } : d))
            setEditingDept(null)
            toast.success('Department updated')
        })
    }

    async function addDept(name: string) {
        if (!name.trim()) { setAddingDept(false); return }
        startTransition(async () => {
            const { data, error } = await supabase.from('departments').insert({ name: name.trim() } as never).select().single()
            if (error) { toast.error(error.message); return }
            setDepartments((prev) => [...prev, { ...(data as any), department_sub_sections: [] }])
            setAddingDept(false)
            toast.success('Department added!')
        })
    }

    async function deleteDept(id: string) {
        startTransition(async () => {
            const { error } = await supabase.from('departments').delete().eq('id', id)
            if (error) { toast.error('Failed to delete'); return }
            setDepartments((prev) => prev.filter((d) => d.id !== id))
            toast.success('Department deleted')
        })
        setDeleteTarget(null)
    }

    async function saveSub(deptId: string, subId: string, name: string) {
        if (!name.trim()) return
        startTransition(async () => {
            const { error } = await supabase.from('department_sub_sections').update({ name: name.trim() } as never).eq('id', subId)
            if (error) { toast.error('Failed to update'); return }
            setDepartments((prev) => prev.map((d) => d.id === deptId
                ? { ...d, department_sub_sections: d.department_sub_sections.map((s) => s.id === subId ? { ...s, name: name.trim() } : s) }
                : d
            ))
            setEditingSub(null)
            toast.success('University/Board updated')
        })
    }

    async function addMultipleSubs(deptId: string, names: string[]) {
        startTransition(async () => {
            const rows = names.map((name) => ({ name, department_id: deptId }))
            const { data, error } = await supabase.from('department_sub_sections').insert(rows as never).select()
            if (error) { toast.error(error.message); return }
            setDepartments((prev) => prev.map((d) => d.id === deptId
                ? { ...d, department_sub_sections: [...d.department_sub_sections, ...(data ?? [])] }
                : d
            ))
            setAddingSubTo(null)
            setExpanded((prev) => new Set(prev).add(deptId))
            toast.success(`${names.length} items added!`)
        })
    }

    async function deleteSub(deptId: string, subId: string) {
        startTransition(async () => {
            const { error } = await supabase.from('department_sub_sections').delete().eq('id', subId)
            if (error) { toast.error('Failed to delete'); return }
            setDepartments((prev) => prev.map((d) => d.id === deptId
                ? { ...d, department_sub_sections: d.department_sub_sections.filter((s) => s.id !== subId) }
                : d
            ))
            toast.success('University/Board deleted')
        })
        setDeleteTarget(null)
    }

    function saveDeptFund() {
        if (!editFundDept) return
        const val = parseFloat(fundValue) || 0
        startTransition(async () => {
            const { error } = await supabase.from('departments').update({ dept_fund: val } as never).eq('id', editFundDept.id)
            if (error) { toast.error('Fund update failed'); return }
            setDepartments((prev) => prev.map((d) => d.id === editFundDept.id ? { ...d, dept_fund: val } : d))
            toast.success('Department fund updated!')
            setEditFundDept(null)
        })
    }

    return (
        <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Departments & Universities/Boards</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage departments and their sub-sections</p>
                </div>
                <Button onClick={() => setAddingDept(true)} disabled={addingDept} className="gap-1.5">
                    <Plus className="w-4 h-4" /> Add Department
                </Button>
            </div>

            {addingDept && (
                <div className="bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl p-4 mb-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <InlineEdit value="" placeholder="Department name e.g. Distance Education, Regular..." onSave={addDept} onCancel={() => setAddingDept(false)} />
                </div>
            )}

            {departments.length === 0 && !addingDept && (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                    <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No departments yet</p>
                    <p className="text-sm text-gray-400 mt-1">Add your first department to get started</p>
                    <Button className="mt-4 gap-1.5" onClick={() => setAddingDept(true)}>
                        <Plus className="w-4 h-4" /> Add Department
                    </Button>
                </div>
            )}

            <div className="space-y-3">
                {departments.map((dept) => (
                    <div key={dept.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                            <button onClick={() => toggleExpand(dept.id)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 transition-colors">
                                {expanded.has(dept.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-indigo-600" />
                            </div>

                            {editingDept === dept.id ? (
                                <InlineEdit value={dept.name} placeholder="Department name" onSave={(v) => saveDept(dept.id, v)} onCancel={() => setEditingDept(null)} />
                            ) : (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-semibold text-gray-800">{dept.name}</span>
                                        {dept.dept_fund != null && (
                                            <span className="ml-2 text-xs text-indigo-600 font-medium">Fund: {formatCurrency(dept.dept_fund)}</span>
                                        )}
                                    </div>
                                    <Badge variant="outline" className="text-xs text-gray-500 border-gray-200 mr-1">
                                        {dept.department_sub_sections.length} board{dept.department_sub_sections.length !== 1 ? 's' : ''}
                                    </Badge>
                                    <button
                                        onClick={() => { setEditFundDept(dept); setFundValue(String(dept.dept_fund ?? 0)) }}
                                        title="Update fund balance"
                                        className="w-7 h-7 rounded-lg hover:bg-indigo-50 text-indigo-500 flex items-center justify-center transition-colors"
                                    >
                                        <IndianRupee className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => { setAddingSubTo(dept.id); setExpanded((p) => new Set(p).add(dept.id)) }} title="Add sub-sections" className="w-7 h-7 rounded-lg hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setEditingDept(dept.id)} className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setDeleteTarget({ type: 'dept', id: dept.id, name: dept.name })} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>

                        {expanded.has(dept.id) && (
                            <div className="border-t border-gray-100">
                                {addingSubTo === dept.id && (
                                    <AddSubSectionsPanel departmentId={dept.id} saving={isPending} onSave={(names) => addMultipleSubs(dept.id, names)} onCancel={() => setAddingSubTo(null)} />
                                )}
                                {dept.department_sub_sections.length === 0 && addingSubTo !== dept.id && (
                                    <div className="px-16 py-3 text-xs text-gray-400 flex items-center gap-2 bg-gray-50/60">
                                        <School className="w-3.5 h-3.5" />
                                        No boards yet —
                                        <button onClick={() => setAddingSubTo(dept.id)} className="text-purple-600 hover:underline font-medium">add one</button>
                                    </div>
                                )}
                                {dept.department_sub_sections.length > 0 && (
                                    <div className="bg-gray-50/60 divide-y divide-gray-100">
                                        {dept.department_sub_sections.map((sub) => (
                                            <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 group">
                                                <div className="w-6 flex-shrink-0" />
                                                <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center flex-shrink-0 ml-7">
                                                    <School className="w-3 h-3 text-purple-600" />
                                                </div>
                                                {editingSub === sub.id ? (
                                                    <InlineEdit value={sub.name} placeholder="University/Board name" onSave={(v) => saveSub(dept.id, sub.id, v)} onCancel={() => setEditingSub(null)} />
                                                ) : (
                                                    <>
                                                        <span className="text-sm text-gray-700 flex-1">{sub.name}</span>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => setEditingSub(sub.id)} className="w-6 h-6 rounded-md hover:bg-blue-100 text-blue-500 flex items-center justify-center">
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                            <button onClick={() => setDeleteTarget({ type: 'sub', id: sub.id, name: sub.name, deptId: dept.id })} className="w-6 h-6 rounded-md hover:bg-red-100 text-red-400 flex items-center justify-center">
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Fund Edit Dialog */}
            <Dialog open={!!editFundDept} onOpenChange={(o) => { if (!o) setEditFundDept(null) }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-indigo-600" /> Update Department Fund
                        </DialogTitle>
                    </DialogHeader>
                    {editFundDept && (
                        <div className="space-y-4 mt-2">
                            <p className="text-sm text-gray-600">Update fund balance for <span className="font-semibold">{editFundDept.name}</span></p>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Fund Amount (₹)</label>
                                <Input type="number" autoFocus value={fundValue} onChange={(e) => setFundValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveDeptFund()} />
                            </div>
                            <div className="flex gap-3">
                                <Button className="flex-1" onClick={saveDeptFund} disabled={isPending}>{isPending ? 'Saving...' : 'Update'}</Button>
                                <Button variant="outline" onClick={() => setEditFundDept(null)}>Cancel</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {deleteTarget && (
                <ConfirmDialog
                    open={true}
                    title={`Delete ${deleteTarget.type === 'dept' ? 'Department' : 'University/Board'}`}
                    description={`"${deleteTarget.name}" will be permanently deleted. Are you sure?`}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => deleteTarget.type === 'dept' ? deleteDept(deleteTarget.id) : deleteSub(deleteTarget.deptId!, deleteTarget.id)}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    )
}
