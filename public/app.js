const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_STATE = {
  booted: false,
  synced: false,
  packages: [],
  sources: {},
  session: null,
  target: null,
  stage: 'idle',
  pending: null,
  events: 12,
  logs: [
    { time: now(), channel: 'KERNEL', event: 'Secure shell mounted', status: 'READY' },
    { time: now(), channel: 'VAULT', event: 'Local state container sealed', status: 'LOCKED' },
    { time: now(), channel: 'NODE', event: 'Red channel awaiting operator', status: 'STANDBY' }
  ]
};

const requiredPackages = ['nexus-core', 'recon-suite', 'game-resolver', 'cipher-lab'];
const packageMeta = {
  'nexus-core': ['trmx/kernel', 18],
  'recon-suite': ['trmx/recon', 27],
  'game-resolver': ['trmx/identity', 22],
  'cipher-lab': ['trmx/crypto', 31]
};

let state = loadState();
let busy = false;
let history = [];
let historyIndex = 0;

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('cybertrmx-state'));
    return { ...structuredClone(DEFAULT_STATE), ...saved, logs: saved?.logs?.slice(-80) || DEFAULT_STATE.logs };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem('cybertrmx-state', JSON.stringify(state));
  renderDashboard();
}

function hash32(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(input, min, max) {
  return min + (hash32(input) % (max - min + 1));
}

function pick(input, values) {
  return values[seeded(input, 0, values.length - 1)];
}

function safe(value, max = 80) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}

