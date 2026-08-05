create or replace function private.normalize_jsonb_value(p_value jsonb)
returns jsonb
language plpgsql
set search_path = public, private
as $$
begin
  if p_value is null then return '{}'::jsonb; end if;
  if jsonb_typeof(p_value) <> 'string' then return p_value; end if;
  begin
    return (p_value #>> '{}')::jsonb;
  exception when invalid_text_representation then
    return p_value;
  end;
end;
$$;

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
    private.normalize_jsonb_value(coalesce(p_meta,'{}'::jsonb))
  );
  return v_sequence;
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
  v_result jsonb;
begin
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'running' or v_job.worker_id is distinct from p_worker_id then raise exception 'JOB_LEASE_LOST'; end if;
  if v_job.cancel_requested_at is not null then
    update public.jobs set status='cancelled',cancelled_at=now(),finished_at=now(),worker_id=null,lease_expires_at=null,heartbeat_at=null where id=p_job_id;
    perform private.append_job_event(p_job_id,'CANCELLED','Job cancelled before completion was committed',v_job.progress,'warning');
    return jsonb_build_object('status','cancelled');
  end if;
  v_result := private.normalize_jsonb_value(coalesce(p_result,'{}'::jsonb));
  insert into public.evidence(workspace_id,case_id,job_id,evidence_type,name,data,sha256,created_by)
  values (v_job.workspace_id,v_job.case_id,v_job.id,left(p_evidence_type,80),left(p_evidence_name,180),v_result,p_sha256,v_job.created_by)
  returning id into v_evidence_id;
  update public.jobs
  set status='completed',progress=100,result=v_result,error=null,last_error_code=null,last_error_message=null,
      finished_at=now(),worker_id=null,lease_expires_at=null,heartbeat_at=now()
  where id=p_job_id;
  perform private.append_job_event(p_job_id,'COMPLETED','Job completed and evidence sealed',100,'success',jsonb_build_object('evidence_id',v_evidence_id,'sha256',p_sha256));
  return jsonb_build_object('status','completed','evidence_id',v_evidence_id,'sha256',p_sha256);
end;
$$;

update public.jobs set result=private.normalize_jsonb_value(result) where result is not null and jsonb_typeof(result)='string';
update public.evidence set data=private.normalize_jsonb_value(data) where data is not null and jsonb_typeof(data)='string';
update public.job_events set meta=private.normalize_jsonb_value(meta) where meta is not null and jsonb_typeof(meta)='string';
update public.user_devices set label=coalesce(nullif(platform,''),'Device')||' / '||coalesce(nullif(browser,''),'Browser') where label like '%Ã%' or label like '%Â%' or label like '%�%';
update public.security_events set event_type='api.capacity_exhausted',severity='warning',details=jsonb_build_object('status',500,'reason','database_connection_capacity','resolved_in','5.3.0-r3') where event_type='api.internal_error' and created_at between timestamptz '2026-08-05 18:10:30+00' and timestamptz '2026-08-05 18:12:00+00';
