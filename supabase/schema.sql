-- Extensions
create extension if not exists pgcrypto;

-- Tables
create table if not exists hatym_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  is_active boolean not null default true,
  pages_per_user int not null default 3,
  page_ttl_minutes int not null default 10,
  auto_complete_after_minutes int null,
  constraint hatym_sessions_pages_per_user_check check (pages_per_user between 1 and 20),
  constraint hatym_sessions_page_ttl_minutes_check check (page_ttl_minutes between 1 and 1440),
  constraint hatym_sessions_auto_complete_after_minutes_check check (
    auto_complete_after_minutes is null
    or auto_complete_after_minutes between 1 and 43200
  )
);

create table if not exists quran_pages (
  page_number int primary key,
  mushaf_url text not null,
  render_type text not null default 'json',
  constraint quran_pages_render_type_check check (render_type = 'json')
);

-- Schema upgrades for existing databases (create table if not exists won't alter old tables).
alter table hatym_sessions
  add column if not exists pages_per_user int;

alter table hatym_sessions
  add column if not exists page_ttl_minutes int;

alter table hatym_sessions
  add column if not exists auto_complete_after_minutes int;

update hatym_sessions
set pages_per_user = 3
where pages_per_user is null;

update hatym_sessions
set pages_per_user = least(greatest(pages_per_user, 1), 20)
where pages_per_user is distinct from least(greatest(pages_per_user, 1), 20);

alter table hatym_sessions
  alter column pages_per_user set default 3;

alter table hatym_sessions
  alter column pages_per_user set not null;

alter table hatym_sessions
  drop constraint if exists hatym_sessions_pages_per_user_check;

alter table hatym_sessions
  add constraint hatym_sessions_pages_per_user_check
  check (pages_per_user between 1 and 20);

update hatym_sessions
set page_ttl_minutes = 10
where page_ttl_minutes is null;

update hatym_sessions
set page_ttl_minutes = least(greatest(page_ttl_minutes, 1), 1440)
where page_ttl_minutes is distinct from least(greatest(page_ttl_minutes, 1), 1440);

alter table hatym_sessions
  alter column page_ttl_minutes set default 10;

alter table hatym_sessions
  alter column page_ttl_minutes set not null;

alter table hatym_sessions
  drop constraint if exists hatym_sessions_page_ttl_minutes_check;

alter table hatym_sessions
  add constraint hatym_sessions_page_ttl_minutes_check
  check (page_ttl_minutes between 1 and 1440);

update hatym_sessions
set auto_complete_after_minutes = null
where auto_complete_after_minutes is not null
  and auto_complete_after_minutes <= 0;

update hatym_sessions
set auto_complete_after_minutes = least(greatest(auto_complete_after_minutes, 1), 43200)
where auto_complete_after_minutes is distinct from least(greatest(auto_complete_after_minutes, 1), 43200);

alter table hatym_sessions
  alter column auto_complete_after_minutes set default null;

alter table hatym_sessions
  drop constraint if exists hatym_sessions_auto_complete_after_minutes_check;

alter table hatym_sessions
  add constraint hatym_sessions_auto_complete_after_minutes_check
  check (
    auto_complete_after_minutes is null
    or auto_complete_after_minutes between 1 and 43200
  );

alter table quran_pages
  add column if not exists render_type text;

update quran_pages
set render_type = lower(btrim(render_type))
where render_type is not null;

update quran_pages
set render_type = 'json'
where render_type is null
  or btrim(render_type) = ''
  or render_type <> 'json';

alter table quran_pages
  alter column render_type set default 'json';

alter table quran_pages
  alter column render_type set not null;

alter table quran_pages
  drop constraint if exists quran_pages_render_type_check;

alter table quran_pages
  add constraint quran_pages_render_type_check
  check (render_type = 'json');

create table if not exists hatym_pages (
  session_id uuid not null references hatym_sessions(id) on delete cascade,
  page_number int not null references quran_pages(page_number),
  status text not null check (status in ('available', 'assigned', 'completed')),
  assigned_to text null,
  assigned_at timestamptz null,
  completed_at timestamptz null,
  claim_token text null,
  last_expired_to text null,
  last_expired_at timestamptz null,
  primary key (session_id, page_number)
);

create table if not exists hatym_claim_events (
  id bigserial primary key,
  session_id uuid not null references hatym_sessions(id) on delete cascade,
  user_id text not null,
  page_number int not null references quran_pages(page_number),
  claim_token text null,
  completed_at timestamptz null,
  expired_at timestamptz null,
  claimed_at timestamptz not null default now()
);

create table if not exists hatym_participants (
  session_id uuid not null references hatym_sessions(id) on delete cascade,
  user_id text not null,
  name text not null,
  deceased_name text null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table hatym_pages
  add column if not exists last_expired_to text;

alter table hatym_pages
  add column if not exists last_expired_at timestamptz;

alter table hatym_claim_events
  add column if not exists claim_token text;

alter table hatym_claim_events
  add column if not exists completed_at timestamptz;

alter table hatym_claim_events
  add column if not exists expired_at timestamptz;

-- Indexes
drop index if exists hatym_sessions_single_row_idx;
drop index if exists hatym_sessions_single_active_idx;
create index if not exists hatym_pages_session_status_idx on hatym_pages (session_id, status);
create index if not exists hatym_pages_session_assigned_at_idx on hatym_pages (session_id, assigned_at);
create index if not exists hatym_pages_session_assigned_to_status_idx on hatym_pages (session_id, assigned_to, status);
create index if not exists hatym_claim_events_session_user_idx on hatym_claim_events (session_id, user_id);
create index if not exists hatym_claim_events_session_token_idx on hatym_claim_events (session_id, claim_token);
create index if not exists hatym_participants_session_joined_idx on hatym_participants (session_id, joined_at);

-- RLS
alter table hatym_sessions enable row level security;
alter table quran_pages enable row level security;
alter table hatym_pages enable row level security;
alter table hatym_claim_events enable row level security;
alter table hatym_participants enable row level security;

drop policy if exists "Public read sessions" on hatym_sessions;
create policy "Public read sessions" on hatym_sessions
  for select using (true);

drop policy if exists "Public read quran pages" on quran_pages;
create policy "Public read quran pages" on quran_pages
  for select using (true);

drop policy if exists "Public read hatym pages" on hatym_pages;
create policy "Public read hatym pages" on hatym_pages
  for select using (true);

drop policy if exists "Public read claim events" on hatym_claim_events;
create policy "Public read claim events" on hatym_claim_events
  for select using (true);

drop policy if exists "Public read participants" on hatym_participants;
create policy "Public read participants" on hatym_participants
  for select using (true);

grant select on hatym_claim_events to anon, authenticated;
grant select on hatym_participants to anon, authenticated;

-- Functions
drop function if exists create_hatym_session_with_settings(int, int, int);

create or replace function create_hatym_session_with_settings(
  p_pages_per_user int default 3,
  p_page_ttl_minutes int default 10,
  p_auto_complete_after_minutes int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_pages_per_user int := least(greatest(coalesce(p_pages_per_user, 3), 1), 20);
  v_page_ttl_minutes int := least(greatest(coalesce(p_page_ttl_minutes, 10), 1), 1440);
  v_auto_complete_after_minutes int := case
    when p_auto_complete_after_minutes is null or p_auto_complete_after_minutes <= 0 then null
    else least(greatest(p_auto_complete_after_minutes, 1), 43200)
  end;
begin
  insert into hatym_sessions (
    is_active,
    pages_per_user,
    page_ttl_minutes,
    auto_complete_after_minutes
  )
  values (
    true,
    v_pages_per_user,
    v_page_ttl_minutes,
    v_auto_complete_after_minutes
  )
  returning id into v_session_id;

  insert into hatym_pages (session_id, page_number, status)
  select v_session_id, qp.page_number, 'available'
  from quran_pages qp
  on conflict (session_id, page_number) do nothing;

  return v_session_id;
end;
$$;

create or replace function create_hatym_session()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return create_hatym_session_with_settings();
end;
$$;

create or replace function release_expired_assignments(
  p_session_id uuid,
  p_ttl_minutes int default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_ttl interval;
  v_updated int := 0;
  v_completed int := 0;
  v_session_active boolean;
  v_session_ttl_minutes int := 10;
begin
  select hs.is_active, hs.page_ttl_minutes
  into v_session_active, v_session_ttl_minutes
  from hatym_sessions hs
  where hs.id = p_session_id;

  if v_session_active is distinct from true then
    return 0;
  end if;

  v_ttl := make_interval(mins => greatest(coalesce(p_ttl_minutes, v_session_ttl_minutes, 10), 0));

  with expired as (
    select
      hp.session_id,
      hp.page_number,
      hp.assigned_to,
      hp.claim_token
    from hatym_pages hp
    where hp.session_id = p_session_id
      and hp.status = 'assigned'
      and hp.assigned_at is not null
      and hp.assigned_at <= v_now - v_ttl
    for update
  ),
  marked_events as (
    update hatym_claim_events hce
    set expired_at = coalesce(hce.expired_at, v_now)
    from expired e
    where hce.session_id = e.session_id
      and hce.user_id = e.assigned_to
      and hce.page_number = e.page_number
      and hce.claim_token = e.claim_token
      and hce.completed_at is null
      and hce.expired_at is null
    returning hce.id
  ),
  released as (
    update hatym_pages hp
    set status = 'available',
        assigned_to = null,
        assigned_at = null,
        completed_at = null,
        claim_token = null,
        last_expired_to = e.assigned_to,
        last_expired_at = v_now
    from expired e
    where hp.session_id = e.session_id
      and hp.page_number = e.page_number
    returning 1
  )
  select count(*)
  into v_updated
  from released;

  return v_updated;
end;
$$;

drop function if exists claim_next_page(uuid, text, int);

create or replace function claim_next_page(
  p_session_id uuid,
  p_user_id text,
  p_reader_name text,
  p_deceased_name text default null,
  p_ttl_minutes int default null
)
returns table (
  page_number int,
  mushaf_url text,
  claim_token text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_page record;
  v_session_active boolean;
  v_claimed_count int := 0;
  v_active_count int := 0;
  v_rows_returned int := 0;
  v_rows int := 0;
  v_max_pages int := 3;
  v_pages_to_assign int := 1;
  v_ttl_minutes int := 10;
  v_reader_name text := nullif(btrim(coalesce(p_reader_name, '')), '');
  v_deceased_name text := nullif(btrim(coalesce(p_deceased_name, '')), '');
begin
  if v_reader_name is null then
    status := 'name_required';
    return next;
    return;
  end if;

  select
    hs.is_active,
    least(greatest(coalesce(hs.pages_per_user, 3), 1), 20),
    least(greatest(coalesce(hs.page_ttl_minutes, 10), 1), 1440)
  into v_session_active, v_max_pages, v_ttl_minutes
  from hatym_sessions hs
  where hs.id = p_session_id;

  if v_session_active is distinct from true then
    status := 'finished';
    return next;
    return;
  end if;

  perform release_expired_assignments(p_session_id, coalesce(p_ttl_minutes, v_ttl_minutes));

  -- Serialize claims for the same user in the same session.
  perform pg_advisory_xact_lock(hashtext(p_session_id::text || ':' || p_user_id));

  insert into hatym_participants (
    session_id,
    user_id,
    name,
    deceased_name,
    joined_at,
    last_seen_at
  )
  values (
    p_session_id,
    p_user_id,
    v_reader_name,
    v_deceased_name,
    v_now,
    v_now
  )
  on conflict (session_id, user_id) do update
  set name = excluded.name,
      deceased_name = excluded.deceased_name,
      last_seen_at = excluded.last_seen_at;

  select count(*)
  into v_claimed_count
  from hatym_claim_events hce
  where hce.session_id = p_session_id
    and hce.user_id = p_user_id;

  select count(*)
  into v_active_count
  from hatym_pages hp
  where hp.session_id = p_session_id
    and hp.assigned_to = p_user_id
    and hp.status = 'assigned';

  return query
  select
    hp.page_number,
    qp.mushaf_url,
    hp.claim_token,
    hp.status
  from hatym_pages hp
  join quran_pages qp on qp.page_number = hp.page_number
  where hp.session_id = p_session_id
    and hp.assigned_to = p_user_id
    and hp.status = 'assigned'
  order by hp.page_number;

  get diagnostics v_rows = row_count;
  v_rows_returned := v_rows_returned + v_rows;

  if v_active_count > 0 then
    return;
  end if;

  v_pages_to_assign := case
    when v_claimed_count = 0 then v_max_pages
    else 1
  end;

  while v_rows_returned < v_pages_to_assign loop
    select hp.page_number
    into v_page
    from hatym_pages hp
    where hp.session_id = p_session_id
      and hp.status = 'available'
    order by hp.page_number asc
    for update skip locked
    limit 1;

    if not found then
      exit;
    end if;

    update hatym_pages as hp
    set status = 'assigned',
        assigned_to = p_user_id,
        assigned_at = v_now,
        completed_at = null,
        claim_token = encode(extensions.gen_random_bytes(24), 'base64')
    where hp.session_id = p_session_id
      and hp.page_number = v_page.page_number
    returning hp.page_number,
      (select qp.mushaf_url from quran_pages qp where qp.page_number = hp.page_number),
      hp.claim_token
    into page_number, mushaf_url, claim_token;

    insert into hatym_claim_events (session_id, user_id, page_number, claim_token, claimed_at)
    values (p_session_id, p_user_id, page_number, claim_token, v_now);

    status := 'assigned';
    return next;

    v_rows_returned := v_rows_returned + 1;
    v_claimed_count := v_claimed_count + 1;
  end loop;

  if v_rows_returned = 0 then
    status := 'finished';
    return next;
    return;
  end if;
end;
$$;

create or replace function complete_page(
  p_session_id uuid,
  p_page_number int,
  p_user_id text,
  p_claim_token text
)
returns table (
  status text,
  completed_count int,
  finished boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
  v_completed int;
begin
  perform release_expired_assignments(p_session_id);

  update hatym_pages as hp
  set status = 'completed',
      completed_at = now()
  where hp.session_id = p_session_id
    and hp.page_number = p_page_number
    and hp.status = 'assigned'
    and hp.assigned_to = p_user_id
    and hp.claim_token = p_claim_token
  returning 1 into v_updated;

  if v_updated is null then
    status := 'invalid';
    completed_count := null;
    finished := false;
    return next;
    return;
  end if;

  update hatym_claim_events hce
  set completed_at = coalesce(hce.completed_at, now())
  where hce.session_id = p_session_id
    and hce.user_id = p_user_id
    and hce.page_number = p_page_number
    and hce.claim_token = p_claim_token
    and hce.expired_at is null;

  select count(*) into v_completed
  from hatym_pages hp
  where hp.session_id = p_session_id
    and hp.status = 'completed';

  if v_completed >= 604 then
    update hatym_sessions
    set completed_at = now(),
        is_active = false
    where id = p_session_id
      and completed_at is null;
    finished := true;
  else
    finished := false;
  end if;

  status := 'completed';
  completed_count := v_completed;
  return next;
end;
$$;

-- Permissions
revoke all on function create_hatym_session() from public;
grant execute on function create_hatym_session() to service_role;

revoke all on function create_hatym_session_with_settings(int, int, int) from public;
grant execute on function create_hatym_session_with_settings(int, int, int) to service_role;

revoke all on function claim_next_page(uuid, text, text, text, int) from public;
grant execute on function claim_next_page(uuid, text, text, text, int) to anon, authenticated;

revoke all on function release_expired_assignments(uuid, int) from public;
grant execute on function release_expired_assignments(uuid, int) to anon, authenticated;

revoke all on function complete_page(uuid, int, text, text) from public;
grant execute on function complete_page(uuid, int, text, text) to anon, authenticated;
