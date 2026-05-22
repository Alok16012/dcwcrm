import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: any }
    if (!profile || !['admin', 'backend'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { student_id, ...updates } = body
    if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 })

    const allowed = [
      'verification_status', 'exam_status', 'result_status',
      'admit_card_url', 'enrollment_card_url', 'id_card_url',
      'marksheet_url', 'certificate_url', 'admission_progress',
      'university_name', 'board_name', 'father_name',
      'guardian_name', 'guardian_phone', 'guardian_relationship',
      'dob', 'gender', 'address', 'state', 'pincode',
      'profile_photo_url', 'portal_active',
    ]
    const filtered: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in updates) filtered[k] = updates[k]
    }

    const { error } = await (supabase as any).from('students').update(filtered).eq('id', student_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
