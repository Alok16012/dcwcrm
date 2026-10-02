'use client'

import { useState } from 'react'
import { MessageCircle, SlidersHorizontal } from 'lucide-react'
import WhatsAppClient, { type Conversation, type BotStatus } from './WhatsAppClient'
import ControlCentre from './ControlCentre'

/** Chats (what the bot is doing) and Control Centre (how it should behave). */
export default function WhatsAppPageTabs({ initialStatus, conversations, canManage, canSeeChats, canControl }: {
  initialStatus: BotStatus | null; conversations: Conversation[]; canManage: boolean
  canSeeChats: boolean; canControl: boolean
}) {
  const [view, setView] = useState<'chats' | 'control'>(canSeeChats ? 'chats' : 'control')
  const tabs = ([
    ['chats', 'Chats', MessageCircle],
    ['control', 'Control Centre', SlidersHorizontal],
  ] as const).filter(([key]) => (key === 'chats' ? canSeeChats : canControl))
  return (
    <div className="space-y-5">
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
        ? <WhatsAppClient initialStatus={initialStatus} conversations={conversations} canManage={canManage} />
        : (
          <>
            {/* Backend has no Chats tab, so keep the bot's connection / QR here */}
            {!canSeeChats && canManage && <WhatsAppClient initialStatus={initialStatus} conversations={[]} canManage connectionOnly />}
            <ControlCentre aiProvider={initialStatus?.ai_provider ?? null} />
          </>
        )}
    </div>
  )
}
