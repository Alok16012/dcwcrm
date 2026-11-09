-- Expense categories: Board and University (separately) replace Vendor —
-- those payments were going to boards — and Event is new.
--
-- Existing 'vendor' rows become 'board'.

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

UPDATE expenses SET category = 'board' WHERE category = 'vendor';

ALTER TABLE expenses ADD CONSTRAINT expenses_category_check CHECK (
  category IN ('rent','utilities','marketing','travel','salary','board','university','event','misc','other')
);
