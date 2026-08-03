(()=>{
'use strict';
function setText(selector,text){const element=document.querySelector(selector);if(element)element.textContent=text}
function refresh(){
  setText('.hero-eyebrow','CONNECTED SECURITY OPERATIONS / NODE-07');
  setText('.hero-desc','A connected security operations workspace for managing cases, verified assets, public intelligence, evidence, live job events, and permission-based device check-ins.');
  const interfaceValue=document.querySelector('.hero-meta>div:nth-child(3) strong');if(interfaceValue)interfaceValue.textContent='SECURE WORKSPACE 5.0';
  const headings=document.querySelectorAll('.section-heading');
  if(headings[0])headings[0].textContent='One workspace for the full investigation trail.';
  if(headings[1])headings[1].textContent='Built to keep technical work clear, accountable, and easy to follow.';
  if(headings[2])headings[2].textContent='Your current workspace, at a glance.';
  const copies=document.querySelectorAll('.section-copy');
  if(copies[0])copies[0].textContent='Sources, cases, assets, jobs, events, and evidence now stay connected from the first lookup to the final record. Each completed collection keeps its provider, timestamp, event history, and evidence digest.';
  if(copies[1])copies[1].textContent='CYBERTRMX keeps the depth of a technical operations console without hiding what is happening. You can see the scope, provider, job state, result, and evidence behind each action.';
  const principles=document.querySelectorAll('.principle');
  if(principles[0]){principles[0].querySelector('b').textContent='Connected by default';principles[0].querySelector('p').textContent='Cases, verified scope, jobs, evidence, check-ins, and audit history share one secure backend.'}
  if(principles[1]){principles[1].querySelector('b').textContent='Terminal and interface';principles[1].querySelector('p').textContent='Use the visual workspace or run connected commands for cases, scope, DNS, RDAP, IP enrichment, and check-in requests.'}
  if(principles[2]){principles[2].querySelector('b').textContent='Every action leaves a trail';principles[2].querySelector('p').textContent='Job stages, provider responses, timestamps, evidence digests, and workspace changes remain visible and reviewable.'}
  const visionItems=document.querySelectorAll('.vision-item');
  if(visionItems[0]){visionItems[0].querySelector('h3').textContent='Keep complex work understandable.';visionItems[0].querySelector('p').textContent='Turn cases, scope, collection jobs, evidence, telemetry, and check-ins into one clear operational flow.'}
  if(visionItems[1]){visionItems[1].querySelector('h3').textContent='Use real sources where they matter.';visionItems[1].querySelector('p').textContent='DNS, RDAP, public IP metadata, location permission, backend events, and evidence records come from the service handling the request.'}
  if(visionItems[2]){visionItems[2].querySelector('h3').textContent='Keep sensitive actions inside a clear boundary.';visionItems[2].querySelector('p').textContent='Asset ownership is verified before assessment work, location requests need visible approval, and external account credentials are never tested or changed.'}
  setText('.warning-stage small','OPERATOR NOTICE / SCOPE AND CONSENT');
  setText('.warning-stage h2','Good data starts with a clear boundary.');
  setText('.warning-stage p','Phone analysis reports numbering-plan metadata, not a person’s live position. Device location comes only from the device that opens the request and approves access. Domain ownership can be confirmed through DNS before deeper assessment work is enabled.');
  document.querySelectorAll('.home-actions button').forEach(button=>{if(button.dataset.tab==='terminal')button.textContent='OPEN TERMINAL';if(button.dataset.tab==='guide')button.textContent='VIEW FIELD GUIDE'});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
})();
