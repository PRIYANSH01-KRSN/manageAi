-- ChronosFlow database schema for Supabase (free tier).
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to re-run.
--
-- Every table has row-level security: a signed-in student can only read and write
-- rows where user_id = their own auth.uid(). Deleting an account deletes its data.

-- Profile / routine settings (one row per student)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  chronotype text not null default 'BALANCED',
  wake_time text not null default '07:30',
  sleep_time text not null default '23:30',
  distraction_factor real not null default 1.25,
  learned_buffer_inflation real not null default 1.0,
  session_style text not null default 'pomodoro',
  daily_focus_cap_minutes integer not null default 300,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Daily protected routines (meals, commute, gym…)
create table if not exists public.habits (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  start_time text not null,
  end_time text not null,
  is_strict boolean not null default true,
  primary key (user_id, id)
);

-- Weekly classes / shifts
create table if not exists public.fixed_events (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null,
  location text,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time text not null,
  end_time text not null,
  allow_gap_study boolean not null default false,
  source text not null default 'MANUAL',
  primary key (user_id, id)
);

-- Backlog tasks
create table if not exists public.tasks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null,
  category text default 'general',
  subject text,
  quadrant text default 'Q2',
  estimated_minutes integer not null default 45,
  completed_minutes integer not null default 0,
  confidence smallint default 3,
  weightage smallint default 3,
  difficulty smallint,
  deadline date,
  task_type text,
  knowledge_level smallint,
  volume_type text,
  volume_count integer,
  depends_on text,
  group_id text,
  micro_sprints boolean not null default false,
  materials jsonb not null default '[]'::jsonb,
  roadblock text,
  steps jsonb not null default '[]'::jsonb,
  stuck_protocol text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);

-- Session reviews (done / partly done / stalled) — also feed pace calibration
create table if not exists public.session_reviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  task_id text,
  task_title text not null,
  quadrant text,
  status text not null,
  reason_id text,
  user_note text,
  hour_of_day smallint,
  kind text,
  subject text,
  task_type text,
  planned_minutes integer,
  actual_minutes integer,
  progress_pct smallint,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists session_reviews_user_created_idx on public.session_reviews (user_id, created_at desc);

-- Learned low-energy hours
create table if not exists public.fatigue_hours (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hour smallint not null check (hour between 0 and 23),
  primary key (user_id, hour)
);

-- Morning check-ins (mood, energy, commitments, plan A/B/C…)
create table if not exists public.daily_checkins (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date_key date not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

-- Row-level security: each student sees only their own rows.
alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.fixed_events enable row level security;
alter table public.tasks enable row level security;
alter table public.session_reviews enable row level security;
alter table public.fatigue_hours enable row level security;
alter table public.daily_checkins enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['habits', 'fixed_events', 'tasks', 'session_reviews', 'fatigue_hours', 'daily_checkins'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
