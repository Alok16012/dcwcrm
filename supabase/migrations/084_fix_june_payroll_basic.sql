-- One-time fix: the mentorship-incentive credit had created payroll rows with
-- basic/HRA/allowances = 0 (only the incentive amount), wiping the employee's
-- salary. Restore the salary structure from the employee on any such DRAFT stub
-- row (not yet paid), keep the already-credited incentive, and recompute
-- gross & net. Month-agnostic so it fixes whichever billing-cycle month the
-- credit landed in (e.g. June or July).

update payroll p
set basic      = e.basic_salary,
    hra        = e.hra,
    allowances = e.allowances,
    pf         = e.pf_deduction,
    tds        = e.tds_deduction,
    gross      = coalesce(e.basic_salary,0) + coalesce(e.hra,0) + coalesce(e.allowances,0) + coalesce(p.incentive,0),
    net        = coalesce(e.basic_salary,0) + coalesce(e.hra,0) + coalesce(e.allowances,0) + coalesce(p.incentive,0)
                 - coalesce(e.pf_deduction,0) - coalesce(e.tds_deduction,0)
                 - coalesce(p.other_deductions,0) - coalesce(p.leave_deduction,0)
from employees e
where p.employee_id = e.id
  and p.status = 'draft'                 -- never touch processed/paid rows
  and coalesce(p.basic, 0) = 0           -- only the broken stub rows
  and coalesce(e.basic_salary, 0) > 0;   -- only employees that have a salary set
