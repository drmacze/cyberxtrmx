(()=>{
'use strict';
const VERSION='5.3.0-r3';
window.CYBERTRMX_ENV='staging';
window.CYBERTRMX_BUILD_VERSION=VERSION;
function mount(){
  if(document.querySelector('#cybertrmx-staging-marker'))return;
  const badge=document.createElement('div');
  badge.id='cybertrmx-staging-marker';
  badge.textContent=`STAGING / ${VERSION} / LOADING`;
  Object.assign(badge.style,{position:'fixed',zIndex:'3000',top:'calc(env(safe-area-inset-top, 0px) + 10px)',right:'10px',padding:'7px 10px',border:'1px solid rgba(227,58,78,.45)',borderRadius:'999px',background:'rgba(8,9,11,.9)',color:'#e85a70',font:'700 8px ui-monospace,SFMono-Regular,Menlo,monospace',letterSpacing:'.1em',pointerEvents:'none',backdropFilter:'blur(12px)'});
  document.body.append(badge);
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(window.CYBERTRMX_JOBS_R3?.enabled){badge.textContent=`STAGING / ${VERSION} / READY`;clearInterval(timer);return}
    if(attempts>=80){badge.textContent=`STAGING / ${VERSION} / LOAD ERROR`;clearInterval(timer)}
  },100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
