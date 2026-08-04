(()=>{
'use strict';
const CONFIG=window.CYBERTRMX_BACKEND||{};
const JOB_ACTIONS=new Set(['run_lookup','job_status','cancel_job','retry_job','queue_status']);
const ACTIVE_STATES=new Set(['queued','validating','running','retry_wait']);
const TERMINAL_STATES=new Set(['completed','failed','timed_out','cancelled','dead_letter']);
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const safe=(value,max=300)=>String(value??'').replace(/[<>]/g,'').trim().slice(0,max);
const statusLabel=value=>String(value||'unknown').replaceAll('_',' ').toUpperCase();
const notify=message=>window.toast?window.toast(message):console.log(message);
let client=null,queueTimer=null,observer=null;
const jobTimers=new Map();

function patchClientFactory(){
  const sdk=window.supabase;
  if(!sdk?.createClient||sdk.createClient.__cybertrmxJobs)return;
  const previous=sdk.createClient.bind(sdk);
  const wrapped=(...args)=>{
    const instance=previous(...args);
    client=instance;
    window.CYBERTRMX_JOBS_CLIENT=instance;
    const invoke=instance.functions.invoke.bind(instance.functions);
    instance.functions.invoke=(name,options={})=>{
      const action=options?.body?.action;
      const target=JOB_ACTIONS.has(action)&&CONFIG.jobsFunction?CONFIG.jobsFunction:name;
      return invoke(target,options);
    };
    return instance;
  };
  wrapped.__cybertrmxJobs=true;
  sdk.createClient=wrapped;
}

async function call(action,payload={}){
  if(window.CYBERTRMX_OPERATIONS?.call)return window.CYBERTRMX_OPERATIONS.call(action,payload);
  if(!client)throw new Error('Job client is not ready');
  const {data,error}=await client.functions.invoke(CONFIG.jobsFunction,{body:{action,...payload}});
  if(error){let message=error.message||'Job request failed';try{const body=await error.context.json();message=body.message||body.error||message}catch{}throw new Error(message)}
  if(data?.error)throw new Error(data.message||data.error);
  return data;
}

function addQueueCard(){
  if($('#ops-queue-card'))return true;
  const lookup=$('#ops-lookup-form');
  if(!lookup)return false;
  const parent=lookup.closest('.ops-card');
  if(!parent)return false;
  const card=document.createElement('article');
  card.id='ops-queue-card';
  card.className='ops-card wide ops-private-card';
  card.hidden=parent.hidden;
  card.innerHTML=`<div class="ops-card-head"><div><small>PERSISTENT WORKER</small><h3>Job queue</h3></div><span class="ops-live">CRON + LEASES</span></div><div class="job-queue-summary"><div><small>QUEUED</small><strong id="job-count-queued">0</strong><span>waiting for claim</span></div><div><small>ACTIVE</small><strong id="job-count-active">0</strong><span>heartbeat protected</span></div><div><small>RETRY</small><strong id="job-count-retry">0</strong><span>backoff window</span></div><div><small>DEAD LETTER</small><strong id="job-count-dead">0</strong><span>manual review</span></div></div><div class="job-queue-list" id="job-queue-list"><div class="ops-empty">Queue status will appear after sign-in.</div></div><div class="job-worker-note"><b>WORKER CONTRACT</b> · A job remains in PostgreSQL after this browser closes. The worker renews a lease with heartbeats, retries transient provider failures, and moves exhausted retries to dead-letter state.</div>`;
  parent.insertAdjacentElement('afterend',card);
  return true;
}

function syncPrivateVisibility(){
  const card=$('#ops-queue-card');
  const reference=$('#ops-lookup-form')?.closest('.ops-card');
  if(card&&reference)card.hidden=reference.hidden;
}

function jobInput(job){return safe(job?.request_payload?.input||'Input unavailable',253)}
function age(value){
  if(!value)return'—';
  const seconds=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/1000));
  if(seconds<60)return`${seconds}s ago`;
  if(seconds<3600)return`${Math.floor(seconds/60)}m ago`;
  if(seconds<86400)return`${Math.floor(seconds/3600)}h ago`;
  return`${Math.floor(seconds/86400)}d ago`;
}
function canCancel(status){return ACTIVE_STATES.has(status)}
function canRetry(status){return ['failed','timed_out','cancelled','dead_letter'].includes(status)}