function redact(value) {
  const text = safe(value, 120);
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(3, name.length - 2))}@${domain || 'hidden.local'}`;
  }
  if (text.length <= 5) return `${text.slice(0, 1)}****`;
  return `${text.slice(0, 3)}${'*'.repeat(Math.min(10, text.length - 5))}${text.slice(-2)}`;
}

function logEvent(channel, event, status = 'OK') {
  state.events += 1;
  state.logs.push({ time: now(), channel, event: safe(event, 140), status });
  state.logs = state.logs.slice(-80);
  saveState();
}

function line(text = '', type = '') {
  const row = document.createElement('div');
  row.className = `line ${type}`.trim();
  row.textContent = text;
  $('#terminal-output').append(row);
  $('#terminal-output').scrollTop = $('#terminal-output').scrollHeight;
  return row;
}

async function streamLines(items, delay = 180) {
  for (const item of items) {
    line(item.text ?? item, item.type ?? 'muted');
    await wait(item.delay ?? delay);
  }
}

async function progress(label, duration = 1300, failAt = null) {
  const row = document.createElement('div');
  row.className = 'line progress-line';
  const name = document.createElement('span');
  name.textContent = label;
  const track = document.createElement('span');
  track.className = 'progress-track';
  const fill = document.createElement('span');
  fill.className = 'progress-fill';
  fill.style.width = '0%';
  track.append(fill);
  const count = document.createElement('span');
  count.textContent = '0%';
  row.append(name, track, count);
  $('#terminal-output').append(row);
  for (let pct = 0; pct <= 100; pct += seeded(`${label}:${pct}`, 5, 13)) {
    const capped = Math.min(pct, 100);
    fill.style.width = `${capped}%`;
    count.textContent = `${capped}%`;
    $('#terminal-output').scrollTop = $('#terminal-output').scrollHeight;
    await wait(duration / 12);
    if (failAt && capped >= failAt) {
      fill.style.width = `${failAt}%`;
      count.textContent = 'ERR';
      return false;
    }
  }
  fill.style.width = '100%';
  count.textContent = '100%';
  return true;
}

function prompt(question, callback) {
  state.pending = { question, action: callback };
  line(`${question} [y/n]`, 'warn');
  saveState();
}

function requireBoot() {
  if (!state.booted) {
    line('E_RUNTIME_LOCKED: initialize the red-node runtime first.', 'error');
    return false;
  }
  return true;
}

function requirePackages() {
  const missing = requiredPackages.filter((item) => !state.packages.includes(item));
  if (missing.length) {
    line(`E_DEPENDENCY: missing package(s): ${missing.join(', ')}`, 'error');
    return false;
  }
  return true;
}

function requireTarget() {
  if (!state.session || !state.target) {
    line('E_CONTEXT: create a session and set a target first.', 'error');
    return false;
  }
  return true;
}

async function commandBoot(args) {
  if (state.booted) {
    line('Runtime already active. Use system reset to rebuild the environment.', 'muted');
    return;
  }
  const profile = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : 'rednode';
  line(`Loading runtime profile: ${safe(profile)}`, 'system');
  await progress('kernel.map', 1050);
  await progress('vault.mount', 850);
  await progress('tty.bind', 650);
  state.booted = true;
  state.stage = 'booted';
  logEvent('KERNEL', `Runtime profile ${safe(profile)} initialized`, 'ONLINE');
  line('RED-NODE RUNTIME ONLINE', 'success');
}

async function commandPkg(args) {
  if (!requireBoot()) return;
  const action = args[0];
  if (action === 'sync') {
    line('Contacting signed package mirrors...', 'system');
    const ok = await progress('index.trmx', 1300, state.synced ? null : (Math.random() < .18 ? 71 : null));
    if (!ok) {
      line('Mirror handshake interrupted. Re-run pkg sync.', 'error');
      logEvent('PKG', 'Package index handshake interrupted', 'RETRY');
      return;
    }
    await progress('signature.db', 760);
    state.synced = true;
    logEvent('PKG', 'Signed package index synchronized', 'VERIFIED');
    line('Package catalog synchronized and signature chain verified.', 'success');
    saveState();
    return;
  }
  if (action === 'install') {
    const name = safe(args[1]);
    if (!state.synced) return line('E_INDEX: run package synchronization before installation.', 'error');
    if (!packageMeta[name]) return line(`E_PACKAGE: ${name || '<empty>'} not found in signed catalog.`, 'error');
    if (state.packages.includes(name)) return line(`${name} is already installed.`, 'muted');
    const [channel, size] = packageMeta[name];
    prompt(`Install ${name} from ${channel} (${size} MB)?`, `install:${name}`);
    return;
  }
  if (action === 'list') {
    requiredPackages.forEach((name) => line(`${state.packages.includes(name) ? '[installed]' : '[missing]  '} ${name}`, state.packages.includes(name) ? 'success' : 'muted'));
    return;
  }
  line('E_PKG_SYNTAX: unsupported package operation.', 'error');
}

async function installPackage(name) {
  line(`Resolving ${name} dependency graph...`, 'system');
  await progress(`${name}.tar.zst`, 1250);
  await progress('sha256.verify', 650);
  await progress('module.link', 820);
  state.packages.push(name);
  logEvent('PKG', `${name} installed and linked`, 'INSTALLED');
  line(`${name} installation complete.`, 'success');
}

async function commandSource(args) {
  if (!requireBoot() || !requirePackages()) return;
  const action = args[0];
  if (action === 'add') {
    const platform = safe(args[1]).toLowerCase();
    const regionIndex = args.indexOf('--region');
    const region = safe(regionIndex >= 0 ? args[regionIndex + 1] : 'sea').toUpperCase();
    if (!['ml', 'ff', 'ip'].includes(platform)) return line('E_SOURCE: accepted sources are ml, ff, or ip.', 'error');
    line(`Preparing ${platform.toUpperCase()} source adapter / region ${region}...`, 'system');
    await progress('schema.load', 680);
    await progress('resolver.bind', 940);
    state.sources[platform] = { region, connected: true, time: now() };
    logEvent('SOURCE', `${platform.toUpperCase()} adapter bound for ${region}`, 'CONNECTED');
    line(`${platform.toUpperCase()} source adapter connected.`, 'success');
    return;
  }
  if (action === 'list') {
    const entries = Object.entries(state.sources);
    if (!entries.length) return line('No source adapters configured.', 'muted');
    entries.forEach(([key, value]) => line(`${key.toUpperCase()} :: ${value.region} :: CONNECTED @ ${value.time}`, 'data'));
    return;
  }
  line('E_SOURCE_SYNTAX: unsupported source operation.', 'error');
}

async function commandSession(args) {
  if (!requireBoot() || !requirePackages()) return;
  if (args[0] === 'new') {
    const codename = safe(args.slice(1).join('-') || `op-${Date.now().toString(36).slice(-5)}`, 28).toLowerCase();
    state.session = { id: `TRX-${hash32(codename + Date.now()).toString(16).slice(0, 8).toUpperCase()}`, codename, created: now() };
    state.target = null;
    state.stage = 'session';
    logEvent('SESSION', `Session ${state.session.id} opened`, 'ACTIVE');
    line(`Session opened: ${state.session.id}`, 'success');
    line(`Codename: ${codename}`, 'data');
    return;
  }
  if (args[0] === 'close') {
    if (!state.session) return line('No active session.', 'muted');
    logEvent('SESSION', `Session ${state.session.id} closed`, 'SEALED');
    state.session = null;
    state.target = null;
    state.stage = 'idle';
    line('Session closed and volatile target context erased.', 'success');
    saveState();
    return;
  }
  line('E_SESSION_SYNTAX: unsupported session operation.', 'error');
}

async function commandTarget(args) {
  if (!requireBoot() || !requirePackages()) return;
  if (!state.session) return line('E_SESSION: open an operation session first.', 'error');
  if (args[0] !== 'set') return line('E_TARGET_SYNTAX: unsupported target operation.', 'error');
  const platform = safe(args[1]).toLowerCase();
  if (!['ml', 'ff', 'ip'].includes(platform)) return line('E_TARGET: target type must be ml, ff, or ip.', 'error');
  if (!state.sources[platform]) return line(`E_SOURCE: ${platform.toUpperCase()} source adapter is not connected.`, 'error');
  if (platform === 'ml') {
    const playerId = safe(args[2]);
    const zoneId = safe(args[3]);
    if (!/^\d{4,15}$/.test(playerId) || !/^\d{3,8}$/.test(zoneId)) return line('E_TARGET_FORMAT: ML requires numeric PLAYER_ID and ZONE_ID.', 'error');
    state.target = { platform, id: playerId, zone: zoneId, key: `${playerId}:${zoneId}` };
  } else if (platform === 'ff') {
    const uid = safe(args[2]);
    const region = safe(args[3] || state.sources.ff.region).toUpperCase();
    if (!/^\d{6,15}$/.test(uid)) return line('E_TARGET_FORMAT: FF requires a numeric UID.', 'error');
    state.target = { platform, id: uid, region, key: `${uid}:${region}` };
  } else {
    const ip = safe(args[2]);
    if (!/^[0-9a-f:.]{3,45}$/i.test(ip)) return line('E_TARGET_FORMAT: invalid IP address.', 'error');
    state.target = { platform, id: ip, key: ip };
  }
  state.stage = 'target';
  logEvent('TARGET', `${platform.toUpperCase()} target context loaded`, 'ARMED');
  line(`Target context armed: ${platform.toUpperCase()} / ${redact(state.target.id)}`, 'success');
}

async function commandRecon(args) {
  if (!requireBoot() || !requirePackages() || !requireTarget()) return;
  if (args[0] !== 'start') return line('E_RECON_SYNTAX: unsupported recon operation.', 'error');
  prompt(`Authorize staged reconnaissance for session ${state.session.id}?`, 'recon');
}

async function performRecon() {
  const target = state.target;
  line(`Opening resolver pipeline for ${target.platform.toUpperCase()} target...`, 'system');
  const stages = [
    ['source.handshake', 720], ['identity.normalize', 880], ['public-index.query', 1350],
    ['metadata.correlate', 1100], ['confidence.score', 760], ['report.seal', 680]
  ];
  for (const [name, duration] of stages) await progress(name, duration);

  if (target.platform === 'ip') {
    await resolveIp(target.id);
  } else {
    const seed = target.key;
    const game = target.platform === 'ml' ? 'MOBILE LEGENDS' : 'FREE FIRE';
    const nick = pick(seed, ['V0ID•REAPER', 'REDxPHANTOM', 'NEXUS_77', 'KIRA•NODE', 'TRMX丨GHOST', 'DARKBYTE']);
    const level = seeded(seed + 'level', target.platform === 'ml' ? 18 : 22, target.platform === 'ml' ? 190 : 100);
    const region = target.zone || target.region || state.sources[target.platform].region;
    const rank = pick(seed + 'rank', target.platform === 'ml' ? ['Epic', 'Legend', 'Mythic', 'Mythical Honor', 'Mythical Glory'] : ['Gold', 'Platinum', 'Diamond', 'Heroic', 'Grandmaster']);
    const confidence = seeded(seed + 'confidence', 72, 98);
    line(`GAME       : ${game}`, 'data');
    line(`HANDLE     : ${nick}`, 'data');
    line(`PUBLIC ID  : ${target.id}`, 'data');
    line(`ZONE/REGION: ${region}`, 'data');
    line(`LEVEL      : ${level}`, 'data');
    line(`RANK BAND  : ${rank}`, 'data');
    line(`CONFIDENCE : ${confidence}%`, 'data');
    line(`SOURCE MODE: staged identity model`, 'muted');
  }
  state.stage = 'recon-complete';
  logEvent('RECON', `${target.platform.toUpperCase()} reconnaissance report sealed`, 'COMPLETE');
  line('Reconnaissance sequence complete. Report attached to active session.', 'success');
}

async function resolveIp(ip) {
  line('Querying public IP intelligence endpoint...', 'system');
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,message,ip,type,continent,country,region,city,latitude,longitude,timezone,connection`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'lookup rejected');
    line(`IP         : ${data.ip}`, 'data');
    line(`TYPE       : ${data.type || 'UNKNOWN'}`, 'data');
    line(`LOCATION   : ${[data.city, data.region, data.country].filter(Boolean).join(', ') || 'UNKNOWN'}`, 'data');
    line(`CONTINENT  : ${data.continent || 'UNKNOWN'}`, 'data');
    line(`COORDINATE : ${data.latitude ?? 'N/A'}, ${data.longitude ?? 'N/A'} (approx.)`, 'data');
    line(`TIMEZONE   : ${data.timezone?.id || 'UNKNOWN'}`, 'data');
    line(`ASN / ORG  : ${data.connection?.asn || 'N/A'} / ${data.connection?.org || data.connection?.isp || 'UNKNOWN'}`, 'data');
    line('Public network metadata only; coordinates are approximate.', 'muted');
  } catch (error) {
    line(`Public endpoint unavailable: ${safe(error.message)}`, 'error');
    line('The target remains stored; retry the recon stage later.', 'muted');
  }
}

