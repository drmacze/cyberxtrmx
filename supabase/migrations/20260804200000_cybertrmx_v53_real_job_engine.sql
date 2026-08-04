create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

alter table public.jobs add column if not exists request_payload jsonb not null default '{}'::jsonb;
alter table public.jobs add column if not exists queue_key text;
alter table public.jobs add column if not exists priority smallint not null default 0;
alter table public.jobs add column if not exists attempt_count integer not null default 0;
alter table public.jobs add column if not exists max_attempts integer not null default 3;
alter table public.jobs add column if not exists available_at timestamptz not null default now();
alter table public.jobs add column if not exists claimed_at timestamptz;
alter table public.jobs add column if not exists heartbeat_at timestamptz;
alter table public.jobs add column if not exists lease_expires_at timestamptz;
alter table public.jobs add column if not exists worker_id uuid;
alter table public.jobs add column if not exists timeout_seconds integer not null default 45;
alter table public.jobs add column if not exists cancel_requested_at timestamptz;
alter table public.jobs add column if not exists cancelled_at timestamptz;
alter table public.jobs add column if not exists last_error_code text;
alter table public.jobs add column if not exists last_error_message text;
alter table public.jobs add column if not exists dead_lettered_at timestamptz;
alter table public.jobs add column if not exists retry_of_job_id uuid references public.jobs(id) on delete set null;

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check check (
  status in ('queued','validating','running','retry_wait','completed','failed','timed_out','cancelled','dead_letter')
);
alter table public.jobs drop constraint if exists jobs_priority_check;
alter table public.jobs add constraint jobs_priority_check check (priority between -100 and 100);
alter table public.jobs drop constraint if exists jobs_attempts_check;
alter table public.jobs add constraint jobs_attempts_check check (attempt_count >= 0 and max_attempts between 1 and 10);
alter table public.jobs drop constraint if exists jobs_timeout_check;
alter table public.jobs add constraint jobs_timeout_check check (timeout_seconds between 10 and 300);

create unique index if not exists idx_jobs_creator_queue_key
  on public.jobs(created_by, queue_key)
  where queue_key is not null;
create index if not exists idx_jobs_worker_queue
  on public.jobs(priority desc, available_at asc, created_at asc)
  where status in ('queued','retry_wait');
create index if not exists idx_jobs_worker_lease
  on public.jobs(lease_expires_at)
  where status = 'running';
create index if not exists idx_jobs_retry_of on public.jobs(retry_of_job_id);

create table if not exists private.job_worker_config (
  singleton boolean primary key default true check (singleton),
  worker_secret text not null default encode(gen_random_bytes(32),'hex'),
  worker_url text not null default 'https://ydaeukhqwishlrjyfktk.supabase.co/functions/v1/cybertrmx-worker',
  updated_at timestamptz not null default now()
);
insert into private.job_worker_config(singleton) values (true)
on conflict (singleton) do nothing;
revoke all on private.job_worker_config from public, anon, authenticated;

