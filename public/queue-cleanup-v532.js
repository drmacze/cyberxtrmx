(()=>{
'use strict';
const VERSION='5.3.2';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const shortId=value=>{const id=String(value||'');return id.length>16?`${id.slice(0,8)}…${id.slice(-4)}`:id};
async function copyText(text){
  const value=String(text||'');
  try{await navigator.clipboard.writeText(value)}catch{
    const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove();
  }
}
function updateCopyButton(button,id){button.textContent='COPIED';window.toast?.(`Job ID copied / ${shortId(id)}`);setTimeout(()=>button.textContent='COPY ID',1100)}
function decorateQueue(){
  const card=$('#ops-r3-queue-card');
  if(!card)return;
  const eyebrow=$('.ops-card-head small',card);if(eyebrow)eyebrow.textContent='PERSISTENT QUEUE / PRODUCTION 5.3.2';
  const note=$('.r2-worker-note',card);if(note)note.innerHTML='<b>PERSISTENT QUEUE RECEIPT</b> · Jobs continue in the backend after this page closes. Use Events for the full lifecycle or copy the job ID for terminal commands.';
  $$('.r2-queue-row',card).forEach(row=>{
    const source=$('[data-r3-open]',row);const id=source?.dataset.r3Open;if(!id)return;
    let identity=$('.r532-job-identity',row);
    if(!identity){identity=document.createElement('div');identity.className='r532-job-identity';const main=$('.r2-queue-main',row);main?.insertBefore(identity,main.children[1]||null)}
    identity.innerHTML=`<code title="${id}">${shortId(id)}</code><span>JOB ID</span>`;
    const actions=$('.r2-queue-actions',row);if(actions&&!$('[data-r532-copy]',actions)){const button=document.createElement('button');button.type='button';button.className='ops-mini';button.dataset.r532Copy=id;button.textContent='COPY ID';actions.prepend(button)}
  });
}
document.addEventListener('click',async event=>{const button=event.target.closest?.('[data-r532-copy]');if(!button)return;event.preventDefault();const id=button.dataset.r532Copy;await copyText(id);updateCopyButton(button,id)},true);
const observer=new MutationObserver(decorateQueue);
function init(){decorateQueue();observer.observe(document.body,{subtree:true,childList:true});window.dispatchEvent(new CustomEvent('cybertrmx:queue-cleanup-ready',{detail:{version:VERSION}}))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
