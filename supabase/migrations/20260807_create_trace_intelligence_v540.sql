create table if not exists public.trace_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid null references public.cases(id) on delete set null,
  asset_type text not null check (asset_type in ('domain','url')),
  asset_value text not null,
  label text null,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, asset_type, asset_value)
);

create table if not exists public.trace_scans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid null references public.cases(id) on delete set null,
  asset_id uuid null references public.trace_assets(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  scan_type text not null check (scan_type in ('web','phone','map_snapshot')),
  target_display text not null,
  target_hash text not null,
  status text not null default 'completed' check (status in ('completed','partial','failed')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  result jsonb not null default '{}'::jsonb,
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.trace_findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.trace_scans(id) on delete cascade,
  category text not null,
  severity text not null check (severity in ('info','low','medium','high')),
  title text not null,
  detail text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trace_assets_workspace_idx on public.trace_assets(workspace_id, created_at desc);
create index if not exists trace_assets_case_idx on public.trace_assets(case_id);
create index if not exists trace_assets_creator_idx on public.trace_assets(created_by);
create index if not exists trace_scans_workspace_idx on public.trace_scans(workspace_id, created_at desc);
create index if not exists trace_scans_asset_idx on public.trace_scans(asset_id, created_at desc);
create index if not exists trace_scans_target_hash_idx on public.trace_scans(workspace_id, target_hash, created_at desc);
create index if not exists trace_scans_case_idx on public.trace_scans(case_id);
create index if not exists trace_scans_creator_idx on public.trace_scans(created_by);
create index if not exists trace_findings_scan_idx on public.trace_findings(scan_id, severity);

alter table public.trace_assets enable row level security;
alter table public.trace_scans enable row level security;
alter table public.trace_findings enable row level security;

revoke all privileges on table public.trace_assets from anon, authenticated;
revoke all privileges on table public.trace_scans from anon, authenticated;
revoke all privileges on table public.trace_findings from anon, authenticated;

create or replace function public.consume_trace_rate_limit(p_bucket text, p_limit integer default 20, p_window_seconds integer default 60)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  current_count integer;
  started timestamptz;
begin
  select request_count, window_started_at into current_count, started
  from public.api_rate_limits where bucket_key=p_bucket for update;
  if not found then
    insert into public.api_rate_limits(bucket_key, window_started_at, request_count, updated_at)
    values(p_bucket, now(), 1, now());
    return true;
  end if;
  if started < now() - make_interval(secs => greatest(1,p_window_seconds)) then
    update public.api_rate_limits set window_started_at=now(), request_count=1, updated_at=now() where bucket_key=p_bucket;
    return true;
  end if;
  if current_count >= greatest(1,p_limit) then return false; end if;
  update public.api_rate_limits set request_count=request_count+1, updated_at=now() where bucket_key=p_bucket;
  return true;
end;
$$;

revoke all on function public.consume_trace_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_trace_rate_limit(text,integer,integer) to service_role;