async function commandTrace(args) {
  if (!requireBoot() || !requirePackages() || !requireTarget()) return;
  if (args[0] !== 'resolve') return line('E_TRACE_SYNTAX: unsupported trace operation.', 'error');
  if (state.stage !== 'recon-complete') return line('E_STAGE: complete reconnaissance before trace resolution.', 'error');
  line('Constructing logical route graph...', 'system');
  await progress('route.seed', 750);
  await progress('edge.correlate', 1050);
  await progress('noise.reduce', 960);
  const hops = seeded(state.target.key + 'hops', 4, 9);
  for (let i = 1; i <= hops; i += 1) {
    const a = seeded(`${state.target.key}:${i}:a`, 11, 223);
    const b = seeded(`${state.target.key}:${i}:b`, 1, 254);
    const c = seeded(`${state.target.key}:${i}:c`, 1, 254);
    const latency = seeded(`${state.target.key}:${i}:lat`, 14, 188);
    line(`${String(i).padStart(2, '0')}  ${a}.${b}.${c}.x   ${latency} ms   logical-hop`, 'data');
    await wait(110);
  }
  state.stage = 'trace-complete';
  logEvent('TRACE', `${hops} logical hops resolved`, 'MAPPED');
  line('Logical route map generated. No device-level location exposed.', 'success');
}

