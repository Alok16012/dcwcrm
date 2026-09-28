import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { type Conversation, type BotStatus } from '@/components/whatsapp/WhatsAppClient'
import WhatsAppPageTabs from '@/components/whatsapp/WhatsAppPageTabs'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

/** Every bot chat, across every counsellor's leads, so management only.
 *  Counsellors see their own bot leads in Leads, with the bot's answers. */
const CAN_VIEW = ['admin', 'backend']
/** Linking the bot hands over the WhatsApp number, so only these may see the QR. */
const CAN_MANAGE = ['admin', 'backend']

export default async function WhatsAppPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !CAN_VIEW.includes(profile.role)) redirect('/dashboard')

  const canManage = CAN_MANAGE.includes(profile.role)
  const db = supabase as any

  const [statusRes, convRes] = await Promise.all([
    canManage ? db.from('wa_bot_status').select('*').maybeSingle() : Promise.resolve({ data: null }),
    db.from('wa_conversations')
      .select('id, chat_jid, phone, push_name, flow, status, lead_temperature, lead_id, human_until, last_inbound_at, last_outbound_at, created_at, state')
      .order('last_inbound_at', { ascending: false, nullsFirst: false })
      .limit(300),
  ])

  const conversations: Conversation[] = ((convRes.data ?? []) as any[]).map(c => ({
    id: c.id,
    phone: c.phone,
    name: c.push_name,
    flow: c.flow,
    status: c.status,
    temperature: c.lead_temperature,
    leadId: c.lead_id,
    humanUntil: c.human_until,
    lastInbound: c.last_inbound_at,
    createdAt: c.created_at,
    summary: c.state?.answers ? summarise(c.flow, c.state.answers) : null,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Bot</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Admission chatbot — its chats, what it knows, and who it follows up
        </p>
      </div>
      <WhatsAppPageTabs
        initialStatus={(statusRes.data ?? null) as BotStatus | null}
        conversations={conversations}
        canManage={canManage}
      />
    </div>
  )
}

/** A one-line glance at what the bot has learned so far. */
function summarise(flow: string | null, a: Record<string, unknown>): string | null {
  const parts = flow === 'school'
    ? [a.klass, a.situation, a.previousBoard, a.currentPercent]
    : [a.level, a.course, a.mode, a.percent]
  const s = parts.filter(Boolean).join(' · ')
  return s || null
}
