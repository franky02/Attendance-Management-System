-- Night duty is per calendar month, not per 16th–15th muster period.
-- period_start now holds the month's 1st day (e.g. 2026-10-01 = October 2026).
-- Entries saved under a muster period (e.g. 2026-10-16, "16 Oct – 15 Nov") were filled in
-- for that start month, so they move to its 1st.
update public.night_duty
set period_start = date_trunc('month', period_start)::date
where extract(day from period_start) <> 1;

comment on column public.night_duty.period_start is 'Calendar month of the night duty, as its 1st day (YYYY-MM-01)';
