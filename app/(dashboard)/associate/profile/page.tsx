'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'

interface Associate {
  name: string
  phone: string
  father_phone: string | null
  email: string
  associate_code: string | null
  aadhar_number: string | null
  pan_number: string | null
  current_address: string | null
  current_city: string | null
  current_state: string | null
  current_pincode: string | null
  permanent_address: string | null
  permanent_city: string | null
  permanent_state: string | null
  permanent_pincode: string | null
  same_as_current: boolean
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  account_holder_name: string | null
  coordinator_name: string | null
  coordinator_id: string | null
  state: string | null
  district: string | null
  city: string | null
  institution_name: string | null
  institution_address: string | null
}

export default function AssociateProfilePage() {
  const supabase = createClient()
  const db = supabase as any
  const [associate, setAssociate] = useState<Associate | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await db.from('associates').select('*').eq('user_id', user.id).single()
    setAssociate(data as Associate)
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!associate) return null

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your registered information</p>
      </div>

      <Section title="Personal Information">
        <Row label="Full Name" value={associate.name} />
        <Row label="Phone" value={associate.phone} />
        <Row label="Father's Phone" value={associate.father_phone} />
        <Row label="Email" value={associate.email} copyable />
        <Row label="Associate Code" value={associate.associate_code} copyable />
        <Row label="Aadhaar Number" value={associate.aadhar_number} masked />
        <Row label="PAN Number" value={associate.pan_number} />
        <Row label="State" value={associate.state} />
        <Row label="District" value={associate.district} />
        <Row label="City" value={associate.city} />
        <Row label="Coordinator Name" value={associate.coordinator_name} />
      </Section>

      {(associate.institution_name || associate.institution_address) && (
        <Section title="Institution">
          <Row label="Institution Name" value={associate.institution_name} />
          <Row label="Institution Address" value={associate.institution_address} />
        </Section>
      )}

      <Section title="Current Address">
        <Row label="Address" value={associate.current_address} />
        <Row label="City" value={associate.current_city} />
        <Row label="State" value={associate.current_state} />
        <Row label="Pincode" value={associate.current_pincode} />
      </Section>

      <Section title={`Permanent Address${associate.same_as_current ? ' (same as current)' : ''}`}>
        <Row label="Address" value={associate.same_as_current ? associate.current_address : associate.permanent_address} />
        <Row label="City" value={associate.same_as_current ? associate.current_city : associate.permanent_city} />
        <Row label="State" value={associate.same_as_current ? associate.current_state : associate.permanent_state} />
        <Row label="Pincode" value={associate.same_as_current ? associate.current_pincode : associate.permanent_pincode} />
      </Section>

      <Section title="Bank Details">
        <Row label="Account Holder" value={associate.account_holder_name} />
        <Row label="Bank Name" value={associate.bank_name} />
        <Row label="Account Number" value={associate.account_number} masked />
        <Row label="IFSC Code" value={associate.ifsc_code} copyable />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <h4 className="font-semibold text-xs text-blue-700 uppercase tracking-wide border-b pb-2 mb-4">{title}</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
  )
}

function Row({ label, value, copyable, masked }: { label: string; value: string | null | undefined; copyable?: boolean; masked?: boolean }) {
  const display = masked && value
    ? value.slice(0, -4).replace(/./g, '•') + value.slice(-4)
    : (value || '—')
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-gray-900">{display}</p>
        {copyable && value && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`) }}
            className="text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
