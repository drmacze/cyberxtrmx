(()=>{
'use strict';
const BUILD='5.3.3';
const coarse=matchMedia('(pointer:coarse)').matches;
const lowPower=coarse||Boolean(navigator.connection?.saveData)||Boolean(navigator.deviceMemory&&navigator.deviceMemory<=4);
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
  setTimeout(()=>boot.remove(),420);
}
function armBootWatchdog(){
  if(coarse)setTimeout(()=>releaseBoot('touch-shell'),180);
  setTimeout(()=>releaseBoot('startup-watchdog'),2200);
  window.addEventListener('load',()=>setTimeout(()=>releaseBoot('window-load'),220),{once:true});
  window.addEventListener('error',()=>setTimeout(()=>releaseBoot('startup-error'),40),{capture:true});
  window.addEventListener('unhandledrejection',()=>setTimeout(()=>releaseBoot('startup-rejection'),40));
}
function appendStyle(href,id){
  if(document.querySelector(`#${id}`))return;
  const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;document.head.append(link);
}
function loadScript(name){
  if(document.querySelector(`script[data-module="${name}"]`))return Promise.resolve();
  return new Promise((resolve)=>{
    const script=document.createElement('script');
    script.src=`./${name}.js?v=${BUILD}`;script.defer=true;script.dataset.module=name;
    script.onload=resolve;script.onerror=resolve;document.head.append(script);
  });
}
function loadModule(name){
  appendStyle(`./${name}.css?v=${BUILD}`,`cybertrmx-${name}-style`);
  return loadScript(name);
}
function loadExternal(src,id){
  const existing=document.querySelector(`#${id}`);if(existing)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.id=id;script.src=src;script.async=true;
    script.onload=resolve;script.onerror=reject;document.head.append(script);
  });
}
function tab(name){
  if(name==='guide'&&window.openCyberGuide){window.openCyberGuide();return}
  if(name==='patch'){
    if(window.CYBERTRMX_PATCH)window.CYBERTRMX_PATCH.open();
    else loadScript('patch-page').then(()=>window.CYBERTRMX_PATCH?.open());
    return;
  }
  if(name==='operations'){
    if(window.CYBERTRMX_OPERATIONS){window.CYBERTRMX_OPERATIONS.open();return}
    window.toast?.('Operations is connecting');
    loadScript('cloud-bootstrap');
    let tries=0;const timer=setInterval(()=>{tries++;if(window.CYBERTRMX_OPERATIONS){clearInterval(timer);window.CYBERTRMX_OPERATIONS.open()}else if(tries>=20)clearInterval(timer)},250);
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
    lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(time=>lenis.raf(time*1000));gsap.ticker.lagSmoothing(0);
  }
  gsap.from('.hero-frame',{opacity:0,scale:.985,duration:.8,ease:'power3.out'});
  gsap.from('.hero-eyebrow,.hero-title,.hero-desc,.hero-meta',{y:24,opacity:0,duration:.75,ease:'power3.out',stagger:.07,delay:.1});
  document.querySelectorAll('[data-reveal]').forEach(element=>gsap.from(element,{y:40,opacity:0,duration:.8,ease:'power3.out',scrollTrigger:{trigger:element,start:'top 88%',toggleActions:'play none none reverse'}}));
  ScrollTrigger.refresh();
}
async function loadDesktopMotion(){
  if(lowPower||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  try{
    appendStyle('https://unpkg.com/lenis@1.3.25/dist/lenis.css','cybertrmx-lenis-style');
    await loadExternal('https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js','cybertrmx-gsap');
    await loadExternal('https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js','cybertrmx-scroll-trigger');
    await loadExternal('https://unpkg.com/lenis@1.3.25/dist/lenis.min.js','cybertrmx-lenis');
    initMotion();
  }catch(error){console.warn('Optional motion libraries unavailable',error)}
}
function scheduleFeatureModules(){
  const schedule=(delay,task)=>setTimeout(task,delay);
  schedule(30,()=>loadScript('copy-refresh'));
  schedule(90,()=>loadScript('terminal-v2'));
  schedule(150,()=>loadScript('command-hints'));
  schedule(210,()=>loadScript('command-hints-v52'));
  schedule(320,()=>loadScript('intel'));
  schedule(430,()=>loadScript('intel-workspace'));
  schedule(560,()=>loadScript('profile'));
  schedule(700,()=>loadScript('guide'));
  schedule(850,()=>loadModule('system-upgrade'));
  schedule(1000,()=>loadModule('tracker-v2'));
  schedule(lowPower?1500:950,()=>loadScript('cloud-bootstrap'));
}

armBootWatchdog();
if('scrollRestoration' in history)history.scrollRestoration='manual';
window.addEventListener('pageshow',()=>{if(!location.hash)requestAnimationFrame(()=>scrollTo(0,0))},{once:true});
window.addEventListener('DOMContentLoaded',()=>{
  buildNav();releaseBoot('dom-ready');scheduleFeatureModules();
  if(!lowPower)window.addEventListener('load',()=>setTimeout(loadDesktopMotion,700),{once:true});
});
})();