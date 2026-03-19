-- 1. Modify 'payments' table to let Finance team insert manual income.
drop policy if exists "Backend and admin can insert payments" on payments;
drop policy if exists "Staff can insert payments" on payments;

create policy "Staff can insert payments"
  on payments for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend','finance'))
  );

-- 2. Add payroll_id reference to expenses to link them natively
alter table expenses add column if not exists payroll_id uuid references payroll(id) on delete set null;

-- 3. Trigger on payroll for auto-salary conversion to Expense Ledger
create or replace function handle_payroll_paid()
returns trigger as $$
declare
    emp_name text;
begin
    -- Whenever payroll status flips precisely to 'paid'
    if NEW.status = 'paid' and OLD.status != 'paid' then
        -- Grab employee actual name
        select full_name into emp_name from profiles
        where id = (select profile_id from employees where id = NEW.employee_id);
        
        insert into expenses (
            payroll_id,
            category,
            description,
            amount,
            expense_date,
            status,
            payment_mode
        ) values (
            NEW.id,
            'salary',
            'Salary Paid - ' || coalesce(emp_name, 'Employee') || ' - ' || NEW.month || '/' || NEW.year,
            NEW.net,
            (coalesce(NEW.payment_date, current_date))::date,
            'approved',
            'neft'
        );
    end if;
    return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_payroll_paid on payroll;
create trigger on_payroll_paid
after update on payroll
for each row execute procedure handle_payroll_paid();