function renderQueue(data){
  addQueueCard();syncPrivateVisibility();
  const jobs=data?.jobs||[];
  const counts=new Map((data?.counts||[]).map(item=>[item.status,Number(item.count)||0]));
  const set=(id,value)=>{const element=$(`#${id}`);if(element)element.textContent=String(value)};
  set('job-count-queued',counts.get('queued')||0);
  set('job-count-active',(counts.get('running')||0)+(counts.get('validating')||0));
  set('job-count-retry',counts.get('retry_wait')||0);
  set('job-count-dead',counts.get('dead_letter')||0);
  const list=$('#job-queue-list');
  if(!list)return;
  list.innerHTML=jobs.length?jobs.map(job=>`<div class="job-queue-row" data-state="${safe(job.status,30)}"><div class="job-queue-main"><div class="job-queue-badge ${safe(job.status,30)}">${statusLabel(job.status)}</div><strong>${statusLabel(job.job_type)}</strong><em>${jobInput(job)}</em><small>${Number(job.progress)||0}% · ATTEMPT ${Number(job.attempt_count)||0}/${Number(job.max_attempts)||0} · ${age(job.heartbeat_at||job.claimed_at||job.created_at)}${job.last_error_code?` · ${safe(job.last_error_code,100)}`:''}</small></div><div class="job-queue-actions"><button class="ops-mini" data-v53-open="${job.id}">EVENTS</button>${canCancel(job.status)?`<button class="ops-mini danger" data-v53-cancel="${job.id}">CANCEL</button>`:''}${canRetry(job.status)?`<button class="ops-mini" data-v53-retry="${job.id}">RETRY</button>`:''}</div></div>`).join(''):'<div class="ops-empty">No persistent jobs have been queued.</div>';
  $$('[data-v53-open]',list).forEach(button=>button.onclick=()=>openJob(button.dataset.v53Open));
  $$('[data-v53-cancel]',list).forEach(button=>button.onclick=()=>cancelJob(button.dataset.v53Cancel));
  $$('[data-v53-retry]',list).forEach(button=>button.onclick=()=>retryJob(button.dataset.v53Retry));
}

async function refreshQueue(silent=true){
  if(document.visibilityState==='hidden')return;
  try{renderQueue(await call('queue_status'))}catch(error){if(!silent)notify(error.message)}
}
function scheduleQueue(){
  clearTimeout(queueTimer);
  queueTimer=setTimeout(async()=>{await refreshQueue(true);scheduleQueue()},5000);
}

function setConsole(job,events=[]){
  const consoleBox=$('#ops-job-console'),result=$('#ops-job-result');
  if(!consoleBox)return;
  consoleBox.hidden=false;
  $('#ops-job-label').textContent=statusLabel(job.status);
  $('#ops-job-progress').textContent=`${Number(job.progress)||0}%`;
  $('#ops-job-bar').style.width=`${Math.max(0,Math.min(100,Number(job.progress)||0))}%`;
  const eventBox=$('#ops-job-events');
  if(eventBox)eventBox.innerHTML=events.map(event=>`<div class="ops-job-event"><b>${String(Number(event.progress)||0).padStart(2,'0')}%</b><span>${statusLabel(event.stage)}</span><em>${safe(event.message,260)}</em></div>`).join('');
  if(result){
    const failed=['failed','timed_out','dead_letter','cancelled'].includes(job.status);
    result.hidden=!(job.result||failed);
    if(job.result)result.textContent=summarize(job.result);
    else if(failed)result.textContent=`${statusLabel(job.status)}${job.last_error_code?` · ${job.last_error_code}`:''}${job.last_error_message?`\n${job.last_error_message}`:''}`;
  }
  let controls=$('.ops-job-controls');
  if(!controls){controls=document.createElement('div');controls.className='ops-job-controls';consoleBox.insertAdjacentElement('afterend',controls)}
  controls.innerHTML=`${canCancel(job.status)?`<button class="ops-button secondary" data-console-cancel="${job.id}">CANCEL JOB</button>`:''}${canRetry(job.status)?`<button class="ops-button" data-console-retry="${job.id}">RETRY JOB</button>`:''}`;
  $('[data-console-cancel]',controls)?.addEventListener('click',()=>cancelJob(job.id));
  $('[data-console-retry]',controls)?.addEventListener('click',()=>retryJob(job.id));
}
function summarize(result){
  if(!result)return'No result returned.';
  if(result.records)return Object.entries(result.records).map(([type,records])=>`${type}: ${Array.isArray(records)?records.length:0} record(s)`).join('\n');
  if(result.response){const value=result.response;return JSON.stringify({query:result.query,source:result.source,name:value.name||value.handle||null,country:value.country||value.country_code||null,asn:value.connection?.asn||value.startAutnum||null,org:value.connection?.org||value.name||null,network:value.network||value.cidr0_cidrs||null},null,2)}
  return JSON.stringify(result,null,2).slice(0,7000);
}

