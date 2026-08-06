(()=>{
'use strict';
const VERSION='5.3.6-rc1';
const ACTIVE=location.pathname.includes('/staging/')||new URLSearchParams(location.search).get('stability536')==='1'||localStorage.getItem('cybertrmx-stability-536')==='1';
if(!ACTIVE)return;
const inflight=new Map();
const stats={coalesced:0,completed:0,lastRequestId:'',lastFunction:'',lastAction:'',lastDurationMs:0};
const stable=value=>{try{return JSON.stringify(value,Object.keys(value||{}).sort())}catch{return String(value)}};
function readOnly(functionName,body){const action=String(body?.action||'');return action==='dashboard'||action==='queue_status'||(!action&&/locations/i.test(functionName))}
function decorateError(error){
 const context=error?.context,requestId=context?.headers?.get?.('x-request-id')||context?.headers?.get?.('X-Request-ID')||'';
 if(!requestId)return error;
 stats.lastRequestId=requestId;error.requestId=requestId;
 try{
  const originalJson=context.json?.bind(context);let cached;
  if(originalJson)context.json=async()=>{if(cached===undefined)cached=await originalJson();if(cached&&typeof cached==='object')return{...cached,request_id:cached.request_id||requestId,error:`${cached.error||'REQUEST_FAILED'} / REQUEST ${requestId}`};return cached};
 }catch{}
 if(!String(error.message||'').includes(requestId))error.message=`${error.message||'Backend request failed'} / request ${requestId}`;
 return error;
}
function wrapClient(client){
 const invoke=client?.functions?.invoke?.bind(client.functions);if(!invoke||invoke.__cybertrmxStability536)return client;
 const wrapped=async(functionName,options={})=>{
  const body=options?.body||{},action=String(body?.action||'');
  const key=`${functionName}:${stable(body)}`;const dedupe=readOnly(functionName,body);
  if(dedupe&&inflight.has(key)){stats.coalesced++;return inflight.get(key)}
  const started=performance.now();
  const task=(async()=>{const result=await invoke(functionName,options);stats.completed++;stats.lastFunction=functionName;stats.lastAction=action;stats.lastDurationMs=Math.round(performance.now()-started);if(result?.error)decorateError(result.error);return result})().finally(()=>inflight.delete(key));
  if(dedupe)inflight.set(key,task);return task;
 };
 wrapped.__cybertrmxStability536=true;client.functions.invoke=wrapped;return client;
}
function install(){
 const supabase=window.supabase;if(!supabase?.createClient||supabase.createClient.__cybertrmxStability536)return false;
 const original=supabase.createClient.bind(supabase);
 const wrapped=(url,key,options={})=>wrapClient(original(url,key,options));
 wrapped.__cybertrmxStability536=true;wrapped.__cybertrmxOriginal=original;supabase.createClient=wrapped;
 window.CYBERTRMX_STABILITY_TRANSPORT={version:VERSION,stats,inflight};
 return true;
}
if(!install()){let attempts=0;const timer=setInterval(()=>{attempts++;if(install()||attempts>=80)clearInterval(timer)},50)}
})();
