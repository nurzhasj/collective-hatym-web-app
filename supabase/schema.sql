-- Extensions
create extension if not exists pgcrypto;

-- Tables
create table if not exists hatym_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  is_active boolean not null default true
);

create table if not exists quran_pages (
  page_number int primary key,
  mushaf_url text not null
);

create table if not exists hatym_pages (
  session_id uuid not null references hatym_sessions(id) on delete cascade,
  page_number int not null references quran_pages(page_number),
  status text not null check (status in ('available', 'assigned', 'completed')),
  assigned_to text null,
  assigned_at timestamptz null,
  completed_at timestamptz null,
  claim_token text null,
  primary key (session_id, page_number)
);

-- Indexes
create index if not exists hatym_pages_session_status_idx on hatym_pages (session_id, status);
create index if not exists hatym_pages_session_assigned_at_idx on hatym_pages (session_id, assigned_at);
create index if not exists hatym_pages_session_assigned_to_status_idx on hatym_pages (session_id, assigned_to, status);

-- RLS
alter table hatym_sessions enable row level security;
alter table quran_pages enable row level security;
alter table hatym_pages enable row level security;

create policy "Public read sessions" on hatym_sessions
  for select using (true);

create policy "Public read quran pages" on quran_pages
  for select using (true);

create policy "Public read hatym pages" on hatym_pages
  for select using (true);

-- Functions
create or replace function create_hatym_session()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  insert into hatym_sessions (is_active) values (true) returning id into v_session_id;

  insert into hatym_pages (session_id, page_number, status)
  select v_session_id, page_number, 'available'
  from quran_pages
  order by page_number;

  return v_session_id;
end;
$$;

create or replace function claim_next_page(
  p_session_id uuid,
  p_user_id text,
  p_ttl_minutes int default 5
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
  v_ttl interval := make_interval(mins => p_ttl_minutes);
  v_existing record;
  v_page record;
  v_session_active boolean;
begin
  select is_active into v_session_active from hatym_sessions where id = p_session_id;
  if v_session_active is distinct from true then
    status := 'finished';
    return next;
    return;
  end if;

  select hp.page_number, qp.mushaf_url, hp.claim_token
  into v_existing
  from hatym_pages hp
  join quran_pages qp on qp.page_number = hp.page_number
  where hp.session_id = p_session_id
    and hp.status = 'assigned'
    and hp.assigned_to = p_user_id
    and hp.assigned_at >= v_now - v_ttl
  order by hp.assigned_at desc
  limit 1;

  if found then
    page_number := v_existing.page_number;
    mushaf_url := v_existing.mushaf_url;
    claim_token := v_existing.claim_token;
    status := 'assigned';
    return next;
    return;
  end if;

  select hp.page_number
  into v_page
  from hatym_pages hp
  where hp.session_id = p_session_id
    and hp.status = 'assigned'
    and hp.assigned_at < v_now - v_ttl
  order by hp.assigned_at asc
  for update skip locked
  limit 1;

  if not found then
    select hp.page_number
    into v_page
    from hatym_pages hp
    where hp.session_id = p_session_id
      and hp.status = 'available'
    order by hp.page_number asc
    for update skip locked
    limit 1;
  end if;

  if not found then
    status := 'finished';
    return next;
    return;
  end if;

  update hatym_pages as hp
  set status = 'assigned',
      assigned_to = p_user_id,
      assigned_at = v_now,
      claim_token = encode(extensions.gen_random_bytes(24), 'base64')
  where hp.session_id = p_session_id
    and hp.page_number = v_page.page_number
  returning hp.page_number,
    (select qp.mushaf_url from quran_pages qp where qp.page_number = hp.page_number),
    hp.claim_token
  into page_number, mushaf_url, claim_token;

  status := 'assigned';
  return next;
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

  select count(*) into v_completed
  from hatym_pages
  where session_id = p_session_id
    and status = 'completed';

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

revoke all on function claim_next_page(uuid, text, int) from public;
grant execute on function claim_next_page(uuid, text, int) to anon, authenticated;

revoke all on function complete_page(uuid, int, text, text) from public;
grant execute on function complete_page(uuid, int, text, text) to anon, authenticated;
