-- Phase 4: clients and the consent audit trail.
-- Clients are soft-deleted (deleted_at) so reminder and consent history survive.
-- Every change to a client's reminder consent is written to consent_events by a
-- trigger, so the audit trail cannot be skipped or edited by the app.

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  -- Stored lower-case so uniqueness ignores letter case.
  email text check (
    email is null
    or (email = lower(email) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email_reminders_consent boolean not null default false,
  -- SMS is a later phase (TCPA); the app cannot set this yet.
  sms_reminders_consent boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Reminders need an address to go to.
  constraint clients_email_consent_needs_email check (not email_reminders_consent or email is not null),
  constraint clients_sms_consent_needs_phone check (not sms_reminders_consent or phone_e164 is not null),
  -- Lets other tables reference (client, business) together, so a row can never
  -- point at a client from a different business.
  constraint clients_id_business_id_key unique (id, business_id)
);

create unique index clients_business_email_key
on public.clients (business_id, email)
where deleted_at is null and email is not null;

create index clients_business_name_idx
on public.clients (business_id, last_name, first_name)
where deleted_at is null;

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Consent audit trail (legal proof of who agreed to receive reminders, and when)
-- ---------------------------------------------------------------------------

create type public.consent_channel as enum ('email', 'sms');
create type public.consent_action as enum ('granted', 'revoked');
create type public.consent_source as enum (
  'staff_entry', 'import', 'unsubscribe_link', 'sms_stop', 'booking_form'
);

create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  client_id uuid not null,
  channel public.consent_channel not null,
  action public.consent_action not null,
  source public.consent_source not null,
  recorded_by uuid references auth.users (id) on delete set null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete cascade
);

create index consent_events_client_idx on public.consent_events (client_id, created_at);
create index consent_events_business_idx on public.consent_events (business_id);
create index consent_events_recorded_by_idx on public.consent_events (recorded_by);

create function public.record_client_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  -- Changes made by signed-in staff come from the app; anything else
  -- (service jobs, unsubscribe links) must write its own event.
  v_source public.consent_source := 'staff_entry';
begin
  if v_user_id is null then
    return new;
  end if;

  if new.email_reminders_consent is distinct from
     (case when tg_op = 'INSERT' then false else old.email_reminders_consent end) then
    insert into public.consent_events (business_id, client_id, channel, action, source, recorded_by)
    values (
      new.business_id, new.id, 'email',
      case when new.email_reminders_consent then 'granted' else 'revoked' end::public.consent_action,
      v_source, v_user_id
    );
  end if;

  if new.sms_reminders_consent is distinct from
     (case when tg_op = 'INSERT' then false else old.sms_reminders_consent end) then
    insert into public.consent_events (business_id, client_id, channel, action, source, recorded_by)
    values (
      new.business_id, new.id, 'sms',
      case when new.sms_reminders_consent then 'granted' else 'revoked' end::public.consent_action,
      v_source, v_user_id
    );
  end if;

  return new;
end;
$$;

create trigger clients_record_consent
after insert or update of email_reminders_consent, sms_reminders_consent on public.clients
for each row execute function public.record_client_consent();

-- ---------------------------------------------------------------------------
-- Privileges: members manage clients; nobody hard-deletes them or edits the trail.
-- ---------------------------------------------------------------------------

revoke all on table public.clients, public.consent_events from anon, authenticated;

grant select,
  insert (business_id, first_name, last_name, email, phone_e164, email_reminders_consent, notes),
  update (first_name, last_name, email, phone_e164, email_reminders_consent, notes, deleted_at)
on table public.clients to authenticated;

grant select on table public.consent_events to authenticated;

revoke execute on function public.record_client_consent() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.clients enable row level security;
alter table public.consent_events enable row level security;

create policy "Members can read their business's clients"
on public.clients for select to authenticated
using ((select public.is_business_member(business_id)));

create policy "Members can add clients to their business"
on public.clients for insert to authenticated
with check ((select public.is_business_member(business_id)));

create policy "Members can update their business's clients"
on public.clients for update to authenticated
using ((select public.is_business_member(business_id)))
with check ((select public.is_business_member(business_id)));

create policy "Members can read their business's consent history"
on public.consent_events for select to authenticated
using ((select public.is_business_member(business_id)));
