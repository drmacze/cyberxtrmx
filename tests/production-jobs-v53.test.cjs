const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('production backend config exposes the persistent Job API',()=>{
  const config=read('public/backend-config.js');
  assert.match(config,/jobsFunction: 'cybertrmx-jobs'/);
  assert.match(config,/operationsFunction: 'cybertrmx-ops'/);
});

test('queue client is isolated and fail-open',()=>{
  const jobs=read('public/jobs-r3.js');
  assert.match(jobs,/run_lookup/);
  assert.match(jobs,/queue_status/);
  assert.match(jobs,/job_status/);
  assert.match(jobs,/cancel_job/);
  assert.match(jobs,/retry_job/);
  assert.match(jobs,/PERSISTENT QUEUE RECEIPT/);
  assert.match(jobs,/LEASE \+ HEARTBEAT/);
  assert.doesNotMatch(jobs,/window\.fetch\s*=/);
  assert.doesNotMatch(jobs,/supabase\.createClient\s*=/);
  assert.doesNotMatch(jobs,/CYBERTRMX_OPERATIONS\.call\s*=/);
});

test('native terminal bridge supports the production job command surface',()=>{
  const bridge=read('public/r3-terminal-bridge.js');
  for(const action of ['job list','job status','job cancel','job retry','lookup <dns|rdap|ip>'])assert.match(bridge,new RegExp(action.replace(/[|<>]/g,char=>`\\${char}`)));
  assert.match(bridge,/PERSISTENT QUEUE RECEIPT/);
  assert.match(bridge,/queue_status/);
});

test('source bootstrap enables queue and replaces the native execute binding',()=>{
  const bootstrap=read('public/cloud-bootstrap.js');
  assert.match(bootstrap,/enableQueueForLoad/);
  assert.match(bootstrap,/jobs_r3/);
  assert.match(bootstrap,/r3-terminal-bridge\.js/);
  assert.match(bootstrap,/window\.execute=wrapped/);
  assert.match(bootstrap,/execute = window\.CYBERTRMX_PRODUCTION_EXECUTE/);
  assert.match(bootstrap,/attempts>=80/);
});

test('production release ledger and cache include persistent queue assets',()=>{
  const patch=read('public/patch-page.js');
  const sw=read('public/sw.js');
  assert.match(patch,/version:'5\.3\.1'/);
  assert.match(patch,/Production terminal queue recovery/);
  assert.match(patch,/CURRENT BUILD \/ 5\.3\.1 \/ CACHE 49/);
  assert.match(sw,/cybertrmx-v49/);
  for(const asset of ['jobs-r2.css','jobs-r3.js','r3-terminal-bridge.js','security-r3.js'])assert.match(sw,new RegExp(asset.replaceAll('.','\\.')));
});
