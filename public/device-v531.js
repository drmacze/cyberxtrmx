(()=>{
'use strict';
const CONFIG=window.CYBERTRMX_BACKEND||{};
const SEC=window.CYBERTRMX_SECURITY||{};
const VERSION='5.3.1';
const MEMORY_KEY='__cybertrmx_device_v531';
const uuidPattern=SEC.uuidPattern||/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const targets=new Set([
  CONFIG.operationsFunction||'cybertrmx-ops',
  CONFIG.jobsFunction||'cybertrmx-jobs',
  CONFIG.locationsFunction||'cybertrmx-locations',
]);
const originalFetch=window.fetch.bind(window);
let memoryId='';

function uuid(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  const bytes=new Uint8Array(16);globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  return [...bytes].map((byte,index)=>([4,6,8,10].includes(index)?'-':'')+byte.toString(16).padStart(2,'0')).join('');
}
function readStorage(storage,key){try{return storage?.getItem(key)||''}catch{return''}}
function writeStorage(storage,key,value){try{storage?.setItem(key,value)}catch{}}
function deviceId(force=false){
  const key=SEC.DEVICE_KEY||'cybertrmx-device-id-v1';
  let value=force?'':memoryId||readStorage(localStorage,key)||readStorage(sessionStorage,key)||readStorage(sessionStorage,MEMORY_KEY);
  if(!uuidPattern.test(value))value=uuid();
  memoryId=value;
  writeStorage(localStorage,key,value);
  writeStorage(sessionStorage,key,value);
  writeStorage(sessionStorage,MEMORY_KEY,value);
  window.CYBERTRMX_DEVICE_ID=value;
  return value;
}
function ascii(value,max=100){return String(value??'').normalize('NFKD').replace(/[^\x20-\x7E]/g,'-').replace(/\s+/g,' ').trim().slice(0,max)}
function metadata(){
  const meta=SEC.deviceMeta?.()||{};
  return {
    label:ascii(meta.label||'Device - Browser',80)||'Device - Browser',
    platform:ascii(meta.platform||'Device',60)||'Device',
    browser:ascii(meta.browser||'Browser',60)||'Browser',
  };
}
function requestUrl(input){try{return new URL(input instanceof Request?input.url:String(input),location.href)}catch{return null}}
function shouldPatch(url){
  if(!url||url.origin!==new URL(CONFIG.url).origin)return false;
  const marker='/functions/v1/';
  const index=url.pathname.indexOf(marker);
  if(index<0)return false;
  return targets.has(decodeURIComponent(url.pathname.slice(index+marker.length).split('/')[0]||''));
}
function copyHeaders(input,init){
  const headers=new Headers(input instanceof Request?input.headers:undefined);
  const raw=init?.headers;
  const put=(key,value)=>{try{headers.set(String(key),ascii(value,500))}catch{}};
  if(raw instanceof Headers)raw.forEach((value,key)=>put(key,value));
  else if(Array.isArray(raw))raw.forEach(pair=>Array.isArray(pair)&&put(pair[0],pair[1]));
  else if(raw&&typeof raw==='object')Object.entries(raw).forEach(([key,value])=>put(key,value));
  return headers;
}
function secureHeaders(input,init,force=false){
  const headers=copyHeaders(input,init),meta=metadata();
  headers.set('x-device-id',deviceId(force));
  headers.set('x-device-label',meta.label);
  headers.set('x-device-platform',meta.platform);
  headers.set('x-device-browser',meta.browser);
  headers.set('x-client-version',VERSION);
  if(!headers.has('x-idempotency-key')&&String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase()==='POST'){
    headers.set('x-idempotency-key',SEC.idempotencyKey?.()||uuid());
  }
  return headers;
}
async function patchedFetch(input,init={}){
  const url=requestUrl(input);
  if(!shouldPatch(url))return originalFetch(input,init);
  const retryInput=input instanceof Request?input.clone():input;
  let headers=secureHeaders(input,init,false);
  let response=await originalFetch(input,{...init,headers});
  if(response.status!==400)return response;
  let payload=null;try{payload=await response.clone().json()}catch{}
  if(payload?.error!=='DEVICE_ID_REQUIRED')return response;
  headers=secureHeaders(retryInput,init,true);
  return originalFetch(retryInput,{...init,headers});
}

deviceId(false);
window.fetch=patchedFetch;
window.CYBERTRMX_DEVICE_TRANSPORT={version:VERSION,getId:deviceId,metadata};
})();
