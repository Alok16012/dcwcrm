import {
  LayoutList, FileText, GraduationCap, ClipboardCheck,
  BookOpen, Award, CheckCircle2, Truck,
} from 'lucide-react'

// One source of truth for the student journey, shown identically on the
// student portal, the associate page and the counselor mentorship page.
// Every stage is derived purely from admin-controlled fields — these views
// only READ this data, they never edit it.
export interface LifecycleStudent {
  verification_status?: string | null
  exam_status?: string | null
  result_status?: string | null
  enrollment_number?: string | null
  portal_active?: boolean | null
  admit_card_url?: string | null
  dispatched?: boolean | null
}

export const STUDENT_LIFECYCLE = [
  { key: 'lead_received',        label: 'Lead Received',        icon: LayoutList },
  { key: 'docs_submitted',       label: 'Docs Submitted',       icon: FileText },
  { key: 'admission_confirmed',  label: 'Admission Confirmed',  icon: GraduationCap },
  { key: 'enrollment_generated', label: 'Enrollment ID',        icon: ClipboardCheck },
  { key: 'exam_form_filled',     label: 'Exam Form',            icon: BookOpen },
  { key: 'hall_ticket_released', label: 'Hall Ticket',          icon: Award },
  { key: 'result_declared',      label: 'Result Declared',      icon: CheckCircle2 },
  { key: 'marksheet_dispatched', label: 'Dispatched',           icon: Truck },
] as const

export function getLifecycleStage(s: LifecycleStudent): Record<string, boolean> {
  return {
    lead_received:        true,
    docs_submitted:       ['in_review', 'verified'].includes(s.verification_status ?? ''),
    admission_confirmed:  !!s.enrollment_number,
    enrollment_generated: !!s.portal_active || !!s.enrollment_number,
    exam_form_filled:     (s.exam_status ?? 'not_scheduled') !== 'not_scheduled',
    hall_ticket_released: !!s.admit_card_url,
    result_declared:      ['declared', 'passed', 'failed'].includes(s.result_status ?? ''),
    marksheet_dispatched: !!s.dispatched,
  }
}

export function lifecycleProgress(s: LifecycleStudent) {
  const done = getLifecycleStage(s)
  const keys = STUDENT_LIFECYCLE.map(l => l.key)
  const lastIdx = keys.reduce((acc, k, i) => (done[k] ? i : acc), -1)
  return {
    done,
    lastIdx,
    total: STUDENT_LIFECYCLE.length,
    pct: Math.round(((lastIdx + 1) / STUDENT_LIFECYCLE.length) * 100),
  }
}

export function StudentLifecycle({
  student,
  title = 'Student Progress',
  className = '',
}: {
  student: LifecycleStudent
  title?: string
  className?: string
}) {
  const { done, lastIdx, total, pct } = lifecycleProgress(student)
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <span className="text-[10px] font-bold text-emerald-600">{pct}% · {lastIdx + 1}/{total}</span>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
        {STUDENT_LIFECYCLE.map((step, i) => {
          const isDone = done[step.key]
          const isCurrent = i === lastIdx + 1
          const Icon = step.icon
          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5 text-center">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                isDone
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-200'
                  : isCurrent
                    ? 'bg-blue-100 border-2 border-blue-400 border-dashed'
                    : 'bg-gray-100 border border-gray-200'
              }`}>
                <Icon className={`w-4 h-4 ${isDone ? 'text-white' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <p className={`text-[9px] font-semibold leading-tight ${isDone ? 'text-emerald-700' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                {step.label}
              </p>
            </div>
          )
        })}
      </div>
      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
