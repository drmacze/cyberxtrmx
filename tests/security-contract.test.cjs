const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('PWA caches every 5.2 security asset',()=>{
  const sw=read('public/sw.js');
  for(const asset of ['security-utils.js','security-v52.js','security-v52.css','command-hints-v52.js']){
    assert.match(sw,new RegExp(asset.replace('.','\\.')));
  }
  assert.match(sw,/cybertrmx-v27/);
});

test('security layer adds device and idempotency headers',()=>{
  const source=read('public/security-v52.js');
  assert.match(source,/x-device-id/);
  assert.match(source,/x-idempotency-key/);
  assert.match(source,/x-client-version/);
  assert.match(source,/instance\.channel=noRealtimeChannel/);
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
