'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { employeeSchema, type EmployeeFormData } from '@/lib/validations/employee.schema'
import type { ColumnDef } from '@tanstack/react-table'
import type { UserRole } from '@/types/app.types'

interface EmployeeRow {
  id: string
  profile_id: string
  employee_code: string
  full_name: string
  role: UserRole
  department: string
  designation: string
  joining_date: string
  status: 'active' | 'inactive'
}

interface EmployeeTableProps {
  data: EmployeeRow[]
}

const ROLES: UserRole[] = ['admin', 'telecaller', 'backend', 'finance']

export default function EmployeeTable({ data: initialData }: EmployeeTableProps) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { role: 'telecaller', hra: 0, allowances: 0, pf_deduction: 0, tds_deduction: 0 },
  })

  const filtered = data.filter((e) => {
    const matchSearch =
      !search ||
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || e.role === roleFilter
    return matchSearch && matchRole
  })

  const onSubmit = (values: EmployeeFormData) => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/hrms/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create employee')
        }
        const { employee } = await res.json()
        setData((prev) => [employee, ...prev])
        toast.success('Employee created')
        setShowForm(false)
        reset()
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to create employee')
      }
    })
  }

  const columns: ColumnDef<EmployeeRow>[] = [
    { accessorKey: 'employee_code', header: 'Code' },
    { accessorKey: 'full_name', header: 'Name' },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => (
        <Badge variant="outline" className="capitalize">{getValue() as string}</Badge>
      ),
    },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'designation', header: 'Designation' },
    {
      accessorKey: 'joining_date',
      header: 'Joining Date',
      cell: ({ getValue }) => {
        const val = getValue() as string | null | undefined
        if (!val || val === '—') return '—'
        return format(new Date(val), 'dd MMM yyyy')
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant={getValue() === 'active' ? 'default' : 'secondary'} className="capitalize">
          {getValue() as string}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v || 'all')}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        onRowClick={(row) => router.push(`/hrms/${row.id}`)}
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input {...register('full_name')} />
                {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input {...register('phone')} />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select onValueChange={(v) => setValue('role', v as UserRole)} defaultValue="telecaller">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input {...register('department')} />
                {errors.department && <p className="text-xs text-red-500">{errors.department.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Designation</Label>
                <Input {...register('designation')} />
                {errors.designation && <p className="text-xs text-red-500">{errors.designation.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Joining Date</Label>
                <Input type="date" {...register('joining_date')} />
                {errors.joining_date && <p className="text-xs text-red-500">{errors.joining_date.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Basic Salary (₹)</Label>
                <Input type="number" min="0" {...register('basic_salary', { valueAsNumber: true })} />
                {errors.basic_salary && <p className="text-xs text-red-500">{errors.basic_salary.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>HRA (₹)</Label>
                <Input type="number" min="0" {...register('hra', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Allowances (₹)</Label>
                <Input type="number" min="0" {...register('allowances', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>PF Deduction (₹)</Label>
                <Input type="number" min="0" {...register('pf_deduction', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>TDS Deduction (₹)</Label>
                <Input type="number" min="0" {...register('tds_deduction', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Bank Account (masked)</Label>
                <Input {...register('bank_account_masked')} placeholder="XXXX1234" />
              </div>
              <div className="space-y-1">
                <Label>Bank IFSC</Label>
                <Input {...register('bank_ifsc')} placeholder="SBIN0001234" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Employee'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
