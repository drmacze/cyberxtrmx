const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('current package version is published in the Patch menu',()=>{
  const version=JSON.parse(read('package.json')).version;
  const patch=read('public/patch-page.js');
  assert.match(patch,new RegExp(`version:'${version.replaceAll('.','\\.')}'`));
  assert.match(patch,new RegExp(`CURRENT BUILD / ${version.replaceAll('.','\\.')}`));
});

test('Patch menu keeps newest release first',()=>{
  const version=JSON.parse(read('package.json')).version;
  const patch=read('public/patch-page.js');
  const releasesStart=patch.indexOf('const releases=[');
  const current=patch.indexOf(`version:'${version}'`);
  const previous=patch.indexOf("version:'5.3.0'");
  assert.ok(releasesStart>=0&&current>releasesStart);
  assert.ok(previous<0||current<previous);
});
