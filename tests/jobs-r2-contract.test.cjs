const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');
const source=read('public/jobs-r3.js');

test('persistent jobs R3 are staging-gated and use the dedicated API',()=>{
  assert.match(source,/location\.pathname\.includes\('\/staging\/'\)/);
  assert.match(source,/jobs_r3/);
  assert.match(read('public/backend-config.js'),/jobsFunction: 'cybertrmx-jobs'/);
  assert.match(source,/\/functions\/v1\/\$\{CONFIG\.jobsFunction\}/);
});

test('job requests carry authenticated ASCII-safe device context',()=>{
  for(const marker of ['Authorization','x-device-id','x-device-label','x-device-platform','x-device-browser','x-client-version','x-idempotency-key'])assert.match(source,new RegExp(marker));
  assert.match(source,/replace\(\/\[\^\\x20-\\x7E\]\/g,' '\)/);
});

test('R3 never replaces global clients or Operations runtime',()=>{
  assert.doesNotMatch(source,/supabase\.createClient\s*=/);
  assert.doesNotMatch(source,/window\.fetch\s*=/);
  assert.doesNotMatch(source,/functions\.invoke\s*=/);
  assert.doesNotMatch(source,/ops-runtime-state|setRuntime\(/);
});

test('R3 installs early form, enter-key, and button interception',()=>{
  assert.match(source,/installEarlyGuards/);
  assert.match(source,/document\.addEventListener\('submit'/);
  assert.match(source,/document\.addEventListener\('keydown'/);
  assert.match(source,/document\.addEventListener\('click'/);
  assert.match(source,/stopImmediatePropagation/);
  assert.match(source,/PERSISTENT QUEUE RECEIPT/);
  assert.match(source,/legacy operation path is disabled/);
});

test('R3 supports queue lifecycle and terminal commands',()=>{
  for(const action of ['run_lookup','queue_status','job_status','cancel_job','retry_job'])assert.match(source,new RegExp(`'${action}'`));
  for(const state of ['queued','running','retry_wait','cancelled','dead_letter','timed_out'])assert.match(source,new RegExp(state));
  for(const command of ['job list','job status <job-id>','job cancel <job-id>','job retry <job-id>'])assert.match(source,new RegExp(command.replace(/[<>-]/g,'.')));
});

test('nested JSON evidence is parsed before display',()=>{
  assert.match(source,/typeof value==='string'/);
  assert.match(source,/JSON\.parse\(value\)/);
  assert.match(source,/JSON\.stringify\(\{query:value\.query/);
});
