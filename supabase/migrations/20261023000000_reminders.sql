-- Phase 6: email reminders.
-- Reminder rules ("24 hours before") turn every scheduled appointment into
-- reminder jobs. A trigger keeps the jobs in sync with appointments and rules,
-- pg_cron asks the app every minute to send the jobs that are due, and every
-- change of a job's status is written to notification_events (the history page).
--
-- Members can read all of this; only the service role (the dispatcher and the
-- Resend webhook, running on the server) writes jobs, events and suppressions.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create type public.reminder_channel as enum ('email', 'sms');
create type public.reminder_job_status as enum (
  'pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped'
);
create type public.notification_event_type as enum (
  'queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'skipped', 'cancelled'
);
create type public.suppression_reason as enum ('unsubscribed', 'hard_bounce', 'complaint');

-- Opaque per-client token for the unsubscribe link in every reminder email.
alter table public.clients
add column unsubscribe_token uuid not null default gen_random_uuid();

alter table public.clients
add constraint clients_unsubscribe_token_key unique (unsubscribe_token);

-- ---------------------------------------------------------------------------
-- Rules and the email template
-- ---------------------------------------------------------------------------

create table public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- SMS is a later phase; the app cannot pick a channel yet.
  channel public.reminder_channel not null default 'email' check (channel = 'email'),
  -- Between 15 minutes and 14 days before the appointment.
  offset_minutes integer not null check (offset_minutes between 15 and 20160),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_rules_business_offset_key unique (business_id, channel, offset_minutes)
);

create trigger reminder_rules_set_updated_at
before update on public.reminder_rules
for each row execute function public.set_updated_at();

-- A business has at most one email template; without one the app uses its default.
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  channel public.reminder_channel not null default 'email' check (channel = 'email'),
  subject text not null check (char_length(btrim(subject)) between 1 and 150),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_templates_business_channel_key unique (business_id, channel)
);

create trigger message_templates_set_updated_at
before update on public.message_templates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The send queue
-- ---------------------------------------------------------------------------

create table public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  appointment_id uuid not null,
  -- Kept (as null) when the rule is deleted, so the history survives.
  rule_id uuid references public.reminder_rules (id) on delete set null,
  channel public.reminder_channel not null,
  offset_minutes integer not null,
  send_at timestamptz not null,
  status public.reminder_job_status not null default 'pending',
  attempts integer not null default 0,
  -- When the dispatcher should pick the job up; null once it is final.
  next_attempt_at timestamptz,
  locked_at timestamptz,
  skip_reason text,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (appointment_id, business_id)
    references public.appointments (id, business_id) on delete cascade,
  -- One job per appointment and rule: the database itself prevents duplicates.
  constraint reminder_jobs_appointment_rule_key unique (appointment_id, rule_id)
);

create index reminder_jobs_due_idx
on public.reminder_jobs (next_attempt_at)
where status in ('pending', 'failed');

create index reminder_jobs_business_send_at_idx on public.reminder_jobs (business_id, send_at desc);
create index reminder_jobs_rule_idx on public.reminder_jobs (rule_id);
create index reminder_jobs_provider_message_idx
on public.reminder_jobs (provider_message_id)
where provider_message_id is not null;

create trigger reminder_jobs_set_updated_at
before update on public.reminder_jobs
for each row execute function public.set_updated_at();

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  job_id uuid not null references public.reminder_jobs (id) on delete cascade,
  event public.notification_event_type not null,
  detail jsonb not null default '{}'::jsonb,
  -- Webhook delivery id (svix-id), so a re-delivered webhook is recorded once.
  provider_event_id text unique,
  created_at timestamptz not null default now()
);

create index notification_events_job_idx on public.notification_events (job_id, created_at);
create index notification_events_business_idx on public.notification_events (business_id, created_at desc);

-- Addresses that must never get another email. business_id null = every business.
create table public.suppressions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  channel public.reminder_channel not null,
  address text not null check (address = lower(address)),
  reason public.suppression_reason not null,
  created_at timestamptz not null default now(),
  constraint suppressions_business_channel_address_key
    unique nulls not distinct (business_id, channel, address)
);

create index suppressions_address_idx on public.suppressions (channel, address);

create table public.usage_counters (
  business_id uuid not null references public.businesses (id) on delete cascade,
  period_start date not null,
  emails_sent integer not null default 0,
  sms_sent integer not null default 0,
  primary key (business_id, period_start)
);

-- ---------------------------------------------------------------------------
-- Keeping jobs in sync with appointments and rules
-- ---------------------------------------------------------------------------

