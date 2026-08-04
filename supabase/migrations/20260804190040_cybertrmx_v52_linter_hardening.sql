create index if not exists idx_api_idempotency_workspace
  on public.api_idempotency(workspace_id);

create index if not exists idx_user_devices_revoked_by
  on public.user_devices(revoked_by)
  where revoked_by is not null;

create policy api_rate_limits_deny_all
  on public.api_rate_limits
  for all to anon, authenticated
  using (false)
  with check (false);

create policy api_idempotency_deny_all
  on public.api_idempotency
  for all to anon, authenticated
  using (false)
  with check (false);

create policy user_devices_deny_all
  on public.user_devices
  for all to anon, authenticated
  using (false)
  with check (false);

create policy security_events_deny_all
  on public.security_events
  for all to anon, authenticated
  using (false)
  with check (false);
