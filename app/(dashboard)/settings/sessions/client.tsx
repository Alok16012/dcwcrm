'use client'
import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, CalendarDays, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Session } from '@/types/app.types'

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

export function SessionsClient({ sessions: initial }: { sessions: Session[] }) {
    const [sessions, setSessions] = useState(initial)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [adding, setAdding] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
    const [isPending, startTransition] = useTransition()
    const supabase = createClient()

    async function saveSession(id: string, name: string) {
        if (!name.trim()) return
        startTransition(async () => {
            const { error } = await supabase.from('sessions').update({ name: name.trim() } as never).eq('id', id)
            if (error) { toast.error('Failed to update'); return }
            setSessions((prev) => prev.map((s) => s.id === id ? { ...s, name: name.trim() } : s))
            setEditingId(null)
            toast.success('Session updated')
        })
    }

    async function addSession(name: string) {
        if (!name.trim()) { setAdding(false); return }
        startTransition(async () => {
            const { data, error } = await supabase.from('sessions').insert({ name: name.trim() } as never).select().single()
            if (error) { toast.error(error.message); return }
            setSessions((prev) => [data as Session, ...prev])
            setAdding(false)
            toast.success('Session added!')
        })
    }

    async function deleteSession(id: string) {
        startTransition(async () => {
            const { error } = await supabase.from('sessions').delete().eq('id', id)
            if (error) { toast.error('Failed to delete'); return }
            setSessions((prev) => prev.filter((s) => s.id !== id))
            toast.success('Session deleted')
        })
        setDeleteTarget(null)
    }

    return (
        <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Academic Sessions</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage academic sessions for leads and students</p>
                </div>
                <Button onClick={() => setAdding(true)} disabled={adding} className="gap-1.5">
                    <Plus className="w-4 h-4" /> Add Session
                </Button>
            </div>

            {adding && (
                <div className="bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl p-4 mb-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="w-4 h-4 text-blue-600" />
                    </div>
                    <InlineEdit
                        value=""
                        placeholder="Session name e.g. 2023-2024..."
                        onSave={addSession}
                        onCancel={() => setAdding(false)}
                    />
                </div>
            )}

            {sessions.length === 0 && !adding && (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                    <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No sessions yet</p>
                    <p className="text-sm text-gray-400 mt-1">Add your first session to get started</p>
                    <Button className="mt-4 gap-1.5" onClick={() => setAdding(true)}>
                        <Plus className="w-4 h-4" /> Add Session
                    </Button>
                </div>
            )}

            <div className="space-y-3">
                {sessions.map((session) => (
                    <div key={session.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <CalendarDays className="w-4 h-4 text-blue-600" />
                            </div>

                            {editingId === session.id ? (
                                <InlineEdit
                                    value={session.name}
                                    placeholder="Session name"
                                    onSave={(v) => saveSession(session.id, v)}
                                    onCancel={() => setEditingId(null)}
                                />
                            ) : (
                                <>
                                    <span className="font-semibold text-gray-800 flex-1">{session.name}</span>

                                    <button
                                        onClick={() => setEditingId(session.id)}
                                        className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget({ id: session.id, name: session.name })}
                                        className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {deleteTarget && (
                <ConfirmDialog
                    open={true}
                    title="Delete Session"
                    description={`"${deleteTarget.name}" will be permanently deleted. Are you sure?`}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => deleteSession(deleteTarget.id)}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    )
}
