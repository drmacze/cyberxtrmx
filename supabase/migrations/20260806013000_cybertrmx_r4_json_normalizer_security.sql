alter function public.normalize_jsonb_document(jsonb) set search_path = pg_catalog, public;
alter function public.normalize_job_jsonb_fields() set search_path = pg_catalog, public;
alter function public.normalize_evidence_jsonb_fields() set search_path = pg_catalog, public;

revoke all on function public.normalize_jsonb_document(jsonb) from public, anon, authenticated;
revoke all on function public.normalize_job_jsonb_fields() from public, anon, authenticated;
revoke all on function public.normalize_evidence_jsonb_fields() from public, anon, authenticated;