-- Creates, reschedules or cancels the jobs of one appointment or one rule
-- (or both). A job that is being sent right now is never touched; the
-- dispatcher checks the appointment again before it sends.
create function public.refresh_reminder_jobs(
  p_business_id uuid,
  p_appointment_id uuid default null,
  p_rule_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Jobs whose appointment or rule no longer wants a reminder.
  update public.reminder_jobs j
  set status = 'cancelled', next_attempt_at = null, locked_at = null
  where j.business_id = p_business_id
    and (p_appointment_id is null or j.appointment_id = p_appointment_id)
    and (p_rule_id is null or j.rule_id = p_rule_id)
    and (j.status = 'pending' or (j.status = 'failed' and j.next_attempt_at is not null))
    and not exists (
      select 1
      from public.appointments a
      join public.reminder_rules r on r.business_id = a.business_id
      where a.id = j.appointment_id
        and r.id = j.rule_id
        and a.status = 'scheduled'
        and a.deleted_at is null
        and a.starts_at > now()
        and r.is_active
    );

  -- Jobs every active rule wants for every upcoming scheduled appointment.
  -- A reminder whose time has already passed is skipped, never sent late.
  insert into public.reminder_jobs as j (
    business_id, appointment_id, rule_id, channel, offset_minutes, send_at,
    status, next_attempt_at, skip_reason
  )
  select
    a.business_id, a.id, r.id, r.channel, r.offset_minutes, d.send_at,
    case when d.send_at <= now() then 'skipped' else 'pending' end::public.reminder_job_status,
    case when d.send_at <= now() then null else d.send_at end,
    case when d.send_at <= now() then 'too_late' end
  from public.appointments a
  join public.reminder_rules r on r.business_id = a.business_id
  cross join lateral (
    select a.starts_at - pg_catalog.make_interval(mins => r.offset_minutes) as send_at
  ) d
  where a.business_id = p_business_id
    and (p_appointment_id is null or a.id = p_appointment_id)
    and (p_rule_id is null or r.id = p_rule_id)
    and a.status = 'scheduled'
    and a.deleted_at is null
    and a.starts_at > now()
    and r.is_active
    -- A new or changed rule does not fill the history with reminders that
    -- were already too late for appointments booked earlier.
    and (p_rule_id is null or d.send_at > now())
  on conflict (appointment_id, rule_id) do update
  set send_at = excluded.send_at,
      offset_minutes = excluded.offset_minutes,
      status = excluded.status,
      next_attempt_at = excluded.next_attempt_at,
      skip_reason = excluded.skip_reason,
      attempts = 0,
      locked_at = null,
      last_error = null,
      provider_message_id = null,
      sent_at = null
  -- Rescheduled (new time) or brought back after a cancellation.
  where j.status <> 'processing'
    and (j.status = 'cancelled' or j.send_at is distinct from excluded.send_at);
end;
$$;

create function public.sync_appointment_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_reminder_jobs(new.business_id, new.id, null);
  return new;
end;
$$;

create trigger appointments_sync_reminders
after insert or update of starts_at, status, deleted_at on public.appointments
for each row execute function public.sync_appointment_reminders();

create function public.sync_rule_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.reminder_jobs
    set status = 'cancelled', next_attempt_at = null, locked_at = null
    where rule_id = old.id
      and (status = 'pending' or (status = 'failed' and next_attempt_at is not null));
    return old;
  end if;
  perform public.refresh_reminder_jobs(new.business_id, null, new.id);
  return new;
end;
$$;

create trigger reminder_rules_sync_jobs
after insert or update of offset_minutes, is_active on public.reminder_rules
for each row execute function public.sync_rule_reminders();

-- Runs before the row goes away so its pending jobs are cancelled, not orphaned.
create trigger reminder_rules_cancel_jobs_on_delete
before delete on public.reminder_rules
for each row execute function public.sync_rule_reminders();

-- Every status change of a job lands in the history.
create function public.record_reminder_job_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.notification_event_type;
begin
  if tg_op = 'UPDATE' and new.status = old.status
     and new.send_at is not distinct from old.send_at then
    return new;
  end if;

  v_event := case new.status
    when 'pending' then 'queued'
    when 'sent' then 'sent'
    when 'failed' then 'failed'
    when 'skipped' then 'skipped'
    when 'cancelled' then 'cancelled'
  end;
  -- 'processing' is an internal state, not worth a history line.
  if v_event is null then
    return new;
  end if;

  insert into public.notification_events (business_id, job_id, event, detail)
  values (
    new.business_id, new.id, v_event,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'send_at', new.send_at,
      'reason', new.skip_reason,
      'error', new.last_error,
      'attempts', case when new.attempts > 0 then new.attempts end,
      'will_retry', case when new.status = 'failed' then new.next_attempt_at is not null end
    ))
  );
  return new;
