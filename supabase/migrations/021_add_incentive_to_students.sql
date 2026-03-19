-- Add incentive column to students table
alter table students 
add column if not exists incentive_amount numeric(10,2) default 0;
