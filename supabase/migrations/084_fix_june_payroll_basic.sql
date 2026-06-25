-- One-time fix: mentorship-incentive credit had created June 2026 payroll rows
-- with basic/HRA/allowances = 0 (only the incentive). Restore the salary
-- structure from the employee while KEEPING the already-credited incentive
-- (regular + mentorship), and recompute gross & net.

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
  and p.month = 6
  and p.year  = 2026
  and coalesce(p.basic, 0) = 0          -- only the broken stub rows
  and coalesce(e.basic_salary, 0) > 0;   -- only employees that actually have a salary
