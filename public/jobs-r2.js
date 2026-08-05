(()=>{
'use strict';
const VERSION='5.3.0-r2';
const CONFIG=window.CYBERTRMX_BACKEND||{};
const SEC=window.CYBERTRMX_SECURITY||{};
const ACTIVE_STATES=new Set(['queued','validating','running','retry_wait']);
const RETRY_STATES=new Set(['failed','timed_out','cancelled','dead_letter']);
const ENABLED=location.pathname.includes('/staging/')||new URLSearchParams(location.search).get('jobs_r2')==='1';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const safe=(value,max=300)=>String(value??'').replace(/[<>]/g,'').trim().slice(0,max);
const statusLabel=value=>String(value||'unknown').replaceAll('_',' ').toUpperCase();
const notify=message=>window.toast?window.toast(message):console.log(message);
let queueTimer=null;
let visibilityObserver=null;
let mounted=false;
let latestQueue=null;
const jobTimers=new Map();
const requestState={lastEndpoint:'',lastAction:'',lastStatus:null,lastRequestId:'',lastBackendVersion:'',lastError:'',lastAt:'',lastDurationMs:0};

class JobApiError extends Error{
  constructor(payload,status=0){
    super(payload?.message||payload?.error||'The persistent job request failed.');
    this.code=payload?.error||'JOB_REQUEST_FAILED';
    this.status=status;
    this.requestId=payload?.request_id||'';
    this.retryable=Boolean(payload?.retryable);
  }
}
function enabled(){return ENABLED&&Boolean(CONFIG.jobsFunction&&CONFIG.url&&CONFIG.publishableKey)}
function client(){return window.CYBERTRMX_SECURE_CLIENT||null}
async function activeSession(){
  const current=client();
  if(!current?.auth?.getSession)throw new JobApiError({error:'JOB_CLIENT_NOT_READY',message:'The protected account client is not ready.'});
  const result=await current.auth.getSession();
  const session=result?.data?.session;
  if(!session?.access_token)throw new JobApiError({error:'AUTH_REQUIRED',message:'Sign in before using the persistent job queue.'},401);
  return session;
}
function deviceContext(){
  let id='';
  try{id=SEC.getDeviceId?.()||localStorage.getItem('cybertrmx-device-id-v1')||''}catch{}
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)){
    id=crypto.randomUUID();
    try{localStorage.setItem('cybertrmx-device-id-v1',id)}catch{}
  }
  const meta=SEC.deviceMeta?.()||{label:'Device · Browser',platform:navigator.platform||'Device',browser:'Browser'};
  return{id,meta};
}
function recordRequest(action,response,payload,error,started){
  requestState.lastEndpoint=CONFIG.jobsFunction||'cybertrmx-jobs';
  requestState.lastAction=action;
  requestState.lastAt=new Date().toISOString();
  requestState.lastDurationMs=Math.max(0,Math.round(performance.now()-started));
  requestState.lastError=error?String(error.message||error):'';
  requestState.lastStatus=response?.status??null;
  requestState.lastRequestId=payload?.request_id||response?.headers?.get?.('x-request-id')||'';
  requestState.lastBackendVersion=payload?.backend_version||response?.headers?.get?.('x-cybertrmx-backend')||'';
  window.dispatchEvent(new CustomEvent('cybertrmx:diagnostics',{detail:{...requestState,source:'jobs-r2'}}));
}
async function call(action,payload={}){
  if(!enabled())throw new JobApiError({error:'JOB_QUEUE_DISABLED',message:'Persistent jobs are enabled only in staging.'},409);
  const session=await activeSession();
  const {id,meta}=deviceContext();
  const idempotencyKey=crypto.randomUUID();
  const headers={
    'Content-Type':'application/json',
    apikey:CONFIG.publishableKey,
    Authorization:`Bearer ${session.access_token}`,
    'x-device-id':id,
    'x-device-label':meta.label,
    'x-device-platform':meta.platform,
    'x-device-browser':meta.browser,
    'x-client-version':VERSION,
    'x-idempotency-key':idempotencyKey
  };
  const started=performance.now();
  let response=null,body=null,lastError=null;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    try{
      response=await fetch(`${CONFIG.url}/functions/v1/${CONFIG.jobsFunction}`,{
        method:'POST',headers,body:JSON.stringify({action,...payload}),cache:'no-store',credentials:'omit',signal:controller.signal
      });
      body=await response.json().catch(()=>({error:`JOB_HTTP_${response.status}`,message:'The job service returned an unreadable response.'}));
      clearTimeout(timeout);
      if(!response.ok||body?.error)throw new JobApiError(body,response.status);
      recordRequest(action,response,body,null,started);
      return body;
    }catch(error){
      clearTimeout(timeout);
      lastError=error instanceof JobApiError?error:new JobApiError({error:error?.name==='AbortError'?'JOB_TIMEOUT':'JOB_NETWORK_ERROR',message:error?.name==='AbortError'?'The job service did not respond before the timeout.':'The job service could not be reached.',retryable:true},0);
      if(lastError instanceof JobApiError&&lastError.status>0)break;
      if(attempt===0)await new Promise(resolve=>setTimeout(resolve,350));
    }
  }
  recordRequest(action,response,body,lastError,started);
  throw lastError;
}
function age(value){
  if(!value)return'—';
  const seconds=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/1000));
  if(seconds<60)return`${seconds}s ago`;
  if(seconds<3600)return`${Math.floor(seconds/60)}m ago`;
  if(seconds<86400)return`${Math.floor(seconds/3600)}h ago`;
  return`${Math.floor(seconds/86400)}d ago`;
}
function jobInput(job){return safe(job?.request_payload?.input||'Input unavailable',253)}
function canCancel(status){return ACTIVE_STATES.has(status)}
function canRetry(status){return RETRY_STATES.has(status)}
function queueCard(){return $('#ops-r2-queue-card')}
function syncVisibility(){
  const card=queueCard(),reference=$('#ops-lookup-form')?.closest('.ops-card');
  if(card&&reference)card.hidden=reference.hidden;
}
function mount(){
  if(mounted&&queueCard())return true;
  const lookup=$('#ops-lookup-form');
  const reference=lookup?.closest('.ops-card');
  if(!lookup||!reference)return false;
  const card=document.createElement('article');
  card.id='ops-r2-queue-card';
  card.className='ops-card wide ops-private-card';
  card.hidden=reference.hidden;
  card.innerHTML=`<div class="ops-card-head"><div><small>PERSISTENT WORKER / STAGING</small><h3>Job queue</h3></div><div class="r2-queue-head-actions"><span class="ops-live">LEASE + HEARTBEAT</span><button class="ops-mini" id="r2-refresh-queue">REFRESH</button></div></div><div class="r2-queue-summary"><div><small>QUEUED</small><strong id="r2-count-queued">0</strong><span>waiting for claim</span></div><div><small>ACTIVE</small><strong id="r2-count-active">0</strong><span>worker heartbeat</span></div><div><small>RETRY</small><strong id="r2-count-retry">0</strong><span>backoff window</span></div><div><small>DEAD LETTER</small><strong id="r2-count-dead">0</strong><span>manual review</span></div></div><div class="r2-queue-list" id="r2-queue-list"><div class="ops-empty">Queue status will appear after sign-in.</div></div><div class="r2-worker-note"><b>STAGING FEATURE</b> · Jobs remain in PostgreSQL after the browser closes. Failure of this panel never changes the Operations runtime status.</div>`;
  reference.insertAdjacentElement('afterend',card);
  $('#r2-refresh-queue').onclick=()=>refreshQueue(false);
  visibilityObserver?.disconnect();
  visibilityObserver=new MutationObserver(syncVisibility);
  visibilityObserver.observe(reference,{attributes:true,attributeFilter:['hidden']});
  mounted=true;
  syncVisibility();
  return true;
}
function setCount(id,value){const element=$(`#${id}`);if(element)element.textContent=String(value)}
function renderQueue(data){
  if(!mount())return;
  latestQueue=data;
  const counts=new Map((data?.counts||[]).map(item=>[item.status,Number(item.count)||0]));
  setCount('r2-count-queued',counts.get('queued')||0);
  setCount('r2-count-active',(counts.get('running')||0)+(counts.get('validating')||0));
  setCount('r2-count-retry',counts.get('retry_wait')||0);
  setCount('r2-count-dead',counts.get('dead_letter')||0);
  const jobs=data?.jobs||[],list=$('#r2-queue-list');
  if(!list)return;
  list.innerHTML=jobs.length?jobs.map(job=>`<div class="r2-queue-row" data-state="${safe(job.status,30)}"><div class="r2-queue-main"><div class="r2-queue-badge ${safe(job.status,30)}">${statusLabel(job.status)}</div><strong>${statusLabel(job.job_type)}</strong><em>${jobInput(job)}</em><small>${Number(job.progress)||0}% · ATTEMPT ${Number(job.attempt_count)||0}/${Number(job.max_attempts)||0} · ${age(job.heartbeat_at||job.claimed_at||job.created_at)}${job.last_error_code?` · ${safe(job.last_error_code,100)}`:''}</small></div><div class="r2-queue-actions"><button class="ops-mini" data-r2-open="${job.id}">EVENTS</button>${canCancel(job.status)?`<button class="ops-mini danger" data-r2-cancel="${job.id}">CANCEL</button>`:''}${canRetry(job.status)?`<button class="ops-mini" data-r2-retry="${job.id}">RETRY</button>`:''}</div></div>`).join(''):'<div class="ops-empty">No persistent jobs have been queued.</div>';
  $$('[data-r2-open]',list).forEach(button=>button.onclick=()=>openJob(button.dataset.r2Open));
  $$('[data-r2-cancel]',list).forEach(button=>button.onclick=()=>cancelJob(button.dataset.r2Cancel));
  $$('[data-r2-retry]',list).forEach(button=>button.onclick=()=>retryJob(button.dataset.r2Retry));
}
function renderQueueError(error){
  if(!mount())return;
  const list=$('#r2-queue-list');
  if(list)list.innerHTML=`<div class="r2-queue-error"><strong>QUEUE UNAVAILABLE</strong><span>${safe(error.message,300)}</span>${error.requestId?`<small>REQUEST ${safe(error.requestId,80)}</small>`:''}</div>`;
}
async function refreshQueue(silent=true){
  if(!enabled()||document.visibilityState==='hidden'||!$('#view-operations')?.classList.contains('active'))return null;
  try{const data=await call('queue_status');renderQueue(data);return data}
  catch(error){renderQueueError(error);if(!silent)notify(error.message);return null}
}
function scheduleQueue(){
  clearTimeout(queueTimer);
  queueTimer=setTimeout(async()=>{await refreshQueue(true);scheduleQueue()},5000);
}
function summarize(result){
  if(!result)return'No result returned.';
  if(result.records)return Object.entries(result.records).map(([type,records])=>`${type}: ${Array.isArray(records)?records.length:0} record(s)`).join('\n');
  if(result.response){const value=result.response;return JSON.stringify({query:result.query,source:result.source,name:value.name||value.handle||null,country:value.country||value.country_code||null,asn:value.connection?.asn||value.startAutnum||null,org:value.connection?.org||value.name||null,network:value.network||value.cidr0_cidrs||null},null,2)}
  return JSON.stringify(result,null,2).slice(0,7000);
}
function renderJob(job,events=[]){
  const consoleBox=$('#ops-job-console'),result=$('#ops-job-result');
  if(!consoleBox)return;
  consoleBox.hidden=false;
  $('#ops-job-label').textContent=statusLabel(job.status);
  $('#ops-job-progress').textContent=`${Number(job.progress)||0}%`;
  $('#ops-job-bar').style.width=`${Math.max(0,Math.min(100,Number(job.progress)||0))}%`;
  const eventBox=$('#ops-job-events');
  if(eventBox)eventBox.innerHTML=events.map(event=>`<div class="ops-job-event"><b>${String(Number(event.progress)||0).padStart(2,'0')}%</b><span>${statusLabel(event.stage)}</span><em>${safe(event.message,260)}</em></div>`).join('');
  const failed=['failed','timed_out','dead_letter','cancelled'].includes(job.status);
  if(result){result.hidden=!(job.result||failed);result.textContent=job.result?summarize(job.result):failed?`${statusLabel(job.status)}${job.last_error_code?` · ${job.last_error_code}`:''}${job.last_error_message?`\n${job.last_error_message}`:''}`:''}
  let controls=$('#r2-job-controls');
  if(!controls){controls=document.createElement('div');controls.id='r2-job-controls';controls.className='r2-job-controls';consoleBox.insertAdjacentElement('afterend',controls)}
  controls.innerHTML=`${canCancel(job.status)?`<button class="ops-button secondary" data-r2-console-cancel="${job.id}">CANCEL JOB</button>`:''}${canRetry(job.status)?`<button class="ops-button" data-r2-console-retry="${job.id}">RETRY JOB</button>`:''}`;
  $('[data-r2-console-cancel]',controls)?.addEventListener('click',()=>cancelJob(job.id));
  $('[data-r2-console-retry]',controls)?.addEventListener('click',()=>retryJob(job.id));
}
async function pollJob(jobId,scroll=false){
  clearTimeout(jobTimers.get(jobId));
  try{
    const data=await call('job_status',{job_id:jobId});
    renderJob(data.job,data.events||[]);
    if(scroll)$('#ops-job-console')?.scrollIntoView({behavior:'smooth',block:'center'});
    await refreshQueue(true);
    window.CYBERTRMX_OPERATIONS?.refresh?.(true);
    if(ACTIVE_STATES.has(data.job.status)){
      const timer=setTimeout(()=>pollJob(jobId,false),Math.max(1000,Number(data.poll_after_ms)||2000));
      jobTimers.set(jobId,timer);
    }else jobTimers.delete(jobId);
    return data;
  }catch(error){jobTimers.delete(jobId);renderQueueError(error);throw error}
}
async function openJob(jobId){try{return await pollJob(jobId,true)}catch(error){notify(error.message)}}
async function enqueue(jobType,input,scroll=true){
  const data=await call('run_lookup',{job_type:jobType,input,case_id:localStorage.getItem('cybertrmx-active-case')||null});
  notify(`Job queued · ${String(data.job_id).slice(0,8)}`);
  await pollJob(data.job_id,scroll);
  return data;
}
async function enqueueFromForm(){
  const type=$('#ops-lookup-type')?.value,input=safe($('#ops-lookup-input')?.value,253),button=$('#ops-run-lookup');
  if(!input){notify('Enter a domain or public IPv4 address');return}
  if(button){button.disabled=true;button.textContent='QUEUEING…'}
  const consoleBox=$('#ops-job-console');if(consoleBox)consoleBox.hidden=false;
  if($('#ops-job-label'))$('#ops-job-label').textContent='QUEUEING';
  if($('#ops-job-progress'))$('#ops-job-progress').textContent='0%';
  if($('#ops-job-bar'))$('#ops-job-bar').style.width='0%';
  if($('#ops-job-events'))$('#ops-job-events').innerHTML='<div class="ops-job-event"><b>00%</b><span>REQUEST</span><em>Writing the job to the persistent queue.</em></div>';
  try{await enqueue(type,input,false)}
  catch(error){notify(error.message);const result=$('#ops-job-result');if(result){result.hidden=false;result.textContent=`${error.message}${error.requestId?`\nRequest ${error.requestId}`:''}`}}
  finally{if(button){button.disabled=false;button.textContent='RUN JOB'}}
}
async function cancelJob(jobId){
  if(!confirm('Cancel this queued or running job?'))return;
  try{const data=await call('cancel_job',{job_id:jobId});notify(data.job?.status==='cancelled'?'Job cancelled':'Cancellation requested');await pollJob(jobId,false)}catch(error){notify(error.message)}
}
async function retryJob(jobId){
  try{const data=await call('retry_job',{job_id:jobId});notify(`Retry queued · ${String(data.job_id).slice(0,8)}`);await pollJob(data.job_id,true)}catch(error){notify(error.message)}
}
function terminalLine(text,type=''){
  const output=$('#terminal-output');if(!output)return;
  const row=document.createElement('div');row.className=`line ${type}`;row.textContent=text;output.append(row);output.scrollTop=output.scrollHeight;
}
async function terminalJob(raw){
  const parts=raw.trim().split(/\s+/),command=(parts[0]||'').toLowerCase();
  if(command==='lookup'){
    const map={dns:'dns_inventory',rdap:'rdap_lookup',ip:'ip_enrichment'},jobType=map[(parts[1]||'').toLowerCase()],input=safe(parts[2],253);
    if(!jobType||!input){terminalLine('usage: lookup <dns|rdap|ip> <domain-or-ip>','warn');return}
    const data=await enqueue(jobType,input,false);terminalLine(`queued ${data.job_id}`,'ok');return;
  }
  const sub=(parts[1]||'list').toLowerCase(),jobId=parts[2]||'';
  if(sub==='list'||sub==='queue'){
    const data=await call('queue_status');
    if(!(data.jobs||[]).length){terminalLine('persistent queue is empty','block');return}
    (data.jobs||[]).slice(0,12).forEach(job=>terminalLine(`${job.id}  ${statusLabel(job.status)}  ${Number(job.progress)||0}%  ${jobInput(job)}`,'block'));
    return;
  }
  if(!jobId){terminalLine('usage: job <status|cancel|retry> <job-id>','warn');return}
  if(sub==='status'){const data=await call('job_status',{job_id:jobId});terminalLine(`${data.job.id}  ${statusLabel(data.job.status)}  ${data.job.progress}%  attempt ${data.job.attempt_count}/${data.job.max_attempts}`,'block');return}
  if(sub==='cancel'){const data=await call('cancel_job',{job_id:jobId});terminalLine(`job ${jobId} / ${statusLabel(data.job.status)}`,'ok');return}
  if(sub==='retry'){const data=await call('retry_job',{job_id:jobId});terminalLine(`retry queued: ${data.job_id}`,'ok');return}
  terminalLine('usage: job <list|status|cancel|retry> [job-id]','warn');
}
function bindCapture(){
  if(document.documentElement.dataset.jobsR2Bound)return;
  document.documentElement.dataset.jobsR2Bound='1';
  document.addEventListener('submit',event=>{
    if(event.target?.id==='ops-lookup-form'){
      event.preventDefault();event.stopImmediatePropagation();enqueueFromForm();return;
    }
    if(event.target?.id==='terminal-form'){
      const input=$('#command-input'),raw=input?.value.trim()||'';
      if(!/^(?:job|lookup)(?:\s|$)/i.test(raw))return;
      event.preventDefault();event.stopImmediatePropagation();terminalLine(`root@trmx# ${raw}`,'command');input.value='';terminalJob(raw).catch(error=>terminalLine(`job operation failed: ${error.message}`,'warn'));
    }
  },true);
}
function extendHints(){
  const api=window.CYBERTRMX_COMMAND_HINTS;if(!api?.commands)return false;
  const items=[
    {command:'job list',category:'Jobs',description:'List persistent jobs in the connected workspace.'},
    {command:'job status <job-id>',category:'Jobs',description:'Show status, progress, and attempt count for a persistent job.'},
    {command:'job cancel <job-id>',category:'Jobs',description:'Request cancellation for a queued or running job.'},
    {command:'job retry <job-id>',category:'Jobs',description:'Queue a new attempt from a terminal job state.'}
  ];
  items.forEach(item=>{if(!api.commands.some(existing=>existing.command===item.command))api.commands.push(item)});
  return true;
}
function initialize(){
  if(!enabled())return;
  bindCapture();
  let attempts=0;
  const wait=setInterval(()=>{
    attempts++;
    mount();
    if(client()&&mount()){
      clearInterval(wait);
      refreshQueue(true);
      scheduleQueue();
    }else if(attempts>=100){clearInterval(wait);mount();renderQueueError(new JobApiError({message:'The staging job client did not become ready.'}))}
  },120);
  if(!extendHints()){let tries=0;const hints=setInterval(()=>{tries++;if(extendHints()||tries>60)clearInterval(hints)},100)}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshQueue(true)});
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-go="operations"],[data-tab="operations"]'))setTimeout(()=>refreshQueue(true),350)},true);
}
window.CYBERTRMX_JOBS_R2={version:VERSION,enabled:enabled(),call,refresh:refreshQueue,open:openJob,cancel:cancelJob,retry:retryJob,diagnostics:()=>({...requestState}),latest:()=>latestQueue};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
