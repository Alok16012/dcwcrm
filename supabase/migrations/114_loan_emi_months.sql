-- The "Debt" section of Litigation is now "Loans" (money DCW borrowed from a
-- lender). Rows keep record_type = 'debt'; litigation_type holds the loan
-- purpose, litigation_amount the amount borrowed, amount_refunded the amount
-- to repay. emi_months is the repayment tenure (NULL = one-time repayment).

ALTER TABLE department_litigations ADD COLUMN IF NOT EXISTS emi_months INTEGER
  CHECK (emi_months IS NULL OR emi_months > 0);
