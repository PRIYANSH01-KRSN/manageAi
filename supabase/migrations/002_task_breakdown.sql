-- ChronosFlow migration 002: task breakdown + stuck list.
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
-- Only ADDS things; existing data is not touched.

-- Extra per-task details for broken-down steps (group, order, time explanation, spacing).
alter table public.tasks add column if not exists meta jsonb not null default '{}'::jsonb;

-- Things a student got stuck on; they become the agenda for summary/review sessions.
create table if not exists public.stuck_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  task_id text,
  group_id text,
  task_title text,
  kind text not null default 'concept',
  note text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists stuck_items_user_idx on public.stuck_items (user_id, resolved, created_at desc);

alter table public.stuck_items enable row level security;
drop policy if exists "own rows" on public.stuck_items;
create policy "own rows" on public.stuck_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
