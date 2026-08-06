(()=>{
'use strict';
const V='5.3.3';
const addStyle=(href,id)=>{if(document.querySelector(`#${id}`))return;const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=`${href}?v=${V}`;document.head.append(link)};
const load=(src,id)=>new Promise((resolve,reject)=>{const existing=document.querySelector(`#${id}`);if(existing){if(existing.dataset.ready==='1'||existing.readyState==='complete')resolve();else{existing.addEventListener('load',()=>{existing.dataset.ready='1';resolve()},{once:true});existing.addEventListener('error',reject,{once:true})}return}const script=document.createElement('script');script.id=id;script.src=src.includes('://')?src:`${src}?v=${V}`;script.async=false;script.onload=()=>{script.dataset.ready='1';resolve()};script.onerror=reject;document.head.append(script)});
function enableQueueForLoad(){
 const current=new URL(location.href),had=current.searchParams.has('jobs_r3'),old=current.searchParams.get('jobs_r3');
 current.searchParams.set('jobs_r3','1');history.replaceState(history.state,'',current);
 return()=>{const restored=new URL(location.href);if(had)restored.searchParams.set('jobs_r3',old||'1');else restored.searchParams.delete('jobs_r3');history.replaceState(history.state,'',restored)};
}
function installNativeQueueParser(){
 const bridge=window.CYBERTRMX_R3_TERMINAL_BRIDGE;
 const original=window.execute;
 if(!bridge?.execute||typeof original!=='function'||original.__cybertrmxQueue533)return false;
 const wrapped=async raw=>{
  const cmd=String(raw||'').trim().split(/\s+/)[0]?.toLowerCase();
  if(cmd==='job'||cmd==='lookup')return bridge.execute(raw);
  return original(raw);
 };
 wrapped.__cybertrmxQueue533=true;
 wrapped.__cybertrmxOriginal=original;
 window.execute=wrapped;
 try{window.CYBERTRMX_PRODUCTION_EXECUTE=wrapped;(0,eval)('execute = window.CYBERTRMX_PRODUCTION_EXECUTE')}catch{}
 window.dispatchEvent(new CustomEvent('cybertrmx:queue-parser-ready',{detail:{version:V}}));
 return true;
}
async function boot(){
 addStyle('./cloud-core.css','cybertrmx-cloud-style');
 addStyle('./security-v52.css','cybertrmx-security-style');
 addStyle('./guard-v528.css','cybertrmx-guard-style');
 addStyle('./jobs-r2.css','cybertrmx-jobs-v53-style');
 try{await load('./guard-v528.js','cybertrmx-guard-v528')}catch(error){console.error('CYBERTRMX Production Guard failed',error)}
 try{
  await load('./backend-config.js','cybertrmx-backend-config');
  if(!window.supabase)await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.54.0/dist/umd/supabase.min.js','cybertrmx-supabase-client');
  await load('./auth-redirect-fix.js','cybertrmx-auth-redirect-fix');
  await load('./security-utils.js','cybertrmx-security-utils');
  await load('./security-r3.js','cybertrmx-security-v53');
  const restoreUrl=enableQueueForLoad();
  try{await load('./jobs-r3.js','cybertrmx-jobs-v53')}finally{restoreUrl()}
  await load('./r3-terminal-bridge.js','cybertrmx-terminal-v53');
  await load('./queue-cleanup-v532.js','cybertrmx-queue-cleanup-v533');
  if(!installNativeQueueParser()){
   let attempts=0;const timer=setInterval(()=>{attempts++;if(installNativeQueueParser()||attempts>=80)clearInterval(timer)},50);
  }
  await load('./cloud-core.js','cybertrmx-cloud-core');
 }catch(error){console.error('CYBERTRMX production backend bootstrap failed',error)}
}
boot();
})();
