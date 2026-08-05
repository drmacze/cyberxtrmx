(()=>{
'use strict';
let loading=null;
function ensurePatch(){
  if(window.CYBERTRMX_PATCH?.open)return Promise.resolve(window.CYBERTRMX_PATCH);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    let script=document.querySelector('script[data-module="patch-page"],#cybertrmx-patch-page');
    const finish=()=>{
      let attempts=0;
      const timer=setInterval(()=>{
        attempts++;
        if(window.CYBERTRMX_PATCH?.open){clearInterval(timer);resolve(window.CYBERTRMX_PATCH)}
        else if(attempts>=50){clearInterval(timer);loading=null;reject(new Error('PATCH_MODULE_TIMEOUT'))}
      },100);
    };
    if(script){finish();return}
    script=document.createElement('script');
    script.id='cybertrmx-patch-page';
    script.src='./patch-page.js?v=5.2.5';
    script.async=true;
    script.onload=finish;
    script.onerror=()=>{loading=null;reject(new Error('PATCH_MODULE_LOAD_FAILED'))};
    document.head.append(script);
  });
  return loading;
}
async function openPatch(event){
  if(event){event.preventDefault();event.stopImmediatePropagation()}
  try{const patch=await ensurePatch();patch.open()}
  catch(error){console.error('CYBERTRMX Patch loader failed',error);window.toast?.('Patch could not be opened. Refresh once and try again.')}
}
document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-go="patch"], [data-tab="patch"], #open-patch');
  if(target)openPatch(event);
},true);
window.CYBERTRMX_PATCH_LOADER={open:openPatch,ensure:ensurePatch};
})();