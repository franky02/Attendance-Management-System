-- 07:30 IST on the 16th (02:00 UTC). Replace PROJECT_REF and CRON_SECRET_VALUE before running.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'notify-muster-ready',
  '0 2 16 * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/notify-muster-ready',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'CRON_SECRET_VALUE'),
    body := '{}'::jsonb
  );
  $$
);
