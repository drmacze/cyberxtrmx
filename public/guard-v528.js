(()=>{
'use strict';
const VERSION='5.2.8';
const CACHE_PREFIX='cybertrmx-';
const errors=[];
const $=(selector,root=document)=>root.querySelector(selector);
const safe=(value,max=240)=>String(value??'').replace(/[<>]/g,'').trim().slice(0,max);
const notify=message=>window.toast?window.toast(message):console.log(message);
let latest=null;
let mounting=false;

window.addEventListener('error',event=>{errors.unshift({type:'error',message:safe(event.message||event.error?.message||'Page error'),time:new Date().toISOString()});errors.splice(8)});
window.addEventListener('unhandledrejection',event=>{errors.unshift({type:'promise',message:safe(event.reason?.message||event.reason||'Unhandled promise rejection'),time:new Date().toISOString()});errors.splice(8)});

function environment(){return location.pathname.includes('/staging/')?'STAGING':'PRODUCTION'}
function readDeviceId(){try{return localStorage.getItem('cybertrmx-device-id-v1')||''}catch{return''}}
async function serviceWorkerInfo(){
  if(!('serviceWorker'in navigator))return{supported:false,controlled:false,registrations:0,scope:''};
  const registrations=await navigator.serviceWorker.getRegistrations().catch(()=>[]);
  return{supported:true,controlled:Boolean(navigator.serviceWorker.controller),registrations:registrations.length,scope:navigator.serviceWorker.controller?.scriptURL||registrations[0]?.scope||''};
}
async function cacheInfo(){
  if(!('caches'in window))return[];
  return(await caches.keys().catch(()=>[])).filter(key=>key.startsWith(CACHE_PREFIX));
}
async function sessionInfo(){
  const client=window.CYBERTRMX_SECURE_CLIENT;
  if(!client?.auth?.getSession)return{connected:false,expiresAt:null};
  try{const result=await client.auth.getSession();return{connected:Boolean(result.data?.session),expiresAt:result.data?.session?.expires_at||null}}
  catch{return{connected:false,expiresAt:null}}
}
async function collect(){
  const [worker,cachesList,session]=await Promise.all([serviceWorkerInfo(),cacheInfo(),sessionInfo()]);
  const request=window.CYBERTRMX_RECOVERY_527?.diagnostics?.()||{};
  latest={
    generatedAt:new Date().toISOString(),
    frontendVersion:VERSION,
    environment:environment(),
    online:navigator.onLine,
    path:location.pathname,
    viewport:`${window.innerWidth}×${window.innerHeight}`,
    deviceId:readDeviceId(),
    worker,
    caches:cachesList,
    session,
    request,
    errors:[...errors]
  };
  return latest;
}
function row(label,value,state=''){
  return`<div class="guard-row"><span>${label}</span><strong class="${state}">${safe(value||'—',300)}</strong></div>`;
}
function formatTime(value){return value?new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'medium'}):'—'}
function render(data){
  const body=$('#guard-details');if(!body||!data)return;
  const request=data.request||{},worker=data.worker||{};
  body.innerHTML=`<div class="guard-grid">
    <section><small>BUILD</small>${row('Frontend',data.frontendVersion)}${row('Environment',data.environment,data.environment==='PRODUCTION'?'ok':'warn')}${row('Viewport',data.viewport)}${row('Online',data.online?'YES':'NO',data.online?'ok':'bad')}</section>
    <section><small>APPLICATION CACHE</small>${row('Service worker',worker.controlled?'CONTROLLED':'NOT CONTROLLED',worker.controlled?'ok':'warn')}${row('Registrations',String(worker.registrations??0))}${row('Caches',data.caches.join(', ')||'NONE')}</section>
    <section><small>ACCOUNT CONTEXT</small>${row('Session',data.session.connected?'CONNECTED':'SIGNED OUT',data.session.connected?'ok':'warn')}${row('Device ID',data.deviceId?`${data.deviceId.slice(0,8)}…${data.deviceId.slice(-4)}`:'MISSING',data.deviceId?'ok':'bad')}${row('Session expiry',data.session.expiresAt?formatTime(data.session.expiresAt*1000):'—')}</section>
    <section><small>LAST BACKEND REQUEST</small>${row('Endpoint',request.lastEndpoint||'NONE')}${row('Action',request.lastAction||'NONE')}${row('HTTP status',request.lastStatus==null?'—':String(request.lastStatus),request.lastStatus>=200&&request.lastStatus<300?'ok':request.lastStatus?'bad':'')}${row('Request ID',request.lastRequestId||'—')}${row('Backend',request.lastBackendVersion||'—')}${row('Duration',request.lastDurationMs?`${request.lastDurationMs} ms`:'—')}${row('Last error',request.lastError||'NONE',request.lastError?'bad':'ok')}</section>
  </div><section class="guard-errors"><small>PAGE ERRORS</small>${data.errors.length?data.errors.map(item=>`<div><strong>${safe(item.type).toUpperCase()}</strong><span>${safe(item.message)}</span><time>${formatTime(item.time)}</time></div>`).join(''):'<p>No page errors recorded in this session.</p>'}</section>`;
  $('#guard-updated').textContent=`UPDATED ${new Date(data.generatedAt).toLocaleTimeString('en-GB',{hour12:false})}`;
}
async function refresh(){render(await collect());return latest}
function reportText(data){
  const request=data.request||{},worker=data.worker||{};
  return[
    'CYBERTRMX PRODUCTION GUARD',
    `Generated: ${data.generatedAt}`,
    `Frontend: ${data.frontendVersion}`,
    `Environment: ${data.environment}`,
    `Path: ${data.path}`,
    `Viewport: ${data.viewport}`,
    `Online: ${data.online}`,
    `Service worker controlled: ${worker.controlled}`,
    `Service worker registrations: ${worker.registrations}`,
    `Caches: ${data.caches.join(', ')||'NONE'}`,
    `Session connected: ${data.session.connected}`,
    `Device ID: ${data.deviceId||'MISSING'}`,
    `Last endpoint: ${request.lastEndpoint||'NONE'}`,
    `Last action: ${request.lastAction||'NONE'}`,
    `Last status: ${request.lastStatus??'NONE'}`,
    `Request ID: ${request.lastRequestId||'NONE'}`,
    `Backend version: ${request.lastBackendVersion||'NONE'}`,
    `Last error: ${request.lastError||'NONE'}`,
    `Page errors: ${data.errors.map(item=>item.message).join(' | ')||'NONE'}`
  ].join('\n');
}
async function copyReport(){const data=latest||await collect(),text=reportText(data);try{await navigator.clipboard.writeText(text);notify('Diagnostic report copied')}catch{window.prompt('Copy diagnostic report',text)}}
async function cleanReload(){
  if(!confirm('Replace the application cache and reload the current build? Your account session will stay signed in.'))return;
  location.href=`./recover.html?v=${VERSION}&return=${encodeURIComponent(location.pathname.includes('/staging/')?'staging/':'')}`;
}
function openStaging(){location.href=`https://drmacze.github.io/cyberxtrmx/staging/?v=${VERSION}`}
function toggle(open=true){const details=$('#guard-panel');if(!details)return;details.hidden=!open;$('#guard-toggle').textContent=open?'HIDE DIAGNOSTICS':'OPEN DIAGNOSTICS';if(open){refresh();details.scrollIntoView({behavior:'smooth',block:'nearest'})}}
function mount(){
  if($('#cybertrmx-guard')||mounting)return Boolean($('#cybertrmx-guard'));
  const profile=$('#view-profile .profile-v2');if(!profile)return false;
  mounting=true;
  const section=document.createElement('section');section.id='cybertrmx-guard';section.className='guard-shell';
  section.innerHTML=`<div class="guard-head"><div><small>PRODUCTION GUARD / ${VERSION}</small><h3>System diagnostics</h3><p>Inspect the active build, cache, device identity, session, and the latest backend request without changing the workspace interface.</p></div><span id="guard-updated">NOT CHECKED</span></div><div class="guard-actions"><button id="guard-toggle">OPEN DIAGNOSTICS</button><button id="guard-refresh">REFRESH</button><button id="guard-copy">COPY REPORT</button><button id="guard-recover" class="danger">CLEAN RELOAD</button><button id="guard-staging">OPEN STAGING</button></div><div id="guard-panel" hidden><div id="guard-details"></div></div>`;
  profile.append(section);
  $('#guard-toggle').onclick=()=>toggle($('#guard-panel').hidden);
  $('#guard-refresh').onclick=refresh;
  $('#guard-copy').onclick=copyReport;
  $('#guard-recover').onclick=cleanReload;
  $('#guard-staging').onclick=openStaging;
  mounting=false;return true;
}
function ensureMount(){if(mount())return;let attempts=0;const timer=setInterval(()=>{attempts++;if(mount()||attempts>=80)clearInterval(timer)},100)}
function terminalLine(text,type=''){const output=$('#terminal-output');if(!output)return;const row=document.createElement('div');row.className=`line ${type}`;row.textContent=text;output.append(row);output.scrollTop=output.scrollHeight}
function bindTerminal(){
  const form=$('#terminal-form'),input=$('#command-input');if(!form||!input||form.dataset.guardBound)return;
  form.dataset.guardBound='1';form.addEventListener('submit',async event=>{
    const raw=input.value.trim();if(!/^guard(?:\s|$)/i.test(raw))return;
    event.preventDefault();event.stopImmediatePropagation();terminalLine(`root@trmx# ${raw}`,'command');input.value='';
    const action=(raw.split(/\s+/)[1]||'status').toLowerCase();
    if(action==='open'){document.querySelector('.nav-item[data-tab="profile"]')?.click();setTimeout(()=>toggle(true),250);return}
    if(action==='recover'){cleanReload();return}
    if(action==='staging'){openStaging();return}
    const data=await collect(),request=data.request||{};
    terminalLine(`BUILD ${data.frontendVersion} / ${data.environment}`,'ok');
    terminalLine(`CACHE ${data.caches.join(', ')||'NONE'} / SW ${data.worker.controlled?'CONTROLLED':'OFF'}`,'block');
    terminalLine(`SESSION ${data.session.connected?'CONNECTED':'SIGNED OUT'} / DEVICE ${data.deviceId?data.deviceId.slice(0,8):'MISSING'}`,'block');
    terminalLine(`LAST ${request.lastEndpoint||'NONE'} ${request.lastStatus??'—'} / ${request.lastRequestId||'NO REQUEST ID'}`,request.lastError?'warn':'block');
  },true);
}
function extendHints(){const api=window.CYBERTRMX_COMMAND_HINTS;if(!api?.commands)return false;const items=[
  {command:'guard status',category:'System',description:'Show the active build, cache, device, and last backend request.'},
  {command:'guard open',category:'System',description:'Open the System Diagnostics panel in Profile.'},
  {command:'guard recover',category:'System',description:'Replace application caches and reload the current build.'},
  {command:'guard staging',category:'System',description:'Open the isolated staging build.'}
];items.forEach(item=>{if(!api.commands.some(existing=>existing.command===item.command))api.commands.push(item)});return true}
function initialize(){ensureMount();bindTerminal();if(!extendHints()){let tries=0;const timer=setInterval(()=>{tries++;if(extendHints()||tries>60)clearInterval(timer)},100)}window.addEventListener('cybertrmx:diagnostics',()=>{if(!$('#guard-panel')?.hidden)refresh()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!$('#guard-panel')?.hidden)refresh()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
window.CYBERTRMX_GUARD={version:VERSION,collect,refresh,open:()=>{document.querySelector('.nav-item[data-tab="profile"]')?.click();setTimeout(()=>toggle(true),250)},recover:cleanReload};
})();