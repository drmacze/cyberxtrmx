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
  v_progress integer;
begin
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.status <> 'running' or v_job.worker_id is distinct from p_worker_id then
    return query select false,false,coalesce(v_job.status,'missing');
    return;
  end if;
  v_progress := greatest(v_job.progress,greatest(0,least(99,coalesce(p_progress,v_job.progress))));
  update public.jobs
  set progress=v_progress,
      heartbeat_at=now(),
      lease_expires_at=now()+make_interval(secs=>greatest(30,least(300,p_lease_seconds)))
  where id=p_job_id;
  if coalesce(p_stage,'') <> '' then
    perform private.append_job_event(p_job_id,p_stage,p_message,v_progress,'info',p_meta);
  end if;
  return query select true,(v_job.cancel_requested_at is not null),'running'::text;
end;
$$;

revoke all on function private.heartbeat_job(uuid,uuid,integer,text,text,integer,jsonb)
  from public,anon,authenticated;
