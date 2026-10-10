'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import {
  MessageCircle, Smartphone, CheckCircle2, AlertTriangle, RefreshCw, Search,
  PauseCircle, PlayCircle, UserRound, Bot, Headset, Flame, ExternalLink, WifiOff, Unlink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BotStatus {
  status: string
  connected_as: string | null
  qr: string | null
  pairing_code: string | null
  ai_provider: string | null
  ai_used_today: number | null
  last_error: string | null
  relink_requested_at?: string | null
  updated_at: string
}

export interface Conversation {
  id: string
  phone: string | null
  name: string | null
  flow: string | null
  status: string
  temperature: string | null
  leadId: string | null
  humanUntil: string | null
  lastInbound: string | null
  createdAt: string
  summary: string | null
}

interface Message {
  id: string
  direction: 'in' | 'out'
  author: 'student' | 'bot' | 'human'
  body: string | null
  media: string | null
  ai_used: boolean
  created_at: string
}

/** The bot writes a heartbeat every minute; three missed means it is down. */
const STALE_MS = 3 * 60 * 1000

const TEMP_STYLE: Record<string, string> = {
  Hot: 'bg-red-100 text-red-700',
  Warm: 'bg-amber-100 text-amber-700',
  Cold: 'bg-slate-100 text-slate-600',
}

const FLOW_LABEL: Record<string, string> = { school: 'Open School', college: 'College' }

