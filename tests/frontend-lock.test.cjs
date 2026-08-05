const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const manifest=JSON.parse(fs.readFileSync('stability/frontend-lock.json','utf8'));

test('critical frontend files match the verified baseline',()=>{
  const args=['diff','--name-only',`${manifest.baseline_commit}..HEAD`,'--',...manifest.locked_paths];
  const changed=execFileSync('git',args,{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed,[],`Stability lock violation:\n${changed.join('\n')}\nReview the frontend in staging before moving the baseline.`);
});

test('stable startup does not load withdrawn 5.3 frontend modules',()=>{
  const motion=fs.readFileSync('public/motion.js','utf8');
  const bootstrap=fs.readFileSync('public/cloud-bootstrap.js','utf8');
  const index=fs.readFileSync('public/index.html','utf8');
  for(const source of [motion,bootstrap,index]){
    assert.doesNotMatch(source,/jobs-v53|device-v531|startup-v53|lazy-loader|boot-watchdog/i);
  }
});

test('locked files and baseline commit are valid',()=>{
  assert.match(manifest.baseline_commit,/^[0-9a-f]{40}$/);
  assert.ok(manifest.locked_paths.length>=7);
  for(const path of manifest.locked_paths)assert.ok(fs.existsSync(path),`Missing locked file: ${path}`);
  execFileSync('git',['cat-file','-e',`${manifest.baseline_commit}^{commit}`]);
});
