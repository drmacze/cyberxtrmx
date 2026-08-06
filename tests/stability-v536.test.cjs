const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'public',name),'utf8');

test('5.3.6 candidate remains opt-in',()=>{
 const bootstrap=read('cloud-bootstrap.js');
 assert.match(bootstrap,/stability536/);
 assert.match(bootstrap,/if\(STABILITY_536\)await load\('\.\/stability-transport-v536\.js'/);
 assert.match(bootstrap,/if\(STABILITY_536\)await load\('\.\/stability-v536\.js'/);
});

test('health observer is scoped to the queue list',()=>{
 const source=read('stability-v536.js');
 assert.match(source,/queueObserver\.observe\(list,/);
 assert.doesNotMatch(source,/observe\(document\.body/);
 assert.doesNotMatch(source,/observe\(document\.documentElement/);
});

test('read-only requests are coalesced but writes are not listed',()=>{
 const source=read('stability-transport-v536.js');
 assert.match(source,/action==='dashboard'/);
 assert.match(source,/action==='queue_status'/);
 assert.doesNotMatch(source,/action==='run_lookup'/);
 assert.doesNotMatch(source,/action==='retry_job'/);
 assert.doesNotMatch(source,/action==='cancel_job'/);
});

test('candidate has reversible terminal controls and patch history',()=>{
 const health=read('stability-v536.js');
 const patch=read('patch-hotfix-v536.js');
 assert.match(health,/health copy/);
 assert.match(health,/health disable/);
 assert.match(health,/localStorage\.removeItem\('cybertrmx-stability-536'\)/);
 assert.match(patch,/5\.3\.6-rc1/);
});
