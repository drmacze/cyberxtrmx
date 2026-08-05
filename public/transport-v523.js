(()=>{
'use strict';
const SEC=window.CYBERTRMX_SECURITY||{};
const nativeFetch=window.fetch.bind(window);
const inFlight=new Map();
const CLIENT_VERSION='5.2.6';
const FUNCTION_PATH='/functions/v1/';
const READ_ACTIONS=new Set(['dashboard','security_status','job_status']);
let dashboardLocations=[];
let dashboardServerTime=null;

if(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout!=='function'){
  AbortSignal.timeout=milliseconds=>{
    const controller=new AbortController();
    setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),milliseconds);
    return controller.signal;
  };
}

function ascii(value){
  const text=String(value??'');
  const normalized=typeof text.normalize==='function'?text.normalize('NFKD'):text;
  return normalized.replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim();
}
function urlOf(input){return typeof input==='string'?input:input?.url||String(input)}
function functionName(url){const index=url.indexOf(FUNCTION_PATH);if(index<0)return'';return decodeURIComponent(url.slice(index+FUNCTION_PATH.length).split(/[?#/]/)[0]||'')}
function actionOf(body){try{return String(JSON.parse(String(body||'{}')).action||'')}catch{return''}}
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
  const action=actionOf(init.body);
  const idempotency=READ_ACTIONS.has(action)?'shared-read':headers.get('x-idempotency-key')||'';
  return [url,init.method||'GET',authorization.slice(-32),device,idempotency,String(init.body||'')].join('|');
}
async function snapshot(response,name,action){
  const body=await response.text();
  if(response.ok&&name==='cybertrmx-ops'&&action==='dashboard'){
    try{
      const payload=JSON.parse(body);
      dashboardLocations=Array.isArray(payload.locations)?payload.locations:[];
      dashboardServerTime=payload.server_time||new Date().toISOString();
    }catch{}
  }
  return {body,status:response.status,statusText:response.statusText,headers:[...response.headers.entries()]};
}
function restore(data){return new Response(data.body,{status:data.status,statusText:data.statusText,headers:data.headers})}
function localLocationsResponse(){
  return new Response(JSON.stringify({
    ok:true,
    request_id:`local-${crypto.randomUUID?.()||Date.now()}`,
    backend_version:'locations-from-dashboard-v1',
    locations:dashboardLocations,
    server_time:dashboardServerTime||new Date().toISOString()
  }),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-CYBERTRMX-Source':'operations-dashboard'}});
}
function wait(milliseconds){return new Promise(resolve=>setTimeout(resolve,milliseconds))}
async function send(url,init,headers,name,action){
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await nativeFetch(url,{...init,headers,signal:controller.signal,cache:'no-store',credentials:'omit',mode:'cors'});
      clearTimeout(timer);
      if([502,503,504].includes(response.status)&&attempt===0){await wait(450);continue}
      return snapshot(response,name,action);
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
  if(name==='cybertrmx-locations')return Promise.resolve(localLocationsResponse());
  const headers=normalizeHeaders(init.headers||(typeof input!=='string'&&input?.headers),name);
  const next={...init,method,headers};
  const action=actionOf(next.body);
  const key=keyFor(url,next,headers);
  let pending=inFlight.get(key);
  if(!pending){
    pending=send(url,next,headers,name,action).finally(()=>inFlight.delete(key));
    inFlight.set(key,pending);
  }
  return pending.then(restore);
};
window.CYBERTRMX_TRANSPORT={version:CLIENT_VERSION,pending:()=>inFlight.size,locations:()=>dashboardLocations.slice()};
})();