async function commandVault(args) {
  if (!requireBoot() || !requirePackages() || !requireTarget()) return;
  if (args[0] !== 'audit') return line('E_VAULT_SYNTAX: unsupported vault operation.', 'error');
  if (!['recon-complete', 'trace-complete', 'audit-complete'].includes(state.stage)) return line('E_STAGE: reconnaissance must complete before vault audit.', 'error');
  const vector = safe(args[1]).toLowerCase();
  if (!['password', 'email', 'id'].includes(vector)) return line('E_VECTOR: audit vector must be password, email, or id.', 'error');
  prompt(`Stage isolated ${vector.toUpperCase()} audit against the current target model?`, `audit:${vector}`);
}

async function performAudit(vector) {
  const seed = `${state.target.key}:${vector}:${Date.now().toString().slice(0, -5)}`;
  line(`Loading ${vector.toUpperCase()} audit module...`, 'system');
  await progress('wordlist.index', 920);
  await progress('pattern.engine', 780);
  await progress('entropy.model', 1150);
  const willFail = seeded(seed, 0, 99) < 36;
  const ok = await progress('credential.sandbox', 1700, willFail ? seeded(seed + 'fail', 48, 88) : null);
  if (!ok) {
    logEvent('VAULT', `${vector} audit terminated by model`, 'FAILED');
    line('AUDIT FAILED: confidence threshold not reached.', 'error');
    line('Use vault retry to rebuild the attack model.', 'muted');
    state.stage = 'audit-failed';
    saveState();
    return;
  }
  await progress('result.seal', 720);
  const token = Array.from({ length: 4 }, (_, i) => hash32(seed + i).toString(16).slice(0, 4).toUpperCase()).join('-');
  line(`AUDIT STATUS : SUCCESS`, 'success');
  line(`VECTOR       : ${vector.toUpperCase()}`, 'data');
  line(`MODEL TOKEN  : ${token}`, 'data');
  line(`TARGET MASK  : ${redact(state.target.id)}`, 'data');
  line('No live credential was requested, tested, captured, or changed.', 'muted');
  state.stage = 'audit-complete';
  logEvent('VAULT', `${vector} audit completed in isolated model`, 'SUCCESS');
}

