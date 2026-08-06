const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('stability/frontend-lock.json'));

test('all production version sources agree on 5.3.0',()=>{
  assert.equal(pkg.version,'5.3.0');
  assert.equal(lock.version,pkg.version);
  assert.match(read('public/cloud-bootstrap.js'),/const V='5\.3\.0'/);
  assert.match(read('public/patch-page.js'),/CURRENT BUILD \/ 5\.3\.0 \/ CACHE 48/);
  assert.match(read('public/recover.html'),/production 5\.3\.0/i);
  assert.match(read('public/sw.js'),/cybertrmx-v48/);
});

test('verified interface files remain locked to the stable baseline',()=>{
  assert.equal(lock.baseline_commit,'45944c57e421161a91da1dd002eefe6b78cbf1da');
  assert.deepEqual(lock.locked_paths,[
    'public/index.html','public/app.js','public/motion.js','public/styles.css',
    'public/mobile.css','public/landing.css','public/refine.css'
  ]);
});

test('production queue modules are present without editing the locked source parser',()=>{
  const config=read('public/backend-config.js');
  const bootstrap=read('public/cloud-bootstrap.js');
  const jobs=read('public/jobs-r3.js');
  const bridge=read('public/r3-terminal-bridge.js');
  assert.match(config,/jobsFunction: 'cybertrmx-jobs'/);
  assert.match(bootstrap,/security-r3\.js/);
  assert.match(bootstrap,/jobs-r3\.js/);
  assert.match(bootstrap,/jobs-r2\.css/);
  assert.match(jobs,/PERSISTENT QUEUE RECEIPT/);
  assert.match(jobs,/run_lookup/);
  assert.match(jobs,/queue_status/);
  assert.match(bridge,/job <status\|cancel\|retry>/);
  assert.match(bridge,/lookup <dns\|rdap\|ip>/);
});

test('Pages artifact activates the native queue parser in production and staging',()=>{
  const workflow=read('.github/workflows/pages.yml');
  assert.match(workflow,/branches: \[main\]/);
  assert.match(workflow,/activate_native_queue/);
  assert.match(workflow,/production_version == '5\.3\.0'/);
  assert.match(workflow,/CYBERTRMX_R3_TERMINAL_BRIDGE\?\.execute/);
  assert.match(workflow,/jobs_off/);
  assert.match(workflow,/persistent_queue/);
  assert.match(workflow,/site\/staging/);
  assert.match(workflow,/noindex,nofollow/);
});

test('System Guard and clean recovery preserve account and workspace storage',()=>{
  const guard=read('public/guard-v528.js');
  for(const marker of ['Service worker','Device ID','Request ID','Backend','CLEAN RELOAD','OPEN STAGING','guard status','guard recover'])assert.match(guard,new RegExp(marker));
  assert.doesNotMatch(guard,/localStorage\.clear|sessionStorage\.clear/);
  const recovery=read('public/recover.html');
  assert.match(recovery,/getRegistrations/);
  assert.match(recovery,/caches\.keys/);
  assert.match(recovery,/cybertrmx-v/);
  assert.doesNotMatch(recovery,/localStorage|sessionStorage/);
});

test('production service worker caches queue assets and preserves staging namespace',()=>{
  const sw=read('public/sw.js');
  for(const asset of ['jobs-r2.css','jobs-r3.js','r3-terminal-bridge.js','security-r3.js'])assert.match(sw,new RegExp(asset.replace('.','\\.')));
  assert.match(sw,/CACHE_NAMESPACE/);
  assert.match(sw,/key=>key\.startsWith\(CACHE_NAMESPACE\)/);
  assert.doesNotMatch(sw,/staging-marker\.js/);
  assert.doesNotMatch(sw,/cybertrmx-staging-/);
});
