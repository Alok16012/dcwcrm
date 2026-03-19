import { z } from 'zod'

export const expenseSchema = z.object({
  category: z.enum(['rent', 'utilities', 'marketing', 'travel', 'salary', 'vendor', 'misc', 'other']),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  amount: z.number().positive('Amount must be positive'),
  expense_date: z.string().min(1, 'Date is required'),
  payment_mode: z.string().optional(),
  notes: z.string().optional(),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
