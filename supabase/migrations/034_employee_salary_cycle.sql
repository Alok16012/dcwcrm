-- Add salary_cycle_start_day to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_cycle_start_day integer DEFAULT 1 CHECK (salary_cycle_start_day BETWEEN 1 AND 31);

-- Backfill existing employees to start on the 1st
UPDATE employees SET salary_cycle_start_day = 1 WHERE salary_cycle_start_day IS NULL;

-- Add leave_deduction to payroll
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS leave_deduction numeric(12,2) DEFAULT 0;
