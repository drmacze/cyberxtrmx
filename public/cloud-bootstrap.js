(()=>{
const V='5.3.0-r2';
const addStyle=(href,id)=>{if(document.querySelector(`#${id}`))return;const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=`${href}?v=${V}`;document.head.append(link)};
const load=(src,id)=>new Promise((resolve,reject)=>{const existing=document.querySelector(`#${id}`);if(existing){if(existing.dataset.ready==='1')resolve();else existing.addEventListener('load',resolve,{once:true});return}const script=document.createElement('script');script.id=id;script.src=src.includes('://')?src:`${src}?v=${V}`;script.async=false;script.onload=()=>{script.dataset.ready='1';resolve()};script.onerror=reject;document.head.append(script)});
async function boot(){
 addStyle('./cloud-core.css','cybertrmx-cloud-style');
 addStyle('./security-v52.css','cybertrmx-security-style');
 addStyle('./guard-v528.css','cybertrmx-guard-style');
 addStyle('./jobs-r2.css','cybertrmx-jobs-r2-style');
 try{await load('./guard-v528.js','cybertrmx-guard-v528')}catch(error){console.error('CYBERTRMX Production Guard failed',error)}
 try{
  await load('./backend-config.js','cybertrmx-backend-config');
  if(!window.supabase)await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.54.0/dist/umd/supabase.min.js','cybertrmx-supabase-client');
  await load('./auth-redirect-fix.js','cybertrmx-auth-redirect-fix');
  await load('./security-utils.js','cybertrmx-security-utils');
  await load('./security-v52.js','cybertrmx-security-v52');
  await load('./cloud-core.js','cybertrmx-cloud-core');
 }catch(error){console.error('CYBERTRMX backend bootstrap failed',error);return}
 try{await load('./jobs-r2.js','cybertrmx-jobs-r2')}catch(error){console.error('CYBERTRMX staging jobs failed',error)}
}
boot();
})();