export default function WhatsAppClient({
  initialStatus, conversations, canManage, connectionOnly = false,
}: { initialStatus: BotStatus | null; conversations: Conversation[]; canManage: boolean; connectionOnly?: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [status, setStatus] = useState<BotStatus | null>(initialStatus)
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'hot' | 'handoff' | 'paused'>('all')

  const connected = status?.status === 'connected'
  const stale = !status || Date.now() - new Date(status.updated_at).getTime() > STALE_MS

  // While waiting to be linked the QR rotates every ~20s, so keep it fresh.
  // Once connected, a slow poll is enough to notice a disconnect.
  useEffect(() => {
    if (!canManage) return
    const supabase = createClient() as any
    const tick = async () => {
      const { data } = await supabase.from('wa_bot_status').select('*').maybeSingle()
      if (data) setStatus(data)
    }
    const id = setInterval(tick, connected ? 30000 : 4000)
    return () => clearInterval(id)
  }, [canManage, connected])

  const loadMessages = useCallback(async (c: Conversation) => {
    setSelected(c)
    setLoadingMsgs(true)
    const supabase = createClient() as any
    const { data } = await supabase
      .from('wa_messages')
      .select('id, direction, author, body, media, ai_used, created_at')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: true })
      .limit(500)
    setMessages((data ?? []) as Message[])
    setLoadingMsgs(false)
  }, [])

  const isPaused = (c: Conversation) => Boolean(c.humanUntil && new Date(c.humanUntil).getTime() > Date.now())

  async function setPaused(c: Conversation, pause: boolean) {
    const supabase = createClient() as any
    // Paused = a counsellor owns the chat. Far future rather than a flag, so the
    // bot's single "is a human handling this?" check covers both cases.
    const until = pause ? new Date(Date.now() + 3650 * 24 * 3600 * 1000).toISOString() : null
    const { error } = await supabase.from('wa_conversations').update({ human_until: until }).eq('id', c.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(pause ? 'Bot paused in this chat' : 'Bot resumed in this chat')
    setSelected(s => (s && s.id === c.id ? { ...s, humanUntil: until } : s))
    startTransition(() => router.refresh())
  }

  const shown = useMemo(() => conversations.filter(c => {
    if (filter === 'hot' && c.temperature !== 'Hot') return false
    if (filter === 'handoff' && c.status !== 'handoff') return false
    if (filter === 'paused' && !isPaused(c)) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [c.name, c.phone, c.summary].some(v => v?.toLowerCase().includes(q))
  }), [conversations, filter, query])

  const today = new Date().toDateString()
  const stats = {
    today: conversations.filter(c => c.createdAt && new Date(c.createdAt).toDateString() === today).length,
    hot: conversations.filter(c => c.temperature === 'Hot').length,
    handoff: conversations.filter(c => c.status === 'handoff').length,
    paused: conversations.filter(isPaused).length,
  }

  return (
    <div className="space-y-5">
      {/* ----------------------------------------------- connection ----- */}
      {canManage && (
        <div className={`rounded-2xl border p-5 shadow-sm ${
          connected && !stale ? 'bg-white border-gray-200' : 'bg-amber-50/40 border-amber-200'
        }`}>
          {stale ? (
            <div className="flex items-start gap-3">
              <WifiOff className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-900">Bot is not running</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  No heartbeat from the bot service
                  {status ? ` since ${formatDistanceToNow(parseISO(status.updated_at), { addSuffix: true })}` : ''}.
                  Check the <b>whatsapp-bot</b> service on Railway.
                </p>
              </div>
            </div>
          ) : connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </span>
                <div>
                  <p className="font-bold text-gray-900">Connected — answering students</p>
                  <p className="text-sm text-gray-500">
                    {status?.connected_as ?? 'WhatsApp'} · AI: {status?.ai_provider === 'none' ? 'off (script only)' : `${status?.ai_provider} · ${status?.ai_used_today ?? 0} calls today`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  checked {formatDistanceToNow(parseISO(status!.updated_at), { addSuffix: true })}
                </span>
                <RelinkButton
                  pending={Boolean(status?.relink_requested_at)}
                  label="Unlink / link another number"
                  confirmText={`Unlink ${status?.connected_as ?? 'this number'}? The bot stops answering until a number is linked again.`}
                  onRequested={at => setStatus(s => (s ? { ...s, relink_requested_at: at } : s))}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[auto,1fr] items-center">
              <div className="flex justify-center">
                {status?.qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={status.qr}
                    alt="WhatsApp link QR"
                    className="w-64 h-64 rounded-xl border-4 border-white shadow-md bg-white"
                  />
                ) : (
                  <div className="w-64 h-64 rounded-xl border border-dashed border-gray-300 bg-white flex flex-col items-center justify-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <p className="text-xs mt-2">Waiting for a QR…</p>
                  </div>
                )}
              </div>

              <div>
                <p className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-600" /> Link the bot&apos;s WhatsApp number
                </p>
                <ol className="mt-3 space-y-2 text-sm text-gray-700 list-decimal list-inside">
                  <li>Open WhatsApp on the <b>bot&apos;s phone</b> — the new, dedicated number.</li>
                  <li>Go to <b>Settings → Linked devices → Link a device</b>.</li>
                  <li>Point the camera at this QR. It refreshes by itself every few seconds.</li>
                </ol>
                {status?.pairing_code && (
                  <p className="mt-4 text-sm text-gray-700">
                    Or tap <b>“Link with phone number instead”</b> and enter:{' '}
                    <span className="font-mono text-lg font-bold tracking-widest text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1">
                      {status.pairing_code}
                    </span>
                  </p>
                )}
                <p className="mt-4 text-xs text-amber-800 bg-amber-100/70 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Whoever scans this becomes the bot. Use only the dedicated bot number — never your main business number.
                </p>
                {status?.last_error && (
                  <p className="mt-2 text-xs text-gray-500">{status.last_error}</p>
                )}
                <div className="mt-4">
                  <RelinkButton
                    pending={Boolean(status?.relink_requested_at)}
                    label="Stuck? Start a fresh link"
                    confirmText="Throw away the current link attempt and show a new QR?"
                    onRequested={at => setStatus(s => (s ? { ...s, relink_requested_at: at } : s))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!connectionOnly && <>
      {/* ---------------------------------------------------- stats ----- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'New chats today', value: stats.today, icon: MessageCircle, tone: 'text-emerald-600 bg-emerald-50' },
          { label: 'Hot leads', value: stats.hot, icon: Flame, tone: 'text-red-600 bg-red-50' },
          { label: 'Handed to counsellor', value: stats.handoff, icon: Headset, tone: 'text-blue-600 bg-blue-50' },
          { label: 'Bot paused', value: stats.paused, icon: PauseCircle, tone: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${s.tone}`}>
              <s.icon className="w-[18px] h-[18px]" />
            </span>
            <p className="text-2xl font-bold text-gray-900 mt-3 tabular-nums">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* -------------------------------------------- conversations ----- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[70vh]">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, number, course…"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {([['all', 'All'], ['hot', 'Hot'], ['handoff', 'Handed off'], ['paused', 'Paused']] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${filter === k ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {l}
                </button>
              ))}
              <button
                onClick={() => startTransition(() => router.refresh())}
                className="ml-auto px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-gray-100">
            {shown.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">
                {conversations.length === 0 ? 'No WhatsApp chats yet. They appear here as students message the bot.' : 'Nothing matches.'}
              </p>
            ) : shown.map(c => (
              <button
                key={c.id}
                onClick={() => loadMessages(c)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selected?.id === c.id ? 'bg-emerald-50/60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900 truncate">{c.name || (c.phone ? `+${c.phone}` : 'Unknown')}</p>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {c.lastInbound ? formatDistanceToNow(parseISO(c.lastInbound), { addSuffix: true }) : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{c.summary ?? (c.phone ? `+${c.phone}` : '—')}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {c.flow && <Tag cls="bg-gray-100 text-gray-600">{FLOW_LABEL[c.flow] ?? c.flow}</Tag>}
                  {c.temperature && <Tag cls={TEMP_STYLE[c.temperature] ?? ''}>{c.temperature}</Tag>}
                  {c.status === 'handoff' && <Tag cls="bg-blue-100 text-blue-700">Handed off</Tag>}
                  {c.status === 'opted_out' && <Tag cls="bg-gray-200 text-gray-600">Opted out</Tag>}
                  {isPaused(c) && <Tag cls="bg-amber-100 text-amber-700">Bot paused</Tag>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* transcript */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[70vh] min-h-[320px]">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <MessageCircle className="w-8 h-8" />
              <p className="text-sm mt-2">Pick a chat to read it</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{selected.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{selected.phone ? `+${selected.phone}` : 'number not resolved yet'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selected.leadId && (
                    <Link
                      href={`/leads/${selected.leadId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Open lead <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {canManage && (isPaused(selected) ? (
                    <button
                      onClick={() => setPaused(selected, false)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Resume bot
                    </button>
                  ) : (
                    <button
                      onClick={() => setPaused(selected, true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      <PauseCircle className="w-3.5 h-3.5" /> Pause bot here
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#efeae2]">
                {loadingMsgs ? (
                  <p className="text-center text-sm text-gray-500">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No messages recorded.</p>
                ) : messages.map(m => {
                  const mine = m.direction === 'out'
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 shadow-sm ${
                        mine ? (m.author === 'human' ? 'bg-blue-100' : 'bg-[#d9fdd3]') : 'bg-white'
                      }`}>
                        <p className="text-[10px] font-semibold text-gray-400 mb-0.5 inline-flex items-center gap-1">
                          {m.author === 'student' && <><UserRound className="w-3 h-3" /> Student</>}
                          {m.author === 'bot' && <><Bot className="w-3 h-3" /> Bot{m.ai_used ? ' · AI' : ''}</>}
                          {m.author === 'human' && <><Headset className="w-3 h-3" /> Counsellor</>}
                        </p>
                        {m.media && !m.body && <p className="text-sm italic text-gray-500">[{m.media}]</p>}
                        {m.body && <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.body}</p>}
                        <p className="text-[10px] text-gray-400 text-right mt-0.5">{format(parseISO(m.created_at), 'dd MMM, hh:mm a')}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
      </>}
    </div>
  )
}

function Tag({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{children}</span>
}

/**
 * Ask the bot to unlink its number and show a fresh QR — to recover a stuck
 * connection or switch the bot to another number. The bot polls for this
 * every ~10s; the QR then appears in the card above.
 */
function RelinkButton({ pending, label, confirmText, onRequested }: {
  pending: boolean; label: string; confirmText: string; onRequested: (at: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function request() {
    setBusy(true)
    const at = new Date().toISOString()
    const supabase = createClient() as any
    const { error } = await supabase.from('wa_bot_status').update({ relink_requested_at: at }).eq('id', true)
    setBusy(false)
    setConfirming(false)
    if (error) {
      toast.error(error.message)
      return
    }
    onRequested(at)
    toast.success('Unlinking — a new QR will appear here in a few seconds')
  }

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Unlinking…
      </span>
    )
  }
  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-700">{confirmText}</span>
        <button onClick={request} disabled={busy}
          className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-50">
          {busy ? 'Requesting…' : 'Yes, unlink'}
        </button>
        <button onClick={() => setConfirming(false)} className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600">
          Cancel
        </button>
      </span>
    )
  }
  return (
    <button onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50">
      <Unlink className="w-3.5 h-3.5" /> {label}
    </button>
  )
}
