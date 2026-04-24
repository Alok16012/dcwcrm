import { z } from 'zod'

export const employeeSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Valid phone required'),
  role: z.enum(['admin', 'lead', 'counselor', 'backend', 'housekeeping']),
  department: z.string().min(2, 'Department required'),
  designation: z.string().min(2, 'Designation required'),
  joining_date: z.string().min(1, 'Joining date required'),
  basic_salary: z.number().positive('Salary must be positive'),
  hra: z.number().min(0),
  allowances: z.number().min(0),
  pf_deduction: z.number().min(0),
  tds_deduction: z.number().min(0),
  bank_account_masked: z.string().optional(),
  bank_ifsc: z.string().optional(),
  salary_cycle_start_day: z.number().min(1).max(31),
})

export type EmployeeFormData = z.infer<typeof employeeSchema>
