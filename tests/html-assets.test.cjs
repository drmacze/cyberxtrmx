const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function localAssets(html){
  const values=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match=>match[1]);
  return [...new Set(values.filter(value=>value.startsWith('./')).map(value=>value.split(/[?#]/)[0].replace(/^\.\//,'')))];
}

test('every local asset referenced by index.html exists',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  const missing=localAssets(html).filter(asset=>!fs.existsSync(path.join('public',asset)));
  assert.deepEqual(missing,[],`Missing index assets: ${missing.join(', ')}`);
});

test('every local asset referenced by checkin.html exists',()=>{
  const html=fs.readFileSync('public/checkin.html','utf8');
  const missing=localAssets(html).filter(asset=>!fs.existsSync(path.join('public',asset)));
  assert.deepEqual(missing,[],`Missing check-in assets: ${missing.join(', ')}`);
});
