(()=>{
'use strict';
const VERSION='5.3.0-r3';
const COMMAND=/^(?:job|lookup)(?:\s|$)/i;
let busy=false;
const $=selector=>document.querySelector(selector);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function line(text,type=''){
  const output=$('#terminal-output');
  if(!output)return;
  const row=document.createElement('div');
  row.className=`line ${type}`;
  row.textContent=String(text??'');
  output.append(row);
  output.scrollTop=output.scrollHeight;
}
function clearInput(){const input=$('#command-input');if(input)input.value=''}
async function api(){
  for(let attempt=0;attempt<100;attempt++){
    const current=window.CYBERTRMX_JOBS_R3;
    if(current?.enabled&&typeof current.call==='function')return current;
    await sleep(100);
  }
  throw new Error('R3 persistent queue module did not become ready.');
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
const status=value=>String(value||'unknown').replaceAll('_',' ').toUpperCase();
const inputOf=job=>String(job?.request_payload?.input||'Input unavailable').slice(0,253);
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
    return;
  }
  const sub=(parts[1]||'list').toLowerCase();
  const jobId=parts[2]||'';
  if(sub==='list'||sub==='queue'){
    const data=await invoke('queue_status');
    const jobs=data.jobs||[];
    if(!jobs.length){line('persistent queue is empty','block');return}
    jobs.slice(0,16).forEach(job=>line(`${job.id}  ${status(job.status)}  ${Number(job.progress)||0}%  ${inputOf(job)}`,'block'));
    return;
  }
  if(!jobId){line('usage: job <status|cancel|retry> <job-id>','warn');return}
  if(sub==='status'){
    const data=await invoke('job_status',{job_id:jobId});
    const job=data.job||{};
    line(`${job.id||jobId}  ${status(job.status)}  ${Number(job.progress)||0}%  attempt ${Number(job.attempt_count)||0}/${Number(job.max_attempts)||0}`,'block');
    return;
  }
  if(sub==='cancel'){
    const data=await invoke('cancel_job',{job_id:jobId});
    line(`job ${jobId} / ${status(data.job?.status)}`,'ok');
    return;
  }
  if(sub==='retry'){
    const data=await invoke('retry_job',{job_id:jobId});
    line(`retry queued: ${data.job_id}`,'ok');
    return;
  }
  line('usage: job <list|status|cancel|retry> [job-id]','warn');
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