async function commandVaultRetry() {
  if (state.stage !== 'audit-failed') return line('E_RETRY: no failed audit is available.', 'error');
  line('Purging failed model and rebuilding entropy map...', 'system');
  await progress('cache.purge', 650);
  await progress('model.reseed', 900);
  state.stage = 'recon-complete';
  logEvent('VAULT', 'Audit model reset for retry', 'READY');
  line('Audit stage reset. Select an audit vector again.', 'success');
}

async function commandIdentity(args) {
  if (!requireBoot() || !requirePackages() || !requireTarget()) return;
  if (args[0] !== 'mutate') return line('E_IDENTITY_SYNTAX: unsupported identity operation.', 'error');
  if (state.stage !== 'audit-complete') return line('E_STAGE: a successful isolated audit is required.', 'error');
  const field = safe(args[1]).toLowerCase();
  const value = safe(args.slice(2).join(' '), 80);
  if (!['email', 'password', 'id'].includes(field) || !value) return line('E_MUTATION: provide field and replacement value.', 'error');
  prompt(`Commit ${field.toUpperCase()} mutation to the isolated session model?`, `mutate:${field}:${encodeURIComponent(value)}`);
}

async function performMutation(field, value) {
  line(`Opening transactional mutation channel for ${field.toUpperCase()}...`, 'system');
  await progress('snapshot.create', 720);
  await progress('field.validate', 880);
  await progress('transaction.commit', 1450);
  await progress('integrity.verify', 720);
  line(`MUTATION STATUS : SUCCESS`, 'success');
  line(`FIELD           : ${field.toUpperCase()}`, 'data');
  line(`NEW VALUE       : ${redact(value)}`, 'data');
  line(`SCOPE           : SESSION MODEL ONLY`, 'muted');
  state.stage = 'mutation-complete';
  logEvent('IDENTITY', `${field} mutation committed to session model`, 'SUCCESS');
}

function commandStatus() {
  line(`RUNTIME  : ${state.booted ? 'ONLINE' : 'OFFLINE'}`, 'data');
  line(`INDEX    : ${state.synced ? 'SYNCED' : 'UNSYNCED'}`, 'data');
  line(`PACKAGES : ${state.packages.length}/${requiredPackages.length}`, 'data');
  line(`SOURCES  : ${Object.keys(state.sources).map((x) => x.toUpperCase()).join(', ') || 'NONE'}`, 'data');
  line(`SESSION  : ${state.session?.id || 'NONE'}`, 'data');
  line(`TARGET   : ${state.target ? `${state.target.platform.toUpperCase()} / ${redact(state.target.id)}` : 'NONE'}`, 'data');
  line(`STAGE    : ${state.stage.toUpperCase()}`, 'data');
}

function commandSystem(args) {
  if (args[0] === 'reset') {
    prompt('Erase local packages, sources, sessions, and logs?', 'system-reset');
    return;
  }
  line('E_SYSTEM_SYNTAX: unsupported system operation.', 'error');
}

