(()=>{
'use strict';
const ACTIVE=location.pathname.includes('/staging/')||new URLSearchParams(location.search).get('stability536')==='1'||localStorage.getItem('cybertrmx-stability-536')==='1';
if(!ACTIVE)return;
function apply(){
 const view=document.querySelector('#view-patch');if(!view)return false;
 const title=view.querySelector('.patch-hero h2');if(title)title.innerHTML='PATCH<br>5.3.6-rc1';
 const version=view.querySelector('.patch-version');if(version)version.innerHTML='<i></i> CANDIDATE BUILD / 5.3.6-rc1 / OPT-IN';
 const paragraph=view.querySelector('.patch-hero p');if(paragraph)paragraph.textContent='Read-only backend health checks, duplicate request coalescing, request IDs, and a reversible historical job filter are being tested without changing the stable 5.3.5 default.';
 const list=view.querySelector('.patch-list');
 if(list&&!list.querySelector('[data-release="5.3.6-rc1"]')){const article=document.createElement('article');article.className='patch-entry';article.dataset.release='5.3.6-rc1';article.innerHTML='<time>07 AUG 2026<br>v5.3.6-rc1</time><div><h3>Stability and health diagnostics candidate</h3><ul><li>Added authenticated health checks for Operations, Jobs, and Locations plus a transport check for permission-based Check-In.</li><li>Added latency, backend status, and request ID reporting with a copyable health report.</li><li>Coalesced identical read-only dashboard requests while preserving all writes and queue actions.</li><li>Moved old failed, cancelled, timeout, and dead-letter jobs out of the default queue view without deleting database or audit history.</li><li>Added health, health copy, and health disable terminal commands.</li><li>The candidate is opt-in and can be exited without clearing the account session or device identity.</li></ul></div>';list.prepend(article)}
 return true;
}
function install(){const api=window.CYBERTRMX_PATCH;if(api?.open&&!api.open.__v536){const original=api.open.bind(api);const wrapped=()=>{original();setTimeout(apply,0)};wrapped.__v536=true;api.open=wrapped}apply()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>=80)clearInterval(timer)},100);
})();
