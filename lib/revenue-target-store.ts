import { createClient } from '@supabase/supabase-js'

export interface StoredRevenueTarget {
  id: string
  assignee_id: string
  title: string
  target_amount: number
  lead_target: number
  conversion_target: number
  period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom'
  start_date: string
  end_date: string
  bonus_percentage: number
  notes: string | null
  status: 'active' | 'archived'
  created_by: string | null
  created_at: string
  updated_at: string
}

const BUCKET = 'crm-system-data'
const TARGET_FILE = 'revenue-targets.json'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function ensureBucket() {
  const supabase = adminClient()
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some(bucket => bucket.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: false })
  }
  return supabase
}

export async function loadRevenueTargets(): Promise<StoredRevenueTarget[]> {
  const supabase = await ensureBucket()
  const { data, error } = await supabase.storage.from(BUCKET).download(TARGET_FILE)
  if (error) {
    await supabase.storage.from(BUCKET).upload(TARGET_FILE, '[]', {
      contentType: 'application/json',
      upsert: true,
    })
    return []
  }

  try {
    const text = await data.text()
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveRevenueTargets(targets: StoredRevenueTarget[]) {
  const supabase = await ensureBucket()
  const { error } = await supabase.storage.from(BUCKET).upload(TARGET_FILE, JSON.stringify(targets, null, 2), {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw error
}
