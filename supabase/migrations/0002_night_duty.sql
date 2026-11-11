-- Night Duty (NDA statement): hours per person per 16th–15th period. Owner-only, like the other tables.
create table public.night_duty (
  period_start date not null,               -- always a 16th
  employee_id uuid not null references public.employee(id),
  roster text not null default 'Cont.',
  hours numeric,                            -- blank = not entered; Weighted Hrs. (hours ÷ 6) is worked out in the app
  remarks text not null default '',
  updated_at timestamptz not null default now(),
  primary key (period_start, employee_id)
);

revoke all on public.night_duty from anon;
grant select, insert, update, delete on public.night_duty to authenticated;

alter table public.night_duty enable row level security;
create policy owner_only on public.night_duty for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());
