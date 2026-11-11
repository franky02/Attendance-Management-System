-- Several stations. Staff belong to a station; a muster period is per station.
-- Attendance and night duty follow their staff member, so they need no station column.
-- National holidays stay shared. Everything entered before this belongs to Ennore (ENR).
alter table public.employee add column station text not null default 'ENR';
create index employee_station_idx on public.employee (station);

alter table public.period add column station text not null default 'ENR';
alter table public.period drop constraint period_pkey;
alter table public.period add primary key (station, start_date);
