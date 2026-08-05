const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('stability/frontend-lock.json'));

test('all Production Guard version sources agree',()=>{
  assert.equal(pkg.version,'5.2.8');
  assert.equal(lock.version,pkg.version);
  assert.match(read('public/recovery-527.js'),/const VERSION='5\.2\.8'/);
  assert.match(read('public/cloud-bootstrap.js'),/const V='5\.2\.8'/);
  assert.match(read('public/patch-page.js'),/CURRENT BUILD \/ 5\.2\.8/);
  assert.match(read('public/recover.html'),/CYBERTRMX 5\.2\.8/);
});

test('frontend lock points at the user-verified production baseline',()=>{
  assert.equal(lock.baseline_commit,'45944c57e421161a91da1dd002eefe6b78cbf1da');
  assert.deepEqual(lock.locked_paths,[
    'public/index.html','public/app.js','public/motion.js','public/styles.css',
    'public/mobile.css','public/landing.css','public/refine.css'
  ]);
});

test('System Guard exposes diagnostics and controlled recovery',()=>{
  const guard=read('public/guard-v528.js');
  for(const marker of ['Service worker','Device ID','Request ID','Backend','CLEAN RELOAD','OPEN STAGING','guard status','guard recover'])assert.match(guard,new RegExp(marker));
  assert.match(guard,/CYBERTRMX_RECOVERY_527\?\.diagnostics/);
  assert.doesNotMatch(guard,/localStorage\.clear|sessionStorage\.clear/);
  const recovery=read('public/recover.html');
  assert.match(recovery,/getRegistrations/);
  assert.match(recovery,/caches\.keys/);
  assert.doesNotMatch(recovery,/localStorage|sessionStorage/);
});

test('Pages deployment publishes isolated production and staging trees',()=>{
  const workflow=read('.github/workflows/pages.yml');
  assert.match(workflow,/branches: \[main, staging\]/);
  assert.match(workflow,/ref: main/);
  assert.match(workflow,/ref: staging/);
  assert.match(workflow,/site\/staging/);
  assert.match(workflow,/staging-marker\.js/);
  assert.match(workflow,/cybertrmx-staging-/);
  assert.match(workflow,/noindex,nofollow/);
  const marker=read('public/staging-marker.js');
  assert.match(marker,/CYBERTRMX_ENV='staging'/);
  assert.match(marker,/STAGING \/ NOT PRODUCTION/);
});

test('production and staging service workers only delete their own cache namespace',()=>{
  const sw=read('public/sw.js');
  assert.match(sw,/CACHE_NAMESPACE/);
  assert.match(sw,/key\.startsWith\(CACHE_NAMESPACE\)/);
  assert.doesNotMatch(sw,/keys\.filter\(key => key !== CACHE\)/);
});
