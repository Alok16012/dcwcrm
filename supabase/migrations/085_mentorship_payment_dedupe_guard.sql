-- Prevent duplicate active mentorship installment rows for the same case.
-- Rejected rows are excluded so a counselor can resubmit a corrected payment.

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_unique_active_installment
ON mentorship_payments (
  mentorship_id,
  amount,
  paid_on,
  note,
  (COALESCE(screenshot_url, ''))
)
WHERE status <> 'rejected';
