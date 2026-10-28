-- Liquid Sudoku V1 online rooms
-- Run this migration in the Supabase SQL editor or with `supabase db push`.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'won', 'closed')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'diabolical')),
  puzzle_data jsonb,
  values smallint[] not null default '{}',
  notes smallint[] not null default '{}',
  owners text[] not null default '{}',
  version integer not null default 1,
  elapsed_ms bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  color_index smallint not null default 0 check (color_index between 0 and 5),
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_players_room_id_idx on public.room_players(room_id);
create index if not exists rooms_expires_at_idx on public.rooms(expires_at);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.rooms replica identity full;
alter table public.room_players replica identity full;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.room_players
    where room_id = p_room_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

drop policy if exists "members can read rooms" on public.rooms;
create policy "members can read rooms"
on public.rooms for select
to authenticated
using (public.is_room_member(id));

drop policy if exists "members can read room players" on public.room_players;
create policy "members can read room players"
on public.room_players for select
to authenticated
using (public.is_room_member(room_id));

revoke all on public.rooms, public.room_players from anon;
grant select on public.rooms, public.room_players to authenticated;

create or replace function public.generate_room_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i integer;
begin
  for i in 1..6 loop
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1);
  end loop;
  return v_code;
end;
$$;

revoke all on function public.generate_room_code() from public;

