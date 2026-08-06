(()=>{
'use strict';
const VERSION='5.3.2';
const COMMAND=/^(?:job|lookup)(?:\s|$)/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let busy=false;
const $=selector=>document.querySelector(selector);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const status=value=>String(value||'unknown').replaceAll('_',' ').toUpperCase();
const typeLabel=value=>String(value||'job').replaceAll('_',' ').toUpperCase();
const inputOf=job=>String(job?.request_payload?.input||'Legacy input not recorded').slice(0,253);
const shortId=value=>{const id=String(value||'');return id.length>16?`${id.slice(0,8)}…${id.slice(-4)}`:id};
const age=value=>{if(!value)return'—';const seconds=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return`${seconds}s ago`;if(seconds<3600)return`${Math.floor(seconds/60)}m ago`;if(seconds<86400)return`${Math.floor(seconds/3600)}h ago`;return`${Math.floor(seconds/86400)}d ago`};
function output(){return $('#terminal-output')}
function append(node){const target=output();if(!target)return;target.append(node);target.scrollTop=target.scrollHeight}
function line(text,type=''){
  const row=document.createElement('div');
  row.className=`line ${type}`;
  row.textContent=String(text??'');
  append(row);
  return row;
}
async function copyText(text){
  const value=String(text||'');
  try{await navigator.clipboard.writeText(value)}catch{
    const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove();
  }
}
function copyButton(jobId){
  const button=document.createElement('button');
  button.type='button';
  button.className='job-terminal-copy';
  button.textContent='COPY ID';
  button.title=jobId;
  button.addEventListener('click',async()=>{await copyText(jobId);button.textContent='COPIED';setTimeout(()=>button.textContent='COPY ID',1100)});
  return button;
}
function jobCard(job,{events=false}={}){
  const card=document.createElement('div');
  card.className='job-terminal-card';
  card.dataset.state=String(job?.status||'unknown');
  const top=document.createElement('div');top.className='job-terminal-top';
  const id=document.createElement('code');id.textContent=shortId(job?.id);id.title=String(job?.id||'');
  const badge=document.createElement('b');badge.textContent=status(job?.status);
  top.append(id,badge);
  const title=document.createElement('strong');title.textContent=`${typeLabel(job?.job_type)} · ${inputOf(job)}`;
  const meta=document.createElement('small');meta.textContent=`${Number(job?.progress)||0}% · ATTEMPT ${Number(job?.attempt_count)||0}/${Number(job?.max_attempts)||0} · ${age(job?.heartbeat_at||job?.claimed_at||job?.created_at)}`;
  const actions=document.createElement('div');actions.className='job-terminal-actions';actions.append(copyButton(String(job?.id||'')));
  if(events){const hint=document.createElement('span');hint.textContent='EVENT HISTORY BELOW';actions.prepend(hint)}
  card.append(top,title,meta,actions);
  append(card);
  return card;
}
function eventLine(event){
  const row=document.createElement('div');row.className='job-terminal-event';
  const progress=document.createElement('b');progress.textContent=`${String(Number(event?.progress)||0).padStart(3,'0')}%`;
  const stage=document.createElement('span');stage.textContent=status(event?.stage);
  const message=document.createElement('em');message.textContent=String(event?.message||'');
  row.append(progress,stage,message);append(row);
}
function clearInput(){const input=$('#command-input');if(input)input.value=''}
async function api(){
  for(let attempt=0;attempt<100;attempt++){
    const current=window.CYBERTRMX_JOBS_R3;
    if(current?.enabled&&typeof current.call==='function')return current;
    await sleep(100);
  }
  throw new Error('Persistent queue module did not become ready.');
}
async function invoke(action,payload={}){
  const current=await api();
  for(let attempt=0;attempt<50;attempt++){
    try{return await current.call(action,payload)}catch(error){
      const code=String(error?.code||'');
      if(code!=='JOB_CLIENT_NOT_READY')throw error;
      await sleep(120);
    }
  }
  throw new Error('Protected account client is not ready.');
}
async function resolveJobId(token){
  const value=String(token||'').trim();
  if(UUID.test(value))return value;
  if(value.length<4)throw new Error('Use at least 4 characters from the job ID.');
  const data=await invoke('queue_status');
  const matches=(data.jobs||[]).filter(job=>String(job.id||'').toLowerCase().startsWith(value.toLowerCase()));
  if(matches.length===1)return matches[0].id;
  if(matches.length>1)throw new Error(`Job prefix ${value} matches more than one job.`);
  throw new Error(`Job ${value} was not found in the recent queue.`);
}
async function run(raw){
  const parts=String(raw||'').trim().split(/\s+/);
  const command=(parts[0]||'').toLowerCase();
  if(command==='lookup'){
    const types={dns:'dns_inventory',rdap:'rdap_lookup',ip:'ip_enrichment'};
    const jobType=types[(parts[1]||'').toLowerCase()];
    const input=(parts[2]||'').slice(0,253);
    if(!jobType||!input){line('usage: lookup <dns|rdap|ip> <domain-or-ip>','warn');return}
    const data=await invoke('run_lookup',{job_type:jobType,input,case_id:localStorage.getItem('cybertrmx-active-case')||null});
    line(`PERSISTENT QUEUE RECEIPT ${data.job_id}`,'ok');
    line(`Next: job status ${String(data.job_id).slice(0,8)}`,'dim');
    return;
  }
  const sub=(parts[1]||'list').toLowerCase();
  const token=parts[2]||'';
  if(sub==='list'||sub==='queue'){
    const data=await invoke('queue_status');
    const jobs=data.jobs||[];
    if(!jobs.length){line('persistent queue is empty','block');return}
    jobs.slice(0,16).forEach(job=>jobCard(job));
    line('Use the first 8 ID characters with status, events, cancel, or retry.','dim');
    return;
  }
  if(!token){line('usage: job <status|events|copy|cancel|retry> <job-id-or-prefix>','warn');return}
  const jobId=await resolveJobId(token);
  if(sub==='status'){
    const data=await invoke('job_status',{job_id:jobId});
    jobCard(data.job||{id:jobId});
    if(data.job?.last_error_code)line(`${data.job.last_error_code}: ${data.job.last_error_message||'No error detail.'}`,'warn');
    return;
  }
  if(sub==='events'){
    const data=await invoke('job_status',{job_id:jobId});
    jobCard(data.job||{id:jobId},{events:true});
    const events=data.events||[];
    if(!events.length){line('No event history recorded for this job.','dim');return}
    events.forEach(eventLine);
    return;
  }
  if(sub==='copy'){
    await copyText(jobId);line(`COPIED JOB ID ${jobId}`,'ok');return;
  }
  if(sub==='cancel'){
    const data=await invoke('cancel_job',{job_id:jobId});
    line(`job ${shortId(jobId)} / ${status(data.job?.status)}`,'ok');
    return;
  }
  if(sub==='retry'){
    const data=await invoke('retry_job',{job_id:jobId});
    line(`RETRY QUEUED ${data.job_id}`,'ok');
    line(`Next: job status ${String(data.job_id).slice(0,8)}`,'dim');
    return;
  }
  line('usage: job <list|status|events|copy|cancel|retry> [job-id-or-prefix]','warn');
}
async function execute(raw){
  if(busy||!COMMAND.test(String(raw||'').trim()))return false;
  busy=true;
  clearInput();
  line(`root@trmx# ${raw}`,'command');
  try{await run(raw)}catch(error){line(`job operation failed: ${error?.message||error}`,'warn')}
  finally{busy=false}
  return true;
}
function commandFromInput(){return $('#command-input')?.value.trim()||''}
function stop(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
document.addEventListener('submit',event=>{
  if(event.target?.id!=='terminal-form')return;
  const raw=commandFromInput();
  if(!COMMAND.test(raw))return;
  stop(event);execute(raw);
},true);
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.target?.id!=='command-input')return;
  const raw=commandFromInput();
  if(!COMMAND.test(raw))return;
  stop(event);execute(raw);
},true);
document.addEventListener('click',event=>{
  const button=event.target.closest?.('#terminal-form button');
  if(!button)return;
  const raw=commandFromInput();
  if(!COMMAND.test(raw))return;
  stop(event);execute(raw);
},true);
window.CYBERTRMX_R3_TERMINAL_BRIDGE={version:VERSION,execute,ready:true};
})();
