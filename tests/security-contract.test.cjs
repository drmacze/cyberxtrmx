const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('PWA caches every 5.2 security asset',()=>{
  const sw=read('public/sw.js');
  for(const asset of ['security-utils.js','transport-v523.js','security-v52.js','security-v52.css','command-hints-v52.js','tracker-engine.js','tracker-engine.css']){
    assert.match(sw,new RegExp(asset.replace('.','\\.')));
  }
  assert.match(sw,/cybertrmx-v38/);
});

test('security layer adds device and idempotency headers',()=>{
  const source=read('public/security-v52.js');
  assert.match(source,/x-device-id/);
  assert.match(source,/x-idempotency-key/);
  assert.match(source,/x-client-version/);
  assert.match(source,/instance\.channel=noRealtimeChannel/);
});

test('Operations transport loads before the security client',()=>{
  const bootstrap=read('public/cloud-bootstrap.js');
  const transportIndex=bootstrap.indexOf("transport-v523.js");
  const securityIndex=bootstrap.indexOf("security-v52.js");
  const coreIndex=bootstrap.indexOf("cloud-core.js");
  assert.ok(transportIndex>=0,'5.2.3 transport is not loaded');
  assert.ok(transportIndex<securityIndex,'transport must load before the security client');
  assert.ok(securityIndex<coreIndex,'security client must load before Operations core');
});

test('Operations transport deduplicates reads and narrows Locations headers',()=>{
  const source=read('public/transport-v523.js');
  assert.match(source,/READ_ACTIONS=new Set\(\['dashboard','security_status','job_status'\]\)/);
  assert.match(source,/shared-read/);
  assert.match(source,/name==='cybertrmx-locations'/);
  for(const header of ['x-device-label','x-device-platform','x-device-browser','x-idempotency-key']){
    assert.match(source,new RegExp(`headers\\.delete\\('${header}'\\)`));
  }
  assert.match(source,/for\(let attempt=0;attempt<2;attempt\+\+\)/);
  assert.match(source,/AbortSignal\.timeout/);
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
