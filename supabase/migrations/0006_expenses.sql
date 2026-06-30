-- E-3: the expenses table shipped in commit ce54330 with the SQL only in the
-- commit message, never as a migration file — adding it here so the table is
-- tracked like everything else, and 0007_audit_expenses.sql has something to
-- attach its trigger to.

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references orgs(id),
  type         text not null default 'expense'
               check (type in ('expense', 'income')),
  category     text not null,
  amount       bigint not null,        -- integer paise (₹), never float
  currency     text default 'INR',
  description  text not null,
  expense_date date not null,
  notes        text,
  reference_no text,
  voyage_id    uuid references voyages(id),
  logged_by    uuid references profiles(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table expenses enable row level security;
create policy "auth_all" on expenses
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

alter publication supabase_realtime add table expenses;

create trigger touch_expenses before update on expenses
  for each row execute function touch_updated_at();
