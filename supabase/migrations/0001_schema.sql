-- ENNORE Muster: three tables, owner-only access.

create table public.employee (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  designation text not null,
  pf_hrms_number text not null,
  code text not null,
  display_order int not null,
  left_on date
);

create table public.period (
  start_date date primary key,
  end_date date not null,
  roster jsonb not null,
  remarks text not null default '',
  final_downloaded_at timestamptz
);

create table public.attendance (
  employee_id uuid not null references public.employee(id),
  att_date date not null,
  status text not null, -- valid codes live in src/statusCodes.ts
  updated_at timestamptz not null default now(),
  primary key (employee_id, att_date)
);

-- The one app user. Change this email to the owner's login email before running.
create or replace function public.is_app_user() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'OWNER_EMAIL@example.com'
$$;

-- Newer Supabase projects may not expose new tables automatically. Signed-in access only;
-- the policies below still limit it to the one app user. Anonymous visitors get nothing.
revoke all on public.employee, public.period, public.attendance from anon;
grant select, insert, update, delete on public.employee, public.period, public.attendance to authenticated;

alter table public.employee enable row level security;
alter table public.period enable row level security;
alter table public.attendance enable row level security;

create policy owner_only on public.employee for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());
create policy owner_only on public.period for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());
create policy owner_only on public.attendance for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());
