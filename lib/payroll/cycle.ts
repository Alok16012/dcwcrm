// Salary cycles come from employees.salary_cycle_start_day. Start day 1 means
// the plain calendar month; any other day N means the payroll for month M covers
// N of month M-1 through N-1 of month M (e.g. start 22 → Aug payroll = 22 Jul–21 Aug).
//
// Every place that writes a payroll row must derive the incentive from this same
// window. Hand-rolled inserts that skipped the admission side are what left
// cycles short by the whole admission incentive.

export type CycleWindow = { start: string; end: string }

type StudentIncentiveRow = { incentive_amount: number | null }

type MentorPayRow = {
    incentive_amount: number | null
    salary_percentage: number | null
    paid_on: string | null
    approved_at: string | null
    created_at: string | null
}

export type IncentiveBreakup = { admission: number; mentorship: number; total: number }

// Format as a local calendar date. toISOString() converts to UTC and, on an IST
// machine, shifts local midnight to the previous day — which slid the whole
// cycle window one day early and put boundary-day incentives in the wrong month.
const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function cycleWindow(month: number, year: number, startDay: number): CycleWindow {
    if (startDay <= 1) {
        return { start: fmtDate(new Date(year, month - 1, 1)), end: fmtDate(new Date(year, month, 0)) }
    }
    return {
        start: fmtDate(new Date(year, month - 2, startDay)),
        end: fmtDate(new Date(year, month - 1, startDay - 1)),
    }
}

// Inverse of cycleWindow: the payroll month/year a given date belongs to.
export function cycleMonthYear(d: Date, startDay: number): { month: number; year: number } {
    let m = d.getMonth() // 0-based
    let year = d.getFullYear()
    if (startDay > 1 && d.getDate() >= startDay) {
        m += 1
        if (m > 11) { m = 0; year += 1 }
    }
    return { month: m + 1, year }
}

/**
 * Total incentive earned by a profile inside a cycle:
 * admissions (students.incentive_amount by enrollment_date) plus approved
 * mentorship payments (by payment date, falling back to approval/creation).
 */
export async function cycleIncentive(
    // Works with both the server and browser Supabase clients.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    profileId: string,
    w: CycleWindow
): Promise<IncentiveBreakup> {
    const { data: students } = await supabase
        .from('students')
        .select('incentive_amount')
        .eq('assigned_counsellor', profileId)
        .gte('enrollment_date', w.start)
        .lte('enrollment_date', w.end)

    const admission = ((students ?? []) as StudentIncentiveRow[])
        .reduce((acc, s) => acc + (Number(s.incentive_amount) || 0), 0)

    const { data: mentorPays } = await supabase
        .from('mentorship_payments')
        .select('incentive_amount, salary_percentage, paid_on, approved_at, created_at, mentorship:student_mentorships!inner(telecaller_id)')
        .eq('status', 'approved')
        .eq('mentorship.telecaller_id', profileId)

    const mentorship = ((mentorPays ?? []) as MentorPayRow[]).reduce((acc, p) => {
        const when = (p.paid_on ?? p.approved_at ?? p.created_at ?? '').slice(0, 10)
        if (!when || when < w.start || when > w.end) return acc
        return acc + (Number(p.incentive_amount ?? p.salary_percentage) || 0)
    }, 0)

    return { admission, mentorship, total: admission + mentorship }
}
