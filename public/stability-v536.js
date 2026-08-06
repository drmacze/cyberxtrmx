(()=>{
'use strict';
const VERSION='5.3.6-rc1';
const ACTIVE=location.pathname.includes('/staging/')||new URLSearchParams(location.search).get('stability536')==='1'||localStorage.getItem('cybertrmx-stability-536')==='1';
if(!ACTIVE)return;
try{localStorage.setItem('cybertrmx-stability-536','1')}catch{}
const CONFIG=window.CYBERTRMX_BACKEND||{};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const safe=(value,max=220)=>String(value??'').replace(/[<>]/g,'').trim().slice(0,max);
const services=[['operations','Operations',CONFIG.operationsFunction,'dashboard'],['jobs','Jobs',CONFIG.jobsFunction,'queue_status'],['locations','Locations',CONFIG.locationsFunction,''],['checkin','Check-In',CONFIG.checkinFunction,'transport']];
const state={results:{},running:false,lastRun:'',showHistory:false,hiddenHistory:0,lastDiagnostic:null};
let queueObserver=null,queueFrame=0,terminalInstalled=false;
function client(){return window.CYBERTRMX_SECURE_CLIENT||null}
function deviceHeaders(){const security=window.CYBERTRMX_SECURITY,meta=security?.deviceMeta?.()||{};return{'x-device-id':security?.getDeviceId?.()||localStorage.getItem('cybertrmx-device-id-v1')||'','x-device-label':meta.label||'Device / Browser','x-device-platform':meta.platform||'Device','x-device-browser':meta.browser||'Browser','x-client-version':VERSION}}
async function session(){const result=await client()?.auth?.getSession?.();return result?.data?.session||null}
async function request(service,transportOnly=false){
 const [key,label,functionName,action]=service,url=`${CONFIG.url}/functions/v1/${functionName}`,started=performance.now();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  if(!functionName)throw new Error('FUNCTION_NOT_CONFIGURED');
  if(transportOnly||action==='transport'){
   const response=await fetch(url,{method:'OPTIONS',headers:{apikey:CONFIG.publishableKey},cache:'no-store',signal:controller.signal});
   return{key,label,ok:response.ok,status:response.status,latency:Math.round(performance.now()-started),requestId:response.headers.get('x-request-id')||'',mode:'transport'};
  }
  const active=await session();if(!active?.access_token)throw new Error('AUTH_REQUIRED');
  const body=action?{action}:{};
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',apikey:CONFIG.publishableKey,Authorization:`Bearer ${active.access_token}`,...deviceHeaders()},body:JSON.stringify(body),cache:'no-store',signal:controller.signal});
  const payload=await response.json().catch(()=>({}));
  return{key,label,ok:response.ok&&!payload?.error,status:response.status,latency:Math.round(performance.now()-started),requestId:payload?.request_id||response.headers.get('x-request-id')||'',backend:payload?.backend_version||response.headers.get('x-cybertrmx-backend')||'',error:payload?.error||'',mode:'authenticated'};
 }catch(error){return{key,label,ok:false,status:0,latency:Math.round(performance.now()-started),requestId:error?.requestId||'',error:error?.name==='AbortError'?'TIMEOUT':String(error?.message||error),mode:transportOnly?'transport':'authenticated'}}finally{clearTimeout(timer)}
}
async function runChecks(){
 if(state.running)return state.results;state.running=true;render();
 const active=await session();
 const tasks=services.map(service=>request(service,!active||service[3]==='transport'));
 const results=await Promise.all(tasks);state.results=Object.fromEntries(results.map(item=>[item.key,item]));state.running=false;state.lastRun=new Date().toISOString();render();return state.results;
}
function overall(){const values=Object.values(state.results);if(!values.length)return'NOT CHECKED';const failed=values.filter(item=>!item.ok).length;return failed===0?'HEALTHY':failed===values.length?'OFFLINE':'DEGRADED'}
function report(){const lines=[`CYBERTRMX HEALTH ${VERSION}`,`STATUS ${overall()}`,`TIME ${state.lastRun||new Date().toISOString()}`];for(const [,label] of services){const result=Object.values(state.results).find(item=>item.label===label);lines.push(`${label.toUpperCase()} ${result?.ok?'ONLINE':'ERROR'} ${result?.status||0} ${result?.latency||0}ms${result?.requestId?` request=${result.requestId}`:''}${result?.error?` ${result.error}`:''}`)}const transport=window.CYBERTRMX_STABILITY_TRANSPORT?.stats;if(transport)lines.push(`DEDUPE coalesced=${transport.coalesced} completed=${transport.completed} last=${transport.lastDurationMs}ms`);return lines.join('\n')}
async function copyReport(){try{await navigator.clipboard.writeText(report());window.toast?.('Health report copied')}catch{window.toast?.('Copy failed')}}
function disableCandidate(){try{localStorage.removeItem('cybertrmx-stability-536')}catch{}const url=new URL(location.href);url.searchParams.delete('stability536');url.searchParams.set('v','5.3.5');location.replace(url)}
function mount(){
 if($('#ops-health-v536'))return true;const reference=$('#ops-r3-queue-card')||$('#ops-auth-card');if(!reference)return false;
 const card=document.createElement('article');card.id='ops-health-v536';card.className='ops-card wide ops-private-card health-v536';card.innerHTML=`<div class="ops-card-head"><div><small>STABILITY CANDIDATE / ${VERSION}</small><h3>Backend health</h3></div><span id="health-v536-overall">NOT CHECKED</span></div><div class="health-v536-grid" id="health-v536-grid"></div><div class="health-v536-actions"><button class="ops-button" id="health-v536-run">RUN CHECKS</button><button class="ops-button secondary" id="health-v536-copy">COPY REPORT</button><button class="ops-button secondary" id="health-v536-history">SHOW HISTORY</button><button class="ops-button secondary" id="health-v536-exit">EXIT CANDIDATE</button></div><p class="health-v536-note">Checks are read-only. Historical failed jobs stay in audit and can be shown when needed.</p>`;
 reference.insertAdjacentElement('afterend',card);$('#health-v536-run').onclick=runChecks;$('#health-v536-copy').onclick=copyReport;$('#health-v536-history').onclick=()=>{state.showHistory=!state.showHistory;applyHistoryFilter();render()};$('#health-v536-exit').onclick=disableCandidate;render();return true;
}
function render(){if(!mount())return;const overallEl=$('#health-v536-overall');if(overallEl){overallEl.textContent=state.running?'CHECKING':overall();overallEl.dataset.state=overall().toLowerCase()}const grid=$('#health-v536-grid');if(grid)grid.innerHTML=services.map(([key,label])=>{const item=state.results[key];return`<div class="health-v536-row" data-state="${item?.ok?'online':item?'error':'idle'}"><div><strong>${label}</strong><small>${item?.mode==='transport'?'TRANSPORT':'AUTHENTICATED DATA'}</small></div><span>${item?`${item.ok?'ONLINE':'ERROR'} · ${item.status||0} · ${item.latency}ms`:'WAITING'}</span>${item?.requestId?`<code>${safe(item.requestId,80)}</code>`:''}${item?.error?`<em>${safe(item.error,120)}</em>`:''}</div>`}).join('');const history=$('#health-v536-history');if(history)history.textContent=state.showHistory?'HIDE HISTORY':`SHOW HISTORY${state.hiddenHistory?` (${state.hiddenHistory})`:''}`}
function historical(row){if(!['failed','cancelled','timed_out','dead_letter'].includes(row.dataset.state||''))return false;const text=row.textContent||'';const days=Number(text.match(/(\d+)d ago/)?.[1]||0),hours=Number(text.match(/(\d+)h ago/)?.[1]||0);return days>0||hours>=1}
function applyHistoryFilter(){const list=$('#r3-queue-list');if(!list)return;let hidden=0;$$('.r2-queue-row',list).forEach(row=>{const hide=!state.showHistory&&historical(row);row.hidden=hide;if(hide)hidden++});state.hiddenHistory=hidden;const history=$('#health-v536-history');if(history)history.textContent=state.showHistory?'HIDE HISTORY':`SHOW HISTORY${hidden?` (${hidden})`:''}`}
function observeQueue(){const list=$('#r3-queue-list');if(!list||queueObserver)return Boolean(list);queueObserver=new MutationObserver(()=>{cancelAnimationFrame(queueFrame);queueFrame=requestAnimationFrame(applyHistoryFilter)});queueObserver.observe(list,{childList:true,subtree:true});applyHistoryFilter();return true}
function terminalLine(text,type=''){const output=$('#terminal-output');if(!output)return;const row=document.createElement('div');row.className=`line ${type}`;row.textContent=text;output.append(row);output.scrollTop=output.scrollHeight}
function installTerminal(){if(terminalInstalled||typeof window.execute!=='function')return false;const original=window.execute;const wrapped=async raw=>{const value=String(raw||'').trim().toLowerCase();if(value==='health'){terminalLine('running backend health checks…','dim');await runChecks();report().split('\n').forEach(line=>terminalLine(line,line.includes(' ERROR ')?'warn':'block'));return}if(value==='health copy'){await copyReport();terminalLine('health report copied','ok');return}if(value==='health disable'){terminalLine('leaving stability candidate…','dim');disableCandidate();return}return original(raw)};wrapped.__cybertrmxHealth536=true;wrapped.__cybertrmxOriginal=original;window.execute=wrapped;try{window.CYBERTRMX_HEALTH_EXECUTE=wrapped;(0,eval)('execute = window.CYBERTRMX_HEALTH_EXECUTE')}catch{}terminalInstalled=true;return true}
window.addEventListener('cybertrmx:diagnostics',event=>{state.lastDiagnostic=event.detail||null});
function boot(){mount();observeQueue();installTerminal();let attempts=0;const timer=setInterval(()=>{attempts++;mount();observeQueue();installTerminal();if((mount()&&observeQueue()&&terminalInstalled)||attempts>=120)clearInterval(timer)},100);window.CYBERTRMX_STABILITY_536={version:VERSION,runChecks,report,copyReport,disable:disableCandidate,state}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
