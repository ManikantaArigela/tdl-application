-- TDL / Nova Notes — Supabase schema
--
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- It is safe to run again: tables, indexes, and policies are created idempotently.
--
-- Every row belongs to an auth.users row through user_id. Row Level Security is
-- enabled on both tables, so a signed-in user can only read or write their own
-- records. The API uses the anon key plus the user's access token, which means
-- no service-role key is needed in the application.

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}'::text[],
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_created_idx
  on public.notes (user_id, created_at desc, id desc);

create index if not exists notes_user_archived_idx
  on public.notes (user_id, archived, updated_at desc);

-- ---------------------------------------------------------------------------
-- Todos
-- ---------------------------------------------------------------------------
create table if not exists public.todos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  due_date text,
  due_time text check (
    due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  sort_order bigint not null default 0
);

create index if not exists todos_user_order_idx
  on public.todos (user_id, sort_order, created_at, id);

create index if not exists todos_user_completed_idx
  on public.todos (user_id, completed, sort_order);

create index if not exists todos_user_due_idx
  on public.todos (user_id, due_date);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.notes enable row level security;
alter table public.todos enable row level security;

drop policy if exists "notes_owner_all" on public.notes;
create policy "notes_owner_all"
  on public.notes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "todos_owner_all" on public.todos;
create policy "todos_owner_all"
  on public.todos
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The API always sends a user JWT. The public health probe only needs SELECT on
-- notes; RLS returns zero rows for anon and blocks every authenticated write
-- without a matching owner policy.
revoke all on public.notes from anon;
revoke all on public.todos from anon;
grant usage on schema public to anon, authenticated;
grant select on public.notes to anon;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.todos to authenticated;