async function confirmPending(answer) {
  const action = state.pending?.action;
  state.pending = null;
  saveState();
  if (!['y', 'yes'].includes(answer)) {
    line('Operation cancelled by operator.', 'muted');
    logEvent('TTY', 'Operator rejected pending operation', 'CANCELLED');
    return;
  }
  if (action.startsWith('install:')) return installPackage(action.split(':')[1]);
  if (action === 'recon') return performRecon();
  if (action.startsWith('audit:')) return performAudit(action.split(':')[1]);
  if (action.startsWith('mutate:')) {
    const [, field, encoded] = action.split(':');
    return performMutation(field, decodeURIComponent(encoded));
  }
  if (action === 'system-reset') {
    localStorage.removeItem('cybertrmx-state');
    state = structuredClone(DEFAULT_STATE);
    $('#terminal-output').innerHTML = '';
    bootText();
    saveState();
    return;
  }
}

async function dispatch(raw) {
  if (busy) return;
  const clean = raw.trim();
  if (!clean) return;
  history.push(clean);
  historyIndex = history.length;
  line(`root@trmx:~# ${clean}`, 'command');

  if (state.pending) {
    busy = true;
    try { await confirmPending(clean.toLowerCase()); } finally { busy = false; }
    return;
  }

  const [base, ...args] = clean.split(/\s+/);
  busy = true;
  $('#terminal-state').textContent = 'BUSY';
  try {
    switch (base.toLowerCase()) {
      case 'boot': await commandBoot(args); break;
      case 'pkg': await commandPkg(args); break;
      case 'source': await commandSource(args); break;
      case 'session': await commandSession(args); break;
      case 'target': await commandTarget(args); break;
      case 'recon': await commandRecon(args); break;
      case 'trace': await commandTrace(args); break;
      case 'vault': args[0] === 'retry' ? await commandVaultRetry() : await commandVault(args); break;
      case 'identity': await commandIdentity(args); break;
      case 'status': commandStatus(); break;
      case 'clear': $('#terminal-output').innerHTML = ''; break;
      case 'system': commandSystem(args); break;
      default: line(`trmx: command not found: ${safe(base)}`, 'error');
    }
  } catch (error) {
    line(`E_RUNTIME: ${safe(error.message || 'unexpected failure')}`, 'error');
    logEvent('KERNEL', 'Unhandled runtime exception captured', 'ERROR');
  } finally {
    busy = false;
    $('#terminal-state').textContent = state.booted ? 'ENCRYPTED' : 'LOCKED';
    saveState();
  }
}

