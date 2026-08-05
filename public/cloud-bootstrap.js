(()=>{
const addStyle=(href,id)=>{if(document.querySelector(`#${id}`))return;const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;document.head.append(link)};
const load=(src,id)=>new Promise((resolve,reject)=>{const existing=document.querySelector(`#${id}`);if(existing){if(existing.dataset.ready==='1')resolve();else existing.addEventListener('load',resolve,{once:true});return}const script=document.createElement('script');script.id=id;script.src=src;script.async=false;script.onload=()=>{script.dataset.ready='1';resolve()};script.onerror=reject;document.head.append(script)});
async function boot(){
 addStyle('./cloud-core.css','cybertrmx-cloud-style');
 addStyle('./security-v52.css','cybertrmx-security-style');
 try{
  await load('./patch-click-v525.js?v=5.2.6','cybertrmx-patch-click-v525');
  await load('./backend-config.js','cybertrmx-backend-config');
  if(!window.supabase)await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.54.0/dist/umd/supabase.min.js','cybertrmx-supabase-client');
  await load('./auth-redirect-fix.js','cybertrmx-auth-redirect-fix');
  await load('./security-utils.js','cybertrmx-security-utils');
  await load('./transport-v523.js?v=5.2.6','cybertrmx-transport-v523');
  await load('./security-v52.js','cybertrmx-security-v52');
  await load('./cloud-core.js','cybertrmx-cloud-core');
 }catch(error){console.error('CYBERTRMX backend bootstrap failed',error)}
}
boot();
})();