(()=>{
'use strict';
const CONFIG=window.CYBERTRMX_BACKEND||{};
const SEC=window.CYBERTRMX_SECURITY||{};
const VERSION='5.3.0-r3';
const $=(selector,root=document)=>root.querySelector(selector);
const safe=(value,max=180)=>String(value??'').replace(/[<>]/g,'').trim().slice(0,max);
const notify=message=>window.toast?window.toast(message):console.log(message);
const deviceId=SEC.getDeviceId?.()||crypto.randomUUID();
const deviceMeta=SEC.deviceMeta?.()||{label:'Device / Browser',platform:'Device',browser:'Browser'};
let client=null;
let pollTimer=null;
let securityInflight=null;
let lastSecurity=null;
let lastDashboard=null;
let mfaGate=null;
let enrollment=null;
const readInflight=new Map();
const readCache=new Map();

class SecureApiError extends Error{
  constructor(payload,status=0){
    super(SEC.friendlyError?.(payload,'The request could not be completed.')||'The request could not be completed.');
    this.code=payload?.error||'REQUEST_FAILED';
    this.status=status;
    this.retryable=Boolean(payload?.retryable);
    this.requestId=payload?.request_id||'';
    this.details=payload?.details||{};
    this.context={json:async()=>payload};
  }
}
function functionUrl(name){return `${CONFIG.url}/functions/v1/${encodeURIComponent(name)}`}
async function session(){return (await client?.auth.getSession())?.data?.session||null}
function noRealtimeChannel(){
  const channel={on(){return channel},subscribe(callback){queueMicrotask(()=>callback?.('SUBSCRIBED'));return channel},unsubscribe(){return Promise.resolve('ok')}};
  return channel;
}
function requestKey(name,body){
  const action=String(body?.action||'');
  if(name!==CONFIG.operationsFunction||!['dashboard','security_status','job_status'].includes(action))return'';
  return `${name}:${action}:${body?.workspace_id||''}:${body?.job_id||''}`;
}
async function performInvoke(name,options={}){
  const active=await session();
  const body=options.body||{};
  const headers={
    'Content-Type':'application/json',
    apikey:CONFIG.publishableKey,
    Authorization:`Bearer ${active?.access_token||''}`,
    'x-device-id':deviceId,
    'x-device-label':safe(deviceMeta.label,80).replace(/[^\x20-\x7E]/g,' '),
    'x-device-platform':safe(deviceMeta.platform,80).replace(/[^\x20-\x7E]/g,' '),
    'x-device-browser':safe(deviceMeta.browser,80).replace(/[^\x20-\x7E]/g,' '),
    'x-client-version':VERSION,
    'x-idempotency-key':SEC.idempotencyKey?.()||crypto.randomUUID()
  };
  let response=null;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    try{
      response=await fetch(functionUrl(name),{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',credentials:'omit',signal:controller.signal});
      clearTimeout(timeout);
      break;
    }catch(error){
      clearTimeout(timeout);
      if(attempt||error?.name!=='AbortError')return{data:null,error:new SecureApiError({error:'NETWORK_ERROR',message:'The backend connection could not be completed.',retryable:true})};
    }
  }
  const payload=await response.json().catch(()=>({error:`REQUEST_${response.status}`,message:'The backend returned an unreadable response.'}));
  if(!response.ok||payload?.error)return{data:null,error:new SecureApiError(payload,response.status)};
  if(body.action==='dashboard')lastDashboard=payload;
  return{data:payload,error:null};
}
async function secureInvoke(name,options={}){
  const body=options.body||{};
  const key=requestKey(name,body);
  if(!key)return performInvoke(name,options);
  const cached=readCache.get(key);
  if(cached&&Date.now()-cached.at<1500)return cached.value;
  if(readInflight.has(key))return readInflight.get(key);
  const task=performInvoke(name,options).then(value=>{if(!value.error)readCache.set(key,{at:Date.now(),value});return value}).finally(()=>readInflight.delete(key));
  readInflight.set(key,task);
  return task;
}
function patchSupabase(){
  const sdk=window.supabase;
  if(!sdk?.createClient||sdk.createClient.__cybertrmxR3)return;
  const original=sdk.createClient.bind(sdk);
  const wrapped=(...args)=>{
    const instance=original(...args);
    client=instance;
    window.CYBERTRMX_SECURE_CLIENT=instance;
    instance.functions.invoke=secureInvoke;
    instance.channel=noRealtimeChannel;
    instance.removeChannel=async()=>({data:'ok',error:null});
    return instance;
  };
  wrapped.__cybertrmxR3=true;
  sdk.createClient=wrapped;
}
function terminalLine(text,type=''){
  const output=$('#terminal-output');if(!output)return;
  const row=document.createElement('div');row.className=`line ${type}`;row.textContent=text;output.append(row);output.scrollTop=output.scrollHeight;
}
function protectTerminal(){
  document.addEventListener('submit',event=>{
    if(event.target?.id!=='terminal-form')return;
    const input=$('#command-input'),raw=input?.value.trim()||'';
    if(!/^auth\s+(?:login|create)\b/i.test(raw))return;
    event.preventDefault();event.stopImmediatePropagation();
    terminalLine(`root@trmx# ${raw.replace(/^((?:auth\s+(?:login|create))\s+).*$/i,'$1[REDACTED]')}`,'command');
    terminalLine('Credentials are only accepted in the protected account form.','warn');
    terminalLine('Use: auth open','block');input.value='';
    window.CYBERTRMX_OPERATIONS?.open?.();
  },true);
}
function addSecurityCard(){
  if($('#ops-security-card'))return true;
  const auth=$('#ops-auth-card');if(!auth)return false;
  const card=document.createElement('article');card.id='ops-security-card';card.className='ops-card wide ops-private-card';card.hidden=true;
  card.innerHTML='<div class="ops-card-head"><div><small>ACCOUNT SECURITY</small><h3>Security center</h3></div><span id="security-aal">AAL1</span></div><div id="security-center-body"><div class="ops-empty">Security status will appear after sign-in.</div></div>';
  auth.insertAdjacentElement('afterend',card);return true;
}
function securityButton(label,action,kind=''){return `<button class="ops-mini ${kind}" data-security-action="${action}">${label}</button>`}
function formatDate(value){return value?new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'—'}
function cleanDeviceLabel(item){
  const raw=String(item?.label||'');
  if(/Ã|Â|�/.test(raw))return `${item?.platform||'Device'} / ${item?.browser||'Browser'}`;
  return raw||`${item?.platform||'Device'} / ${item?.browser||'Browser'}`;
}
async function call(action,payload={}){
  const result=await secureInvoke(CONFIG.operationsFunction,{body:{action,...payload}});
  if(result.error)throw result.error;return result.data;
}
async function loadSecurity(silent=false){
  if(securityInflight)return securityInflight;
  if(!client)return null;
  securityInflight=(async()=>{
    const active=await session();if(!active){$('#ops-security-card')?.setAttribute('hidden','');return null}
    try{
      const [status,factors,aal]=await Promise.all([
        call('security_status'),
        client.auth.mfa.listFactors(),
        client.auth.mfa.getAuthenticatorAssuranceLevel()
      ]);
      if(factors.error)throw factors.error;if(aal.error)throw aal.error;
      lastSecurity={status,dashboard:lastDashboard||{},factors:factors.data,aal:aal.data};
      renderSecurity();return lastSecurity;
    }catch(error){if(!silent)notify(error.message||'Security status could not be loaded');return null}
  })().finally(()=>{securityInflight=null});
  return securityInflight;
}
function renderSecurity(){
  const card=$('#ops-security-card'),body=$('#security-center-body');if(!card||!body||!lastSecurity)return;
  card.hidden=false;
  const {status,dashboard,factors,aal}=lastSecurity;
  const verified=[...(factors?.totp||[]),...(factors?.phone||[])].filter(factor=>factor.status==='verified');
  const currentLevel=aal?.currentLevel||status?.aal||dashboard?.security?.aal||'aal1';
  $('#security-aal').textContent=currentLevel.toUpperCase();
  const devices=status?.devices||dashboard?.devices||[];
  const events=dashboard?.security_events||[];
  body.innerHTML=`<div class="security-summary"><div><small>ASSURANCE</small><strong>${currentLevel.toUpperCase()}</strong><span>${verified.length?'Authenticator protection enabled':'Password session'}</span></div><div><small>CURRENT DEVICE</small><strong>${safe(deviceMeta.platform)}</strong><span>${deviceId.slice(0,8)} / ${safe(deviceMeta.browser)}</span></div><div><small>ACTIVE DEVICES</small><strong>${devices.filter(item=>!item.revoked_at).length}</strong><span>${devices.length} registered</span></div><div><small>RECENT EVENTS</small><strong>${events.length}</strong><span>security ledger</span></div></div>
  <div class="security-columns"><section><div class="security-title"><div><small>AUTHENTICATOR</small><h4>Multi-factor access</h4></div>${securityButton(verified.length?'ADD FACTOR':'SET UP MFA','mfa-enroll')}</div><div class="security-list">${verified.length?verified.map(factor=>`<div class="security-item"><div><strong>${safe(factor.friendly_name||'Authenticator app')}</strong><small>${safe(factor.factor_type||'totp').toUpperCase()} / VERIFIED</small></div>${securityButton('REMOVE',`mfa-remove:${factor.id}`,'danger')}</div>`).join(''):'<div class="ops-empty">Add an authenticator app to protect signed-in sessions with a second factor.</div>'}</div></section>
  <section><div class="security-title"><div><small>DEVICES</small><h4>Account sessions</h4></div><span>${deviceId.slice(0,8)}</span></div><div class="security-list">${devices.map(item=>`<div class="security-item ${item.device_id===deviceId?'current':''}"><div><strong>${safe(cleanDeviceLabel(item))}</strong><small>${safe(item.platform||'Device')} / ${safe(item.browser||'Browser')} / ${item.revoked_at?'REVOKED':formatDate(item.last_seen_at)}</small></div><div class="ops-row-actions">${securityButton('RENAME',`device-rename:${item.device_id}`)}${!item.revoked_at?securityButton(item.device_id===deviceId?'REVOKE THIS':'REVOKE',`device-revoke:${item.device_id}`,'danger'):''}</div></div>`).join('')||'<div class="ops-empty">No registered devices.</div>'}</div></section></div>
  <section class="security-events"><div class="security-title"><div><small>SECURITY LEDGER</small><h4>Recent account events</h4></div><span>${events.length} EVENTS</span></div><div class="security-list">${events.map(item=>`<div class="security-event ${safe(item.severity)}"><div><strong>${safe(item.event_type).replaceAll('_',' ').toUpperCase()}</strong><small>${formatDate(item.created_at)} / ${safe(item.request_id).slice(0,13)}</small></div><em>${safe(item.severity).toUpperCase()}</em></div>`).join('')||'<div class="ops-empty">No recent security events.</div>'}</div></section>`;
  body.querySelectorAll('[data-security-action]').forEach(button=>button.onclick=()=>securityAction(button.dataset.securityAction));
}
function modal(){closeModal();const wrap=document.createElement('div');wrap.className='security-gate';wrap.id='security-gate';wrap.innerHTML='<div class="security-gate-card"></div>';document.body.append(wrap);mfaGate=wrap;return $('.security-gate-card',wrap)}
function closeModal(){mfaGate?.remove();mfaGate=null}
function qrSource(value){
  const raw=String(value||'');
  if(raw.startsWith('data:image/'))return raw;
  if(raw.includes('<svg'))return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
  return raw;
}
async function beginMfaEnrollment(){
  try{
    const enrolled=await client.auth.mfa.enroll({factorType:'totp',friendlyName:`CYBERTRMX ${deviceMeta.platform}`});if(enrolled.error)throw enrolled.error;
    enrollment=enrolled.data;
    const card=modal();
    card.innerHTML='<small>AUTHENTICATOR SETUP</small><h3>Protect this account</h3><p>Scan the QR code with an authenticator app, then enter the six-digit code.</p><img class="security-qr" id="security-r3-qr" alt="Authenticator QR code"><code class="security-secret" id="security-r3-secret"></code><form id="security-enroll-form"><input id="security-enroll-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="000000"><button class="ops-button">ENABLE MFA</button><button type="button" class="ops-button secondary" id="security-enroll-cancel">CANCEL</button></form>';
    $('#security-r3-qr').src=qrSource(enrollment.totp.qr_code);
    $('#security-r3-secret').textContent=safe(enrollment.totp.secret,160);
    $('#security-enroll-cancel').onclick=async()=>{try{await client.auth.mfa.unenroll({factorId:enrollment.id})}catch{}closeModal()};
    $('#security-enroll-form').onsubmit=verifyEnrollment;
  }catch(error){notify(error.message||'Authenticator setup could not be started')}
}
async function verifyEnrollment(event){
  event.preventDefault();const code=safe($('#security-enroll-code')?.value,12);if(code.length<6){notify('Enter the current authenticator code');return}
  try{const challenge=await client.auth.mfa.challenge({factorId:enrollment.id});if(challenge.error)throw challenge.error;const verified=await client.auth.mfa.verify({factorId:enrollment.id,challengeId:challenge.data.id,code});if(verified.error)throw verified.error;closeModal();notify('Authenticator protection enabled');await loadSecurity(true)}catch(error){notify(error.message||'Authenticator code was not accepted')}
}
async function enforceMfa(){
  if(!client)return;
  const [levels,factors]=await Promise.all([client.auth.mfa.getAuthenticatorAssuranceLevel(),client.auth.mfa.listFactors()]);
  if(levels.error||factors.error)return;
  const verified=factors.data.totp?.filter(item=>item.status==='verified')||[];
  if(levels.data.currentLevel==='aal1'&&levels.data.nextLevel==='aal2'&&verified.length){
    const factor=verified[0],card=modal();
    card.innerHTML='<small>SECOND FACTOR</small><h3>Verify this sign-in</h3><p>Enter the code from your authenticator app to finish opening Operations.</p><form id="security-challenge-form"><input id="security-challenge-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="000000"><button class="ops-button">VERIFY SESSION</button><button type="button" class="ops-button secondary" id="security-challenge-signout">SIGN OUT</button></form>';
    $('#security-challenge-signout').onclick=()=>client.auth.signOut();
    $('#security-challenge-form').onsubmit=async event=>{event.preventDefault();try{const challenge=await client.auth.mfa.challenge({factorId:factor.id});if(challenge.error)throw challenge.error;const verify=await client.auth.mfa.verify({factorId:factor.id,challengeId:challenge.data.id,code:safe($('#security-challenge-code')?.value,12)});if(verify.error)throw verify.error;closeModal();notify('Session verified');window.CYBERTRMX_OPERATIONS?.refresh?.(true);await loadSecurity(true)}catch(error){notify(error.message||'Authenticator code was not accepted')}};
  }
}
async function securityAction(action){
  try{
    if(action==='mfa-enroll'){await beginMfaEnrollment();return}
    if(action.startsWith('mfa-remove:')){const id=action.split(':')[1];if(!confirm('Remove this authenticator factor?'))return;const result=await client.auth.mfa.unenroll({factorId:id});if(result.error)throw result.error;notify('Authenticator removed');await loadSecurity(true);return}
    if(action.startsWith('device-rename:')){const id=action.split(':')[1],label=prompt('Device name');if(!label)return;await call('rename_device',{device_id:id,label});notify('Device name updated');await loadSecurity(true);return}
    if(action.startsWith('device-revoke:')){const id=action.split(':')[1];if(!confirm('Revoke access from this device?'))return;await call('revoke_device',{device_id:id});notify('Device access revoked');if(id===deviceId)await client.auth.signOut();else await loadSecurity(true)}
  }catch(error){notify(`${error.message}${error.requestId?` / ${error.requestId}`:''}`)}
}
function passwordMeter(input){
  if(!input)return{strong:false,notes:['Password is required.']};
  let meter=input.parentElement.querySelector('.password-meter');if(!meter){meter=document.createElement('div');meter.className='password-meter';meter.innerHTML='<i></i><span>Use 12+ characters with mixed character types.</span>';input.insertAdjacentElement('afterend',meter)}
  const assessment=SEC.passwordAssessment?.(input.value)||{score:0,strong:false,notes:[]};meter.dataset.score=String(assessment.score);meter.querySelector('i').style.width=`${assessment.score*20}%`;meter.querySelector('span').textContent=assessment.strong?'Strong password':assessment.notes[0]||'Password needs more variety';return assessment;
}
function protectSignup(){
  document.addEventListener('input',event=>{if(event.target?.id==='ops-auth-password')passwordMeter(event.target)});
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('#ops-signup');if(!button||button.dataset.securityChecked==='1')return;
    event.preventDefault();event.stopImmediatePropagation();const input=$('#ops-auth-password'),password=input?.value||'',assessment=passwordMeter(input);
    if(!assessment.strong){notify('Use a stronger password before creating the account');return}
    button.disabled=true;
    try{const count=await SEC.compromisedPasswordCount(password);if(count>0){notify('This password appears in known breach data. Choose another password.');return}button.dataset.securityChecked='1';button.click();delete button.dataset.securityChecked}catch{notify('Password safety check is unavailable. Account creation was not sent.')}finally{button.disabled=false}
  },true);
}
function startPolling(){stopPolling();const tick=async()=>{if(document.visibilityState==='visible'&&await session())await loadSecurity(true);pollTimer=setTimeout(tick,15000)};pollTimer=setTimeout(tick,12000)}
function stopPolling(){if(pollTimer)clearTimeout(pollTimer);pollTimer=null}
async function afterCore(){
  addSecurityCard();protectTerminal();protectSignup();
  if(!client)client=window.CYBERTRMX_SECURE_CLIENT;
  if(!client)return;
  client.auth.onAuthStateChange((_event,current)=>setTimeout(async()=>{if(current){await enforceMfa();await loadSecurity(true);startPolling()}else{closeModal();stopPolling();$('#ops-security-card')?.setAttribute('hidden','')}},50));
  if(await session()){await enforceMfa();await loadSecurity(true);startPolling()}
}
function waitForCore(){let attempts=0;const timer=setInterval(()=>{attempts++;if(window.CYBERTRMX_OPERATIONS&&window.CYBERTRMX_SECURE_CLIENT){clearInterval(timer);afterCore()}else if(attempts>100)clearInterval(timer)},100)}
patchSupabase();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForCore,{once:true});else waitForCore();
window.CYBERTRMX_SECURITY_R3={version:VERSION,deviceId,loadSecurity,diagnostics:()=>({readCache:readCache.size,inflight:readInflight.size,lastDashboardAt:lastDashboard?.server_time||''})};
})();