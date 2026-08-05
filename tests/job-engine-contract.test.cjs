const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('frontend routes job actions to the dedicated API',()=>{
  const config=read('public/backend-config.js');
  const frontend=read('public/jobs-v53.js');
  assert.match(config,/jobsFunction:\s*'cybertrmx-jobs'/);
  for(const action of ['run_lookup','job_status','cancel_job','retry_job','queue_status'])assert.match(frontend,new RegExp(action));
  assert.match(frontend,/stopImmediatePropagation\(\)/);
  assert.match(frontend,/Writing the job to the persistent queue/);
});

test('queue UI is lazy-loaded through the protected bootstrap',()=>{
  const motion=read('public/motion.js');
  const bootstrap=read('public/cloud-bootstrap.js');
  const sw=read('public/sw.js');
  assert.match(motion,/loadScript\('cloud-bootstrap'\)/);
  assert.match(bootstrap,/jobs-v53\.css/);
  assert.match(bootstrap,/jobs-v53\.js/);
  assert.match(sw,/cybertrmx-v31/);
  assert.match(sw,/caches\.match\(event\.request, \{ ignoreSearch: true \}\)/);
});

test('database migration defines a lease-based durable queue',()=>{
  const migration=read('supabase/migrations/20260804200000_cybertrmx_v53_real_job_engine.sql');
  assert.match(migration,/for update skip locked/i);
  assert.match(migration,/lease_expires_at/i);
  assert.match(migration,/heartbeat_at/i);
  assert.match(migration,/retry_wait/i);
  assert.match(migration,/dead_letter/i);
  assert.match(migration,/cron\.schedule/i);
  assert.match(migration,/net\.http_post/i);
  assert.match(migration,/private\.claim_next_job/i);
  assert.match(migration,/private\.recover_stale_jobs/i);
});

test('worker claims, heartbeats, retries, and seals evidence',()=>{
  const worker=read('supabase/functions/cybertrmx-worker/index.ts');
  for(const contract of ['claim_next_job','heartbeat_job','fail_job','complete_job','cancel_worker_job'])assert.match(worker,new RegExp(contract));
  assert.match(worker,/AbortSignal\.timeout/);
  assert.match(worker,/WORKER_AUTH_INVALID/);
  assert.match(worker,/worker-chain/);
});

test('job API enqueues asynchronously and exposes control actions',()=>{
  const api=read('supabase/functions/cybertrmx-jobs/index.ts');
  assert.match(api,/status:'queued'/);
  assert.match(api,/inserted\.length\?202:200/);
  assert.match(api,/cancel_requested_at/);
  assert.match(api,/retry_of_job_id/);
  assert.match(api,/queue_status/);
  assert.match(api,/MFA_REQUIRED/);
});

test('project keeps the 5.3 job-engine line',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.match(pkg.version,/^5\.3\./);
});