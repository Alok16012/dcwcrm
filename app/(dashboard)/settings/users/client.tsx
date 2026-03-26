'use client'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, UserX, UserCheck, Trash2, KeyRound } from 'lucide-react'
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
import type { ColumnDef } from '@tanstack/react-table'
import type { Profile, UserRole } from '@/types/app.types'
import { ROLE_LABELS } from '@/types/app.types'

const createUserSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters'),
  role: z.enum(['admin', 'lead', 'backend', 'housekeeping']),
  phone: z.string().optional(),
})

type CreateUserData = z.infer<typeof createUserSchema>

export function UsersSettingsClient({ users: initialUsers }: { users: Profile[] }) {
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
        setUsers((prev) => [result.user, ...prev])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create user')
      }
    })
  }

  async function toggleUserStatus(user: Profile) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active } as never)
        .eq('id', user.id)
      if (error) throw error
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? 'User deactivated' : 'User activated')
    } catch {
      toast.error('Failed to update user')
    }
    setConfirmUser(null)
  }

  async function handleUpdatePassword() {
    if (!resetPasswordUser || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update password')
      }
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

        setUsers((prev) => prev.filter((u) => u.id !== user.id))
        toast.success('User deleted successfully')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete user')
      }
      setDeleteUser(null)
    })
  }

  const columns: ColumnDef<Profile>[] = [
    { accessorKey: 'full_name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'role', header: 'Role', cell: ({ row }) => (
        <Badge variant="outline">{ROLE_LABELS[row.original.role] ?? row.original.role}</Badge>
      )
    },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone ?? '-' },
    {
      accessorKey: 'is_active', header: 'Status', cell: ({ row }) => (
        <Badge className={row.original.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      id: 'actions', header: 'Actions', cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            title="Change Password"
            onClick={() => { setResetPasswordUser(row.original); setNewPassword('') }}
          >
            <KeyRound className="w-4 h-4 text-blue-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmUser(row.original)}
          >
            {row.original.is_active ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => setDeleteUser(row.original)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    },
  ]

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage staff accounts and access"
        action={
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
                  <Select onValueChange={(v) => setValue('role', v as UserRole)}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="lead">Counselor</SelectItem>
                      <SelectItem value="backend">Backend</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>{isPending ? 'Creating...' : 'Create User'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <DataTable data={users} columns={columns} />
      {confirmUser && (
        <ConfirmDialog
          open={true}
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
          open={true}
          title="Delete User"
          description={`Are you sure you want to completely delete ${deleteUser.full_name}? This will permanently remove their account and all their access. This action cannot be undone.`}
          confirmLabel="Delete"
          destructive={true}
          onConfirm={() => handleDeleteUser(deleteUser)}
          onCancel={() => setDeleteUser(null)}
        />
      )}

      <Dialog open={!!resetPasswordUser} onOpenChange={(o) => { if (!o) { setResetPasswordUser(null); setNewPassword('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password — {resetPasswordUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-xs text-red-500 mt-1">Minimum 8 characters required</p>
              )}
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
