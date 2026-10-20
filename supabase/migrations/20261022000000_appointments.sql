-- Phase 5: appointments.
-- Times are stored in UTC (timestamptz); the app converts from and to the
-- business's time zone. Appointments are soft-deleted (deleted_at) so the
-- reminder history added in phase 6 can keep pointing at them.

create type public.appointment_status as enum ('scheduled', 'cancelled', 'completed', 'no_show');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text check (location is null or char_length(location) <= 200),
  notes text check (notes is null or char_length(notes) <= 1000),
  status public.appointment_status not null default 'scheduled',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_ends_after_start check (ends_at > starts_at),
  constraint appointments_max_length check (ends_at - starts_at <= interval '24 hours'),
  -- The client must belong to the same business as the appointment.
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete cascade,
  -- Lets reminder jobs (phase 6) reference (appointment, business) together.
  constraint appointments_id_business_id_key unique (id, business_id)
);

create index appointments_business_starts_idx
on public.appointments (business_id, starts_at)
where deleted_at is null;

create index appointments_client_starts_idx
on public.appointments (client_id, starts_at)
where deleted_at is null;

create index appointments_created_by_idx on public.appointments (created_by);

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

-- A removed client cannot be booked.
create function public.validate_appointment_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Existing appointments of a removed client can still be edited.
  if tg_op = 'UPDATE' and new.client_id = old.client_id then
    return new;
  end if;
  if exists (
    select 1 from public.clients c
    where c.id = new.client_id and c.deleted_at is not null
  ) then
    raise exception 'This client was removed' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger appointments_validate_client
before insert or update of client_id on public.appointments
for each row execute function public.validate_appointment_client();

-- Removing a client cancels their upcoming appointments, so no reminder goes out.
create function public.cancel_appointments_of_removed_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.appointments
  set status = 'cancelled'
  where client_id = new.id
    and business_id = new.business_id
    and status = 'scheduled'
    and starts_at > now()
    and deleted_at is null;
  return new;
end;
$$;

create trigger clients_cancel_appointments_on_remove
after update of deleted_at on public.clients
for each row
when (old.deleted_at is null and new.deleted_at is not null)
execute function public.cancel_appointments_of_removed_client();

-- ---------------------------------------------------------------------------
-- Privileges: members manage appointments; nobody hard-deletes them.
-- New appointments always start as 'scheduled' and record who created them.
-- ---------------------------------------------------------------------------

revoke all on table public.appointments from anon, authenticated;

grant select,
  insert (business_id, client_id, title, starts_at, ends_at, location, notes),
  update (client_id, title, starts_at, ends_at, location, notes, status, deleted_at)
on table public.appointments to authenticated;

revoke execute on function public.validate_appointment_client() from public, anon, authenticated;
revoke execute on function public.cancel_appointments_of_removed_client() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.appointments enable row level security;

create policy "Members can read their business's appointments"
on public.appointments for select to authenticated
using ((select public.is_business_member(business_id)));

create policy "Members can add appointments to their business"
on public.appointments for insert to authenticated
with check ((select public.is_business_member(business_id)));

create policy "Members can update their business's appointments"
on public.appointments for update to authenticated
using ((select public.is_business_member(business_id)))
with check ((select public.is_business_member(business_id)));
