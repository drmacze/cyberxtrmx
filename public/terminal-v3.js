(()=>{
'use strict';
const form=document.querySelector('#terminal-form'),input=document.querySelector('#command-input'),out=document.querySelector('#terminal-output');
if(!form||!input||!out)return;

const BASE_KEY='cybertrmx-v3';
const OPS_KEY='cybertrmx-op-v4';
const PENDING_KEY='trmx-op-pending-v4';
const PACKAGES=['nexus-core','recon-suite','game-resolver','cipher-lab'];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const now=()=>new Date().toLocaleTimeString('en-GB',{hour12:false});
const read=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return structuredClone(fallback)}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const random=(min,max)=>Math.floor(min+Math.random()*(max-min+1));
const choose=list=>list[random(0,list.length-1)];
const clean=(value,max=120)=>String(value??'').replace(/[<>]/g,'').trim().slice(0,max);

injectStyles();

function injectStyles(){
  if(document.querySelector('#terminal-engine-v4-style'))return;
  const style=document.createElement('style');
  style.id='terminal-engine-v4-style';
  style.textContent=`
  .op-run{margin:14px 0 18px;border-left:1px solid rgba(227,58,78,.38);padding-left:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .op-run-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;color:#d7dbe0;font-size:10px;letter-spacing:.12em}
  .op-run-head b{font-weight:700}.op-run-head span{color:#6f7882}
  .op-stage{display:grid;grid-template-columns:minmax(118px,180px) minmax(90px,1fr) 52px;gap:10px;align-items:center;min-height:29px;color:#7f8994;font-size:10px}
  .op-stage-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.op-stage-track{height:4px;background:#1d2126;overflow:hidden;position:relative}
  .op-stage-fill{height:100%;width:0;background:linear-gradient(90deg,#812033,#e33a4e);box-shadow:0 0 12px rgba(227,58,78,.24);transition:width .18s ease}
  .op-stage-value{text-align:right;color:#68717b}.op-stage-meta{grid-column:1/-1;margin:-3px 0 6px;color:#505860;font-size:9px;letter-spacing:.05em}
  .op-stage.done .op-stage-name,.op-stage.done .op-stage-value{color:#a8b0b8}.op-stage.failed .op-stage-name,.op-stage.failed .op-stage-value{color:#ff6578}.op-stage.failed .op-stage-fill{background:#ff405a}
  .op-result{margin:9px 0 2px;padding:10px 12px;background:rgba(255,255,255,.025);border-left:2px solid #424a53;color:#9ba4ad;font-size:10px;line-height:1.6}
  .op-result.ok{border-left-color:#b93447}.op-result.fail{border-left-color:#ff405a;color:#d19aa2}
  @media(max-width:620px){.op-stage{grid-template-columns:104px minmax(64px,1fr) 42px;gap:7px}.op-run{padding-left:10px}.op-stage-name{font-size:9px}.op-stage-meta{font-size:8px}}
  `;
  document.head.append(style);
}

function emit(text,type=''){
  const element=document.createElement('div');
  element.className=`line ${type}`.trim();
  element.textContent=text;
  out.append(element);
  out.scrollTop=out.scrollHeight;
  return element;
}
function setBusy(active,label='READY'){
  input.disabled=active;
  const stateLabel=document.querySelector('#terminal-state');
  if(stateLabel)stateLabel.textContent=active?label:'READY';
}
function loadBase(){return read(BASE_KEY,{})}
function syncBase(base){
  write(BASE_KEY,base);
  try{
    if(typeof state!=='undefined'&&state){
      Object.keys(state).forEach(key=>delete state[key]);
      Object.assign(state,structuredClone(base));
      if(typeof renderAll==='function')renderAll();
    }
  }catch{}
}
function event(base,channel,message,status='OK'){
  base.logs=Array.isArray(base.logs)?base.logs:[];
  base.logs.unshift({time:now(),channel,event:message,status});
  base.logs=base.logs.slice(0,80);
  base.events=(base.events||0)+1;
  syncBase(base);
}
function subjectKey(base){return `${base.session||'none'}:${base.target?.type||'none'}:${base.target?.id||'none'}`}
function defaultOp(base){
  const target=base.target?.id||'none';
  return {
    version:4,
    subject:subjectKey(base),
    risk:random(18,86),
    flags:{surface:false,fingerprint:false,identity:false,passive:false,deep:false,traceMap:false,traceVerified:false,gateAssessed:false,gateNegotiated:false,recoveryInspected:false,recoveryVerified:false},
    confidence:{surface:0,fingerprint:0,identity:0,trace:0,gate:0,recovery:0},
    audits:{password:null,email:null,id:null},
    attempts:{},cooldowns:{},artifacts:[],lastFailure:null,mutationPlan:null,
    anomalies:buildAnomalies(target)
  };
}
function buildAnomalies(seed){
  const pool=['regional shard divergence','historical alias discontinuity','recent recovery-channel rotation','device-bound trust boundary','provider policy opacity','activity blind interval','identity graph collision','federated ownership marker','security-hold residue','stale recovery metadata'];
  const count=random(1,3);const copy=[...pool];const result=[];
  for(let i=0;i<count;i++)result.push(copy.splice(random(0,copy.length-1),1)[0]);
  return result;
}
function loadOp(base){
  const all=read(OPS_KEY,{}),key=subjectKey(base);
  const op=all[key]||defaultOp(base);
  if(op.version!==4)return defaultOp(base);
  return op;
}
function saveOp(base,op){const all=read(OPS_KEY,{});all[subjectKey(base)]=op;write(OPS_KEY,all)}
function addArtifact(base,op,type,name,status='SEALED'){
  const item={type,name,time:now(),status};
  op.artifacts.push(item);
  base.evidence=Array.isArray(base.evidence)?base.evidence:[];
  base.evidence.push(item);
  saveOp(base,op);syncBase(base);
}
function attempt(op,name){op.attempts[name]=(op.attempts[name]||0)+1;return op.attempts[name]}
function cooldownRemaining(op,name){return Math.max(0,Math.ceil(((op.cooldowns[name]||0)-Date.now())/1000))}
function checkCooldown(op,name){
  const remaining=cooldownRemaining(op,name);
  if(remaining>0){emit(`${name}: cooldown active / ${remaining}s remaining`,'warn');emit('Use op explain to review the previous failure.','dim');return true}
  return false;
}
function applyFailure(base,op,name,reason,retryMin=10,retryMax=36){
  const seconds=random(retryMin,retryMax);
  op.cooldowns[name]=Date.now()+seconds*1000;
  op.lastFailure={operation:name,reason,time:now(),retryAt:Date.now()+seconds*1000};
  saveOp(base,op);
  event(base,'ENGINE',`${name} failed: ${reason}`,'FAILED');
}
function chanceFor(op,name,baseChance,{retryBonus=true,maxBonus=12}={}){
  const tries=attempt(op,name);
  const bonus=retryBonus?Math.min(maxBonus,(tries-1)*3):0;
  const riskPenalty=Math.floor((op.risk||0)/28);
  return Math.max(2,Math.min(95,baseChance+bonus-riskPenalty));
}
function makeRun(title,operationId){
  const wrap=document.createElement('div');wrap.className='op-run';
  wrap.innerHTML=`<div class="op-run-head"><b>${title}</b><span>${operationId}</span></div>`;
  out.append(wrap);out.scrollTop=out.scrollHeight;return wrap;
}
function makeStage(run,label,meta){
  const row=document.createElement('div');row.className='op-stage';
  row.innerHTML=`<span class="op-stage-name">${label}</span><span class="op-stage-track"><i class="op-stage-fill"></i></span><span class="op-stage-value">0%</span><small class="op-stage-meta">${meta||'awaiting stage event'}</small>`;
  run.append(row);return row;
}
function setStage(row,pct,meta,stateName='running'){
  row.querySelector('.op-stage-fill').style.width=`${pct}%`;
  row.querySelector('.op-stage-value').textContent=stateName==='failed'?'ERR':`${pct}%`;
  if(meta)row.querySelector('.op-stage-meta').textContent=meta;
  row.classList.toggle('done',stateName==='done');row.classList.toggle('failed',stateName==='failed');
  out.scrollTop=out.scrollHeight;
}
async function animateStage(run,stage,failConfig=null){
  const duration=random(stage.min,stage.max);
  const row=makeStage(run,stage.label,typeof stage.meta==='function'?stage.meta():stage.meta);
  const start=performance.now();let pct=0,nextSignal=random(16,34),signalIndex=0;
  const signals=stage.signals||['channel opened','response received','state normalized','integrity checked'];
  while(pct<100){
    const elapsed=performance.now()-start;
    const natural=Math.floor(Math.min(99,(elapsed/duration)*100));
    pct=Math.max(pct,Math.min(99,natural+random(0,5)));
    if(pct>=nextSignal&&signalIndex<signals.length){
      row.querySelector('.op-stage-meta').textContent=signals[signalIndex++];
      nextSignal+=random(14,28);
      if(Math.random()<.35)await wait(random(180,760));
    }
    if(failConfig&&pct>=failConfig.at){
      setStage(row,failConfig.at,failConfig.reason,'failed');
      return false;
    }
    setStage(row,pct,null,'running');
    await wait(random(90,230));
  }
  setStage(row,100,stage.complete||'stage completed','done');
  await wait(random(120,360));return true;
}
async function pipeline(base,op,title,name,stages,successChance,failurePool,options={}){
  if(checkCooldown(op,name))return false;
  const chance=chanceFor(op,name,successChance,options);
  const roll=random(1,100);const succeeds=roll<=chance;
  const failStage=succeeds?-1:random(Math.max(1,Math.floor(stages.length*.3)),stages.length-1);
  const reason=succeeds?'':choose(failurePool);
  const run=makeRun(title,`OP-${Date.now().toString(36).slice(-6).toUpperCase()}`);
  setBusy(true,title.toUpperCase());
  try{
    for(let i=0;i<stages.length;i++){
      const fail=i===failStage?{at:random(43,91),reason}:null;
      const ok=await animateStage(run,stages[i],fail);
      if(!ok){
        const result=document.createElement('div');result.className='op-result fail';result.textContent=`FAILED / ${reason} / chance ${chance}% / roll ${roll}`;run.append(result);
        applyFailure(base,op,name,reason,options.retryMin||10,options.retryMax||38);
        return false;
      }
    }
    const result=document.createElement('div');result.className='op-result ok';result.textContent=`COMPLETE / confidence window ${chance}% / roll ${roll}`;run.append(result);
    op.lastFailure=null;delete op.cooldowns[name];saveOp(base,op);return true;
  }finally{setBusy(false)}
}

const fail={
  package:['mirror quorum dropped below minimum','archive segment checksum diverged','publisher chain could not be completed','dependency graph entered a circular branch','local module cache returned a stale lock','registry timestamp exceeded freshness policy','runtime symbol table rejected the package ABI'],
  source:['source adapter returned schema drift','regional endpoint entered a quota window','public index produced conflicting namespaces','resolver handshake expired before canonicalization','source certificate pin changed during connection','adapter response did not meet integrity quorum','regional shard returned an incomplete metadata frame'],
  surface:['public markers were below minimum density','source graph contained an unresolved namespace collision','regional records disagreed on subject continuity','activity history exposed a long blind interval','surface snapshot exceeded noise tolerance','provider index returned stale correlation markers','subject identifier was recently rebound'],
  fingerprint:['device and activity markers produced contradictory signatures','behavioral cadence was too sparse for a stable fingerprint','historical markers rotated during the build','multiple subjects shared the same public signature','fingerprint entropy exceeded the accepted boundary','regional telemetry lacked enough continuity','alias transitions broke the fingerprint chain'],
  identity:['identity graph split into multiple ownership candidates','canonical subject could not be selected','historical alias chain failed continuity checks','ownership confidence decayed below threshold','federated identity boundary hid the primary subject','recent rebind invalidated older evidence','provider namespace collision remained unresolved','opaque account state prevented identity closure'],
  recon:['source quota exhausted during evidence collection','public activity window closed before sealing','correlation engine detected contaminated evidence','evidence timestamps failed ordering checks','subject activity changed during acquisition','regional relay returned incomplete evidence blocks','noise reduction removed too much usable signal'],
  trace:['logical route contained non-deterministic hops','route graph changed before verification','relay confidence fell below quorum','regional shard introduced an unresolved loop','trace markers were too old to verify','route signature did not match the evidence snapshot','provider edge mapping remained opaque'],
  audit:['exposure model found no reusable pattern','recovery metadata was masked by policy','challenge surface was device-bound','secondary factor boundary remained enforced','risk controls invalidated the audit window','historical recovery route was no longer eligible','security hold blocked sensitive-state evaluation','ownership proof required an out-of-band factor','provider returned an opaque protected state'],
  gate:['risk profile exceeded negotiation policy','trusted-device assertion was unavailable','anti-automation controls invalidated the session','gate receipt signature did not match the active route','regional policy required manual ownership review','session reputation was insufficient','security hold rotated the challenge sequence','identity confidence decayed during negotiation','provider required an owner-present verification step'],
  recovery:['no eligible recovery route remained active','primary recovery channel was recently replaced','secondary channel confidence fell below policy minimum','provider imposed a temporary recovery freeze','recovery metadata conflicted with the identity graph','sensitive changes were disabled for this account state','account activity triggered enhanced review','device-bound recovery could not be reproduced','manual ownership review was required'],
  plan:['change-set preflight found an immutable field boundary','recovery receipt expired during planning','target state changed after the last evidence snapshot','rollback path could not be proven','proposed value failed provider policy','case confidence dropped below planning threshold','an unresolved ownership conflict blocked the plan','transaction window was shorter than the required commit sequence'],
  mutation:['identity proof expired during commit','recovery channel rejected the proposed state','risk engine escalated the transaction to manual review','account state changed after preflight','rollback verification returned an inconsistent revision','multi-factor boundary could not be satisfied','provider policy denied the sensitive-field change','session token lost trust after route rotation','recovery endpoint entered a lock state','historical identity markers fell below confidence threshold','change request collided with a pending security hold','opaque provider state rejected the final commit']
};

const stages={
  boot:[{label:'power integrity',min:700,max:1700,meta:'measuring runtime entropy',signals:['entropy source online','clock drift measured','power state accepted']},{label:'vault mount',min:900,max:2300,meta:'opening encrypted workspace',signals:['key slot selected','header authenticated','workspace mounted']},{label:'kernel map',min:1000,max:2600,meta:'binding runtime symbols',signals:['ABI checked','symbol table linked','kernel map stable']},{label:'service quorum',min:900,max:2400,meta:'starting local services',signals:['eventd online','vaultd online','resolverd online']},{label:'operator context',min:650,max:1600,meta:'loading CX-DRM-077',signals:['profile verified','policy loaded','TTY attached']}],
  sync:[{label:'registry discovery',min:900,max:2500,meta:()=>`${random(3,8)} mirrors discovered`,signals:['mirror list received','latency ranked','primary selected']},{label:'manifest fetch',min:1200,max:3400,meta:()=>`${random(180,920)} KB index`,signals:['index headers received','manifest blocks streamed','index assembled']},{label:'signature chain',min:800,max:2300,meta:'ed25519 / publisher trust',signals:['root key matched','publisher key checked','signature accepted']},{label:'dependency graph',min:1000,max:2900,meta:'resolving module constraints',signals:['constraints loaded','cycles scanned','graph finalized']},{label:'registry commit',min:600,max:1600,meta:'writing local receipt',signals:['receipt generated','cache indexed','registry ready']}],
  install:[{label:'mirror negotiation',min:900,max:2600,meta:()=>`${random(2,7)} endpoints`,signals:['relay opened','mirror selected','range support confirmed']},{label:'archive blocks',min:1800,max:5200,meta:()=>`${random(24,118)} MB staged artifact`,signals:['block 0 verified','transfer window adjusted','final block received']},{label:'archive integrity',min:900,max:2400,meta:'sha-256 / block map',signals:['block map built','digest calculated','digest matched']},{label:'publisher trust',min:800,max:2200,meta:'certificate chain',signals:['issuer resolved','policy checked','publisher trusted']},{label:'dependency linking',min:1200,max:3300,meta:'runtime graph',signals:['imports scanned','symbols linked','dependency graph stable']},{label:'module extraction',min:1300,max:3600,meta:'local filesystem',signals:['layers opened','files materialized','permissions applied']},{label:'runtime registration',min:800,max:2100,meta:'service registry',signals:['module receipt written','service hooks bound','package ready']}],
  source:[{label:'adapter load',min:700,max:1900,meta:'module registry',signals:['adapter located','schema loaded','adapter initialized']},{label:'endpoint discovery',min:1000,max:2900,meta:'regional public endpoints',signals:['DNS resolved','endpoints ranked','primary endpoint selected']},{label:'transport handshake',min:900,max:2500,meta:'TLS / certificate pin',signals:['transport opened','certificate checked','channel established']},{label:'schema negotiation',min:1000,max:2800,meta:'metadata contract',signals:['fields enumerated','types normalized','contract accepted']},{label:'adapter commit',min:650,max:1700,meta:'source registry',signals:['source receipt written','resolver attached','adapter ready']}],
  surface:[{label:'source fan-out',min:1000,max:2900,meta:'multi-source query',signals:['queries staged','sources contacted','response window opened']},{label:'marker collection',min:1600,max:4300,meta:'public identifiers',signals:['aliases collected','timestamps indexed','activity markers received']},{label:'namespace merge',min:1100,max:3200,meta:'canonicalization',signals:['namespaces compared','collisions isolated','canonical keys selected']},{label:'noise reduction',min:1000,max:3000,meta:'confidence filtering',signals:['outliers scored','stale markers removed','signal floor accepted']},{label:'snapshot sealing',min:750,max:1900,meta:'vault artifact',signals:['snapshot serialized','digest written','artifact sealed']}],
  fingerprint:[{label:'behavior window',min:1200,max:3500,meta:'activity cadence',signals:['time bins created','cadence sampled','window normalized']},{label:'marker weighting',min:1300,max:3600,meta:'identity features',signals:['features extracted','weights adjusted','weak markers reduced']},{label:'collision scan',min:1100,max:3100,meta:'cross-subject comparison',signals:['candidate set built','collisions tested','false matches removed']},{label:'entropy model',min:1200,max:3400,meta:'signature stability',signals:['entropy measured','variance scored','stability estimated']},{label:'fingerprint seal',min:700,max:1800,meta:'evidence receipt',signals:['fingerprint encoded','digest calculated','receipt sealed']}],
  identity:[{label:'graph opening',min:1000,max:2900,meta:'subject graph',signals:['nodes loaded','edges normalized','graph opened']},{label:'alias continuity',min:1500,max:4200,meta:'historical identity chain',signals:['aliases ordered','transition gaps measured','continuity scored']},{label:'ownership markers',min:1300,max:3700,meta:'public evidence',signals:['markers classified','conflicts isolated','ownership score updated']},{label:'boundary analysis',min:1200,max:3500,meta:'provider policy',signals:['federation checked','rebind state checked','boundary classified']},{label:'canonical resolution',min:900,max:2400,meta:'identity closure',signals:['candidate ranked','canonical subject selected','identity receipt issued']}],
  reconPassive:[{label:'passive collectors',min:1000,max:3000,meta:'low-noise acquisition',signals:['collectors opened','rate window respected','public frames received']},{label:'timeline ordering',min:1300,max:3900,meta:'event chronology',signals:['timestamps normalized','gaps measured','timeline ordered']},{label:'metadata correlation',min:1500,max:4300,meta:'cross-source evidence',signals:['records joined','conflicts scored','correlation graph built']},{label:'evidence hygiene',min:1100,max:3200,meta:'contamination check',signals:['duplicates removed','stale data marked','chain verified']},{label:'passive bundle',min:800,max:2100,meta:'vault seal',signals:['bundle serialized','manifest generated','bundle sealed']}],
  reconDeep:[{label:'deep source window',min:1400,max:4100,meta:'extended acquisition',signals:['extended window opened','secondary sources queried','frames accumulated']},{label:'historical backfill',min:1700,max:4700,meta:'archive markers',signals:['archive keys generated','historical records aligned','gaps backfilled']},{label:'anomaly isolation',min:1500,max:4300,meta:'opaque-state analysis',signals:['anomalies clustered','false positives removed','opaque state scored']},{label:'confidence rebuild',min:1300,max:3800,meta:'evidence weighting',signals:['weights recalculated','confidence floor tested','model stabilized']},{label:'deep bundle seal',min:900,max:2300,meta:'vault artifact',signals:['bundle encoded','digest committed','deep evidence sealed']}],
  traceMap:[{label:'route seed',min:900,max:2500,meta:'logical edge markers',signals:['seed markers selected','edge candidates opened','route seed stable']},{label:'relay correlation',min:1400,max:4100,meta:'multi-hop graph',signals:['relays grouped','hop order estimated','loops isolated']},{label:'regional alignment',min:1200,max:3600,meta:'shard comparison',signals:['regions compared','latency bands aligned','shard model stabilized']},{label:'route graph',min:1300,max:3900,meta:'logical topology',signals:['edges weighted','cold paths removed','graph finalized']},{label:'map seal',min:700,max:1900,meta:'route artifact',signals:['map serialized','signature written','artifact sealed']}],
  traceVerify:[{label:'snapshot binding',min:900,max:2600,meta:'evidence revision',signals:['revision located','snapshot bound','binding accepted']},{label:'hop replay',min:1500,max:4300,meta:'route consistency',signals:['hop markers replayed','timing compared','route variance measured']},{label:'signature compare',min:1200,max:3500,meta:'route digest',signals:['digest recalculated','signatures compared','integrity scored']},{label:'quorum decision',min:1100,max:3200,meta:'verification quorum',signals:['votes collected','outliers rejected','quorum reached']},{label:'verification receipt',min:700,max:1800,meta:'vault receipt',signals:['receipt encoded','timestamp sealed','trace verified']}],
  audit:[{label:'audit model load',min:900,max:2600,meta:'exposure heuristics',signals:['model selected','rules loaded','audit context opened']},{label:'recovery surface',min:1400,max:4200,meta:'eligible route analysis',signals:['routes enumerated','eligibility tested','protected routes isolated']},{label:'challenge boundary',min:1300,max:3900,meta:'factor policy',signals:['factor types classified','device binding checked','challenge state scored']},{label:'risk simulation',min:1500,max:4400,meta:'provider controls',signals:['risk features loaded','threshold modeled','policy response estimated']},{label:'exposure verdict',min:1000,max:3000,meta:'confidence decision',signals:['signals weighted','confidence calculated','verdict prepared']},{label:'audit receipt',min:700,max:1900,meta:'vault artifact',signals:['receipt written','digest sealed','audit closed']}],
  gateAssess:[{label:'session reputation',min:1000,max:2900,meta:'risk context',signals:['history sampled','reputation scored','session classified']},{label:'policy boundary',min:1300,max:3800,meta:'sensitive operation rules',signals:['rules loaded','exceptions checked','boundary mapped']},{label:'challenge forecast',min:1300,max:3900,meta:'provider response model',signals:['challenge types estimated','device trust checked','forecast stabilized']},{label:'gate viability',min:1100,max:3200,meta:'access threshold',signals:['trust compared','risk penalty applied','viability decided']},{label:'assessment receipt',min:700,max:1900,meta:'ephemeral receipt',signals:['receipt generated','expiry written','assessment sealed']}],
  gateNegotiate:[{label:'ephemeral context',min:1000,max:3000,meta:'short-lived session',signals:['nonce generated','context bound','session opened']},{label:'challenge sequence',min:1700,max:4800,meta:'policy negotiation',signals:['challenge received','response model built','sequence advanced']},{label:'trust revalidation',min:1400,max:4200,meta:'identity confidence',signals:['identity receipt checked','trace receipt checked','trust recalculated']},{label:'risk arbitration',min:1500,max:4400,meta:'provider risk engine',signals:['risk signals submitted','policy branch selected','decision returned']},{label:'gate receipt',min:1000,max:2900,meta:'signature validation',signals:['receipt received','signature verified','expiry recorded']},{label:'token seal',min:700,max:1900,meta:'ephemeral token',signals:['token encoded','scope restricted','token sealed']}],
  recoveryInspect:[{label:'channel inventory',min:1100,max:3300,meta:'recovery routes',signals:['channels enumerated','masked routes classified','inventory completed']},{label:'freshness check',min:1200,max:3600,meta:'route timestamps',signals:['timestamps compared','recent changes detected','freshness scored']},{label:'eligibility model',min:1500,max:4300,meta:'provider policy',signals:['routes tested','policy exceptions checked','eligible set built']},{label:'ownership conflict',min:1300,max:3900,meta:'identity graph',signals:['ownership markers compared','conflicts isolated','route trust updated']},{label:'inspection receipt',min:750,max:2100,meta:'recovery assessment',signals:['assessment serialized','digest written','receipt sealed']}],
  recoveryVerify:[{label:'route challenge',min:1500,max:4400,meta:'recovery proof model',signals:['challenge selected','route state sampled','proof window opened']},{label:'channel consistency',min:1400,max:4200,meta:'cross-route validation',signals:['channels compared','conflicts measured','consistency scored']},{label:'owner boundary',min:1500,max:4500,meta:'ownership requirement',signals:['owner-present controls checked','device binding measured','boundary resolved']},{label:'policy quorum',min:1300,max:3900,meta:'verification decision',signals:['policy votes collected','exceptions rejected','quorum decision returned']},{label:'recovery receipt',min:900,max:2500,meta:'short-lived authorization',signals:['receipt issued','scope restricted','expiry sealed']}],
  plan:[{label:'field policy',min:1000,max:3000,meta:'sensitive field rules',signals:['field classified','immutability checked','policy loaded']},{label:'value preflight',min:1000,max:3100,meta:'proposed state',signals:['format checked','reuse policy checked','value accepted']},{label:'snapshot binding',min:1200,max:3600,meta:'latest evidence state',signals:['snapshot selected','revision bound','state consistency checked']},{label:'rollback proof',min:1300,max:3900,meta:'transaction safety',signals:['rollback path built','prior state sealed','rollback verified']},{label:'commit window',min:1100,max:3400,meta:'ephemeral transaction slot',signals:['window requested','provider timing modeled','window reserved']},{label:'plan seal',min:750,max:2100,meta:'local case plan',signals:['plan serialized','expiry written','plan sealed']}],
  commit:[{label:'gate token recheck',min:1200,max:3600,meta:'ephemeral authorization',signals:['token loaded','signature checked','scope verified']},{label:'recovery receipt',min:1300,max:3900,meta:'route authorization',signals:['receipt loaded','expiry checked','route verified']},{label:'identity revision',min:1300,max:4000,meta:'latest subject state',signals:['revision fetched','ownership markers compared','revision accepted']},{label:'change-set submit',min:1800,max:5200,meta:'sensitive transaction',signals:['transaction opened','change-set submitted','provider response pending']},{label:'provider decision',min:1900,max:5600,meta:'risk and policy arbitration',signals:['risk engine evaluating','policy branch selected','decision returned']},{label:'rollback validation',min:1200,max:3700,meta:'transaction integrity',signals:['new revision sampled','rollback path tested','integrity measured']},{label:'case receipt',min:800,max:2300,meta:'local evidence record',signals:['receipt generated','artifact sealed','case model updated']}]
};

function requireCore(base,{packages=true,source=true,session=true,target=true}={}){
  if(!base.booted){emit('runtime unavailable: boot --profile rednode','warn');return false}
  if(packages&&(base.packages||[]).length<PACKAGES.length){emit('module quorum incomplete: install all four packages','warn');return false}
  if(source&&!Object.keys(base.sources||{}).length){emit('no source adapter connected','warn');return false}
  if(session&&!base.session){emit('no active case session','warn');return false}
  if(target&&!base.target){emit('target context is not configured','warn');return false}
  return true;
}
function needs(op,flag,next){if(!op.flags[flag]){emit(`prerequisite missing: ${next}`,'warn');return false}return true}
function confirmedAudit(op,kind){return op.audits[kind]?.status==='CONFIRMED'}
function tokenValid(op){return op.gateToken&&op.gateToken.expires>Date.now()}
function recoveryValid(op){return op.recoveryReceipt&&op.recoveryReceipt.expires>Date.now()}
function mask(value){const text=clean(value,120);if(text.includes('@')){const [name,domain]=text.split('@');return `${name.slice(0,2)}${'*'.repeat(Math.max(3,name.length-2))}@${domain}`}return text.length<6?`${text.slice(0,1)}****`:`${text.slice(0,3)}${'*'.repeat(Math.min(12,text.length-5))}${text.slice(-2)}`}

async function confirmPending(raw,base){
  const pending=read(PENDING_KEY,null);if(!pending)return false;
  localStorage.removeItem(PENDING_KEY);
  if(!/^(y|yes)$/i.test(raw)){emit('operation cancelled by operator','warn');return true}
  if(pending.type==='install')await installPackage(base,pending.name);
  if(pending.type==='commit')await commitMutation(base);
  if(pending.type==='reset')resetWorkspace();
  return true;
}

async function boot(base){
  if(base.booted){emit('runtime already online','ok');return}
  const op=defaultOp(base);
  const ok=await pipeline(base,op,'RUNTIME BOOT','boot',stages.boot,94,fail.package,{retryMin:4,retryMax:12,maxBonus:4});
  if(!ok)return;
  base.booted=true;event(base,'KERNEL','Secure runtime initialized','ONLINE');emit('TRMX kernel online / node-07 / operator context bound','ok');
}
async function syncRegistry(base){
  if(!requireCore(base,{packages:false,source:false,session:false,target:false}))return;
  const op=loadOp(base);
  const ok=await pipeline(base,op,'REGISTRY SYNC','pkg-sync',stages.sync,88,fail.package,{retryMin:7,retryMax:22});
  if(!ok)return;
  base.synced=true;event(base,'PKG','Package registry synchronized','SYNC');emit('registry synchronized / four signed manifests available','ok');
}
async function installPackage(base,name){
  if(!base.synced){emit('registry unavailable: pkg sync required','warn');return}
  if(!PACKAGES.includes(name)){emit(`package not found: ${name}`,'warn');return}
  if((base.packages||[]).includes(name)){emit(`${name}: already installed`,'ok');return}
  const op=loadOp(base);
  const ok=await pipeline(base,op,`INSTALL ${name.toUpperCase()}`,`pkg-${name}`,stages.install,84,fail.package,{retryMin:8,retryMax:28});
  if(!ok)return;
  base.packages=[...(base.packages||[]),name];event(base,'PKG',`${name} installed and registered`,'READY');emit(`${name}: installed / signature and runtime registration complete`,'ok');
}
async function connectSource(base,type,region){
  if(!requireCore(base,{source:false,session:false,target:false}))return;
  const op=loadOp(base);
  const ok=await pipeline(base,op,`SOURCE ${type.toUpperCase()}`,`source-${type}`,stages.source,80,fail.source,{retryMin:9,retryMax:30});
  if(!ok)return;
  base.sources=base.sources||{};base.sources[type]={region,time:now(),status:'READY'};event(base,'SOURCE',`${type} adapter connected / ${region}`,'READY');emit(`${type} source connected / region ${region}`,'ok');
}
async function runSurface(base){
  if(!requireCore(base))return;const op=loadOp(base);
  const ok=await pipeline(base,op,'SURFACE ENUMERATION','surface',stages.surface,78,fail.surface,{retryMin:12,retryMax:34});if(!ok)return;
  op.flags.surface=true;op.confidence.surface=random(48,82);addArtifact(base,op,'SURFACE',`surface-${Date.now()}.snapshot`);event(base,'SURFACE','Public surface snapshot sealed','SEALED');emit(`surface snapshot complete / confidence ${op.confidence.surface}%`,'ok');
}
async function runFingerprint(base){
  if(!requireCore(base))return;const op=loadOp(base);if(!needs(op,'surface','surface enumerate'))return;
  const ok=await pipeline(base,op,'FINGERPRINT BUILD','fingerprint',stages.fingerprint,64,fail.fingerprint,{retryMin:14,retryMax:40});if(!ok)return;
  op.flags.fingerprint=true;op.confidence.fingerprint=random(43,79);addArtifact(base,op,'FINGERPRINT',`fingerprint-${Date.now()}.sig`);event(base,'FINGERPRINT','Behavioral fingerprint sealed','READY');emit(`fingerprint stabilized / confidence ${op.confidence.fingerprint}%`,'ok');
}
async function resolveIdentity(base){
  if(!requireCore(base))return;const op=loadOp(base);if(!needs(op,'fingerprint','fingerprint build'))return;
  const ok=await pipeline(base,op,'IDENTITY RESOLUTION','identity',stages.identity,52,fail.identity,{retryMin:16,retryMax:46});if(!ok)return;
  op.flags.identity=true;op.confidence.identity=random(51,86);addArtifact(base,op,'IDENTITY',`identity-${Date.now()}.graph`);event(base,'IDENTITY','Canonical identity graph established','READY');emit(`identity graph established / confidence ${op.confidence.identity}%`,'ok');
}
async function runRecon(base,deep=false){
  if(!requireCore(base))return;const op=loadOp(base);if(!needs(op,'identity','identity resolve'))return;
  if(deep&&!op.flags.passive){emit('passive reconnaissance required: recon passive','warn');return}
  const name=deep?'recon-deep':'recon-passive';const ok=await pipeline(base,op,deep?'DEEP RECONNAISSANCE':'PASSIVE RECONNAISSANCE',name,deep?stages.reconDeep:stages.reconPassive,deep?40:72,fail.recon,{retryMin:deep?20:13,retryMax:deep?55:38});if(!ok)return;
  op.flags[deep?'deep':'passive']=true;addArtifact(base,op,deep?'RECON-DEEP':'RECON',`${deep?'deep':'passive'}-${Date.now()}.bundle`);event(base,'RECON',`${deep?'Deep':'Passive'} reconnaissance bundle sealed`,'SEALED');emit(`${deep?'deep':'passive'} reconnaissance complete`,'ok');
}
async function mapTrace(base){
  if(!requireCore(base))return;const op=loadOp(base);if(!needs(op,'passive','recon passive'))return;
  const ok=await pipeline(base,op,'TRACE MAPPING','trace-map',stages.traceMap,66,fail.trace,{retryMin:15,retryMax:43});if(!ok)return;
  op.flags.traceMap=true;op.confidence.trace=random(49,83)+(op.flags.deep?5:0);addArtifact(base,op,'TRACE-MAP',`route-${Date.now()}.map`);event(base,'TRACE','Logical route graph mapped','READY');emit(`logical route mapped / confidence ${Math.min(94,op.confidence.trace)}%`,'ok');
}
async function verifyTrace(base){
  if(!requireCore(base))return;const op=loadOp(base);if(!needs(op,'traceMap','trace map'))return;
  const ok=await pipeline(base,op,'TRACE VERIFICATION','trace-verify',stages.traceVerify,48+(op.flags.deep?8:0),fail.trace,{retryMin:18,retryMax:48});if(!ok)return;
  op.flags.traceVerified=true;op.confidence.trace=Math.min(96,(op.confidence.trace||55)+random(4,12));addArtifact(base,op,'TRACE-VERIFIED',`trace-verify-${Date.now()}.receipt`);event(base,'TRACE','Logical route verification quorum reached','VERIFIED');emit(`trace verification complete / confidence ${op.confidence.trace}%`,'ok');
}
async function audit(base,kind){
  if(!requireCore(base))return;const op=loadOp(base);if(!needs(op,'traceVerified','trace verify'))return;
  if(!['password','email','id'].includes(kind)){emit('usage: vault audit <password|email|id>','warn');return}
  const chance={password:29,email:23,id:17}[kind]+(op.flags.deep?5:0);
  const ok=await pipeline(base,op,`${kind.toUpperCase()} EXPOSURE AUDIT`,`audit-${kind}`,stages.audit,chance,fail.audit,{retryMin:22,retryMax:60,maxBonus:8});
  op.audits[kind]={status:ok?'CONFIRMED':'NO-HIT',confidence:ok?random(52,84):random(9,42),time:now()};saveOp(base,op);
  addArtifact(base,op,'AUDIT',`${kind}-audit-${Date.now()}.log`,ok?'CONFIRMED':'NO-HIT');
  if(!ok){emit(`${kind} audit closed / no eligible exposure path`,'warn');return}
  event(base,'VAULT',`${kind} exposure audit confirmed`,'CONFIRMED');emit(`${kind} audit confirmed / confidence ${op.audits[kind].confidence}%`,'ok');
}
async function assessGate(base){
  if(!requireCore(base))return;const op=loadOp(base);
  if(!Object.values(op.audits).some(x=>x?.status==='CONFIRMED')){emit('confirmed exposure audit required','warn');return}
  const ok=await pipeline(base,op,'GATE ASSESSMENT','gate-assess',stages.gateAssess,42+(op.flags.deep?4:0),fail.gate,{retryMin:24,retryMax:65,maxBonus:7});if(!ok)return;
  op.flags.gateAssessed=true;op.confidence.gate=random(45,76);saveOp(base,op);event(base,'GATE','Sensitive-operation gate assessed','READY');emit(`gate viability established / trust ${op.confidence.gate}%`,'ok');
}
async function negotiateGate(base){
  if(!requireCore(base))return;const op=loadOp(base);if(!needs(op,'gateAssessed','gate assess'))return;
  const ok=await pipeline(base,op,'GATE NEGOTIATION','gate-negotiate',stages.gateNegotiate,20+(op.flags.deep?4:0),fail.gate,{retryMin:30,retryMax:80,maxBonus:5});if(!ok)return;
  op.flags.gateNegotiated=true;op.confidence.gate=Math.min(93,(op.confidence.gate||48)+random(6,15));op.gateToken={id:`GT-${Math.random().toString(36).slice(2,10).toUpperCase()}`,expires:Date.now()+random(150,300)*1000};saveOp(base,op);event(base,'GATE','Ephemeral gate token negotiated','GRANTED');emit(`gate token granted / trust ${op.confidence.gate}% / expires in ${Math.round((op.gateToken.expires-Date.now())/1000)}s`,'ok');
}
async function inspectRecovery(base){
  if(!requireCore(base))return;const op=loadOp(base);if(!tokenValid(op)){emit('valid gate token required: gate negotiate','warn');return}
  const ok=await pipeline(base,op,'RECOVERY INSPECTION','recovery-inspect',stages.recoveryInspect,31+(op.flags.deep?4:0),fail.recovery,{retryMin:32,retryMax:85,maxBonus:5});if(!ok)return;
  op.flags.recoveryInspected=true;op.confidence.recovery=random(42,72);saveOp(base,op);event(base,'RECOVERY','Recovery routes inspected','READY');emit(`recovery inventory complete / confidence ${op.confidence.recovery}%`,'ok');
}
async function verifyRecovery(base){
  if(!requireCore(base))return;const op=loadOp(base);if(!tokenValid(op)){emit('gate token expired or unavailable','warn');return}if(!needs(op,'recoveryInspected','recovery inspect'))return;
  const ok=await pipeline(base,op,'RECOVERY VERIFICATION','recovery-verify',stages.recoveryVerify,14+(op.flags.deep?3:0),fail.recovery,{retryMin:40,retryMax:110,maxBonus:4});if(!ok)return;
  op.flags.recoveryVerified=true;op.confidence.recovery=Math.min(91,(op.confidence.recovery||46)+random(6,14));op.recoveryReceipt={id:`RR-${Math.random().toString(36).slice(2,10).toUpperCase()}`,expires:Date.now()+random(120,240)*1000};saveOp(base,op);event(base,'RECOVERY','Recovery route verification completed','VERIFIED');emit(`recovery receipt issued / expires in ${Math.round((op.recoveryReceipt.expires-Date.now())/1000)}s`,'ok');
}
async function planMutation(base,field,value){
  if(!requireCore(base))return;const op=loadOp(base);
  if(!['password','email','id'].includes(field)||!value){emit('usage: mutation plan <password|email|id> <value>','warn');return}
  if(!confirmedAudit(op,field)){emit(`confirmed ${field} audit required`,'warn');return}
  if(!tokenValid(op)){emit('gate token expired: gate negotiate required','warn');return}
  if(!recoveryValid(op)){emit('recovery receipt expired: recovery verify required','warn');return}
  const ok=await pipeline(base,op,`${field.toUpperCase()} MUTATION PLAN`,`plan-${field}`,stages.plan,34+(op.flags.deep?4:0),fail.plan,{retryMin:35,retryMax:90,maxBonus:5});if(!ok)return;
  op.mutationPlan={field,value,masked:mask(value),created:Date.now(),expires:Date.now()+120000,id:`MP-${Math.random().toString(36).slice(2,10).toUpperCase()}`};saveOp(base,op);event(base,'MODEL',`${field} mutation plan sealed`,'PLANNED');emit(`mutation plan sealed / ${op.mutationPlan.id} / expires in 120s`,'ok');emit('Next command: mutation commit','dim');
}
async function commitMutation(base){
  const op=loadOp(base),plan=op.mutationPlan;
  if(!plan||plan.expires<=Date.now()){emit('mutation plan unavailable or expired','warn');op.mutationPlan=null;saveOp(base,op);return}
  if(!tokenValid(op)||!recoveryValid(op)){emit('authorization chain expired before commit','warn');op.mutationPlan=null;saveOp(base,op);return}
  const baseChance={password:5,email:3,id:2}[plan.field];
  const trustBonus=(op.confidence.gate>=82?1:0)+(op.confidence.recovery>=78?1:0)+(op.flags.deep?1:0);
  const chance=Math.min(plan.field==='password'?8:plan.field==='email'?6:5,baseChance+trustBonus);
  const name=`mutation-${plan.field}`;
  if(checkCooldown(op,name))return;
  attempt(op,name);
  const roll=random(1,100),succeeds=roll<=chance,reason=succeeds?'':choose(fail.mutation);
  const run=makeRun(`${plan.field.toUpperCase()} MUTATION COMMIT`,plan.id);
  setBusy(true,'MUTATION COMMIT');
  try{
    const failStage=succeeds?-1:random(1,stages.commit.length-1);
    for(let i=0;i<stages.commit.length;i++){
      const ok=await animateStage(run,stages.commit[i],i===failStage?{at:random(38,92),reason}:null);
      if(!ok){
        const result=document.createElement('div');result.className='op-result fail';result.textContent=`REJECTED / ${reason} / success window ${chance}% / roll ${roll}`;run.append(result);
        applyFailure(base,op,name,reason,45,150);
        op.mutationPlan=null;
        if(Math.random()<.55){op.flags.gateNegotiated=false;op.gateToken=null}
        if(Math.random()<.35){op.flags.recoveryVerified=false;op.recoveryReceipt=null}
        saveOp(base,op);emit('commit chain invalidated; inspect op status before retry','warn');return;
      }
    }
    const result=document.createElement('div');result.className='op-result ok';result.textContent=`COMMITTED / local case model / success window ${chance}% / roll ${roll}`;run.append(result);
    addArtifact(base,op,'MUTATION',`${plan.field}-${Date.now()}.delta`,'APPLIED');event(base,'MODEL',`${plan.field} mutation committed to local case model`,'APPLIED');emit(`case model updated: ${plan.field} => ${plan.masked}`,'ok');op.mutationPlan=null;saveOp(base,op);
  }finally{setBusy(false)}
}
function opStatus(base){
  const op=loadOp(base);
  const auditStatus=Object.entries(op.audits).map(([k,v])=>`${k}:${v?.status||'NONE'}`).join(' / ');
  const token=tokenValid(op)?`${Math.ceil((op.gateToken.expires-Date.now())/1000)}s`:'NONE';
  const recovery=recoveryValid(op)?`${Math.ceil((op.recoveryReceipt.expires-Date.now())/1000)}s`:'NONE';
  emit(`SUBJECT     ${op.subject}`,'block');emit(`RISK        ${op.risk}/100`,'block');emit(`ANOMALIES   ${op.anomalies.join(' / ')}`,'block');emit(`FLAGS       ${Object.entries(op.flags).filter(([,v])=>v).map(([k])=>k).join(', ')||'NONE'}`,'block');emit(`AUDITS      ${auditStatus}`,'block');emit(`GATE TOKEN  ${token}`,'block');emit(`RECOVERY    ${recovery}`,'block');emit(`PLAN        ${op.mutationPlan?`${op.mutationPlan.field} / ${Math.max(0,Math.ceil((op.mutationPlan.expires-Date.now())/1000))}s`:'NONE'}`,'block');if(op.lastFailure)emit(`LAST FAILURE ${op.lastFailure.operation}: ${op.lastFailure.reason}`,'warn');
}
function opExplain(base){const op=loadOp(base);if(!op.lastFailure){emit('No unresolved operation failure is recorded.','dim');return}const retry=Math.max(0,Math.ceil((op.lastFailure.retryAt-Date.now())/1000));emit(`OPERATION  ${op.lastFailure.operation}`,'block');emit(`REASON     ${op.lastFailure.reason}`,'warn');emit(`RETRY IN   ${retry}s`,'block');emit('The failure applies to the current case model and may invalidate later receipts.','dim')}
function opTree(base){const op=loadOp(base),f=op.flags;const rows=[['surface enumerate',f.surface],['fingerprint build',f.fingerprint],['identity resolve',f.identity],['recon passive',f.passive],['recon deep (optional)',f.deep],['trace map',f.traceMap],['trace verify',f.traceVerified],['vault audit <field>',Object.values(op.audits).some(x=>x?.status==='CONFIRMED')],['gate assess',f.gateAssessed],['gate negotiate',tokenValid(op)],['recovery inspect',f.recoveryInspected],['recovery verify',recoveryValid(op)],['mutation plan <field> <value>',Boolean(op.mutationPlan)],['mutation commit',false]];rows.forEach(([name,done],i)=>emit(`${String(i+1).padStart(2,'0')} ${done?'[COMPLETE]':'[PENDING] '} ${name}`,done?'ok':'block'))}
function resetWorkspace(){localStorage.removeItem(BASE_KEY);localStorage.removeItem(OPS_KEY);localStorage.removeItem(PENDING_KEY);location.reload()}

async function execute(raw){
  const args=raw.trim().split(/\s+/),cmd=(args[0]||'').toLowerCase(),base=loadBase();
  if(await confirmPending(raw,base))return;
  if(cmd==='help'){emit('CORE FLOW','system');emit('boot --profile rednode','block');emit('pkg sync / pkg list / pkg install <module>','block');emit('source add <ml|ff|ip> --region <code> / source list','block');emit('session new <name> / session close','block');emit('target set <ml|ff|ip> <id> [region]','block');emit('ADVANCED OPERATION FLOW','system');emit('surface enumerate → fingerprint build → identity resolve','block');emit('recon passive → recon deep (optional)','block');emit('trace map → trace verify','block');emit('vault audit <password|email|id>','block');emit('gate assess → gate negotiate','block');emit('recovery inspect → recovery verify','block');emit('mutation plan <password|email|id> <value> → mutation commit','block');emit('op status / op explain / op tree / op reset','block');return}
  if(cmd==='boot'){await boot(base);return}
  if(cmd==='pkg'){if(args[1]==='sync'){await syncRegistry(base);return}if(args[1]==='list'){PACKAGES.forEach(p=>emit(`${(base.packages||[]).includes(p)?'[installed]':'[available]'} ${p}`,(base.packages||[]).includes(p)?'ok':'block'));return}if(args[1]==='install'&&args[2]){if(!base.synced){emit('registry unavailable: pkg sync required','warn');return}write(PENDING_KEY,{type:'install',name:clean(args[2])});emit(`Install ${clean(args[2])}? [y/n]`,'warn');return}}
  if(cmd==='source'){if(args[1]==='list'){emit(JSON.stringify(base.sources||{},null,2),'block');return}if(args[1]==='add'&&args[2]){const regionIndex=args.indexOf('--region');const region=clean(regionIndex>=0?args[regionIndex+1]:'SEA').toUpperCase();await connectSource(base,clean(args[2]).toLowerCase(),region);return}}
  if(cmd==='session'){if(!requireCore(base,{packages:false,source:false,session:false,target:false}))return;if(args[1]==='new'&&args[2]){base.session=clean(args.slice(2).join('-'),40);base.target=null;base.evidence=[];syncBase(base);event(base,'CASE',`Session ${base.session} opened`,'ACTIVE');emit(`session ${base.session} created / evidence chain reset`,'ok');return}if(args[1]==='close'){base.session=null;base.target=null;base.evidence=[];syncBase(base);event(base,'CASE','Session closed','DONE');emit('session closed / volatile operation state detached','ok');return}}
  if(cmd==='target'&&args[1]==='set'){if(!base.session){emit('active session required','warn');return}const type=clean(args[2]).toLowerCase(),id=clean(args[3]),region=clean(args[4]||'SEA').toUpperCase();if(!['ml','ff','ip'].includes(type)||!id){emit('usage: target set <ml|ff|ip> <id> [region]','warn');return}base.target={type,id,region};base.evidence=[];syncBase(base);event(base,'TARGET',`Target ${type}:${id} assigned`,'LOCKED');emit(`target staged / ${type}:${id} / region ${region}`,'ok');return}
  if(cmd==='surface'&&args[1]==='enumerate'){await runSurface(base);return}
  if(cmd==='fingerprint'&&args[1]==='build'){await runFingerprint(base);return}
  if(cmd==='identity'&&args[1]==='resolve'){await resolveIdentity(base);return}
  if(cmd==='identity'&&args[1]==='probe'){emit('identity probe retired: use fingerprint build, then identity resolve','warn');return}
  if(cmd==='identity'&&args[1]==='mutate'){emit('direct mutation blocked by operation policy','warn');emit('Use mutation plan <field> <value>, then mutation commit.','block');return}
  if(cmd==='recon'&&args[1]==='passive'){await runRecon(base,false);return}
  if(cmd==='recon'&&args[1]==='deep'){await runRecon(base,true);return}
  if(cmd==='recon'&&args[1]==='start'){emit('one-step recon retired: begin with surface enumerate','warn');return}
  if(cmd==='trace'&&args[1]==='map'){await mapTrace(base);return}
  if(cmd==='trace'&&args[1]==='verify'){await verifyTrace(base);return}
  if(cmd==='trace'&&args[1]==='resolve'){emit('one-step trace retired: use trace map, then trace verify','warn');return}
  if(cmd==='vault'&&args[1]==='audit'){await audit(base,(args[2]||'').toLowerCase());return}
  if(cmd==='gate'&&args[1]==='assess'){await assessGate(base);return}
  if(cmd==='gate'&&args[1]==='negotiate'){await negotiateGate(base);return}
  if(cmd==='recovery'&&args[1]==='inspect'){await inspectRecovery(base);return}
  if(cmd==='recovery'&&args[1]==='verify'){await verifyRecovery(base);return}
  if(cmd==='mutation'&&args[1]==='plan'){await planMutation(base,(args[2]||'').toLowerCase(),clean(args.slice(3).join(' '),120));return}
  if(cmd==='mutation'&&args[1]==='commit'){const op=loadOp(base);if(!op.mutationPlan){emit('no active mutation plan','warn');return}write(PENDING_KEY,{type:'commit'});emit(`Commit ${op.mutationPlan.field} mutation to local case model? [y/n]`,'warn');return}
  if(cmd==='op'&&args[1]==='status'){opStatus(base);return}
  if(cmd==='op'&&args[1]==='explain'){opExplain(base);return}
  if(cmd==='op'&&args[1]==='tree'){opTree(base);return}
  if(cmd==='op'&&args[1]==='reset'){const all=read(OPS_KEY,{});delete all[subjectKey(base)];write(OPS_KEY,all);emit('operation engine state cleared for current subject','ok');return}
  if(cmd==='status'){opStatus(base);return}
  if(cmd==='reset'){write(PENDING_KEY,{type:'reset'});emit('Reset all local workspace and operation state? [y/n]','warn');return}
}

function intercepted(raw){const args=raw.trim().split(/\s+/),cmd=(args[0]||'').toLowerCase();if(read(PENDING_KEY,null))return true;return ['help','boot','pkg','source','session','target','surface','fingerprint','identity','recon','trace','vault','gate','recovery','mutation','op','status','reset'].includes(cmd)}
form.addEventListener('submit',event=>{const raw=input.value.trim();if(!raw||!intercepted(raw))return;event.preventDefault();event.stopImmediatePropagation();emit(`root@trmx# ${raw}`,'command');input.value='';execute(raw).catch(error=>{setBusy(false);emit(`operation engine error: ${error.message}`,'warn')})},true);
window.CYBERTRMX_TERMINAL_V4={execute,status:()=>opStatus(loadBase())};
})();