create or replace function private.append_job_event(
  p_job_id uuid,
  p_stage text,
  p_message text,
  p_progress integer,
  p_level text default 'info',
  p_meta jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_sequence integer;
begin
  perform 1 from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  select coalesce(max(sequence), -1) + 1 into v_sequence
  from public.job_events where job_id = p_job_id;
  insert into public.job_events(job_id,sequence,stage,message,progress,level,meta)
  values (
    p_job_id,
    v_sequence,
    left(coalesce(p_stage,'EVENT'),80),
    left(coalesce(p_message,''),500),
    greatest(0,least(100,coalesce(p_progress,0))),
    case when p_level in ('info','success','warning','error') then p_level else 'info' end,
    coalesce(p_meta,'{}'::jsonb)
  );
  return v_sequence;
end;
$$;

create or replace function private.recover_stale_jobs()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.jobs%rowtype;
  v_count integer := 0;
  v_delay integer;
begin
  for v_job in
    select * from public.jobs
    where status in ('queued','retry_wait') and cancel_requested_at is not null
    for update skip locked
  loop
    update public.jobs
    set status='cancelled', cancelled_at=now(), finished_at=now(),
        worker_id=null, lease_expires_at=null, heartbeat_at=null
    where id=v_job.id;
    perform private.append_job_event(v_job.id,'CANCELLED','Job cancelled before worker execution',v_job.progress,'warning');
    v_count := v_count + 1;
  end loop;

  for v_job in
    select * from public.jobs
    where status='running' and lease_expires_at is not null and lease_expires_at < now()
    for update skip locked
  loop
    if v_job.cancel_requested_at is not null then
      update public.jobs
      set status='cancelled', cancelled_at=now(), finished_at=now(),
          worker_id=null, lease_expires_at=null, heartbeat_at=null,
          last_error_code='CANCELLED_AFTER_LEASE'
      where id=v_job.id;
      perform private.append_job_event(v_job.id,'CANCELLED','Cancellation finalized after worker lease expired',v_job.progress,'warning');
    elsif v_job.attempt_count < v_job.max_attempts then
      v_delay := least(300, 10 * (2 ^ greatest(0,v_job.attempt_count-1))::integer);
      update public.jobs
      set status='retry_wait', available_at=now()+make_interval(secs=>v_delay),
          worker_id=null, lease_expires_at=null, heartbeat_at=null,
          last_error_code='WORKER_LEASE_EXPIRED',
          last_error_message='Worker heartbeat expired before completion'
      where id=v_job.id;
      perform private.append_job_event(v_job.id,'RETRY_SCHEDULED','Worker lease expired; retry scheduled',v_job.progress,'warning',jsonb_build_object('delay_seconds',v_delay,'attempt',v_job.attempt_count));
    else
      update public.jobs
      set status='dead_letter', dead_lettered_at=now(), finished_at=now(),
          worker_id=null, lease_expires_at=null, heartbeat_at=null,
          last_error_code='WORKER_LEASE_EXPIRED',
          last_error_message='Worker heartbeat expired and retry limit was exhausted'
      where id=v_job.id;
      perform private.append_job_event(v_job.id,'DEAD_LETTER','Worker lease expired and retry limit was exhausted',100,'error');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function private.claim_next_job(
  p_worker_id uuid,
  p_lease_seconds integer default 90
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id uuid;
begin
  perform private.recover_stale_jobs();
  select id into v_id
  from public.jobs
  where status in ('queued','retry_wait')
    and available_at <= now()
    and cancel_requested_at is null
  order by priority desc, available_at asc, created_at asc
  for update skip locked
  limit 1;
  if v_id is null then return; end if;

  update public.jobs
  set status='running',
      attempt_count=attempt_count+1,
      worker_id=p_worker_id,
      claimed_at=now(),
      started_at=coalesce(started_at,now()),
      heartbeat_at=now(),
      lease_expires_at=now()+make_interval(secs=>greatest(30,least(300,p_lease_seconds))),
      progress=greatest(progress,5),
      error=null
  where id=v_id;

  perform private.append_job_event(v_id,'CLAIMED','Worker claimed the queued job',5,'info',jsonb_build_object('worker_id',p_worker_id));
  return query select * from public.jobs where id=v_id;
end;
$$;

create or replace function private.heartbeat_job(
  p_job_id uuid,
  p_worker_id uuid,
  p_progress integer,
  p_stage text,
  p_message text,
  p_lease_seconds integer default 90,
  p_meta jsonb default '{}'::jsonb
)
returns table(accepted boolean, should_cancel boolean, current_status text)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.status <> 'running' or v_job.worker_id is distinct from p_worker_id then
    return query select false,false,coalesce(v_job.status,'missing');
    return;
  end if;
  update public.jobs
  set progress=greatest(progress,greatest(0,least(99,coalesce(p_progress,progress)))),
      heartbeat_at=now(),
      lease_expires_at=now()+make_interval(secs=>greatest(30,least(300,p_lease_seconds)))
  where id=p_job_id;
  if coalesce(p_stage,'') <> '' then
    perform private.append_job_event(p_job_id,p_stage,p_message,p_progress,'info',p_meta);
  end if;
  return query select true,(v_job.cancel_requested_at is not null),'running'::text;
end;
$$;

create or replace function private.complete_job(
  p_job_id uuid,
  p_worker_id uuid,
  p_result jsonb,
  p_evidence_type text,
  p_evidence_name text,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.jobs%rowtype;
  v_evidence_id uuid;
begin
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'running' or v_job.worker_id is distinct from p_worker_id then raise exception 'JOB_LEASE_LOST'; end if;
  if v_job.cancel_requested_at is not null then
    update public.jobs set status='cancelled',cancelled_at=now(),finished_at=now(),worker_id=null,lease_expires_at=null,heartbeat_at=null where id=p_job_id;
    perform private.append_job_event(p_job_id,'CANCELLED','Job cancelled before completion was committed',v_job.progress,'warning');
    return jsonb_build_object('status','cancelled');
  end if;
  insert into public.evidence(workspace_id,case_id,job_id,evidence_type,name,data,sha256,created_by)
  values (v_job.workspace_id,v_job.case_id,v_job.id,left(p_evidence_type,80),left(p_evidence_name,180),coalesce(p_result,'{}'::jsonb),p_sha256,v_job.created_by)
  returning id into v_evidence_id;
  update public.jobs
  set status='completed',progress=100,result=coalesce(p_result,'{}'::jsonb),error=null,
      last_error_code=null,last_error_message=null,finished_at=now(),
      worker_id=null,lease_expires_at=null,heartbeat_at=now()
  where id=p_job_id;
  perform private.append_job_event(p_job_id,'COMPLETED','Job completed and evidence sealed',100,'success',jsonb_build_object('evidence_id',v_evidence_id,'sha256',p_sha256));
  return jsonb_build_object('status','completed','evidence_id',v_evidence_id,'sha256',p_sha256);
end;
$$;

create or replace function private.fail_job(
  p_job_id uuid,
  p_worker_id uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_delay_seconds integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.jobs%rowtype;
  v_status text;
begin
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'running' or v_job.worker_id is distinct from p_worker_id then raise exception 'JOB_LEASE_LOST'; end if;
  if v_job.cancel_requested_at is not null then
    update public.jobs set status='cancelled',cancelled_at=now(),finished_at=now(),worker_id=null,lease_expires_at=null,heartbeat_at=null where id=p_job_id;
    perform private.append_job_event(p_job_id,'CANCELLED','Job cancelled while the worker was active',v_job.progress,'warning');
    return jsonb_build_object('status','cancelled');
  end if;
  if p_retryable and v_job.attempt_count < v_job.max_attempts then
    v_status := 'retry_wait';
    update public.jobs
    set status=v_status,available_at=now()+make_interval(secs=>greatest(1,least(300,p_delay_seconds))),
        last_error_code=left(p_error_code,120),last_error_message=left(p_error_message,500),error=left(p_error_code,120),
        worker_id=null,lease_expires_at=null,heartbeat_at=null
    where id=p_job_id;
    perform private.append_job_event(p_job_id,'RETRY_SCHEDULED',left(p_error_message,500),v_job.progress,'warning',jsonb_build_object('error_code',p_error_code,'delay_seconds',p_delay_seconds,'attempt',v_job.attempt_count));
  elsif p_retryable then
    v_status := 'dead_letter';
    update public.jobs
    set status=v_status,dead_lettered_at=now(),finished_at=now(),progress=100,
        last_error_code=left(p_error_code,120),last_error_message=left(p_error_message,500),error=left(p_error_code,120),
        worker_id=null,lease_expires_at=null,heartbeat_at=null
    where id=p_job_id;
    perform private.append_job_event(p_job_id,'DEAD_LETTER',left(p_error_message,500),100,'error',jsonb_build_object('error_code',p_error_code,'attempts',v_job.attempt_count));
  else
    v_status := case when p_error_code='JOB_TIMEOUT' then 'timed_out' else 'failed' end;
    update public.jobs
    set status=v_status,finished_at=now(),progress=100,
        last_error_code=left(p_error_code,120),last_error_message=left(p_error_message,500),error=left(p_error_code,120),
        worker_id=null,lease_expires_at=null,heartbeat_at=null
    where id=p_job_id;
    perform private.append_job_event(p_job_id,upper(v_status),left(p_error_message,500),100,'error',jsonb_build_object('error_code',p_error_code));
  end if;
  return jsonb_build_object('status',v_status,'attempt_count',v_job.attempt_count,'max_attempts',v_job.max_attempts);
end;
$$;

create or replace function private.cancel_worker_job(p_job_id uuid,p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.worker_id is distinct from p_worker_id then raise exception 'JOB_LEASE_LOST'; end if;
  update public.jobs
  set status='cancelled',cancelled_at=now(),finished_at=now(),worker_id=null,lease_expires_at=null,heartbeat_at=null
  where id=p_job_id;
  perform private.append_job_event(p_job_id,'CANCELLED','Worker stopped after receiving a cancellation request',v_job.progress,'warning');
  return jsonb_build_object('status','cancelled');
end;
$$;

create or replace function private.kick_cybertrmx_worker(p_source text default 'database')
returns bigint
language plpgsql
security definer
set search_path = public, private, net
as $$
declare
  v_config private.job_worker_config%rowtype;
  v_request_id bigint;
begin
  select * into v_config from private.job_worker_config where singleton=true;
  if not found then raise exception 'WORKER_CONFIG_MISSING'; end if;
  select net.http_post(
    url := v_config.worker_url,
    headers := jsonb_build_object('Content-Type','application/json','x-worker-token',v_config.worker_secret),
    body := jsonb_build_object('source',coalesce(p_source,'database'),'requested_at',now()),
    timeout_milliseconds := 10000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function private.append_job_event(uuid,text,text,integer,text,jsonb) from public,anon,authenticated;
revoke all on function private.recover_stale_jobs() from public,anon,authenticated;
revoke all on function private.claim_next_job(uuid,integer) from public,anon,authenticated;
revoke all on function private.heartbeat_job(uuid,uuid,integer,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function private.complete_job(uuid,uuid,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function private.fail_job(uuid,uuid,text,text,boolean,integer) from public,anon,authenticated;
revoke all on function private.cancel_worker_job(uuid,uuid) from public,anon,authenticated;
revoke all on function private.kick_cybertrmx_worker(text) from public,anon,authenticated;

DO $$
DECLARE v_jobid bigint;
BEGIN
  select jobid into v_jobid from cron.job where jobname='cybertrmx-job-worker' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule('cybertrmx-job-worker','* * * * *','select private.kick_cybertrmx_worker(''cron'');');
END $$;
