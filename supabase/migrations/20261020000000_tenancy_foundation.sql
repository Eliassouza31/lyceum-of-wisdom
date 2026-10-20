-- Phase 3: tenancy foundation.
-- Every business is a tenant. Users reach a business's data only through business_members,
-- and Row Level Security enforces that in the database itself.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.is_valid_timezone(p_timezone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone);
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'admin', 'staff');

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  timezone text not null,
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- CAN-SPAM requires a valid physical postal address in commercial email footers.
  postal_address text check (postal_address is null or char_length(postal_address) <= 300),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_id_idx on public.business_members (user_id);
create index businesses_created_by_idx on public.businesses (created_by);

create function public.validate_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'Invalid time zone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger businesses_validate
before insert or update of timezone on public.businesses
for each row execute function public.validate_business();

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer so policies can read memberships
-- without recursing into business_members' own policies)
-- ---------------------------------------------------------------------------

create function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
  );
$$;

create function public.has_business_role(p_business_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- New users get a profile automatically
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Onboarding: create a business and its owner membership atomically
-- ---------------------------------------------------------------------------

create function public.create_business(p_name text, p_timezone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_business_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- MVP rule: one business per owner. Serialize per user so two parallel
  -- requests cannot both pass the check.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  if exists (
    select 1 from public.business_members
    where user_id = v_user_id and role = 'owner'
  ) then
    raise exception 'You already own a business' using errcode = 'P0001';
  end if;

  insert into public.businesses (name, timezone, created_by)
  values (btrim(p_name), p_timezone, v_user_id)
  returning id into v_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, v_user_id, 'owner');

  return v_business_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: deny by default, then grant the minimum. RLS narrows rows further.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles, public.businesses, public.business_members from anon, authenticated;

grant select, update (full_name) on table public.profiles to authenticated;
grant select, update (name, timezone, contact_email, phone, postal_address) on table public.businesses to authenticated;
grant select on table public.business_members to authenticated;

revoke execute on function public.create_business(text, text) from public, anon;
grant execute on function public.create_business(text, text) to authenticated;

revoke execute on function public.is_business_member(uuid) from public, anon;
grant execute on function public.is_business_member(uuid) to authenticated;

revoke execute on function public.has_business_role(uuid, public.member_role[]) from public, anon;
grant execute on function public.has_business_role(uuid, public.member_role[]) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Members can read their business"
on public.businesses for select to authenticated
using ((select public.is_business_member(id)));

create policy "Owners and admins can update their business"
on public.businesses for update to authenticated
using ((select public.has_business_role(id, array['owner', 'admin']::public.member_role[])))
with check ((select public.has_business_role(id, array['owner', 'admin']::public.member_role[])));

create policy "Members can read memberships of their business"
on public.business_members for select to authenticated
using ((select public.is_business_member(business_id)));
