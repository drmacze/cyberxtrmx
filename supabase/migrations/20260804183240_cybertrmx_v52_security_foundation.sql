create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_idempotency (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  response_status integer,
  response_body jsonb,
  resource_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (user_id, action, idempotency_key)
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  device_id uuid not null,
  session_id uuid,
  label text not null default 'Unnamed device',
  platform text,
  browser text,
  user_agent_hash text,
  last_ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  unique (user_id, device_id)
);

create unique index if not exists idx_user_devices_session
  on public.user_devices(user_id, session_id)
  where session_id is not null and revoked_at is null;
create index if not exists idx_user_devices_workspace
  on public.user_devices(workspace_id, last_seen_at desc);

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  device_id uuid,
  session_id uuid,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','notice','warning','critical')),
  request_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_security_events_workspace
  on public.security_events(workspace_id, created_at desc);
create index if not exists idx_security_events_user
  on public.security_events(user_id, created_at desc);

alter table public.checkin_requests
  add column if not exists idempotency_key text;
create unique index if not exists idx_checkins_creator_idempotency
  on public.checkin_requests(created_by, idempotency_key)
  where idempotency_key is not null;

alter table public.location_points
  add column if not exists submission_key text;
create unique index if not exists idx_location_submission_key
  on public.location_points(request_id, submission_key)
  where submission_key is not null;

alter table public.api_rate_limits enable row level security;
alter table public.api_idempotency enable row level security;
alter table public.user_devices enable row level security;
alter table public.security_events enable row level security;

revoke all on public.api_rate_limits, public.api_idempotency,
  public.user_devices, public.security_events from anon, authenticated;
revoke all on public.profiles, public.workspaces, public.workspace_members,
  public.cases, public.scope_assets, public.jobs, public.job_events,
  public.evidence, public.checkin_requests, public.location_points,
  public.audit_log from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_started timestamptz;
begin
  if p_bucket_key is null or length(p_bucket_key) < 8 then
    raise exception 'RATE_LIMIT_KEY_INVALID';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'RATE_LIMIT_CONFIG_INVALID';
  end if;

  insert into public.api_rate_limits(bucket_key, window_started_at, request_count, updated_at)
  values (p_bucket_key, now(), 1, now())
  on conflict (bucket_key) do update
  set request_count = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1
        else public.api_rate_limits.request_count + 1
      end,
      window_started_at = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now()
        else public.api_rate_limits.window_started_at
      end,
      updated_at = now()
  returning request_count, window_started_at into v_count, v_started;

  allowed := v_count <= p_limit;
  remaining := greatest(0, p_limit - v_count);
  reset_at := v_started + make_interval(secs => p_window_seconds);
  return next;
end;
$$;

revoke all on function public.consume_rate_limit(text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer)
  to service_role;

create or replace function public.submit_checkin_point_v2(
  p_token_hash text,
  p_submission_key text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision,
  p_altitude double precision,
  p_heading double precision,
  p_speed double precision,
  p_sample_count integer,
  p_consented_at timestamptz,
  p_client_meta jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.checkin_requests%rowtype;
  point_id uuid;
  existing_point uuid;
begin
  if p_submission_key is null or length(p_submission_key) < 16 or length(p_submission_key) > 100 then
    raise exception 'SUBMISSION_KEY_INVALID';
  end if;

  select * into request_row
  from public.checkin_requests
  where token_hash = p_token_hash
  for update;

  if not found then raise exception 'CHECKIN_NOT_FOUND'; end if;

  select id into existing_point
  from public.location_points
  where request_id = request_row.id and submission_key = p_submission_key
  limit 1;

  if existing_point is not null then
    return jsonb_build_object(
      'request_id', request_row.id,
      'point_id', existing_point,
      'accepted', true,
      'duplicate', true
    );
  end if;

  if request_row.status <> 'active' then raise exception 'CHECKIN_NOT_ACTIVE'; end if;
  if request_row.expires_at <= now() then
    update public.checkin_requests set status = 'expired' where id = request_row.id;
    raise exception 'CHECKIN_EXPIRED';
  end if;
  if request_row.submission_count >= request_row.max_submissions then
    update public.checkin_requests
    set status = 'completed', completed_at = coalesce(completed_at, now())
    where id = request_row.id;
    raise exception 'CHECKIN_LIMIT_REACHED';
  end if;

  insert into public.location_points(
    request_id, submission_key, latitude, longitude, accuracy, altitude,
    heading, speed, sample_count, consented_at, client_meta
  ) values (
    request_row.id, p_submission_key, p_latitude, p_longitude, p_accuracy,
    p_altitude, p_heading, p_speed, greatest(1, coalesce(p_sample_count,1)),
    p_consented_at, coalesce(p_client_meta,'{}'::jsonb)
  ) returning id into point_id;

  update public.checkin_requests
  set submission_count = submission_count + 1,
      status = case when submission_count + 1 >= max_submissions then 'completed' else status end,
      completed_at = case when submission_count + 1 >= max_submissions then now() else completed_at end
  where id = request_row.id;

  insert into public.audit_log(workspace_id,actor_id,action,resource_type,resource_id,details)
  values(
    request_row.workspace_id,
    null,
    'checkin.location_submitted',
    'checkin_request',
    request_row.id::text,
    jsonb_build_object('point_id',point_id,'accuracy',p_accuracy,'sample_count',p_sample_count)
  );

  return jsonb_build_object(
    'request_id',request_row.id,
    'point_id',point_id,
    'accepted',true,
    'duplicate',false
  );
end;
$$;

revoke all on function public.submit_checkin_point_v2(
  text,text,double precision,double precision,double precision,
  double precision,double precision,double precision,integer,timestamptz,jsonb
) from public, anon, authenticated;
grant execute on function public.submit_checkin_point_v2(
  text,text,double precision,double precision,double precision,
  double precision,double precision,double precision,integer,timestamptz,jsonb
) to service_role;

create or replace function public.cleanup_security_ledgers()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.api_rate_limits where updated_at < now() - interval '2 days';
  delete from public.api_idempotency where expires_at < now();
  delete from public.security_events where created_at < now() - interval '180 days';
end;
$$;

revoke all on function public.cleanup_security_ledgers()
  from public, anon, authenticated;
grant execute on function public.cleanup_security_ledgers()
  to service_role;
