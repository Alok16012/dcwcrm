-- 1. Add DELETE policy for payments
CREATE POLICY "Admin and finance can delete payments"
  ON payments FOR DELETE
  USING (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'finance'))
  );

-- 2. Update trigger to handle INSERT, UPDATE, and DELETE
CREATE OR REPLACE FUNCTION handle_payment_change()
RETURNS trigger AS $$
DECLARE
  target_id uuid;
BEGIN
  -- Determine which lead_id to update (NEW for insert/update, OLD for delete)
  target_id := COALESCE(NEW.lead_id, OLD.lead_id);
  
  IF target_id IS NOT NULL THEN
    -- Update amount_paid in leads
    UPDATE leads SET
      amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE lead_id = target_id)
    WHERE id = target_id;

    -- Update amount_paid in students
    UPDATE students SET
      amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE lead_id = target_id)
    WHERE lead_id = target_id;
  END IF;

  RETURN NULL; -- result is ignored for AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Replace old insert-only trigger with the new one
DROP TRIGGER IF EXISTS on_payment_inserted ON payments;

CREATE TRIGGER on_payment_changed
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE PROCEDURE handle_payment_change();
