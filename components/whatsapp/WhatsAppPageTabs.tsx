'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MessageCircle, SlidersHorizontal, Plus, Pencil, Power, Trash2, Smartphone } from 'lucide-react'
import WhatsAppClient, { type Conversation, type BotStatus } from './WhatsAppClient'
import ControlCentre from './ControlCentre'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A linked WhatsApp number (wa_accounts, migration 126) and its live status. */
export interface WaAccount extends BotStatus {
  id: string
  label: string
  phone: string | null
  is_active: boolean
  sort_order: number
}

/** "Number 1" — everything from before several numbers belongs to it. */
const FIRST_ACCOUNT = '00000000-0000-0000-0000-000000000001'
const STALE_MS = 3 * 60 * 1000
const PICK_KEY = 'dcw-wa-account'

const db = () => createClient() as any

function dot(a: WaAccount) {
  if (!a.is_active) return 'bg-gray-300'
  const beat = a.heartbeat_at ? new Date(a.heartbeat_at).getTime() : 0
  if (!beat || Date.now() - beat > STALE_MS) return 'bg-red-500'
  return a.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'
}

/** Chats (what the bot is doing) and Control Centre (how it should behave), per WhatsApp number. */
export default function WhatsAppPageTabs({ initialStatus, initialAccounts, conversations, canManage, canSeeChats, canControl }: {
  /** The old single-number status, used only until migration 126 has run. */
  initialStatus: BotStatus | null
  /** null when wa_accounts does not exist yet (migration 126 not run) or the viewer cannot manage numbers. */
  initialAccounts: WaAccount[] | null
  conversations: (Conversation & { accountId?: string | null })[]
  canManage: boolean
  canSeeChats: boolean; canControl: boolean
}) {
  const [view, setView] = useState<'chats' | 'control'>(canSeeChats ? 'chats' : 'control')
  const [accounts, setAccounts] = useState<WaAccount[] | null>(initialAccounts)
  const [picked, setPicked] = useState<string>(FIRST_ACCOUNT)
  // The last number picked on this browser (read after mount, so server and client render alike).
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(PICK_KEY) } catch { /* ignore */ }
    if (saved) void Promise.resolve().then(() => setPicked(saved))
  }, [])
  const [editing, setEditing] = useState<{ id?: string; label: string; phone: string } | null>(null)
  const [removing, setRemoving] = useState<WaAccount | null>(null)
  const [saving, setSaving] = useState(false)

  const multi = Boolean(accounts && accounts.length > 0)
  const account = accounts?.find(a => a.id === picked) ?? accounts?.[0] ?? null
  const accountId = account?.id ?? null

  useEffect(() => { try { if (accountId) localStorage.setItem(PICK_KEY, accountId) } catch { /* ignore */ } }, [accountId])

  const reload = useCallback(async () => {
    const { data, error } = await db().from('wa_accounts').select('*').order('sort_order').order('created_at')
    if (!error) setAccounts(data as WaAccount[])
  }, [])
  // Keep the dots honest without a page reload.
  useEffect(() => {
    if (!multi) return
    const id = setInterval(reload, 30000)
    return () => clearInterval(id)
  }, [multi, reload])

  const shownConversations = useMemo(
    () => (multi && accountId ? conversations.filter(c => (c.accountId ?? FIRST_ACCOUNT) === accountId) : conversations),
    [conversations, multi, accountId],
  )

  async function saveAccount() {
    if (!editing) return
    const label = editing.label.trim()
    if (!label) return toast.error('Give the number a name, e.g. "Admissions 2"')
    const phone = editing.phone.replace(/\D/g, '') || null
    setSaving(true)
    const { data: { user } } = await db().auth.getUser()
    const res = editing.id
      ? await db().from('wa_accounts').update({ label, phone, updated_at: new Date().toISOString() }).eq('id', editing.id).select().single()
      : await db().from('wa_accounts').insert({
          label, phone, created_by: user?.id ?? null,
          sort_order: (accounts ?? []).reduce((m, a) => Math.max(m, a.sort_order), 0) + 1,
        }).select().single()
    setSaving(false)
    if (res.error) return toast.error(res.error.message)
    toast.success(editing.id ? 'Saved' : `${label} added — its QR appears here within a minute`)
    setEditing(null)
    await reload()
    if (!editing.id) setPicked(res.data.id)
  }

  async function toggleActive(a: WaAccount) {
    const { error } = await db().from('wa_accounts').update({ is_active: !a.is_active, updated_at: new Date().toISOString() }).eq('id', a.id)
    if (error) return toast.error(error.message)
    toast.success(a.is_active ? `${a.label} switched off — the bot stops answering on it` : `${a.label} switched on`)
    reload()
  }

  async function remove(a: WaAccount) {
    const { error } = await db().from('wa_accounts').delete().eq('id', a.id)
    setRemoving(null)
    if (error) return toast.error(error.message)
    toast.success(`${a.label} removed`)
    setPicked(FIRST_ACCOUNT)
    reload()
  }

  const tabs = ([
    ['chats', 'Chats', MessageCircle],
    ['control', 'Control Centre', SlidersHorizontal],
  ] as const).filter(([key]) => (key === 'chats' ? canSeeChats : canControl))

  return (
    <div className="space-y-5">
      {/* The numbers the bot runs on */}
      {canManage && multi && (
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Smartphone className="w-3.5 h-3.5" /> Numbers
            </span>
            {accounts!.map(a => (
              <button key={a.id} onClick={() => setPicked(a.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition ${
                  a.id === accountId ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                } ${a.is_active ? '' : 'opacity-60'}`}>
                <span className={`h-2 w-2 rounded-full ${dot(a)}`} />
                {a.label}
                {a.connected_as && <span className="text-[11px] font-normal text-gray-400">{a.connected_as}</span>}
              </button>
            ))}
            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing({ label: '', phone: '' })}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add number
            </Button>
            {account && (
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-8" title="Rename"
                  onClick={() => setEditing({ id: account.id, label: account.label, phone: account.phone ?? '' })}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8" title={account.is_active ? 'Switch off' : 'Switch on'} onClick={() => toggleActive(account)}>
                  <Power className={`w-3.5 h-3.5 ${account.is_active ? 'text-emerald-600' : 'text-gray-400'}`} />
                </Button>
                {account.id !== FIRST_ACCOUNT && (
                  <Button size="sm" variant="ghost" className="h-8 text-red-500 hover:text-red-600" title="Remove" onClick={() => setRemoving(account)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {tabs.length > 1 && tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setView(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              view === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {view === 'chats'
        ? <WhatsAppClient key={accountId ?? 'single'} accountId={accountId} initialStatus={account ?? initialStatus} conversations={shownConversations} canManage={canManage} />
        : (
          <>
            {/* Backend has no Chats tab, so keep the bot's connection / QR here */}
            {!canSeeChats && canManage && (
              <WhatsAppClient key={accountId ?? 'single'} accountId={accountId} initialStatus={account ?? initialStatus} conversations={[]} canManage connectionOnly />
            )}
            <ControlCentre key={accountId ?? 'single'} aiProvider={(account ?? initialStatus)?.ai_provider ?? null} accountId={accountId} />
          </>
        )}

      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <div>
              <DialogHeader><DialogTitle>{editing.id ? 'Edit number' : 'Add a WhatsApp number'}</DialogTitle></DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name *</Label>
                  <Input value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} placeholder="e.g. Open Schooling, Degree, Ads number" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone number (optional)</Label>
                  <Input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} placeholder="91XXXXXXXXXX — to link with a code instead of a QR" />
                </div>
                {!editing.id && (
                  <p className="text-xs text-gray-500">
                    After saving, this number&apos;s QR shows here within a minute. Scan it from WhatsApp on that phone:
                    Settings → Linked devices → Link a device. It gets its own settings and outreach; copy the admission
                    script and flows from another number in its Flow Builder.
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button onClick={saveAccount} disabled={saving}>{saving ? 'Saving…' : editing.id ? 'Save' : 'Add number'}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.label}?`}
        description="This unlinks the number from the bot and permanently deletes its chats, flows, admission script, settings and outreach queue. Leads already created stay in the CRM. To pause it instead, use the power button."
        confirmLabel="Remove permanently"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />
    </div>
  )
}
