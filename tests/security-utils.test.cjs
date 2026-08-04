const test=require('node:test');
const assert=require('node:assert/strict');
const security=require('../public/security-utils.js');

test('device ID is stable and valid',()=>{
  const data=new Map();
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
  const first=security.getDeviceId(storage),second=security.getDeviceId(storage);
  assert.match(first,security.uuidPattern);
  assert.equal(first,second);
});

test('password assessment rejects weak and accepts strong input',()=>{
  assert.equal(security.passwordAssessment('password123').strong,false);
  assert.equal(security.passwordAssessment('Long!Unique#Passphrase2026').strong,true);
});

test('SHA-1 helper matches a known vector',async()=>{
  assert.equal(await security.sha1Hex('password'),'5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
});

test('breach check uses k-anonymity suffix matching',async()=>{
  const hash=await security.sha1Hex('password');
  const count=await security.compromisedPasswordCount('password',async()=>({ok:true,text:async()=>`${hash.slice(5)}:42\nAAAA:1`}));
  assert.equal(count,42);
});