async function pollJob(jobId,scroll=false){
  clearTimeout(jobTimers.get(jobId));
  try{
    const data=await call('job_status',{job_id:jobId});
    setConsole(data.job,data.events||[]);
    if(scroll)$('#ops-job-console')?.scrollIntoView({behavior:'smooth',block:'center'});
    await refreshQueue(true);
    window.CYBERTRMX_OPERATIONS?.refresh?.(true);
    if(ACTIVE_STATES.has(data.job.status)){
      const timer=setTimeout(()=>pollJob(jobId,false),Math.max(1000,Number(data.poll_after_ms)||2000));
      jobTimers.set(jobId,timer);
    }else jobTimers.delete(jobId);
    return data;
  }catch(error){notify(error.message);jobTimers.delete(jobId);throw error}
}
async function openJob(jobId){return pollJob(jobId,true)}

async function enqueueFromForm(){
  const type=$('#ops-lookup-type')?.value,input=safe($('#ops-lookup-input')?.value,253),button=$('#ops-run-lookup');
  if(!input){notify('Enter a domain or public IPv4 address');return}
  if(button){button.disabled=true;button.textContent='QUEUEING…'}
  const box=$('#ops-job-console');if(box)box.hidden=false;
  if($('#ops-job-label'))$('#ops-job-label').textContent='QUEUEING';
  if($('#ops-job-progress'))$('#ops-job-progress').textContent='0%';
  if($('#ops-job-bar'))$('#ops-job-bar').style.width='0%';
  if($('#ops-job-events'))$('#ops-job-events').innerHTML='<div class="ops-job-event"><b>00%</b><span>REQUEST</span><em>Writing the job to the persistent queue.</em></div>';
  try{
    const data=await call('run_lookup',{job_type:type,input,case_id:localStorage.getItem('cybertrmx-active-case')||null});
    notify(`Job queued · ${String(data.job_id).slice(0,8)}`);
    await pollJob(data.job_id,false);
  }catch(error){notify(error.message);const result=$('#ops-job-result');if(result){result.hidden=false;result.textContent=error.message}}
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
  const parts=raw.trim().split(/\s+/),sub=(parts[1]||'list').toLowerCase(),jobId=parts[2]||'';
  if(sub==='list'||sub==='queue'){
    const data=await call('queue_status');
    (data.jobs||[]).slice(0,12).forEach(job=>terminalLine(`${job.id}  ${statusLabel(job.status)}  ${Number(job.progress)||0}%  ${jobInput(job)}`,'block'));
    return;
  }
  if(!jobId){terminalLine('usage: job <status|cancel|retry> <job-id>','warn');return}
  if(sub==='status'){
    const data=await call('job_status',{job_id:jobId});terminalLine(`${data.job.id}  ${statusLabel(data.job.status)}  ${data.job.progress}%  attempt ${data.job.attempt_count}/${data.job.max_attempts}`,'block');return;
  }
  if(sub==='cancel'){const data=await call('cancel_job',{job_id:jobId});terminalLine(`job ${jobId} / ${statusLabel(data.job.status)}`,'ok');return}
  if(sub==='retry'){const data=await call('retry_job',{job_id:jobId});terminalLine(`retry queued: ${data.job_id}`,'ok');return}
  terminalLine('usage: job <list|status|cancel|retry> [job-id]','warn');
}

function bindCapture(){
  document.addEventListener('submit',event=>{
    if(event.target?.id==='ops-lookup-form'){
      event.preventDefault();event.stopImmediatePropagation();enqueueFromForm();return;
    }
    if(event.target?.id==='terminal-form'){
      const input=$('#command-input'),raw=input?.value.trim()||'';
      if(!/^job(?:\s|$)/i.test(raw))return;
      event.preventDefault();event.stopImmediatePropagation();terminalLine(`root@trmx# ${raw}`,'command');input.value='';terminalJob(raw).catch(error=>terminalLine(`job operation failed: ${error.message}`,'warn'));
    }
  },true);
}

function observeOperations(){
  observer=new MutationObserver(()=>{if(addQueueCard())syncPrivateVisibility()});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  addQueueCard();
}
function initialize(){
  patchClientFactory();bindCapture();observeOperations();
  const wait=setInterval(()=>{if(window.CYBERTRMX_OPERATIONS&&window.CYBERTRMX_JOBS_CLIENT){clearInterval(wait);client=window.CYBERTRMX_JOBS_CLIENT;refreshQueue(true);scheduleQueue()}},120);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshQueue(true)});
}
window.CYBERTRMX_JOBS={refresh:refreshQueue,open:openJob,cancel:cancelJob,retry:retryJob};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();