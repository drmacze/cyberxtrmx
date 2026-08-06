(()=>{
'use strict';
const CORE_V='5.3.5',CANDIDATE_V='5.3.6-rc1';
const STABILITY_536=location.pathname.includes('/staging/')||new URLSearchParams(location.search).get('stability536')==='1'||localStorage.getItem('cybertrmx-stability-536')==='1';
const addStyle=(href,id,version=CORE_V)=>{if(document.querySelector(`#${id}`))return;const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=`${href}?v=${version}`;document.head.append(link)};
const load=(src,id,version=CORE_V)=>new Promise((resolve,reject)=>{const existing=document.querySelector(`#${id}`);if(existing){if(existing.dataset.ready==='1'||existing.readyState==='complete')resolve();else{existing.addEventListener('load',()=>{existing.dataset.ready='1';resolve()},{once:true});existing.addEventListener('error',reject,{once:true})}return}const script=document.createElement('script');script.id=id;script.src=src.includes('://')?src:`${src}?v=${version}`;script.async=false;script.onload=()=>{script.dataset.ready='1';resolve()};script.onerror=reject;document.head.append(script)});
function enableQueueForLoad(){const current=new URL(location.href),had=current.searchParams.has('jobs_r3'),old=current.searchParams.get('jobs_r3');current.searchParams.set('jobs_r3','1');history.replaceState(history.state,'',current);return()=>{const restored=new URL(location.href);if(had)restored.searchParams.set('jobs_r3',old||'1');else restored.searchParams.delete('jobs_r3');history.replaceState(history.state,'',restored)}}
function installNativeQueueParser(){const bridge=window.CYBERTRMX_R3_TERMINAL_BRIDGE,original=window.execute;if(!bridge?.execute||typeof original!=='function'||original.__cybertrmxQueue535)return false;const wrapped=async raw=>{const cmd=String(raw||'').trim().split(/\s+/)[0]?.toLowerCase();if(cmd==='job'||cmd==='lookup')return bridge.execute(raw);return original(raw)};wrapped.__cybertrmxQueue535=true;wrapped.__cybertrmxOriginal=original;window.execute=wrapped;try{window.CYBERTRMX_PRODUCTION_EXECUTE=wrapped;(0,eval)('execute = window.CYBERTRMX_PRODUCTION_EXECUTE')}catch{}window.dispatchEvent(new CustomEvent('cybertrmx:queue-parser-ready',{detail:{version:CORE_V}}));return true}
async function boot(){
 addStyle('./cloud-core.css','cybertrmx-cloud-style');addStyle('./security-v52.css','cybertrmx-security-style');addStyle('./guard-v528.css','cybertrmx-guard-style');addStyle('./jobs-r2.css','cybertrmx-jobs-v53-style');if(STABILITY_536)addStyle('./stability-v536.css','cybertrmx-stability-v536-style',CANDIDATE_V);
 try{await load('./guard-v528.js','cybertrmx-guard-v528')}catch(error){console.error('CYBERTRMX Production Guard failed',error)}
 try{
  await load('./backend-config.js','cybertrmx-backend-config');
  if(!window.supabase)await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.54.0/dist/umd/supabase.min.js','cybertrmx-supabase-client');
  await load('./auth-redirect-fix.js','cybertrmx-auth-redirect-fix');await load('./security-utils.js','cybertrmx-security-utils');await load('./device-transport-v535.js','cybertrmx-device-transport-v535');
  if(STABILITY_536)await load('./stability-transport-v536.js','cybertrmx-stability-transport-v536',CANDIDATE_V);
  await load('./security-r3.js','cybertrmx-security-v53');
  const restoreUrl=enableQueueForLoad();try{await load('./jobs-r3.js','cybertrmx-jobs-v53')}finally{restoreUrl()}
  await load('./r3-terminal-bridge.js','cybertrmx-terminal-v53');await load('./queue-cleanup-v532.js','cybertrmx-queue-cleanup-v533');await load('./patch-hotfix-v535.js','cybertrmx-patch-hotfix-v535');
  if(STABILITY_536)await load('./patch-hotfix-v536.js','cybertrmx-patch-hotfix-v536',CANDIDATE_V);
  if(!installNativeQueueParser()){let attempts=0;const timer=setInterval(()=>{attempts++;if(installNativeQueueParser()||attempts>=80)clearInterval(timer)},50)}
  await load('./cloud-core.js','cybertrmx-cloud-core');
  if(STABILITY_536)await load('./stability-v536.js','cybertrmx-stability-v536',CANDIDATE_V);
 }catch(error){console.error('CYBERTRMX production backend bootstrap failed',error)}
}
boot();
})();