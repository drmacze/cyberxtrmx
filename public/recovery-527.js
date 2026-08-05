(()=>{
'use strict';
const VERSION='5.2.8';
const nativeFetch=window.fetch.bind(window);
let dashboardLocations=[];
let patchLoading=null;
const diagnostics={
  version:VERSION,
  requestCount:0,
  lastEndpoint:'',
  lastAction:'',
  lastStatus:null,
  lastRequestId:'',
  lastBackendVersion:'',
  lastError:'',
  lastAt:'',
  lastDurationMs:0
};

function urlOf(input){return typeof input==='string'?input:input?.url||String(input)}
function actionOf(body){try{return String(JSON.parse(String(body||'{}')).action||'')}catch{return''}}
function cleanHeaders(source,name){
  const input=new Headers(source||{}),headers=new Headers();
  const allowed=name==='cybertrmx-ops'
    ?['authorization','apikey','content-type','x-device-id','x-client-version','x-idempotency-key']
    :['authorization','apikey','content-type','x-device-id','x-client-version'];
  allowed.forEach(key=>{const value=input.get(key);if(value)headers.set(key,value)});
  if(!headers.get('x-device-id')){
    let id='';try{id=localStorage.getItem('cybertrmx-device-id-v1')||''}catch{}
    if(!/^[0-9a-f-]{36}$/i.test(id)){id=crypto.randomUUID();try{localStorage.setItem('cybertrmx-device-id-v1',id)}catch{}}
    headers.set('x-device-id',id);
  }
  headers.set('x-client-version',VERSION);
  return headers;
}
function functionName(url){const match=url.match(/\/functions\/v1\/([^/?#]+)/);return match?decodeURIComponent(match[1]):''}
function jsonResponse(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function updateDiagnostics(name,action,response,error,started){
  diagnostics.requestCount+=1;
  diagnostics.lastEndpoint=name||'';
  diagnostics.lastAction=action||'';
  diagnostics.lastAt=new Date().toISOString();
  diagnostics.lastDurationMs=Math.max(0,Math.round(performance.now()-started));
  diagnostics.lastError=error?String(error?.message||error):'';
  if(response){
    diagnostics.lastStatus=response.status;
    diagnostics.lastRequestId=response.headers.get('x-request-id')||'';
    diagnostics.lastBackendVersion=response.headers.get('x-cybertrmx-backend')||'';
  }else{
    diagnostics.lastStatus=null;
    diagnostics.lastRequestId='';
    diagnostics.lastBackendVersion='';
  }
  window.dispatchEvent(new CustomEvent('cybertrmx:diagnostics',{detail:{...diagnostics}}));
}

window.fetch=async function(input,init={}){
  const url=urlOf(input),name=functionName(url),method=String(init.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
  if(method!=='POST'||!name)return nativeFetch(input,init);
  const action=actionOf(init.body),started=performance.now();
  if(name==='cybertrmx-locations'){
    const response=jsonResponse({ok:true,locations:dashboardLocations,backend_version:'dashboard-inline-locations'});
    updateDiagnostics(name,action,response,null,started);
    return response;
  }
  if(name!=='cybertrmx-ops')return nativeFetch(input,init);

  const headers=cleanHeaders(init.headers||(typeof input!=='string'&&input?.headers),name);
  const request={...init,method:'POST',headers,mode:'cors',credentials:'omit',cache:'no-store'};
  let response;
  try{
    try{response=await nativeFetch(url,request)}
    catch(firstError){await new Promise(resolve=>setTimeout(resolve,350));response=await nativeFetch(url,request)}
    if(action==='dashboard'&&response.ok){
      try{const payload=await response.clone().json();dashboardLocations=Array.isArray(payload.locations)?payload.locations:[]}
      catch{dashboardLocations=[]}
    }
    updateDiagnostics(name,action,response,null,started);
    return response;
  }catch(error){
    updateDiagnostics(name,action,null,error,started);
    throw error;
  }
};

function installPatchFallback(){
  if(window.CYBERTRMX_PATCH?.open)return window.CYBERTRMX_PATCH;
  function build(){
    const main=document.querySelector('main');if(!main)return;
    document.querySelector('#view-patch')?.remove();
    const view=document.createElement('section');view.className='view';view.id='view-patch';
    view.innerHTML=`<div class="patch-page"><section class="patch-hero"><div><button class="patch-back" id="patch-back">← BACK TO WORKSPACE</button><small>CYBERTRMX / RELEASE NOTES</small><h2>PATCH<br>${VERSION}</h2><p>Production Guard keeps the verified interface locked, exposes request diagnostics, and provides a controlled clean reload.</p><div class="patch-version"><i></i> CURRENT BUILD / ${VERSION}</div></div></section><section class="patch-list"><article class="patch-entry"><time>05 AUG 2026<br>v${VERSION}</time><div><h3>Production Guard</h3><ul><li>Locked the verified frontend baseline and separated staging from production.</li><li>Added system diagnostics for version, cache, service worker, device identity, session, and backend requests.</li><li>Added a controlled clean reload without deleting account sessions.</li></ul></div></article></section></div>`;
    main.append(view);view.querySelector('#patch-back').onclick=()=>document.querySelector('.nav-item[data-tab="overview"]')?.click();
  }
  function open(){if(!document.querySelector('#view-patch'))build();document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id==='view-patch'));document.querySelectorAll('.nav-item').forEach(item=>item.classList.remove('active'));const title=document.querySelector('#title'),crumb=document.querySelector('#breadcrumb');if(title)title.textContent='Patch Notes';if(crumb)crumb.textContent='WORKSPACE / PATCH';window.scrollTo({top:0,behavior:'smooth'})}
  window.CYBERTRMX_PATCH={open,rebuild:build};return window.CYBERTRMX_PATCH;
}
function loadPatch(){
  if(window.CYBERTRMX_PATCH?.open)return Promise.resolve(window.CYBERTRMX_PATCH);
  if(patchLoading)return patchLoading;
  patchLoading=new Promise(resolve=>{
    document.querySelectorAll('script[data-module="patch-page"],#cybertrmx-patch-page').forEach(script=>script.remove());
    const script=document.createElement('script');script.id='cybertrmx-patch-page';script.src=`./patch-page.js?v=${VERSION}`;script.async=false;
    const finish=()=>setTimeout(()=>resolve(window.CYBERTRMX_PATCH?.open?window.CYBERTRMX_PATCH:installPatchFallback()),0);
    script.onload=finish;script.onerror=finish;document.head.append(script);
    setTimeout(finish,1800);
  }).finally(()=>{patchLoading=null});
  return patchLoading;
}
async function openPatch(event){
  event?.preventDefault();event?.stopImmediatePropagation();
  const patch=await loadPatch();patch.open();document.querySelector('.floating-nav')?.classList.remove('open');
}
document.addEventListener('click',event=>{if(event.target.closest?.('[data-go="patch"],[data-tab="patch"],#open-patch'))openPatch(event)},true);
document.addEventListener('pointerup',event=>{if(event.target.closest?.('[data-go="patch"],[data-tab="patch"],#open-patch'))openPatch(event)},true);
window.CYBERTRMX_RECOVERY_527={
  version:VERSION,
  openPatch,
  locations:()=>dashboardLocations.slice(),
  diagnostics:()=>({...diagnostics,locationCount:dashboardLocations.length})
};
})();