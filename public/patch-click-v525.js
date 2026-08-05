(()=>{
'use strict';
let loading=null;
function removeStaleScripts(){
  document.querySelectorAll('script[data-module="patch-page"],#cybertrmx-patch-page').forEach(script=>script.remove());
}
function waitForPatch(timeout=5000){
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const tick=()=>{
      if(window.CYBERTRMX_PATCH?.open){resolve(window.CYBERTRMX_PATCH);return}
      if(Date.now()-started>=timeout){reject(new Error('PATCH_MODULE_TIMEOUT'));return}
      setTimeout(tick,80);
    };
    tick();
  });
}
function loadPatchScript(){
  removeStaleScripts();
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.id='cybertrmx-patch-page';
    script.src=`./patch-page.js?v=5.2.6&ts=${Date.now()}`;
    script.async=false;
    script.onload=()=>waitForPatch().then(resolve,reject);
    script.onerror=()=>reject(new Error('PATCH_MODULE_LOAD_FAILED'));
    document.head.append(script);
  });
}
async function ensurePatch(){
  if(window.CYBERTRMX_PATCH?.open)return window.CYBERTRMX_PATCH;
  if(loading)return loading;
  loading=loadPatchScript().catch(async error=>{
    console.warn('CYBERTRMX Patch first load failed',error);
    removeStaleScripts();
    await new Promise(resolve=>setTimeout(resolve,120));
    return loadPatchScript();
  }).finally(()=>{loading=null});
  return loading;
}
async function openPatch(event){
  if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
  try{
    const patch=await ensurePatch();
    patch.open();
  }catch(error){
    console.error('CYBERTRMX Patch loader failed',error);
    window.toast?.('Patch could not be opened. Reloading the release page module.');
  }
}
document.addEventListener('pointerup',event=>{
  const target=event.target.closest?.('[data-go="patch"], [data-tab="patch"], #open-patch');
  if(target)openPatch(event);
},true);
document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-go="patch"], [data-tab="patch"], #open-patch');
  if(target)openPatch(event);
},true);
window.CYBERTRMX_PATCH_LOADER={open:openPatch,ensure:ensurePatch};
})();