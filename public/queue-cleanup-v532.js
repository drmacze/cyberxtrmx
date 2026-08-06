(()=>{
'use strict';
const VERSION='5.3.3';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const shortId=value=>{const id=String(value||'');return id.length>16?`${id.slice(0,8)}…${id.slice(-4)}`:id};
let queueObserver=null,observedList=null,scheduled=false,discoveryTimer=null;
async function copyText(text){
  const value=String(text||'');
  try{await navigator.clipboard.writeText(value)}catch{
    const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove();
  }
}
function updateCopyButton(button,id){button.textContent='COPIED';window.toast?.(`Job ID copied / ${shortId(id)}`);setTimeout(()=>button.textContent='COPY ID',1100)}
function decorateQueue(){
  const card=$('#ops-r3-queue-card');
  if(!card)return false;
  const eyebrow=$('.ops-card-head small',card);
  if(eyebrow&&eyebrow.textContent!=='PERSISTENT QUEUE / PRODUCTION 5.3.3')eyebrow.textContent='PERSISTENT QUEUE / PRODUCTION 5.3.3';
  const note=$('.r2-worker-note',card);
  if(note&&note.dataset.cleanupVersion!==VERSION){
    note.innerHTML='<b>PERSISTENT QUEUE RECEIPT</b> · Jobs continue in the backend after this page closes. Use Events for the full lifecycle or copy the job ID for terminal commands.';
    note.dataset.cleanupVersion=VERSION;
  }
  $$('.r2-queue-row',card).forEach(row=>{
    const source=$('[data-r3-open]',row),id=source?.dataset.r3Open;
    if(!id)return;
    let identity=$('.r532-job-identity',row);
    if(!identity){
      identity=document.createElement('div');identity.className='r532-job-identity';
      const code=document.createElement('code'),label=document.createElement('span');label.textContent='JOB ID';identity.append(code,label);
      const main=$('.r2-queue-main',row);main?.insertBefore(identity,main.children[1]||null);
    }
    const code=$('code',identity);
    if(code&&identity.dataset.jobId!==id){code.textContent=shortId(id);code.title=id;identity.dataset.jobId=id}
    const actions=$('.r2-queue-actions',row);
    let button=actions?.querySelector('[data-r533-copy],[data-r532-copy]');
    if(actions&&!button){button=document.createElement('button');button.type='button';button.className='ops-mini';button.textContent='COPY ID';actions.prepend(button)}
    if(button){button.removeAttribute('data-r532-copy');button.dataset.r533Copy=id}
  });
  return true;
}
function scheduleDecorate(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;decorateQueue()});
}
function attachQueueObserver(){
  const list=$('#r3-queue-list');
  if(!list)return false;
  if(list===observedList){scheduleDecorate();return true}
  queueObserver?.disconnect();observedList=list;
  queueObserver=new MutationObserver(scheduleDecorate);
  queueObserver.observe(list,{childList:true});
  scheduleDecorate();
  return true;
}
function discoverQueue(){
  if(attachQueueObserver()){if(discoveryTimer){clearInterval(discoveryTimer);discoveryTimer=null}return true}
  return false;
}
function extendHints(){
  const api=window.CYBERTRMX_COMMAND_HINTS;if(!api?.commands)return false;
  const items=[
    {command:'job events <job-id-or-prefix>',category:'Jobs',description:'Show the persistent queue lifecycle and provider stages.'},
    {command:'job copy <job-id-or-prefix>',category:'Jobs',description:'Copy the complete job UUID from a short prefix.'}
  ];
  items.forEach(item=>{if(!api.commands.some(existing=>existing.command===item.command))api.commands.push(item)});
  return true;
}
document.addEventListener('click',async event=>{
  const copy=event.target.closest?.('[data-r533-copy]');
  if(copy){event.preventDefault();await copyText(copy.dataset.r533Copy);updateCopyButton(copy,copy.dataset.r533Copy);return}
  if(event.target.closest?.('[data-go="operations"],[data-tab="operations"]'))setTimeout(discoverQueue,250);
},true);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')discoverQueue()});
function init(){
  discoverQueue();
  if(!observedList){let attempts=0;discoveryTimer=setInterval(()=>{attempts++;if(discoverQueue()||attempts>=40){clearInterval(discoveryTimer);discoveryTimer=null}},250)}
  if(!extendHints()){let tries=0;const timer=setInterval(()=>{tries++;if(extendHints()||tries>80)clearInterval(timer)},100)}
  window.dispatchEvent(new CustomEvent('cybertrmx:queue-cleanup-ready',{detail:{version:VERSION,observerScope:'queue-list'}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
