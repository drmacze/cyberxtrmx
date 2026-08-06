(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const STABILITY_ACTIVE=location.pathname.includes('/staging/')||params.get('stability536')==='1'||localStorage.getItem('cybertrmx-stability-536')==='1';
const TRACE_ACTIVE=params.get('trace540')==='1'||localStorage.getItem('cybertrmx-trace-540')==='1';
const releases={
 stable:{version:'5.3.5',date:'07 AUG 2026',title:'Device identity transport recovery',items:['Attached the stored browser device UUID to every Operations, Jobs, and Locations request.','Preserved device label, platform, browser, client version, and idempotency metadata through the backend gateway.','Added a stable authenticated fallback when the browser cannot supply its stored device ID.']},
 stability:{version:'5.3.6-rc1',date:'07 AUG 2026',title:'Stability and health diagnostics candidate',items:['Added authenticated health checks for Operations, Jobs, Locations, and the Check-In transport.','Added latency, backend status, request IDs, and a copyable health report.','Coalesced identical read-only dashboard requests without changing writes or queue actions.','Moved historical failed jobs out of the default queue view without deleting audit history.']},
 trace:{version:'5.4.0-rc3',date:'07 AUG 2026',title:'Deterministic Web Trace workspace recovery',items:['Moved Website Intelligence to the dedicated cybertrmx-trace-web-v2 backend.','Replaced the failing PostgREST maybeSingle workspace lookup with resolve_trace_workspace(), bound to auth.uid().','The browser cannot provide or select another user ID for workspace resolution.','Web Trace remains limited to authorized public DNS, RDAP, redirect, HTTP status, and security-header metadata.','Response bodies, port scanning, exploitation, localhost, private addresses, and reserved targets are not collected or accepted.','Added a narrow frontend router that redirects only web_scan; Operations, Jobs, Number Intelligence, Maps, and Asset Watch are not rewritten.','Raised the PWA cache to v55 so Safari loads the rc3 router and bootstrap.']}
};
function articleMarkup(release){return `<time>${release.date}<br>v${release.version}</time><div><h3>${release.title}</h3><ul>${release.items.map(item=>`<li>${item}</li>`).join('')}</ul></div>`}
function ensureRelease(list,release){let article=list.querySelector(`[data-release="${release.version}"]`);if(!article){article=document.createElement('article');article.className='patch-entry';article.dataset.release=release.version;article.innerHTML=articleMarkup(release);list.prepend(article)}return article}
function currentRelease(){if(TRACE_ACTIVE)return releases.trace;if(STABILITY_ACTIVE)return releases.stability;return releases.stable}
function apply(){
 const view=document.querySelector('#view-patch');if(!view)return false;
 const list=view.querySelector('.patch-list');
 if(list){ensureRelease(list,releases.stable);if(STABILITY_ACTIVE)ensureRelease(list,releases.stability);if(TRACE_ACTIVE)ensureRelease(list,releases.trace)}
 const current=currentRelease();
 if(view.dataset.patchOwner!==current.version){
  view.dataset.patchOwner=current.version;
  const title=view.querySelector('.patch-hero h2'),version=view.querySelector('.patch-version'),paragraph=view.querySelector('.patch-hero p');
  if(current===releases.trace){
   if(title)title.innerHTML='PATCH<br>5.4.0-rc3';
   if(version)version.innerHTML='<i></i> CURRENT CANDIDATE / 5.4.0-rc3 / TRACE WORKSPACE RECOVERY';
   if(paragraph)paragraph.textContent='Website Intelligence now uses a dedicated backend with deterministic workspace resolution from the authenticated session, while the default 5.3.5 runtime remains unchanged.';
  }else if(current===releases.stability){
   if(title)title.innerHTML='PATCH<br>5.3.6-rc1';
   if(version)version.innerHTML='<i></i> CANDIDATE BUILD / 5.3.6-rc1 / OPT-IN';
   if(paragraph)paragraph.textContent='Read-only backend health checks, duplicate request coalescing, request IDs, and a reversible historical job filter are being tested without changing the stable 5.3.5 default.';
  }else{
   if(title)title.innerHTML='PATCH<br>5.3.5';
   if(version)version.innerHTML='<i></i> CURRENT BUILD / 5.3.5 / CACHE 55 / DEVICE TRANSPORT';
   if(paragraph)paragraph.textContent='Stable device identity is attached to every Operations, Jobs, and Locations request before it reaches the backend gateway.';
  }
 }
 return true;
}
function install(){
 const api=window.CYBERTRMX_PATCH;if(!api?.open)return false;
 if(!api.open.__cybertrmxPatchCoordinator){const original=api.open.bind(api),wrapped=(...args)=>{const result=original(...args);queueMicrotask(apply);return result};wrapped.__cybertrmxPatchCoordinator=true;wrapped.__cybertrmxOriginal=original;api.open=wrapped}
 apply();window.CYBERTRMX_PATCH_COORDINATOR={version:'5.4.0-rc3',apply,current:currentRelease().version};return true;
}
let attempts=0;function waitForPatch(){attempts++;if(install()||attempts>=80)return;setTimeout(waitForPatch,100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForPatch,{once:true});else waitForPatch();
})();