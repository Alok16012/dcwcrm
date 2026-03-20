import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/card'
import { DollarSign, Gift, Target } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function IncentivePage() {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const { data: rawProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

    const profile = rawProfile as any

    if (profile?.role !== 'telecaller' && profile?.role !== 'admin') {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
                <p>You do not have permission to view this page.</p>
            </div>
        )
    }

    // Fetch students assigned to this counsellor
    const { data: students } = await supabase
        .from('students')
        .select('*, courses:course_id(name)')
        .eq('assigned_counsellor', session.user.id)
        .order('created_at', { ascending: false })

    const validStudents = (students || []) as any[]

    const totalIncentive = validStudents.reduce((acc, s) => acc + (s.incentive_amount || 0), 0)
    const totalStudents = validStudents.length
    const activeStudents = validStudents.filter(s => s.status === 'active').length

    return (
        <div className="space-y-6">
            <PageHeader
                title="My Incentives"
                description="Track your earnings and enrolled students"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 flex items-center gap-4 bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
                    <div className="p-3 bg-white/20 rounded-lg">
                        <Gift className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-white/80 font-medium">Total Incentive Earned</p>
                        <h3 className="text-3xl font-bold">₹{totalIncentive.toLocaleString()}</h3>
                    </div>
                </Card>

                <Card className="p-6 flex items-center gap-4 shadow-sm border border-gray-100">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                        <Target className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-gray-500 font-medium text-sm">Total Enrolled Students</p>
                        <h3 className="text-2xl font-bold text-gray-900">{totalStudents}</h3>
                    </div>
                </Card>

                <Card className="p-6 flex items-center gap-4 shadow-sm border border-gray-100">
                    <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                        <DollarSign className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-gray-500 font-medium text-sm">Active Students</p>
                        <h3 className="text-2xl font-bold text-gray-900">{activeStudents}</h3>
                    </div>
                </Card>
            </div>

            <Card className="p-0 overflow-hidden border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-800">Incentive Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Student Name</th>
                                <th className="px-6 py-4">Course</th>
                                <th className="px-6 py-4 text-right">Total Fee</th>
                                <th className="px-6 py-4 text-right">Fee Paid</th>
                                <th className="px-6 py-4 text-right">Status</th>
                                <th className="px-6 py-4 text-right text-purple-600 font-bold">Your Incentive</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {validStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No students enrolled yet. Start converting leads to earn incentives!
                                    </td>
                                </tr>
                            ) : (
                                validStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {student.full_name}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{student.courses?.name || '-'}</td>
                                        <td className="px-6 py-4 text-right text-gray-600">₹{(student.total_fee || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right text-green-600 font-medium">₹{(student.amount_paid || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {student.status || 'Enrolled'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-purple-600 font-bold">
                                            ₹{(student.incentive_amount || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
