(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const STABILITY_ACTIVE=location.pathname.includes('/staging/')||params.get('stability536')==='1'||localStorage.getItem('cybertrmx-stability-536')==='1';
const TRACE_ACTIVE=params.get('trace540')==='1'||localStorage.getItem('cybertrmx-trace-540')==='1';
const releases={
 stable:{version:'5.3.5',date:'07 AUG 2026',title:'Device identity transport recovery',items:['Attached the stored browser device UUID to every Operations, Jobs, and Locations request.','Preserved device label, platform, browser, client version, and idempotency metadata through the backend gateway.','Added a stable authenticated fallback when the browser cannot supply its stored device ID.']},
 stability:{version:'5.3.6-rc1',date:'07 AUG 2026',title:'Stability and health diagnostics candidate',items:['Added authenticated health checks for Operations, Jobs, Locations, and the Check-In transport.','Added latency, backend status, request IDs, and a copyable health report.','Coalesced identical read-only dashboard requests without changing writes or queue actions.','Moved historical failed jobs out of the default queue view without deleting audit history.']},
 trace:{version:'5.4.0-rc2',date:'07 AUG 2026',title:'Trace Intelligence and Patch render arbitration',items:['Added authorized Web Trace, Number Intelligence, consented maps, Check-In 2.0, Asset Watch, snapshot comparison, and sealed evidence.','Web collection remains limited to public metadata and rejects localhost, private networks, reserved targets, protocol abuse, and redirects into protected address space.','Number Intelligence remains numbering-plan metadata only; it does not expose subscriber identity or live phone location, and raw numbers are not stored.','Replaced competing Patch hotfix writers with one deterministic coordinator. The highest active candidate owns the hero while earlier versions remain visible in release history.','Removed repeated 100 ms Patch DOM rewrites that caused Safari text blinking and random version switching.','Made Patch rendering idempotent and limited startup discovery to a bounded wait that stops as soon as the Patch API is ready.']}
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
  const title=view.querySelector('.patch-hero h2');
  const version=view.querySelector('.patch-version');
  const paragraph=view.querySelector('.patch-hero p');
  if(current===releases.trace){
   if(title)title.innerHTML='PATCH<br>5.4.0-rc2';
   if(version)version.innerHTML='<i></i> CURRENT CANDIDATE / 5.4.0-rc2 / TRACE INTELLIGENCE';
   if(paragraph)paragraph.textContent='A major authorized-intelligence release with deterministic Patch rendering, Web Trace, Number Intelligence, consented maps, Asset Watch, change detection, and sealed evidence.';
  }else if(current===releases.stability){
   if(title)title.innerHTML='PATCH<br>5.3.6-rc1';
   if(version)version.innerHTML='<i></i> CANDIDATE BUILD / 5.3.6-rc1 / OPT-IN';
   if(paragraph)paragraph.textContent='Read-only backend health checks, duplicate request coalescing, request IDs, and a reversible historical job filter are being tested without changing the stable 5.3.5 default.';
  }else{
   if(title)title.innerHTML='PATCH<br>5.3.5';
   if(version)version.innerHTML='<i></i> CURRENT BUILD / 5.3.5 / CACHE 54 / DEVICE TRANSPORT';
   if(paragraph)paragraph.textContent='Stable device identity is attached to every Operations, Jobs, and Locations request before it reaches the backend gateway.';
  }
 }
 return true;
}
function install(){
 const api=window.CYBERTRMX_PATCH;
 if(!api?.open)return false;
 if(!api.open.__cybertrmxPatchCoordinator){
  const original=api.open.bind(api);
  const wrapped=(...args)=>{const result=original(...args);queueMicrotask(apply);return result};
  wrapped.__cybertrmxPatchCoordinator=true;
  wrapped.__cybertrmxOriginal=original;
  api.open=wrapped;
 }
 apply();
 window.CYBERTRMX_PATCH_COORDINATOR={version:'5.4.0-rc2',apply,current:currentRelease().version};
 return true;
}
let attempts=0;
function waitForPatch(){attempts++;if(install()||attempts>=80)return;setTimeout(waitForPatch,100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForPatch,{once:true});else waitForPatch();
})();