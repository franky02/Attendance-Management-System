-- National holidays (NH) that Dad sets per month, for the NHA statement and to mark NH days in the muster.
create table public.national_holiday (
  holiday_date date primary key,
  name text not null default ''
);

revoke all on public.national_holiday from anon;
grant select, insert, update, delete on public.national_holiday to authenticated;

alter table public.national_holiday enable row level security;
create policy owner_only on public.national_holiday for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());
