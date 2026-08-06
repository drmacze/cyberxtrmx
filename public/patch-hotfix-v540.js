(()=>{
'use strict';
const ACTIVE=new URLSearchParams(location.search).get('trace540')==='1'||localStorage.getItem('cybertrmx-trace-540')==='1';
if(!ACTIVE)return;
function apply(){
 const view=document.querySelector('#view-patch');if(!view)return false;
 const title=view.querySelector('.patch-hero h2');if(title)title.innerHTML='PATCH<br>5.4.0-rc1';
 const version=view.querySelector('.patch-version');if(version)version.innerHTML='<i></i> CURRENT CANDIDATE / 5.4.0-rc1 / TRACE INTELLIGENCE';
 const paragraph=view.querySelector('.patch-hero p');if(paragraph)paragraph.textContent='A major authorized-intelligence release combining Web Trace, Number Intelligence, consented maps, Asset Watch, change detection, and sealed evidence.';
 const list=view.querySelector('.patch-list');
 if(list&&!list.querySelector('[data-release="5.4.0-rc1"]')){
  const article=document.createElement('article');article.className='patch-entry';article.dataset.release='5.4.0-rc1';
  article.innerHTML='<time>07 AUG 2026<br>v5.4.0-rc1</time><div><h3>Trace Intelligence major candidate</h3><ul><li>Added Web Trace for authorized public domains and URLs: DNS, DNSSEC indicators, RDAP, HTTP redirects, security headers, certificate-transparency history, tracker detection, technology hints, risk scoring, and SHA-256 evidence.</li><li>Added strict SSRF controls. Localhost, private networks, reserved addresses, internal hostnames, protocol abuse, and redirects into protected address space are rejected before collection.</li><li>Added Number Intelligence using international numbering-plan metadata: E.164 normalization, country, calling code, validity, possibility, and number type. It does not expose subscriber identity, account data, or live phone location.</li><li>Phone scan storage is privacy-reduced: the database keeps a target hash and masked display value rather than the raw number.</li><li>Added Maps & Check-In 2.0 with explicit consent, expiring links, optional interactive map preview, accuracy circle, and Apple Maps, Google Maps, and OpenStreetMap actions.</li><li>Added Asset Watch, repeat scans, snapshot comparison, risk changes, workspace isolation, request IDs, rate limits, audit records, and sealed evidence.</li><li>Added Trace Lab terminal commands while keeping web and phone execution behind visible authorization and lawful-purpose confirmations.</li></ul></div>';
  list.prepend(article);
 }
 return true;
}
function install(){const api=window.CYBERTRMX_PATCH;if(api?.open&&!api.open.__v540){const original=api.open.bind(api);const wrapped=()=>{original();setTimeout(apply,0)};wrapped.__v540=true;api.open=wrapped}apply()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>=80)clearInterval(timer)},100);
})();