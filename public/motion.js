(()=>{
'use strict';
const BUILD='5.3.2';
const lowPower=matchMedia('(pointer:coarse)').matches||Boolean(navigator.connection?.saveData)||Boolean(navigator.deviceMemory&&navigator.deviceMemory<=4);
let bootReleased=false;

function releaseBoot(reason='ready'){
  if(bootReleased)return;
  const boot=document.querySelector('#boot-screen');
  if(!boot)return;
  bootReleased=true;
  boot.dataset.releaseReason=reason;
  boot.classList.add('done');
  boot.setAttribute('aria-hidden','true');
  document.documentElement.dataset.cybertrmxReady=BUILD;
  setTimeout(()=>boot.remove(),650);
}
function armBootWatchdog(){
  setTimeout(()=>releaseBoot('startup-watchdog'),3200);
  window.addEventListener('load',()=>setTimeout(()=>releaseBoot('window-load'),1600),{once:true});
  window.addEventListener('error',()=>setTimeout(()=>releaseBoot('startup-error'),120),{capture:true});
  window.addEventListener('unhandledrejection',()=>setTimeout(()=>releaseBoot('startup-rejection'),120));
}
function loadModule(name){
  if(!document.querySelector(`link[data-module="${name}"]`)){
    const css=document.createElement('link');css.rel='stylesheet';css.href=`./${name}.css?v=${BUILD}`;css.dataset.module=name;document.head.append(css);
  }
  if(!document.querySelector(`script[data-module="${name}"]`)){
    const js=document.createElement('script');js.src=`./${name}.js?v=${BUILD}`;js.defer=true;js.dataset.module=name;document.head.append(js);
  }
}
function loadScript(name){
  if(document.querySelector(`script[data-module="${name}"]`))return;
  const js=document.createElement('script');js.src=`./${name}.js?v=${BUILD}`;js.defer=true;js.dataset.module=name;document.head.append(js);
}
function tab(name){
  if(name==='guide'&&window.openCyberGuide){window.openCyberGuide();return}
  if(name==='patch'){
    if(window.CYBERTRMX_PATCH)window.CYBERTRMX_PATCH.open();
    else setTimeout(()=>window.CYBERTRMX_PATCH?.open(),180);
    return;
  }
  if(name==='operations'){
    if(window.CYBERTRMX_OPERATIONS)window.CYBERTRMX_OPERATIONS.open();
    else{
      window.toast?.('Operations is connecting');
      let tries=0;
      const timer=setInterval(()=>{
        tries++;
        if(window.CYBERTRMX_OPERATIONS){clearInterval(timer);window.CYBERTRMX_OPERATIONS.open()}
        else if(tries>=16)clearInterval(timer);
      },250);
    }
    return;
  }
  const target=document.querySelector(`.nav-item[data-tab="${name}"]`)||document.querySelector(`[data-tab="${name}"]`);
  if(target)target.click();
}
function buildNav(){
  if(document.querySelector('.floating-nav'))return;
  const nav=document.createElement('div');nav.className='floating-nav';
  nav.innerHTML=`<div class="floating-links"><button data-go="overview">Home</button><button data-go="terminal">Terminal</button><button data-go="intel">Intel</button><button data-go="monitor">Monitor</button><button data-go="operations">Operations</button><button data-go="profile">Profile</button><button data-go="guide">Guide</button><button data-go="patch">Patch</button></div><button class="floating-trigger" aria-label="Open navigation"><i></i><span></span><i></i></button>`;
  document.body.append(nav);
  const trigger=nav.querySelector('.floating-trigger');trigger.addEventListener('click',()=>nav.classList.toggle('open'));
  nav.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>{tab(button.dataset.go);nav.classList.remove('open')}));
  document.addEventListener('click',event=>{if(!nav.contains(event.target))nav.classList.remove('open')});
}
function initMotion(){
  if(lowPower||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(!window.gsap||!window.ScrollTrigger)return;
  gsap.registerPlugin(ScrollTrigger);
  if(window.Lenis&&matchMedia('(pointer:fine)').matches){
    const lenis=new Lenis({smoothWheel:true,lerp:.09,anchors:true});
    lenis.on('scroll',ScrollTrigger.update);
    gsap.ticker.add(time=>lenis.raf(time*1000));
    gsap.ticker.lagSmoothing(0);
  }
  gsap.from('.hero-frame',{opacity:0,scale:.985,duration:1.15,ease:'power3.out'});
  gsap.from('.hero-eyebrow,.hero-title,.hero-desc,.hero-meta',{y:34,opacity:0,duration:1,ease:'power3.out',stagger:.1,delay:.15});
  gsap.to('.hero-glow',{xPercent:-14,yPercent:10,scrollTrigger:{trigger:'.hero-frame',start:'top top',end:'bottom top',scrub:1}});
  document.querySelectorAll('[data-reveal]').forEach(element=>gsap.from(element,{y:60,opacity:0,duration:1.05,ease:'power3.out',scrollTrigger:{trigger:element,start:'top 82%',toggleActions:'play none none reverse'}}));
  document.querySelectorAll('.principle').forEach((element,index)=>gsap.from(element,{y:36,opacity:0,duration:.85,delay:index*.05,scrollTrigger:{trigger:element,start:'top 88%'}}));
  gsap.from('.warning-stage',{clipPath:'inset(12% 8% 12% 8% round 30px)',opacity:.25,scrollTrigger:{trigger:'.warning-stage',start:'top 85%',end:'top 30%',scrub:1}});
  ScrollTrigger.refresh();
}

armBootWatchdog();
loadModule('system-upgrade');
loadModule('tracker-v2');
loadScript('patch-page');
loadScript('terminal-v2');
loadScript('command-hints');
loadScript('command-hints-v52');
loadScript('copy-refresh');
window.addEventListener('DOMContentLoaded',()=>{
  buildNav();
  setTimeout(initMotion,lowPower?900:120);
  setTimeout(()=>releaseBoot('dom-ready'),lowPower?1800:2600);
  setTimeout(()=>loadScript('cloud-bootstrap'),lowPower?1200:450);
});
})();