-- 1. Backfill Past Payrolls into Expenses
DO $$
DECLARE
    r RECORD;
    emp_name text;
BEGIN
    FOR r IN (
        SELECT p.*, e.profile_id FROM payroll p
        JOIN employees e ON p.employee_id = e.id
        WHERE p.status = 'paid'
        AND NOT EXISTS (SELECT 1 FROM expenses WHERE payroll_id = p.id)
    ) LOOP
        -- Get profile name
        SELECT full_name INTO emp_name FROM profiles WHERE id = r.profile_id;
        
        INSERT INTO expenses (
            payroll_id,
            category,
            description,
            amount,
            expense_date,
            status,
            payment_mode
        ) VALUES (
            r.id,
            'salary',
            'Salary Paid - ' || coalesce(emp_name, 'Employee') || ' - ' || r.month || '/' || r.year,
            r.net,
            (coalesce(r.payment_date, current_date))::date,
            'approved',
            'neft'
        );
    END LOOP;
END;
$$;


-- 2. Backfill Past Admission Fees into Payments (Income)
-- If a student has 'amount_paid' > 0, but no payment records exist for them,
-- we generate a one-time "Backfilled Admission Fee" payment row to reflect in the Ledger.
DO $$
DECLARE
    s RECORD;
BEGIN
    FOR s IN (
        SELECT * FROM students 
        WHERE amount_paid > 0 
        AND NOT EXISTS (SELECT 1 FROM payments WHERE student_id = students.id OR lead_id = students.lead_id)
    ) LOOP
        INSERT INTO payments (
            lead_id,
            student_id,
            amount,
            payment_mode,
            payment_date,
            notes,
            recorded_by
        ) VALUES (
            s.lead_id,
            s.id,
            s.amount_paid,
            'cash', -- Defaulting to cash for old records without payment mode tracking
            s.enrollment_date,
            'Backfilled Admission Fee',
            (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
        );
    END LOOP;
END;
$$;
