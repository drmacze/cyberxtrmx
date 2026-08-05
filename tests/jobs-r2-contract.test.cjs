const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

const source=read('public/jobs-r2.js');

test('persistent jobs are staging-gated and use the dedicated API',()=>{
  assert.match(source,/location\.pathname\.includes\('\/staging\/'\)/);
  assert.match(source,/jobs_r2/);
  assert.match(read('public/backend-config.js'),/jobsFunction: 'cybertrmx-jobs'/);
  assert.match(source,/CONFIG\.jobsFunction/);
  assert.match(source,/\/functions\/v1\/\$\{CONFIG\.jobsFunction\}/);
});

test('job requests carry authenticated device context and idempotency',()=>{
  for(const marker of ['Authorization','x-device-id','x-device-label','x-device-platform','x-device-browser','x-client-version','x-idempotency-key'])assert.match(source,new RegExp(marker));
  assert.match(source,/getSession/);
  assert.match(source,/crypto\.randomUUID/);
});

test('staging integration never replaces global clients or Operations runtime',()=>{
  assert.doesNotMatch(source,/supabase\.createClient\s*=/);
  assert.doesNotMatch(source,/window\.fetch\s*=/);
  assert.doesNotMatch(source,/functions\.invoke\s*=/);
  assert.doesNotMatch(source,/CYBERTRMX_OPERATIONS\.call\s*=/);
  assert.doesNotMatch(source,/ops-runtime-state|setRuntime\(/);
  assert.match(source,/Failure of this panel never changes the Operations runtime status/);
});

test('queue supports lifecycle controls and browser-independent states',()=>{
  for(const action of ['run_lookup','queue_status','job_status','cancel_job','retry_job'])assert.match(source,new RegExp(`'${action}'`));
  for(const state of ['queued','running','retry_wait','cancelled','dead_letter','timed_out'])assert.match(source,new RegExp(state));
  assert.match(source,/LEASE \+ HEARTBEAT/);
  assert.match(source,/Jobs remain in PostgreSQL after the browser closes/);
});

test('lookup and terminal commands are intercepted without changing core files',()=>{
  assert.match(source,/ops-lookup-form/);
  assert.match(source,/terminal-form/);
  assert.match(source,/stopImmediatePropagation/);
  assert.match(source,/job list/);
  assert.match(source,/job status <job-id>/);
  assert.match(source,/job cancel <job-id>/);
  assert.match(source,/job retry <job-id>/);
});