create or replace function public.create_room(p_nickname text, p_difficulty text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_nickname text;
  v_room public.rooms;
  v_attempt integer := 0;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_nickname := left(regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g'), 20);
  if char_length(v_nickname) = 0 then
    raise exception 'NICKNAME_REQUIRED';
  end if;
  if p_difficulty not in ('easy', 'medium', 'hard', 'diabolical') then
    raise exception 'INVALID_DIFFICULTY';
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.rooms (code, host_id, difficulty)
      values (public.generate_room_code(), v_uid, p_difficulty)
      returning * into v_room;
      exit;
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'ROOM_CODE_UNAVAILABLE';
      end if;
    end;
  end loop;

  insert into public.room_players (room_id, user_id, nickname, color_index, is_ready)
  values (v_room.id, v_uid, v_nickname, 0, true);

  return v_room;
end;
$$;

create or replace function public.join_room(p_code text, p_nickname text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_nickname text;
  v_room public.rooms;
  v_player_count integer;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_nickname := left(regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g'), 20);
  if char_length(v_nickname) = 0 then
    raise exception 'NICKNAME_REQUIRED';
  end if;

  select *
  into v_room
  from public.rooms
  where code = upper(btrim(coalesce(p_code, '')))
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.status = 'closed' or v_room.expires_at <= now() then
    raise exception 'ROOM_EXPIRED';
  end if;

  if exists (
    select 1 from public.room_players
    where room_id = v_room.id and user_id = v_uid
  ) then
    update public.room_players
    set nickname = v_nickname, last_seen_at = now()
    where room_id = v_room.id and user_id = v_uid;
    return v_room;
  end if;

  select count(*) into v_player_count
  from public.room_players
  where room_id = v_room.id;

  if v_player_count >= 6 then
    raise exception 'ROOM_FULL';
  end if;

  insert into public.room_players (room_id, user_id, nickname, color_index, is_ready)
  values (v_room.id, v_uid, v_nickname, v_player_count, false);

  return v_room;
end;
$$;

create or replace function public.set_room_ready(p_room_id uuid, p_ready boolean)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.room_players
  set is_ready = p_ready, last_seen_at = now()
  where room_id = p_room_id and user_id = v_uid;

  if not found then
    raise exception 'ROOM_MEMBERSHIP_REQUIRED';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  return v_room;
end;
$$;

create or replace function public.start_room(p_room_id uuid, p_puzzle jsonb)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_givens text;
  v_solution text;
  v_player_count integer;
  v_values smallint[];
begin
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.host_id <> v_uid then
    raise exception 'HOST_REQUIRED';
  end if;
  if v_room.status not in ('waiting', 'won') then
    raise exception 'ROOM_NOT_WAITING';
  end if;

  select count(*) into v_player_count
  from public.room_players
  where room_id = p_room_id;

  if v_player_count < 2 then
    raise exception 'ROOM_NEEDS_PLAYERS';
  end if;
  if v_room.status = 'waiting' and exists (
    select 1 from public.room_players
    where room_id = p_room_id
      and user_id <> v_room.host_id
      and not is_ready
  ) then
    raise exception 'PLAYERS_NOT_READY';
  end if;

  if jsonb_typeof(p_puzzle) <> 'object'
    or (p_puzzle ->> 'level') <> v_room.difficulty then
    raise exception 'INVALID_PUZZLE';
  end if;

  v_givens := p_puzzle ->> 'givens';
  v_solution := p_puzzle ->> 'solution';
  if v_givens is null
    or v_solution is null
    or v_givens !~ '^[0-9]{81}$'
    or v_solution !~ '^[1-9]{81}$' then
    raise exception 'INVALID_PUZZLE';
  end if;
  if exists (
    select 1
    from generate_series(1, 81) as cells(i)
    where substr(v_givens, cells.i, 1) <> '0'
      and substr(v_givens, cells.i, 1) <> substr(v_solution, cells.i, 1)
  ) then
    raise exception 'INVALID_PUZZLE';
  end if;

  select array_agg(substr(v_givens, cells.i, 1)::smallint order by cells.i)
  into v_values
  from generate_series(1, 81) as cells(i);

  update public.rooms
  set puzzle_data = p_puzzle,
      values = v_values,
      notes = array_fill(0::smallint, array[81]),
      owners = array_fill(null::text, array[81]),
      status = 'playing',
      version = version + 1,
      elapsed_ms = 0,
      started_at = now(),
      finished_at = null,
      updated_at = now(),
      expires_at = now() + interval '24 hours'
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

create or replace function public.apply_room_changes(
  p_room_id uuid,
  p_changes jsonb,
  p_expected_version integer
)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_values smallint[];
  v_notes smallint[];
  v_owners text[];
  v_change jsonb;
  v_cell integer;
  v_value integer;
  v_cell_notes integer;
  v_givens text;
  v_solution text;
  v_board text;
  v_won boolean := false;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'ROOM_MEMBERSHIP_REQUIRED';
  end if;
  if v_room.status <> 'playing' or v_room.expires_at <= now() then
    raise exception 'ROOM_NOT_PLAYING';
  end if;
  if p_expected_version <> v_room.version then
    raise exception 'ROOM_VERSION_CONFLICT';
  end if;
  if jsonb_typeof(p_changes) <> 'array'
    or jsonb_array_length(p_changes) < 1
    or jsonb_array_length(p_changes) > 81 then
    raise exception 'INVALID_CHANGES';
  end if;

  v_values := v_room.values;
  v_notes := v_room.notes;
  v_owners := v_room.owners;
  v_givens := v_room.puzzle_data ->> 'givens';
  v_solution := v_room.puzzle_data ->> 'solution';

  for v_change in select value from jsonb_array_elements(p_changes)
  loop
    if jsonb_typeof(v_change) <> 'object'
      or not (v_change ? 'i')
      or not (v_change ? 'v')
      or not (v_change ? 'n') then
      raise exception 'INVALID_CHANGES';
    end if;

    v_cell := (v_change ->> 'i')::integer;
    v_value := (v_change ->> 'v')::integer;
    v_cell_notes := (v_change ->> 'n')::integer;

    if v_cell < 0 or v_cell > 80
      or v_value < 0 or v_value > 9
      or v_cell_notes < 0 or v_cell_notes > 511 then
      raise exception 'INVALID_CHANGES';
    end if;
    if substr(v_givens, v_cell + 1, 1) <> '0' then
      raise exception 'GIVEN_CELL';
    end if;
    if v_value <> 0 then
      v_cell_notes := 0;
    end if;

    v_values[v_cell + 1] := v_value::smallint;
    v_notes[v_cell + 1] := v_cell_notes::smallint;
    v_owners[v_cell + 1] := v_uid::text;
  end loop;

  select string_agg(v_values[cells.i]::text, '' order by cells.i)
  into v_board
  from generate_series(1, 81) as cells(i);
  v_won := v_board = v_solution;

  update public.rooms
  set values = v_values,
      notes = v_notes,
      owners = v_owners,
      version = version + 1,
      status = case when v_won then 'won' else status end,
      elapsed_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000)::bigint),
      finished_at = case when v_won then now() else null end,
      updated_at = now()
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

create or replace function public.room_heartbeat(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_host_seen timestamptz;
  v_new_host uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.room_players
  set last_seen_at = now()
  where room_id = p_room_id and user_id = v_uid;
  if not found then
    raise exception 'ROOM_MEMBERSHIP_REQUIRED';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.expires_at <= now() and v_room.status <> 'closed' then
    update public.rooms set status = 'closed', updated_at = now()
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  select last_seen_at into v_host_seen
  from public.room_players
  where room_id = p_room_id and user_id = v_room.host_id;

  if v_host_seen is null or v_host_seen < now() - interval '60 seconds' then
    select user_id into v_new_host
    from public.room_players
    where room_id = p_room_id
      and user_id <> v_room.host_id
      and last_seen_at > now() - interval '45 seconds'
    order by joined_at
    limit 1;

    if v_new_host is not null then
      update public.rooms set host_id = v_new_host, updated_at = now()
      where id = p_room_id
      returning * into v_room;
    end if;
  end if;

  return v_room;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_host_id uuid;
  v_new_host uuid;
begin
  if v_uid is null then
    return;
  end if;

  select host_id into v_host_id
  from public.rooms
  where id = p_room_id
  for update;

  delete from public.room_players
  where room_id = p_room_id and user_id = v_uid;

  if v_host_id = v_uid then
    select user_id into v_new_host
    from public.room_players
    where room_id = p_room_id
    order by joined_at
    limit 1;

    if v_new_host is null then
      delete from public.rooms where id = p_room_id;
    else
      update public.rooms
      set host_id = v_new_host, updated_at = now()
      where id = p_room_id;
    end if;
  end if;
end;
$$;

revoke all on function public.create_room(text, text) from public;
revoke all on function public.join_room(text, text) from public;
revoke all on function public.set_room_ready(uuid, boolean) from public;
revoke all on function public.start_room(uuid, jsonb) from public;
revoke all on function public.apply_room_changes(uuid, jsonb, integer) from public;
revoke all on function public.room_heartbeat(uuid) from public;
revoke all on function public.leave_room(uuid) from public;

grant execute on function public.create_room(text, text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.set_room_ready(uuid, boolean) to authenticated;
grant execute on function public.start_room(uuid, jsonb) to authenticated;
grant execute on function public.apply_room_changes(uuid, jsonb, integer) to authenticated;
grant execute on function public.room_heartbeat(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_players'
  ) then
    execute 'alter publication supabase_realtime add table public.room_players';
  end if;
end;
$$;
