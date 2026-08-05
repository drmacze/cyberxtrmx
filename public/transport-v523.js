(()=>{
'use strict';
const SEC=window.CYBERTRMX_SECURITY||{};
const nativeFetch=window.fetch.bind(window);
const inFlight=new Map();
const CLIENT_VERSION='5.2.3';
const FUNCTION_PATH='/functions/v1/';

if(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout!=='function'){
  AbortSignal.timeout=milliseconds=>{
    const controller=new AbortController();
    setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),milliseconds);
    return controller.signal;
  };
}

function ascii(value){
  return String(value??'').normalize?.('NFKD').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim()||String(value??'').replace(/[^\x20-\x7E]/g,' ').trim();
}
function urlOf(input){return typeof input==='string'?input:input?.url||String(input)}
function functionName(url){const index=url.indexOf(FUNCTION_PATH);if(index<0)return'';return decodeURIComponent(url.slice(index+FUNCTION_PATH.length).split(/[?#/]/)[0]||'')}
function normalizeHeaders(source,name){
  const headers=new Headers(source||{});
  for(const [key,value] of [...headers.entries()])headers.set(key,ascii(value));
  const id=SEC.getDeviceId?.()||localStorage.getItem('cybertrmx-device-id-v1')||crypto.randomUUID();
  headers.set('x-device-id',id);
  headers.set('x-client-version',CLIENT_VERSION);
  if(name==='cybertrmx-locations'){
    headers.delete('x-device-label');
    headers.delete('x-device-platform');
    headers.delete('x-device-browser');
    headers.delete('x-idempotency-key');
  }
  return headers;
}
function keyFor(url,init,headers){
  const authorization=headers.get('authorization')||'';
  const device=headers.get('x-device-id')||'';
  const idempotency=headers.get('x-idempotency-key')||'';
  return [url,init.method||'GET',authorization.slice(-32),device,idempotency,String(init.body||'')].join('|');
}
async function snapshot(response){
  return {
    body:await response.text(),
    status:response.status,
    statusText:response.statusText,
    headers:[...response.headers.entries()]
  };
}
function restore(data){return new Response(data.body,{status:data.status,statusText:data.statusText,headers:data.headers})}
function wait(milliseconds){return new Promise(resolve=>setTimeout(resolve,milliseconds))}
async function send(url,init,headers){
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await nativeFetch(url,{...init,headers,signal:controller.signal,cache:'no-store',credentials:'omit',mode:'cors'});
      clearTimeout(timer);
      if([502,503,504].includes(response.status)&&attempt===0){await wait(450);continue}
      return snapshot(response);
    }catch(error){
      clearTimeout(timer);lastError=error;
      if(attempt===0){await wait(450);continue}
    }
  }
  throw lastError||new TypeError('Operations request failed');
}
window.fetch=function(input,init={}){
  const url=urlOf(input);
  const method=String(init.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
  if(!url.includes(FUNCTION_PATH)||method!=='POST')return nativeFetch(input,init);
  const name=functionName(url);
  const headers=normalizeHeaders(init.headers||(typeof input!=='string'&&input?.headers),name);
  const next={...init,method,headers};
  const key=keyFor(url,next,headers);
  let pending=inFlight.get(key);
  if(!pending){
    pending=send(url,next,headers).finally(()=>inFlight.delete(key));
    inFlight.set(key,pending);
  }
  return pending.then(restore);
};
window.CYBERTRMX_TRANSPORT={version:CLIENT_VERSION,pending:()=>inFlight.size};
})();