function switchTab(name) {
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.tab === name));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${name}`));
  const titles = { main: 'COMMAND OVERVIEW', cmd: 'SECURE COMMAND CHANNEL', profile: 'OPERATOR IDENTITY', monitor: 'SYSTEM MONITOR' };
  $('#page-title').textContent = titles[name] || 'CYBERTRMX';
  $('#sidebar').classList.remove('open');
  if (name === 'cmd') setTimeout(() => $('#command-input').focus(), 100);
  if (name === 'monitor') drawPulse();
}

function renderDashboard() {
  $('#metric-runtime').textContent = state.booted ? 'ONLINE' : 'OFFLINE';
  $('#metric-runtime-sub').textContent = state.booted ? state.stage.toUpperCase() : 'BOOT REQUIRED';
  $('#metric-packages').textContent = `${state.packages.length}/4`;
  $('#metric-session').textContent = state.session ? state.session.codename.toUpperCase().slice(0, 12) : 'NONE';
  $('#metric-session-sub').textContent = state.target ? `${state.target.platform.toUpperCase()} TARGET ARMED` : 'NO TARGET';
  $('#metric-events').textContent = String(state.events).padStart(4, '0');
  $('#terminal-state').textContent = state.booted ? 'ENCRYPTED' : 'LOCKED';

  $('#activity-list').innerHTML = state.logs.slice(-6).reverse().map((entry) => `
    <div class="activity-item"><time>${entry.time}</time><div><strong>${entry.channel}</strong> / ${entry.event}</div><span>${entry.status}</span></div>
  `).join('');

  $('#log-table').innerHTML = state.logs.slice().reverse().map((entry) => `
    <div class="log-row"><time>${entry.time}</time><b>${entry.channel}</b><span>${entry.event}</span><em>${entry.status}</em></div>
  `).join('');
}

function bootText() {
  streamLines([
    { text: 'CYBERTRMX SECURE SHELL 7.4.1', type: 'system', delay: 80 },
    { text: 'TTY-07 mounted / operator key accepted', type: 'muted', delay: 90 },
    { text: 'Runtime is locked. Awaiting initialization sequence.', type: 'muted', delay: 90 },
    { text: '', type: 'muted' }
  ], 90);
}

function updateClock() { $('#clock').textContent = now(); }

function renderMatrix() {
  const chars = ['01A7F', 'sudo', '0x7E', 'TRMX', 'void', 'root', 'ssh', 'hash', 'node', 'cipher'];
  $('#matrix').innerHTML = Array.from({ length: 22 }, (_, index) => {
    const left = seeded(`matrix-left-${index}`, 1, 98);
    const duration = seeded(`matrix-duration-${index}`, 9, 24);
    const delay = -seeded(`matrix-delay-${index}`, 0, 20);
    return `<span style="left:${left}%;animation-duration:${duration}s;animation-delay:${delay}s">${pick(`matrix-${index}`, chars)}${pick(`matrix2-${index}`, chars)}${pick(`matrix3-${index}`, chars)}</span>`;
  }).join('');
}

function renderCodeRain() {
  $('#code-rain').innerHTML = Array.from({ length: 16 }, (_, index) => `<span style="left:${seeded(`rain-x-${index}`, 2, 96)}%;top:${-seeded(`rain-y-${index}`, 10, 90)}%;animation-duration:${seeded(`rain-d-${index}`, 7, 17)}s;animation-delay:${-seeded(`rain-l-${index}`, 0, 16)}s">0x${hash32(`code-${index}`).toString(16)}::TRMX::${index}</span>`).join('');
}

function renderResources() {
  const items = [
    ['CPU / NEURAL PIPE', 28, 77], ['MEMORY / VAULT', 35, 83], ['NETWORK / RELAY', 18, 91], ['STORAGE / CACHE', 23, 68], ['ENTROPY / POOL', 48, 96]
  ];
  $('#resource-list').innerHTML = items.map(([name, min, max]) => {
    const value = seeded(`${name}:${Math.floor(Date.now() / 5000)}:${state.events}`, min, max);
    return `<div class="resource"><div class="resource-head"><span>${name}</span><b>${value}%</b></div><div class="resource-track"><div class="resource-fill" style="width:${value}%"></div></div></div>`;
  }).join('');
}

function drawPulse() {
  const canvas = $('#pulse-canvas');
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(600, rect.width * ratio);
  canvas.height = Math.max(260, rect.height * ratio);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.055)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += w / 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += h / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, 'rgba(151,0,27,.45)');
  gradient.addColorStop(.5, '#ff1737');
  gradient.addColorStop(1, 'rgba(255,23,55,.4)');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2.3 * ratio;
  ctx.shadowColor = '#ff1737';
  ctx.shadowBlur = 10 * ratio;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8 * ratio) {
    const t = x / w;
    const activity = state.booted ? 1 : .28;
    const y = h * .55 + Math.sin(t * 31 + state.events) * h * .11 * activity + Math.sin(t * 83) * h * .035 + (seeded(`${Math.floor(t * 100)}:${state.events}`, -9, 9) * ratio);
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 2200);
}

$$('.nav-item').forEach((item) => item.addEventListener('click', () => switchTab(item.dataset.tab)));
$('#menu-button').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#terminal-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#command-input');
  const value = input.value;
  input.value = '';
  dispatch(value);
});
$('#command-input').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    event.currentTarget.value = history[historyIndex] || '';
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    event.currentTarget.value = history[historyIndex] || '';
  }
});
$('#clear-log').addEventListener('click', () => {
  state.logs = [{ time: now(), channel: 'LOG', event: 'Event buffer purged by operator', status: 'PURGED' }];
  saveState();
  toast('Event buffer purged');
});
window.addEventListener('resize', () => { if ($('#tab-monitor').classList.contains('active')) drawPulse(); });

renderMatrix();
renderCodeRain();
renderResources();
renderDashboard();
updateClock();
bootText();
setInterval(updateClock, 1000);
setInterval(() => { renderResources(); if ($('#tab-monitor').classList.contains('active')) drawPulse(); }, 5000);
$('#hero-terminal').innerHTML = '<span>root@trmx:~# channel --open</span><span>[handshake] operator key accepted</span><span>[runtime] staged workflow required</span><span>[tty] awaiting input <b>█</b></span>';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
