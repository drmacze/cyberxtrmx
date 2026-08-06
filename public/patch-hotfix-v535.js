(()=>{
'use strict';
function apply(){
  const view=document.querySelector('#view-patch');
  if(!view)return false;
  const title=view.querySelector('.patch-hero h2');
  if(title)title.innerHTML='PATCH<br>5.3.5';
  const version=view.querySelector('.patch-version');
  if(version)version.innerHTML='<i></i> CURRENT BUILD / 5.3.5 / CACHE 53 / DEVICE TRANSPORT';
  const paragraph=view.querySelector('.patch-hero p');
  if(paragraph)paragraph.textContent='Stable device identity is now attached to every Operations, Jobs, and Locations request before it reaches the backend gateway.';
  const list=view.querySelector('.patch-list');
  if(list&&!list.querySelector('[data-release="5.3.5"]')){
    const article=document.createElement('article');article.className='patch-entry';article.dataset.release='5.3.5';
    article.innerHTML='<time>07 AUG 2026<br>v5.3.5</time><div><h3>Device identity transport recovery</h3><ul><li>Added the stored browser device UUID to every Supabase Edge Function request through global client headers.</li><li>Operations Gateway now preserves the supplied ID and generates a stable authenticated fallback only when a browser cannot provide one.</li><li>Forwarded device label, platform, browser, client version, and idempotency metadata through the gateway.</li><li>Cut production cache 53 so iPhone Safari cannot retain the 5.3.4 client without device headers.</li></ul></div>';
    list.prepend(article);
  }
  return true;
}
function install(){
  const api=window.CYBERTRMX_PATCH;
  if(api?.open&&!api.open.__v535){const original=api.open.bind(api);const wrapped=()=>{original();setTimeout(apply,0)};wrapped.__v535=true;api.open=wrapped}
  apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>=80)clearInterval(timer)},100);
})();