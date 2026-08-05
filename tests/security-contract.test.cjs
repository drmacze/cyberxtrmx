const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('PWA caches every active security, guard, and staging queue asset',()=>{
  const sw=read('public/sw.js');
  for(const asset of ['security-utils.js','security-v52.js','security-v52.css','command-hints-v52.js','tracker-engine.js','tracker-engine.css','recovery-527.js','guard-v528.js','guard-v528.css','recover.html','jobs-r2.js','jobs-r2.css']){
    assert.match(sw,new RegExp(asset.replaceAll('.','\\.')));
  }
  assert.match(sw,/cybertrmx-v43-r2/);
  assert.match(sw,/CACHE_NAMESPACE = 'cybertrmx-v'/);
});

test('security layer adds device and idempotency headers',()=>{
  const source=read('public/security-v52.js');
  assert.match(source,/x-device-id/);
  assert.match(source,/x-idempotency-key/);
  assert.match(source,/x-client-version/);
  assert.match(source,/instance\.channel=noRealtimeChannel/);
});

test('Production Guard and stable Operations load before the staging queue',()=>{
  const bootstrap=read('public/cloud-bootstrap.js');
  const guardIndex=bootstrap.indexOf("guard-v528.js");
  const backendIndex=bootstrap.indexOf("backend-config.js");
  const securityIndex=bootstrap.indexOf("security-v52.js");
  const coreIndex=bootstrap.indexOf("cloud-core.js");
  const jobsIndex=bootstrap.indexOf("jobs-r2.js");
  assert.ok(guardIndex>=0,'Production Guard is not loaded');
  assert.ok(guardIndex<backendIndex,'Production Guard must load before backend configuration');
  assert.ok(backendIndex<securityIndex,'backend configuration must load before security client');
  assert.ok(securityIndex<coreIndex,'security client must load before Operations core');
  assert.ok(coreIndex<jobsIndex,'staging jobs must load after the stable Operations core');
  assert.doesNotMatch(bootstrap,/transport-v523|patch-click-v525|jobs-v53/);
});

test('active recovery path supplies device identity, inline locations, and request diagnostics',()=>{
  const source=read('public/recovery-527.js');
  assert.match(source,/x-device-id/);
  assert.match(source,/name==='cybertrmx-locations'/);
  assert.match(source,/dashboardLocations/);
  assert.match(source,/lastRequestId/);
  assert.match(source,/lastBackendVersion/);
  assert.match(source,/diagnostics:\(\)=>/);
  assert.match(source,/const VERSION='5\.2\.8'/);
});

test('terminal blocks password-bearing account commands',()=>{
  const source=read('public/security-v52.js');
  assert.match(source,/Credentials are only accepted in the protected account form/);
  const hints=read('public/command-hints-v52.js');
  assert.match(hints,/splice/);
  assert.match(hints,/auth open/);
  assert.doesNotMatch(hints,/auth create <email> <password>/);
});

test('check-in uses a stable submission key and structured errors',()=>{
  const source=read('public/checkin.js');
  assert.match(source,/x-submission-key/);
  assert.match(source,/submissionKey=submissionKey\|\|crypto\.randomUUID/);
  assert.match(source,/requestId/);
});
