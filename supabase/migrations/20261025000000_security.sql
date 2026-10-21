-- Phase 8: security hardening.
-- 1. Rate limiting: a counter per key (for example "sign-in:ip:<hash>") in a
--    fixed time window. Only the app's server (service role) calls it.
-- 2. The unsubscribe functions are no longer callable with the public key.
--    The app's server calls them with the service role, after its own rate
--    limit, so nobody can skip that limit by calling the database API directly.

create table public.rate_limits (
  key text primary key check (char_length(key) between 1 and 200),
  window_started_at timestamptz not null default now(),
  hits integer not null default 1
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;

-- Counts one attempt for p_key and returns true while it is within p_max
-- attempts per p_window_seconds. The insert-or-update is atomic, so parallel
-- requests cannot slip past the limit.
create function public.consume_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'p_max and p_window_seconds must be positive';
  end if;

  insert into public.rate_limits as r (key, window_started_at, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_started_at = case
      when r.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else r.window_started_at
    end,
    hits = case
      when r.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else r.hits + 1
    end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Old counters are useless after their window; the longest window is one hour.
select cron.schedule(
  'purge-rate-limits',
  '17 * * * *',
  $$delete from public.rate_limits where window_started_at < now() - interval '1 day'$$
);

-- Unsubscribe: service role only (see note 2 above).
revoke execute on function public.get_unsubscribe_info(uuid) from anon, authenticated;
revoke execute on function public.unsubscribe_by_token(uuid, text, text) from anon, authenticated;
