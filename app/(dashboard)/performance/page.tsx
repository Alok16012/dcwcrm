import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/card'
import { TrendingUp, Users, PhoneCall, CheckCircle2 } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single() as any

    if (profile?.role !== 'lead' && profile?.role !== 'admin') {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
                <p>You do not have permission to view this page.</p>
            </div>
        )
    }

    // Fetch leads assigned to this user
    const { data: leads } = await supabase
        .from('leads')
        .select('status, created_at')
        .eq('assigned_to', session.user.id)

    const validLeads = (leads || []) as any[]
    const totalAssigned = validLeads.length
    const convertedLeads = validLeads.filter(l => l.status === 'converted').length
    const hotLeads = validLeads.filter(l => l.status === 'interested' || l.status === 'application_sent').length

    const conversionRate = totalAssigned > 0 ? ((convertedLeads / totalAssigned) * 100).toFixed(1) : '0.0'

    // Fetch recent activities by this user (calls made, followups, notes)
    const { data: activities } = await supabase
        .from('lead_activities')
        .select('activity_type')
        .eq('performed_by', session.user.id)

    const activitiesArray = (activities || []) as any[]
    const totalActivities = activitiesArray.length
    const callsMade = activitiesArray.filter(a => a.activity_type === 'call_made' || a.activity_type === 'followup_set').length

    return (
        <div className="space-y-6">
            <PageHeader
                title="My Performance"
                description="Analytics and KPIs for your assigned leads"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 flex flex-col gap-2 shadow-sm border-gray-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-gray-500 font-medium text-sm">Total Leads Assigned</h3>
                        <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{totalAssigned}</p>
                </Card>

                <Card className="p-6 flex flex-col gap-2 shadow-sm border-gray-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-gray-500 font-medium text-sm">Total Converted</h3>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-green-600">{convertedLeads}</p>
                </Card>

                <Card className="p-6 flex flex-col gap-2 shadow-sm border-gray-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-gray-500 font-medium text-sm">Conversion Rate</h3>
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-3xl font-bold text-purple-600">{conversionRate}%</p>
                </Card>

                <Card className="p-6 flex flex-col gap-2 shadow-sm border-gray-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-gray-500 font-medium text-sm">Total Follow-ups / Calls</h3>
                        <PhoneCall className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{callsMade}</p>
                    <p className="text-xs text-gray-400 mt-1">Out of {totalActivities} total activities</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 shadow-sm border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Pipeline Status</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">New / Uncontacted</span>
                            <span className="font-semibold">{validLeads.filter(l => l.status === 'new').length}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${totalAssigned > 0 ? (validLeads.filter(l => l.status === 'new').length / totalAssigned) * 100 : 0}%` }}></div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-gray-600">Interested (Hot)</span>
                            <span className="font-semibold">{hotLeads}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-orange-400 h-2 rounded-full" style={{ width: `${totalAssigned > 0 ? (hotLeads / totalAssigned) * 100 : 0}%` }}></div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-gray-600">Converted</span>
                            <span className="font-semibold">{convertedLeads}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${totalAssigned > 0 ? (convertedLeads / totalAssigned) * 100 : 0}%` }}></div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-gray-600">Lost</span>
                            <span className="font-semibold">{validLeads.filter(l => l.status === 'lost').length}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-red-400 h-2 rounded-full" style={{ width: `${totalAssigned > 0 ? (validLeads.filter(l => l.status === 'lost').length / totalAssigned) * 100 : 0}%` }}></div>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 shadow-sm border-gray-100 bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-center">
                    <div>
                        <TrendingUp className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-indigo-900">Keep It Up!</h3>
                        <p className="text-indigo-700/80 mt-2 max-w-sm mx-auto">
                            You are currently converting {conversionRate}% of your assigned leads. Focus on your {hotLeads} hot leads to boost your performance this week.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    )
}
