create or replace function public.normalize_jsonb_document(value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  parsed jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'string' then
    return value;
  end if;
  begin
    parsed := (value #>> '{}')::jsonb;
  exception when others then
    return value;
  end;
  if jsonb_typeof(parsed) in ('object','array') then
    return parsed;
  end if;
  return value;
end;
$$;

create or replace function public.normalize_job_jsonb_fields()
returns trigger
language plpgsql
as $$
begin
  new.request_payload := public.normalize_jsonb_document(new.request_payload);
  new.result := public.normalize_jsonb_document(new.result);
  return new;
end;
$$;

drop trigger if exists normalize_job_jsonb_fields on public.jobs;
create trigger normalize_job_jsonb_fields
before insert or update of request_payload, result on public.jobs
for each row execute function public.normalize_job_jsonb_fields();

create or replace function public.normalize_evidence_jsonb_fields()
returns trigger
language plpgsql
as $$
begin
  new.data := public.normalize_jsonb_document(new.data);
  return new;
end;
$$;

drop trigger if exists normalize_evidence_jsonb_fields on public.evidence;
create trigger normalize_evidence_jsonb_fields
before insert or update of data on public.evidence
for each row execute function public.normalize_evidence_jsonb_fields();

update public.jobs
set request_payload = public.normalize_jsonb_document(request_payload),
    result = public.normalize_jsonb_document(result)
where jsonb_typeof(request_payload) = 'string'
   or jsonb_typeof(result) = 'string';

update public.evidence
set data = public.normalize_jsonb_document(data)
where jsonb_typeof(data) = 'string';

update public.jobs
set request_payload = jsonb_build_object(
  'input', coalesce(result->>'query', result->>'domain'),
  'source', 'legacy-backfill'
)
where coalesce(request_payload, '{}'::jsonb) = '{}'::jsonb
  and coalesce(result->>'query', result->>'domain') is not null;
