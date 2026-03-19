export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: string
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: string
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: string
          phone?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          is_active?: boolean
        }
      }
      sub_courses: {
        Row: {
          id: string
          course_id: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          name: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          name?: string
          is_active?: boolean
        }
      }
      leads: {
        Row: {
          id: string
          full_name: string
          phone: string
          email: string | null
          city: string | null
          state: string | null
          course_id: string | null
          sub_course_id: string | null
          status: string
          source: string
          assigned_to: string | null
          assigned_at: string | null
          next_followup_date: string | null
          total_fee: number | null
          amount_paid: number
          converted_at: string | null
          import_batch_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          phone: string
          email?: string | null
          city?: string | null
          state?: string | null
          course_id?: string | null
          sub_course_id?: string | null
          status?: string
          source: string
          assigned_to?: string | null
          assigned_at?: string | null
          next_followup_date?: string | null
          total_fee?: number | null
          amount_paid?: number
          converted_at?: string | null
          import_batch_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string
          email?: string | null
          city?: string | null
          state?: string | null
          course_id?: string | null
          sub_course_id?: string | null
          status?: string
          source?: string
          assigned_to?: string | null
          assigned_at?: string | null
          next_followup_date?: string | null
          total_fee?: number | null
          amount_paid?: number
          converted_at?: string | null
          import_batch_id?: string | null
          created_by?: string | null
          updated_at?: string
        }
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string
          activity_type: string
          old_value: string | null
          new_value: string | null
          note: string | null
          performed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          activity_type: string
          old_value?: string | null
          new_value?: string | null
          note?: string | null
          performed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          activity_type?: string
          old_value?: string | null
          new_value?: string | null
          note?: string | null
          performed_by?: string | null
        }
      }
      lead_column_preferences: {
        Row: {
          id: string
          user_id: string
          column_key: string
          is_visible: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          column_key: string
          is_visible?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          column_key?: string
          is_visible?: boolean
          sort_order?: number
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          lead_id: string | null
          student_id: string | null
          amount: number
          payment_mode: string
          payment_date: string
          receipt_number: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          student_id?: string | null
          amount: number
          payment_mode: string
          payment_date: string
          receipt_number?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          student_id?: string | null
          amount?: number
          payment_mode?: string
          payment_date?: string
          receipt_number?: string | null
          notes?: string | null
          recorded_by?: string | null
        }
      }
      students: {
        Row: {
          id: string
          lead_id: string | null
          enrollment_number: string
          full_name: string
          phone: string
          email: string | null
          city: string | null
          course_id: string | null
          sub_course_id: string | null
          assigned_counsellor: string | null
          total_fee: number | null
          amount_paid: number
          enrollment_date: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          enrollment_number?: string
          full_name: string
          phone: string
          email?: string | null
          city?: string | null
          course_id?: string | null
          sub_course_id?: string | null
          assigned_counsellor?: string | null
          total_fee?: number | null
          amount_paid?: number
          enrollment_date?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          enrollment_number?: string
          full_name?: string
          phone?: string
          email?: string | null
          city?: string | null
          course_id?: string | null
          sub_course_id?: string | null
          assigned_counsellor?: string | null
          total_fee?: number | null
          amount_paid?: number
          enrollment_date?: string | null
          status?: string
          updated_at?: string
        }
      }
      student_documents: {
        Row: {
          id: string
          student_id: string
          doc_type: string
          status: string
          file_url: string | null
          notes: string | null
          expiry_date: string | null
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          doc_type: string
          status?: string
          file_url?: string | null
          notes?: string | null
          expiry_date?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          doc_type?: string
          status?: string
          file_url?: string | null
          notes?: string | null
          expiry_date?: string | null
          uploaded_by?: string | null
          updated_at?: string
        }
      }
      student_exams: {
        Row: {
          id: string
          student_id: string
          exam_type: string
          exam_name: string
          exam_date: string | null
          centre: string | null
          hall_ticket_number: string | null
          admit_card_url: string | null
          score: string | null
          is_passed: boolean | null
          remarks: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          exam_type: string
          exam_name: string
          exam_date?: string | null
          centre?: string | null
          hall_ticket_number?: string | null
          admit_card_url?: string | null
          score?: string | null
          is_passed?: boolean | null
          remarks?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          exam_type?: string
          exam_name?: string
          exam_date?: string | null
          centre?: string | null
          hall_ticket_number?: string | null
          admit_card_url?: string | null
          score?: string | null
          is_passed?: boolean | null
          remarks?: string | null
        }
      }
      employees: {
        Row: {
          id: string
          profile_id: string
          employee_code: string
          department: string | null
          designation: string | null
          joining_date: string | null
          basic_salary: number | null
          hra: number | null
          allowances: number | null
          incentive: number | null
          pf_deduction: number | null
          tds_deduction: number | null
          other_deductions: number | null
          bank_account: string | null
          bank_ifsc: string | null
          bank_name: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          employee_code?: string
          department?: string | null
          designation?: string | null
          joining_date?: string | null
          basic_salary?: number | null
          hra?: number | null
          allowances?: number | null
          incentive?: number | null
          pf_deduction?: number | null
          tds_deduction?: number | null
          other_deductions?: number | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          employee_code?: string
          department?: string | null
          designation?: string | null
          joining_date?: string | null
          basic_salary?: number | null
          hra?: number | null
          allowances?: number | null
          incentive?: number | null
          pf_deduction?: number | null
          tds_deduction?: number | null
          other_deductions?: number | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          employee_id: string
          date: string
          status: string
          clock_in: string | null
          clock_out: string | null
          notes: string | null
          marked_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          date: string
          status: string
          clock_in?: string | null
          clock_out?: string | null
          notes?: string | null
          marked_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          date?: string
          status?: string
          clock_in?: string | null
          clock_out?: string | null
          notes?: string | null
          marked_by?: string | null
        }
      }
      leave_requests: {
        Row: {
          id: string
          employee_id: string
          leave_type: string
          from_date: string
          to_date: string
          reason: string | null
          status: string
          approved_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          leave_type: string
          from_date: string
          to_date: string
          reason?: string | null
          status?: string
          approved_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          leave_type?: string
          from_date?: string
          to_date?: string
          reason?: string | null
          status?: string
          approved_by?: string | null
        }
      }
      payroll: {
        Row: {
          id: string
          employee_id: string
          month: number
          year: number
          basic: number
          hra: number
          allowances: number
          incentive: number
          gross: number
          pf: number
          tds: number
          other_deductions: number
          net: number
          status: string
          payment_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          month: number
          year: number
          basic?: number
          hra?: number
          allowances?: number
          incentive?: number
          gross?: number
          pf?: number
          tds?: number
          other_deductions?: number
          net?: number
          status?: string
          payment_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          month?: number
          year?: number
          basic?: number
          hra?: number
          allowances?: number
          incentive?: number
          gross?: number
          pf?: number
          tds?: number
          other_deductions?: number
          net?: number
          status?: string
          payment_date?: string | null
        }
      }
      expenses: {
        Row: {
          id: string
          category: string
          description: string
          amount: number
          expense_date: string
          payment_mode: string | null
          bill_url: string | null
          notes: string | null
          submitted_by: string | null
          approved_by: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          category: string
          description: string
          amount: number
          expense_date: string
          payment_mode?: string | null
          bill_url?: string | null
          notes?: string | null
          submitted_by?: string | null
          approved_by?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          category?: string
          description?: string
          amount?: number
          expense_date?: string
          payment_mode?: string | null
          bill_url?: string | null
          notes?: string | null
          submitted_by?: string | null
          approved_by?: string | null
          status?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
