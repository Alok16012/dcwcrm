-- Robust trigger to sync amount_paid from payments to leads and students
CREATE OR REPLACE FUNCTION handle_payment_change()
RETURNS trigger AS $$
DECLARE
    target_lead_id uuid;
    target_student_id uuid;
BEGIN
    -- Determine which lead/student to update
    IF TG_OP = 'DELETE' THEN
        target_lead_id := OLD.lead_id;
        target_student_id := OLD.student_id;
    ELSE
        target_lead_id := NEW.lead_id;
        target_student_id := NEW.student_id;
    END IF;

    -- Update Leads
    IF target_lead_id IS NOT NULL THEN
        UPDATE leads SET
            amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE lead_id = target_lead_id)
        WHERE id = target_lead_id;
    END IF;

    -- Update Students (by student_id or lead_id)
    IF target_student_id IS NOT NULL THEN
        UPDATE students SET
            amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE student_id = target_student_id)
        WHERE id = target_student_id;
    ELSIF target_lead_id IS NOT NULL THEN
        UPDATE students SET
            amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE lead_id = target_lead_id)
        WHERE lead_id = target_lead_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger to payments table
DROP TRIGGER IF EXISTS on_payment_inserted ON payments;
DROP TRIGGER IF EXISTS on_payment_changed ON payments;

CREATE TRIGGER on_payment_changed
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE PROCEDURE handle_payment_change();

-- Backfill: Ensure all students/leads are synced
UPDATE students s SET amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE student_id = s.id OR lead_id = s.lead_id);
UPDATE leads l SET amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE lead_id = l.id);
