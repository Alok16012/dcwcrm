import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const AUTO_PUNCHOUT_TIME = '18:00:00' // 6 PM

function calcStatus(clockIn: string): 'present' | 'half_day' {
  const [ih, im] = clockIn.slice(0, 5).split(':').map(Number)
  const mins = (18 * 60) - (ih * 60 + im)
  return mins >= 360 ? 'present' : 'half_day'
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const today = todayIST()

  // Find all employees who punched in but not out today
  const { data, error } = await supabase
    .from('attendance')
    .select('id, clock_in')
    .eq('date', today)
    .not('clock_in', 'is', null)
    .is('clock_out', null)

  if (error) {
    console.error('auto-punchout fetch error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  // Update each record
  const updates = data.map(r => ({
    id: r.id,
    clock_out: AUTO_PUNCHOUT_TIME,
    status: calcStatus(r.clock_in as string),
  }))

  // Batch update (upsert by id)
  const { error: upErr } = await supabase
    .from('attendance')
    .upsert(updates as never, { onConflict: 'id' })

  if (upErr) {
    console.error('auto-punchout update error', upErr)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  console.log(`auto-punchout: ${updates.length} records closed for ${today}`)
  return NextResponse.json({ updated: updates.length, date: today })
}
