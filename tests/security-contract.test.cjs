const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('PWA caches every active production security, queue, and guard asset',()=>{
  const sw=read('public/sw.js');
  for(const asset of ['security-utils.js','security-r3.js','security-v52.css','jobs-r3.js','r3-terminal-bridge.js','jobs-r2.css','command-hints-v52.js','tracker-engine.js','tracker-engine.css','recovery-527.js','guard-v528.js','guard-v528.css','recover.html'])assert.match(sw,new RegExp(asset.replaceAll('.','\\.')));
  assert.match(sw,/cybertrmx-v48/);
  assert.match(sw,/CACHE_NAMESPACE = 'cybertrmx-v'/);
});

test('production security layer adds device identity, idempotency, MFA, and request coalescing',()=>{
  const source=read('public/security-r3.js');
  assert.match(source,/x-device-id/);
  assert.match(source,/x-idempotency-key/);
  assert.match(source,/x-client-version/);
  assert.match(source,/instance\.channel=noRealtimeChannel/);
  assert.match(source,/readInflight/);
  assert.match(source,/Authenticator QR code/);
  assert.match(source,/encodeURIComponent\(raw\)/);
  assert.match(source,/replace\(\/\[\^\\x20-\\x7E\]\//);
});

test('Production Guard loads before security, queue, and Operations core',()=>{
  const bootstrap=read('public/cloud-bootstrap.js');
  const guardIndex=bootstrap.indexOf('guard-v528.js');
  const backendIndex=bootstrap.indexOf('backend-config.js');
  const securityIndex=bootstrap.indexOf('security-r3.js');
  const jobsIndex=bootstrap.indexOf('jobs-r3.js');
  const coreIndex=bootstrap.indexOf('cloud-core.js');
  assert.ok(guardIndex>=0&&guardIndex<backendIndex);
  assert.ok(backendIndex<securityIndex&&securityIndex<jobsIndex&&jobsIndex<coreIndex);
  assert.doesNotMatch(bootstrap,/transport-v523|patch-click-v525|jobs-r2\.js/);
});

test('active recovery supplies device identity, inline locations, and request diagnostics',()=>{
  const source=read('public/recovery-527.js');
  assert.match(source,/x-device-id/);
  assert.match(source,/name==='cybertrmx-locations'/);
  assert.match(source,/dashboardLocations/);
  assert.match(source,/lastRequestId/);
  assert.match(source,/lastBackendVersion/);
  assert.match(source,/diagnostics:\(\)=>/);
  const workflow=read('.github/workflows/pages.yml');
  assert.match(workflow,/recovery-527\.js/);
});

test('terminal protects credentials and artifact parser handles persistent job commands',()=>{
  const source=read('public/security-r3.js');
  assert.match(source,/Credentials are only accepted in the protected account form/);
  const hints=read('public/command-hints-v52.js');
  assert.match(hints,/auth open/);
  assert.doesNotMatch(hints,/auth create <email> <password>/);
  const workflow=read('.github/workflows/pages.yml');
  assert.match(workflow,/cmd==='job'\|\|cmd==='lookup'/);
  assert.match(workflow,/CYBERTRMX_R3_TERMINAL_BRIDGE\?\.execute/);
});

test('check-in uses a stable submission key and structured errors',()=>{
  const source=read('public/checkin.js');
  assert.match(source,/x-submission-key/);
  assert.match(source,/submissionKey=submissionKey\|\|crypto\.randomUUID/);
  assert.match(source,/requestId/);
});
