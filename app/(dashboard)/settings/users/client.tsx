'use client'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, UserX, UserCheck, Trash2, KeyRound, Users, Briefcase, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { ColumnDef } from '@tanstack/react-table'
import type { Profile, UserRole } from '@/types/app.types'
import { ROLE_LABELS } from '@/types/app.types'

const createUserSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters'),
  role: z.enum(['admin', 'lead', 'backend', 'housekeeping', 'counselor', 'associate']),
  phone: z.string().optional(),
})
type CreateUserData = z.infer<typeof createUserSchema>

interface EmployeeRow {
  id: string
  employee_code: string
  department: string | null
  designation: string | null
  joining_date: string | null
  is_active: boolean
  basic_salary: number
  profile: { id: string; full_name: string; email: string; phone: string | null; role: string } | null
}

interface AssociateRow {
  id: string
  name: string
  email: string
  phone: string
  associate_code: string | null
  status: 'pending' | 'approved' | 'rejected'
  current_city: string | null
  current_state: string | null
  wallet_balance: number
  created_at: string
}

const ASSOC_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
}

type Tab = 'staff' | 'employees' | 'associates'

export function UsersSettingsClient({
  users: initialUsers,
  employees: initialEmployees,
  associates: initialAssociates,
}: {
  users: Profile[]
  employees: EmployeeRow[]
  associates: AssociateRow[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('staff')
  const [users, setUsers] = useState(initialUsers)
  const [open, setOpen] = useState(false)
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null)
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
  })

  async function onCreateUser(data: CreateUserData) {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        toast.success('User created successfully')
        setOpen(false)
        reset()
        setUsers(prev => [result.user, ...prev])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create user')
      }
    })
  }

  async function toggleUserStatus(user: Profile) {
    try {
      const { error } = await supabase.from('profiles').update({ is_active: !user.is_active } as never).eq('id', user.id)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? 'User deactivated' : 'User activated')
    } catch { toast.error('Failed to update user') }
    setConfirmUser(null)
  }

  async function handleUpdatePassword() {
    if (!resetPasswordUser || newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: resetPasswordUser.id, newPassword }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        toast.success(`Password updated for ${resetPasswordUser.full_name}`)
        setResetPasswordUser(null)
        setNewPassword('')
      } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to update password') }
    })
  }

  async function handleDeleteUser(user: Profile) {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        setUsers(prev => prev.filter(u => u.id !== user.id))
        toast.success('User deleted successfully')
      } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete user') }
      setDeleteUser(null)
    })
  }

  // ── Staff columns ────────────────────────────────────────────────────────────
  const staffColumns: ColumnDef<Profile>[] = [
    { accessorKey: 'full_name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'role', header: 'Role',
      cell: ({ row }) => <Badge variant="outline">{ROLE_LABELS[row.original.role] ?? row.original.role}</Badge>
    },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone ?? '-' },
    {
      accessorKey: 'is_active', header: 'Status',
      cell: ({ row }) => (
        <Badge className={row.original.is_active ? 'bg-green-100 text-green-800 border-0' : 'bg-red-100 text-red-800 border-0'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" title="Change Password" onClick={() => { setResetPasswordUser(row.original); setNewPassword('') }}>
            <KeyRound className="w-4 h-4 text-blue-500" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmUser(row.original)}>
            {row.original.is_active ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteUser(row.original)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    },
  ]

  // ── Employee columns ─────────────────────────────────────────────────────────
  const employeeColumns: ColumnDef<EmployeeRow>[] = [
    { id: 'name', header: 'Name', accessorFn: r => r.profile?.full_name ?? '', cell: ({ row }) => <span className="font-medium">{row.original.profile?.full_name ?? '—'}</span> },
    { accessorKey: 'employee_code', header: 'Emp Code', cell: ({ row }) => <span className="font-mono text-xs text-gray-600">{row.original.employee_code}</span> },
    { id: 'email', header: 'Email', accessorFn: r => r.profile?.email ?? '', cell: ({ row }) => <span className="text-xs">{row.original.profile?.email ?? '—'}</span> },
    { id: 'phone', header: 'Phone', accessorFn: r => r.profile?.phone ?? '', cell: ({ row }) => row.original.profile?.phone ?? '-' },
    { id: 'role', header: 'Role', accessorFn: r => r.profile?.role ?? '', cell: ({ row }) => <Badge variant="outline" className="text-xs">{ROLE_LABELS[row.original.profile?.role as UserRole] ?? row.original.profile?.role ?? '—'}</Badge> },
    { accessorKey: 'department', header: 'Dept', cell: ({ row }) => row.original.department ?? '-' },
    { accessorKey: 'designation', header: 'Designation', cell: ({ row }) => row.original.designation ?? '-' },
    {
      accessorKey: 'joining_date', header: 'Joined',
      cell: ({ row }) => row.original.joining_date ? format(new Date(row.original.joining_date), 'dd MMM yyyy') : '-'
    },
    {
      accessorKey: 'is_active', header: 'Status',
      cell: ({ row }) => (
        <Badge className={row.original.is_active ? 'bg-green-100 text-green-800 border-0' : 'bg-red-100 text-red-800 border-0'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
  ]

  // ── Associate columns ────────────────────────────────────────────────────────
  const associateColumns: ColumnDef<AssociateRow>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'associate_code', header: 'Code', cell: ({ row }) => row.original.associate_code ? <span className="font-mono text-xs text-indigo-700">{row.original.associate_code}</span> : '-' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-xs">{row.original.email}</span> },
    { accessorKey: 'phone', header: 'Phone' },
    {
      id: 'location', header: 'Location', accessorFn: r => `${r.current_city ?? ''} ${r.current_state ?? ''}`,
      cell: ({ row }) => {
        const loc = [row.original.current_city, row.original.current_state].filter(Boolean).join(', ')
        return loc || '-'
      }
    },
    {
      accessorKey: 'wallet_balance', header: 'Wallet',
      cell: ({ row }) => <span className="text-green-700 font-medium">₹{(row.original.wallet_balance ?? 0).toLocaleString()}</span>
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => {
        const s = ASSOC_STATUS[row.original.status] ?? ASSOC_STATUS.pending
        return <Badge className={`${s.cls} border-0`}>{s.label}</Badge>
      }
    },
    {
      accessorKey: 'created_at', header: 'Joined',
      cell: ({ row }) => <span className="text-xs text-gray-500">{format(new Date(row.original.created_at), 'dd MMM yyyy')}</span>
    },
  ]

  const tabs: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'staff',      label: 'Staff',      icon: Users,        count: users.length },
    { key: 'employees',  label: 'Employees',  icon: Briefcase,    count: initialEmployees.length },
    { key: 'associates', label: 'Associates', icon: UserCircle2,  count: initialAssociates.length },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Management"
        description="Manage staff, employees and associates"
        action={
          activeTab === 'staff' ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Staff Account</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit(onCreateUser)} className="space-y-4">
                  <div><Label>Full Name</Label><Input {...register('full_name')} />{errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}</div>
                  <div><Label>Email</Label><Input type="email" {...register('email')} />{errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}</div>
                  <div><Label>Password</Label><Input type="password" {...register('password')} />{errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}</div>
                  <div><Label>Phone</Label><Input {...register('phone')} /></div>
                  <div>
                    <Label>Role</Label>
                    <Select onValueChange={v => setValue('role', v as UserRole)}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="lead">Counselor (Lead)</SelectItem>
                        <SelectItem value="counselor">Counselor</SelectItem>
                        <SelectItem value="backend">Backend</SelectItem>
                        <SelectItem value="housekeeping">Housekeeping</SelectItem>
                        <SelectItem value="associate">Associate</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending}>{isPending ? 'Creating...' : 'Create User'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'staff' && <DataTable data={users} columns={staffColumns} />}
      {activeTab === 'employees' && <DataTable data={initialEmployees} columns={employeeColumns} />}
      {activeTab === 'associates' && <DataTable data={initialAssociates} columns={associateColumns} />}

      {/* ── Dialogs ── */}
      {confirmUser && (
        <ConfirmDialog
          open
          title={confirmUser.is_active ? 'Deactivate User' : 'Activate User'}
          description={`Are you sure you want to ${confirmUser.is_active ? 'deactivate' : 'activate'} ${confirmUser.full_name}?`}
          confirmLabel={confirmUser.is_active ? 'Deactivate' : 'Activate'}
          destructive={confirmUser.is_active}
          onConfirm={() => toggleUserStatus(confirmUser)}
          onCancel={() => setConfirmUser(null)}
        />
      )}
      {deleteUser && (
        <ConfirmDialog
          open
          title="Delete User"
          description={`Are you sure you want to completely delete ${deleteUser.full_name}? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDeleteUser(deleteUser)}
          onCancel={() => setDeleteUser(null)}
        />
      )}
      <Dialog open={!!resetPasswordUser} onOpenChange={o => { if (!o) { setResetPasswordUser(null); setNewPassword('') } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Password — {resetPasswordUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>New Password</Label>
              <Input type="password" placeholder="Min 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              {newPassword.length > 0 && newPassword.length < 8 && <p className="text-xs text-red-500 mt-1">Minimum 8 characters required</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setResetPasswordUser(null); setNewPassword('') }}>Cancel</Button>
              <Button onClick={handleUpdatePassword} disabled={isPending || newPassword.length < 8}>
                {isPending ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
