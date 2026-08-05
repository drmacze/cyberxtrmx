const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const patch=fs.readFileSync('public/patch-page.js','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');

test('Patch shows the exact current build version',()=>{
  const release=patch.match(/const releases=\[\s*\{version:'([^']+)'/);
  const current=patch.match(/CURRENT BUILD \/ ([0-9A-Za-z.-]+)/);
  assert.ok(release,'Patch release list is missing');
  assert.ok(current,'Patch current build label is missing');
  assert.equal(release[1],pkg.version);
  assert.equal(current[1],pkg.version);
});

test('service worker cache has a valid versioned name',()=>{
  assert.match(sw,/const CACHE = 'cybertrmx-v[0-9A-Za-z.-]+';/);
});