end;
$$;

create trigger reminder_jobs_record_event
after insert or update of status, send_at on public.reminder_jobs
for each row execute function public.record_reminder_job_event();

-- Every new business starts with a "24 hours before" email reminder.
create function public.create_default_reminder_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reminder_rules (business_id, offset_minutes)
  values (new.id, 1440)
  on conflict do nothing;
  return new;
end;
$$;

create trigger businesses_create_default_reminder_rule
after insert on public.businesses
for each row execute function public.create_default_reminder_rule();

-- Businesses that already exist get the same default rule (and their
-- upcoming appointments get jobs through the rule trigger).
insert into public.reminder_rules (business_id, offset_minutes)
select id, 1440 from public.businesses
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Dispatcher API (service role only)
-- ---------------------------------------------------------------------------

-- Picks up to p_limit due jobs and marks them 'processing'. FOR UPDATE SKIP
-- LOCKED means two runs at the same time never get the same job. Jobs that
-- must not be sent any more are settled here, and only sendable jobs are
-- returned, with everything needed to write the email.
create function public.claim_due_reminder_jobs(p_limit integer default 20)
returns table (
  job_id uuid,
  business_id uuid,
  send_at timestamptz,
  attempts integer,
  business_name text,
  business_timezone text,
  business_contact_email text,
  business_postal_address text,
  client_first_name text,
  client_email text,
  unsubscribe_token uuid,
  appointment_title text,
  appointment_starts_at timestamptz,
  appointment_location text,
  template_subject text,
  template_body text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  -- Recovery: a run that died mid-send leaves jobs 'processing'. Put them back.
  update public.reminder_jobs
  set status = 'pending', locked_at = null, next_attempt_at = now()
  where status = 'processing' and locked_at < now() - interval '10 minutes';

  with due as (
    select j.id
    from public.reminder_jobs j
    where j.status in ('pending', 'failed')
      and j.next_attempt_at <= now()
    order by j.next_attempt_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  ),
  claimed as (
    update public.reminder_jobs j
    set status = 'processing', locked_at = now(), attempts = j.attempts + 1
    from due
    where j.id = due.id
    returning j.id
  )
  select coalesce(pg_catalog.array_agg(claimed.id), '{}') into v_ids from claimed;

  -- Appointment gone or no longer scheduled: nothing to remind.
  update public.reminder_jobs j
  set status = 'cancelled', next_attempt_at = null, locked_at = null
  from public.appointments a
  where j.id = any (v_ids)
    and a.id = j.appointment_id
    and (a.status <> 'scheduled' or a.deleted_at is not null);

  -- The other reasons a reminder is not sent, in order of importance.
  update public.reminder_jobs j
  set status = 'skipped', next_attempt_at = null, locked_at = null,
      skip_reason = s.reason
  from (
    select j2.id,
      case
        when a.starts_at <= now() then 'appointment_passed'
        when c.deleted_at is not null then 'client_removed'
        when c.email is null or not c.email_reminders_consent then 'no_consent'
        when exists (
          select 1 from public.suppressions x
          where x.channel = 'email'
            and x.address = c.email
            and (x.business_id is null or x.business_id = j2.business_id)
        ) then 'suppressed'
        when b.postal_address is null or pg_catalog.btrim(b.postal_address) = '' then 'missing_postal_address'
      end as reason
    from public.reminder_jobs j2
    join public.appointments a on a.id = j2.appointment_id
    join public.clients c on c.id = a.client_id
    join public.businesses b on b.id = j2.business_id
    where j2.id = any (v_ids)
      and j2.status = 'processing'
  ) s
  where j.id = s.id and s.reason is not null;

  return query
  select
    j.id, j.business_id, j.send_at, j.attempts,
    b.name, b.timezone, b.contact_email, b.postal_address,
    c.first_name, c.email, c.unsubscribe_token,
    a.title, a.starts_at, a.location,
    t.subject, t.body
  from public.reminder_jobs j
  join public.appointments a on a.id = j.appointment_id
  join public.clients c on c.id = a.client_id
  join public.businesses b on b.id = j.business_id
  left join public.message_templates t on t.business_id = j.business_id and t.channel = j.channel
  where j.id = any (v_ids)
    and j.status = 'processing'
  order by j.send_at;
end;
$$;

create function public.complete_reminder_job(p_job_id uuid, p_provider_message_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_timezone text;
begin
  update public.reminder_jobs j
  set status = 'sent', sent_at = now(), provider_message_id = p_provider_message_id,
      next_attempt_at = null, locked_at = null, last_error = null
  where j.id = p_job_id and j.status = 'processing'
  returning j.business_id into v_business_id;

  if v_business_id is null then
    return;
  end if;

  -- Usage is counted per calendar month in the business's own time zone.
  select b.timezone into v_timezone from public.businesses b where b.id = v_business_id;
  insert into public.usage_counters as u (business_id, period_start, emails_sent)
  values (
    v_business_id,
    pg_catalog.date_trunc('month', pg_catalog.timezone(v_timezone, now()))::date,
    1
  )
  on conflict (business_id, period_start)
  do update set emails_sent = u.emails_sent + 1;
end;
$$;

-- Temporary failures are retried after 1 min, 5 min, 30 min and 2 hours;
-- after the 5th attempt (or a permanent failure) the job stays 'failed'.
create function public.fail_reminder_job(p_job_id uuid, p_error text, p_permanent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reminder_jobs j
  set status = 'failed',
      locked_at = null,
      last_error = left(p_error, 500),
      next_attempt_at = case
        when p_permanent or j.attempts >= 5 then null
        else now() + case j.attempts
          when 1 then interval '1 minute'
          when 2 then interval '5 minutes'
          when 3 then interval '30 minutes'
          else interval '2 hours'
        end
      end
  where j.id = p_job_id and j.status = 'processing';
end;
$$;

-- Resend webhook: delivered / bounced / complained. Returns false when the
-- email is unknown. Bounces and complaints block the address from now on.
create function public.record_email_event(
  p_provider_message_id text,
  p_event public.notification_event_type,
  p_provider_event_id text,
  p_detail jsonb default '{}'::jsonb,
  p_permanent_bounce boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.reminder_jobs;
  v_email text;
begin
  if p_event not in ('delivered', 'bounced', 'complained') then
    raise exception 'Unsupported event: %', p_event using errcode = '22023';
  end if;

  select * into v_job from public.reminder_jobs
  where provider_message_id = p_provider_message_id
  limit 1;
  if not found then
    return false;
  end if;

  insert into public.notification_events (business_id, job_id, event, detail, provider_event_id)
  values (v_job.business_id, v_job.id, p_event, coalesce(p_detail, '{}'::jsonb), p_provider_event_id)
  on conflict (provider_event_id) do nothing;

  if p_event = 'delivered' or (p_event = 'bounced' and not p_permanent_bounce) then
    return true;
  end if;

  select c.email into v_email
  from public.appointments a
  join public.clients c on c.id = a.client_id
  where a.id = v_job.appointment_id;

  if v_email is not null then
    insert into public.suppressions (business_id, channel, address, reason)
    values (
      -- A hard bounce means the address does not exist, for anyone.
      case when p_event = 'bounced' then null else v_job.business_id end,
      'email', v_email,
      case when p_event = 'bounced' then 'hard_bounce' else 'complaint' end::public.suppression_reason
    )
    on conflict do nothing;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Unsubscribe link (public: the token in the email is the only credential)
-- ---------------------------------------------------------------------------

create function public.get_unsubscribe_info(p_token uuid)
returns table (business_name text, subscribed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.name, c.email_reminders_consent
  from public.clients c
  join public.businesses b on b.id = c.business_id
  where c.unsubscribe_token = p_token and c.deleted_at is null;
$$;

create function public.unsubscribe_by_token(p_token uuid, p_ip_address text default null, p_user_agent text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_business_name text;
begin
  select * into v_client from public.clients
  where unsubscribe_token = p_token and deleted_at is null
  for update;
  if not found then
    return null;
  end if;

  select name into v_business_name from public.businesses where id = v_client.business_id;

  if v_client.email_reminders_consent then
    update public.clients set email_reminders_consent = false where id = v_client.id;
    -- The consent trigger only records staff changes; this one is the client's own.
    insert into public.consent_events (
      business_id, client_id, channel, action, source, ip_address, user_agent
    )
    values (
      v_client.business_id, v_client.id, 'email', 'revoked', 'unsubscribe_link',
      left(p_ip_address, 100), left(p_user_agent, 300)
    );
  end if;
  return v_business_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- pg_cron: every minute, ask the app to send due reminders
-- ---------------------------------------------------------------------------

-- The shared secret the app checks on /api/cron/dispatch. It is created here
-- and never leaves the database: the app reads it with get_dispatch_secret().
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'reminder_dispatch_secret',
  'Bearer token for /api/cron/dispatch'
)
where not exists (select 1 from vault.secrets where name = 'reminder_dispatch_secret');

create function public.get_dispatch_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'reminder_dispatch_secret'
  limit 1;
$$;

-- Does nothing until the app's address is stored in the vault as
-- 'reminder_dispatch_url' (e.g. https://example.com/api/cron/dispatch).
create function public.invoke_reminder_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets
  where name = 'reminder_dispatch_url' limit 1;
  v_secret := public.get_dispatch_secret();
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := pg_catalog.jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

select cron.schedule('dispatch-reminders', '* * * * *', 'select public.invoke_reminder_dispatch()');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table
  public.reminder_rules, public.message_templates, public.reminder_jobs,
  public.notification_events, public.suppressions, public.usage_counters
from anon, authenticated;

grant select, insert (business_id, offset_minutes, is_active), update (offset_minutes, is_active), delete
on table public.reminder_rules to authenticated;

grant select, insert (business_id, subject, body), update (subject, body), delete
on table public.message_templates to authenticated;

grant select on table public.reminder_jobs, public.notification_events, public.usage_counters to authenticated;

revoke execute on function public.refresh_reminder_jobs(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sync_appointment_reminders() from public, anon, authenticated;
revoke execute on function public.sync_rule_reminders() from public, anon, authenticated;
revoke execute on function public.record_reminder_job_event() from public, anon, authenticated;
revoke execute on function public.create_default_reminder_rule() from public, anon, authenticated;
revoke execute on function public.invoke_reminder_dispatch() from public, anon, authenticated;

revoke execute on function public.claim_due_reminder_jobs(integer) from public, anon, authenticated;
revoke execute on function public.complete_reminder_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.fail_reminder_job(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.record_email_event(text, public.notification_event_type, text, jsonb, boolean)
from public, anon, authenticated;
revoke execute on function public.get_dispatch_secret() from public, anon, authenticated;
grant execute on function public.claim_due_reminder_jobs(integer) to service_role;
grant execute on function public.complete_reminder_job(uuid, text) to service_role;
grant execute on function public.fail_reminder_job(uuid, text, boolean) to service_role;
grant execute on function public.record_email_event(text, public.notification_event_type, text, jsonb, boolean)
to service_role;
grant execute on function public.get_dispatch_secret() to service_role;

revoke execute on function public.get_unsubscribe_info(uuid) from public;
revoke execute on function public.unsubscribe_by_token(uuid, text, text) from public;
grant execute on function public.get_unsubscribe_info(uuid) to anon, authenticated, service_role;
grant execute on function public.unsubscribe_by_token(uuid, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security (service_role bypasses it)
-- ---------------------------------------------------------------------------

alter table public.reminder_rules enable row level security;
alter table public.message_templates enable row level security;
alter table public.reminder_jobs enable row level security;
alter table public.notification_events enable row level security;
alter table public.suppressions enable row level security;
alter table public.usage_counters enable row level security;

create policy "Members can read their business's reminder rules"
on public.reminder_rules for select to authenticated
using ((select public.is_business_member(business_id)));

create policy "Owners and admins can add reminder rules"
on public.reminder_rules for insert to authenticated
with check ((select public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])));

create policy "Owners and admins can change reminder rules"
on public.reminder_rules for update to authenticated
using ((select public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])))
with check ((select public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])));

create policy "Owners and admins can delete reminder rules"
on public.reminder_rules for delete to authenticated
using ((select public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])));

create policy "Members can read their business's templates"
on public.message_templates for select to authenticated
using ((select public.is_business_member(business_id)));

create policy "Owners and admins can add templates"
on public.message_templates for insert to authenticated
with check ((select public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])));

create policy "Owners and admins can change templates"
on public.message_templates for update to authenticated
using ((select public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])))
with check ((select public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])));

create policy "Owners and admins can delete templates"
on public.message_templates for delete to authenticated
using ((select public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])));

create policy "Members can read their business's reminder jobs"
on public.reminder_jobs for select to authenticated
using ((select public.is_business_member(business_id)));

create policy "Members can read their business's notification history"
on public.notification_events for select to authenticated
using ((select public.is_business_member(business_id)));

create policy "Members can read their business's usage"
on public.usage_counters for select to authenticated
using ((select public.is_business_member(business_id)));
-- suppressions: no policy, so only the service role can read or write them.
