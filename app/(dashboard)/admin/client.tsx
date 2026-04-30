'use client'
import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { FeeManager } from './tabs/FeeManager'
import { IncentiveManager } from './tabs/IncentiveManager'
import { PaymentConfig } from './tabs/PaymentConfig'
import { ProgressManager } from './tabs/ProgressManager'
import { ProspectusManager } from './tabs/ProspectusManager'
import { NotificationManager } from './tabs/NotificationManager'
import { WalletManager } from './tabs/WalletManager'
import { CrmSyncMonitor } from './tabs/CrmSyncMonitor'
import { SystemSettings } from './tabs/SystemSettings'

export function AdminPanelClient() {
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [students, setStudents] = useState<{ id: string; full_name: string; course?: { name: string }; department?: { name: string }; status: string }[]>([])
  const [counsellors, setCounsellors] = useState<{ id: string; full_name: string; role: string }[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [c, d, s, p] = await Promise.all([
        supabase.from('courses').select('id, name').eq('is_active', true).order('name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('students').select('id, full_name, status, course:courses(id,name), department:departments(id,name)').neq('status', 'dropped').order('full_name'),
        supabase.from('profiles').select('id, full_name, role').in('role', ['lead', 'counselor', 'backend', 'admin']).order('full_name'),
      ])
      setCourses(c.data ?? [])
      setDepartments(d.data ?? [])
      setStudents((s.data ?? []) as typeof students)
      setCounsellors((p.data ?? []) as typeof counsellors)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        description="Central control for fee plans, incentives, payments, progress, prospectus, notifications, and system settings"
      />

      <Tabs defaultValue="fee" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto flex-nowrap inline-flex gap-1 bg-slate-100 p-1 rounded-xl min-w-max">
            <TabsTrigger value="fee" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">Fee & Plan</TabsTrigger>
            <TabsTrigger value="incentive" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">Incentive Slabs</TabsTrigger>
            <TabsTrigger value="payment" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">Payment Config</TabsTrigger>
            <TabsTrigger value="progress" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">Progress Manager</TabsTrigger>
            <TabsTrigger value="prospectus" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">Prospectus</TabsTrigger>
            <TabsTrigger value="notifications" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">Notifications</TabsTrigger>
            <TabsTrigger value="wallet" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">Wallet Manager</TabsTrigger>
            <TabsTrigger value="crm" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">CRM Sync</TabsTrigger>
            <TabsTrigger value="settings" className="whitespace-nowrap text-xs px-3 py-1.5 rounded-lg">System Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="fee" className="mt-4">
          <FeeManager courses={courses} departments={departments} />
        </TabsContent>
        <TabsContent value="incentive" className="mt-4">
          <IncentiveManager courses={courses} departments={departments} />
        </TabsContent>
        <TabsContent value="payment" className="mt-4">
          <PaymentConfig departments={departments} />
        </TabsContent>
        <TabsContent value="progress" className="mt-4">
          <ProgressManager students={students} courses={courses} departments={departments} />
        </TabsContent>
        <TabsContent value="prospectus" className="mt-4">
          <ProspectusManager departments={departments} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationManager counsellors={counsellors} />
        </TabsContent>
        <TabsContent value="wallet" className="mt-4">
          <WalletManager counsellors={counsellors} />
        </TabsContent>
        <TabsContent value="crm" className="mt-4">
          <CrmSyncMonitor students={students} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SystemSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
