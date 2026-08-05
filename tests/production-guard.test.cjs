const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('stability/frontend-lock.json'));

test('staging R3 and production baseline versions are explicit',()=>{
  assert.equal(pkg.version,'5.3.0-r3');
  assert.equal(lock.version,'5.2.8');
  assert.match(read('public/cloud-bootstrap.js'),/const V='5\.3\.0-r3'/);
  assert.match(read('public/patch-page.js'),/CURRENT BUILD \/ 5\.3\.0-r3/);
  assert.match(read('public/staging-marker.js'),/STAGING \/ 5\.3\.0-r3/);
  assert.match(read('public/recovery-527.js'),/const VERSION='5\.3\.0-r3'/);
  assert.match(read('public/recover.html'),/CYBERTRMX 5\.3\.0-r3/);
});

test('frontend lock points at the verified production baseline',()=>{
  assert.equal(lock.baseline_commit,'45944c57e421161a91da1dd002eefe6b78cbf1da');
  assert.deepEqual(lock.locked_paths,['public/index.html','public/app.js','public/motion.js','public/styles.css','public/mobile.css','public/landing.css','public/refine.css']);
});

test('System Guard exposes diagnostics and staging-only recovery',()=>{
  const guard=read('public/guard-v528.js');
  for(const marker of ['Service worker','Device ID','Request ID','Backend','CLEAN RELOAD','OPEN STAGING','guard status','guard recover'])assert.match(guard,new RegExp(marker));
  assert.match(guard,/CYBERTRMX_RECOVERY_527\?\.diagnostics/);
  assert.doesNotMatch(guard,/localStorage\.clear|sessionStorage\.clear/);
  const recovery=read('public/recover.html');
  assert.match(recovery,/getRegistrations/);
  assert.match(recovery,/cyberxtrmx\/staging/);
  assert.match(recovery,/cybertrmx-staging-/);
  assert.doesNotMatch(recovery,/localStorage|sessionStorage/);
});

test('Pages deployment publishes isolated production and staging trees',()=>{
  const workflow=read('.github/workflows/pages.yml');
  for(const marker of ['branches: [main, staging]','ref: main','ref: staging','site/staging','staging-marker.js','cybertrmx-staging-','noindex,nofollow'])assert.match(workflow,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(read('public/staging-marker.js'),/CYBERTRMX_ENV='staging'/);
});

test('production and staging service workers only delete their own namespace',()=>{
  const sw=read('public/sw.js');
  assert.match(sw,/CACHE_NAMESPACE/);
  assert.match(sw,/key\.startsWith\(CACHE_NAMESPACE\)/);
  assert.doesNotMatch(sw,/keys\.filter\(key => key !== CACHE\)/);
});
