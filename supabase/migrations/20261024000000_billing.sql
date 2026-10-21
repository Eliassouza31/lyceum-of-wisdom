-- Phase 7: plans and billing.
-- Every business has one row in subscriptions. New businesses start a 14-day
-- free trial; after that, a paid plan bought through Stripe Checkout keeps the
-- reminders going. Only the Stripe webhook (service role) writes the row, so
-- nothing the browser sends can change a plan.
--
-- The dispatcher only picks up reminders of businesses with access, and stops
-- at the plan's monthly email limit. Paused reminders stay queued and go out
-- once the business pays again (unless the appointment has passed by then).

create type public.plan_tier as enum ('trial', 'basic', 'pro', 'business');

create table public.subscriptions (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  plan public.plan_tier not null default 'trial',
  -- Stripe's subscription status: trialing, active, past_due, canceled, unpaid...
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Set by a trigger when the status becomes past_due: the 7-day grace period starts here.
  past_due_since timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Webhook events already handled. Stripe can send the same event again.
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Plan rules (keep in sync with src/lib/billing/plans.ts; a test checks it)
-- ---------------------------------------------------------------------------

create function public.plan_monthly_email_limit(p_plan public.plan_tier)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'trial' then 1000
    when 'basic' then 1000
    when 'pro' then 5000
    when 'business' then 20000
  end;
$$;

-- Whether reminders go out. A failed payment keeps them going for 7 days.
create function public.subscription_allows_reminders(
  p_status text,
  p_trial_ends_at timestamptz,
  p_past_due_since timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_status
    when 'trialing' then p_trial_ends_at is null or p_trial_ends_at > now()
    when 'active' then true
    when 'past_due' then coalesce(p_past_due_since, now()) > now() - interval '7 days'
    else false
  end;
$$;

create function public.track_past_due()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'past_due' then
    new.past_due_since := null;
  elsif tg_op = 'INSERT' or old.status <> 'past_due' then
    new.past_due_since := coalesce(new.past_due_since, now());
  else
    new.past_due_since := old.past_due_since;
  end if;
  return new;
end;
$$;

create trigger subscriptions_track_past_due
before insert or update of status on public.subscriptions
for each row execute function public.track_past_due();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- Every new business starts a 14-day free trial.
create function public.start_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (business_id, trial_ends_at)
  values (new.id, now() + interval '14 days')
  on conflict do nothing;
  return new;
end;
$$;

create trigger businesses_start_trial
after insert on public.businesses
for each row execute function public.start_trial();

-- Businesses that already exist get their trial from today.
insert into public.subscriptions (business_id, trial_ends_at)
select id, now() + interval '14 days' from public.businesses
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Dispatcher: only businesses with access, and only within the monthly limit
-- ---------------------------------------------------------------------------

create or replace function public.claim_due_reminder_jobs(p_limit integer default 20)
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
    join public.subscriptions s on s.business_id = j.business_id
    where j.status in ('pending', 'failed')
      and j.next_attempt_at <= now()
      -- Without access, jobs wait in the queue (paused) instead of being claimed.
      and public.subscription_allows_reminders(s.status, s.trial_ends_at, s.past_due_since)
    order by j.next_attempt_at
    limit greatest(1, least(p_limit, 100))
    for update of j skip locked
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
  -- The monthly limit is checked against emails already sent, so one batch
  -- can go past it by at most p_limit emails.
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
        when coalesce(u.emails_sent, 0) >= public.plan_monthly_email_limit(sub.plan) then 'quota_exceeded'
      end as reason
    from public.reminder_jobs j2
    join public.appointments a on a.id = j2.appointment_id
    join public.clients c on c.id = a.client_id
    join public.businesses b on b.id = j2.business_id
    join public.subscriptions sub on sub.business_id = j2.business_id
    left join public.usage_counters u
      on u.business_id = j2.business_id
      and u.period_start = pg_catalog.date_trunc('month', pg_catalog.timezone(b.timezone, now()))::date
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

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------

revoke all on table public.subscriptions, public.stripe_events from anon, authenticated;
grant select on table public.subscriptions to authenticated;

revoke execute on function public.start_trial() from public, anon, authenticated;
revoke execute on function public.track_past_due() from public, anon, authenticated;
revoke execute on function public.claim_due_reminder_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminder_jobs(integer) to service_role;

alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

create policy "Members can read their business's subscription"
on public.subscriptions for select to authenticated
using ((select public.is_business_member(business_id)));
-- stripe_events: no policy, so only the service role can read or write it.
