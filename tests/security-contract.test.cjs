const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('PWA caches every active R3 security, guard, and queue asset',()=>{
  const sw=read('public/sw.js');
  for(const asset of ['security-utils.js','security-r3.js','security-v52.css','command-hints-v52.js','tracker-engine.js','tracker-engine.css','recovery-527.js','guard-v528.js','guard-v528.css','recover.html','jobs-r3.js','jobs-r2.css'])assert.match(sw,new RegExp(asset.replaceAll('.','\\.')));
  assert.match(sw,/cybertrmx-v45-r3/);
  assert.doesNotMatch(sw,/jobs-r2\.js|security-v52\.js/);
  assert.match(sw,/CACHE_NAMESPACE = 'cybertrmx-v'/);
});

test('R3 security coalesces protected reads and renders MFA safely',()=>{
  const source=read('public/security-r3.js');
  for(const marker of ['x-device-id','x-idempotency-key','x-client-version','readInflight','readCache','securityInflight'])assert.match(source,new RegExp(marker));
  assert.match(source,/instance\.channel=noRealtimeChannel/);
  assert.match(source,/encodeURIComponent\(raw\)/);
  assert.match(source,/security-r3-qr/);
  assert.doesNotMatch(source,/src=\\"\$\{enrollment\.totp\.qr_code\}/);
});

test('R3 jobs and security install before Operations core',()=>{
  const bootstrap=read('public/cloud-bootstrap.js');
  const guard=bootstrap.indexOf('guard-v528.js');
  const backend=bootstrap.indexOf('backend-config.js');
  const security=bootstrap.indexOf('security-r3.js');
  const jobs=bootstrap.indexOf('jobs-r3.js');
  const core=bootstrap.indexOf('cloud-core.js');
  assert.ok(guard>=0&&guard<backend);
  assert.ok(backend<security);
  assert.ok(security<jobs);
  assert.ok(jobs<core,'jobs-r3 must register early capture handlers before cloud-core');
  assert.doesNotMatch(bootstrap,/jobs-r2\.js|security-v52\.js|transport-v523|patch-click-v525/);
});

test('active recovery path reports the R3 candidate',()=>{
  const source=read('public/recovery-527.js');
  assert.match(source,/x-device-id/);
  assert.match(source,/name==='cybertrmx-locations'/);
  assert.match(source,/dashboardLocations/);
  assert.match(source,/lastRequestId/);
  assert.match(source,/const VERSION='5\.3\.0-r3'/);
});

test('terminal credential protection remains active in R3',()=>{
  const source=read('public/security-r3.js');
  assert.match(source,/Credentials are only accepted in the protected account form/);
  const hints=read('public/command-hints-v52.js');
  assert.match(hints,/auth open/);
  assert.doesNotMatch(hints,/auth create <email> <password>/);
});

test('check-in uses a stable submission key and structured errors',()=>{
  const source=read('public/checkin.js');
  assert.match(source,/x-submission-key/);
  assert.match(source,/submissionKey=submissionKey\|\|crypto\.randomUUID/);
  assert.match(source,/requestId/);
});
