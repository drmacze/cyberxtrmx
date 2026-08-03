const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  logs: [
    { channel: 'KERNEL', event: 'Isolated runtime boundary verified', status: 'READY' },
    { channel: 'PUBLIC-META', event: 'External metadata adapter standing by', status: 'ARMED' },
    { channel: 'SIM-CORE', event: 'Deterministic account model synchronized', status: 'ONLINE' }
  ],
  events: 1204
};

const pageTitles = {
  main: 'COMMAND OVERVIEW',
  cmd: 'SECURE COMMAND CHANNEL',
  profile: 'OPERATOR IDENTITY',
  monitor: 'SYSTEM MONITOR'
};

function timeString(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function switchTab(name) {
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.tab === name));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${name}`));
  $('#page-title').textContent = pageTitles[name] || 'CYBERTRMX';
  if (name === 'cmd') setTimeout(() => $('#command-input').focus(), 100);
  if (name === 'monitor') drawPulse();
}

$$('.nav-item').forEach((item) => item.addEventListener('click', () => switchTab(item.dataset.tab)));

function updateClock() {
  $('#clock').textContent = timeString();
}
updateClock();
setInterval(updateClock, 1000);

const activitySeeds = [
  ['SIM-CORE', 'Account model checksum rotated', 'SYNC'],
  ['PUBLIC-META', 'Coarse network index refreshed', 'INDEX'],
  ['RED-NODE', 'Encrypted display channel stabilized', 'SECURE'],
  ['KERNEL', 'Command event sealed in local buffer', 'LOGGED'],
  ['MONITOR', 'Signal latency calibration completed', 'PASS']
];

function renderActivity() {
  $('#activity-list').innerHTML = activitySeeds.map(([source, event, status], index) => `
    <div class="activity-item">
      <time>${timeString(new Date(Date.now() - index * 17_000))}</time>
      <div><strong>${source}</strong> / ${event}</div>
      <span>${status}</span>
    </div>
  `).join('');
}
renderActivity();
setInterval(() => {
  activitySeeds.unshift(activitySeeds.pop());
  renderActivity();
  state.events += Math.floor(Math.random() * 4) + 1;
  $('#event-count').textContent = state.events.toLocaleString('en-US');
  $('#latency-count').textContent = `${31 + Math.floor(Math.random() * 18)}ms`;
}, 6500);

function addTerminalLine(text, type = '') {
  const line = document.createElement('div');
  line.className = `line ${type}`.trim();
  line.textContent = text;
  $('#terminal-output').append(line);
  $('#terminal-output').scrollTop = $('#terminal-output').scrollHeight;
}

function addLog(channel, event, status = 'OK') {
  state.logs.unshift({ channel, event, status, time: timeString() });
  state.logs = state.logs.slice(0, 18);
  renderLogs();
}

function renderLogs() {
  $('#monitor-logs').innerHTML = state.logs.map((log) => `
    <div class="log-row">
      <span>${log.time || timeString()}</span>
      <span>${log.channel}</span>
      <span>${escapeHtml(log.event)}</span>
      <span class="log-state">${log.status}</span>
    </div>
  `).join('');
}
renderLogs();

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function formatResult(result) {
  return JSON.stringify(result, null, 2);
}

$('#terminal-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#command-input');
  const command = input.value.trim();
  if (!command) return;

  input.value = '';
  addTerminalLine(`root@trmx:~$ ${command}`, 'command');

  if (command.toLowerCase() === 'clear') {
    $('#terminal-output').innerHTML = '';
    addTerminalLine('DISPLAY BUFFER PURGED', 'system');
    addLog('CMD', 'Terminal display buffer purged', 'DONE');
    return;
  }

  $('#terminal-state').textContent = 'PROCESSING';
  addTerminalLine('Executing encrypted command sequence…', 'muted');
  const started = performance.now();

  try {
    const response = await fetch('/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'Command rejected.');

    addTerminalLine(`COMPLETED / ${payload.elapsedMs}ms / ${payload.result?.source || 'system'}`, 'system');
    addTerminalLine(formatResult(payload.result), 'json');
    addLog('CMD', `${command.split(/\s+/).slice(0, 2).join(' ').toUpperCase()} completed`, payload.result?.verified ? 'VERIFIED' : 'SIMULATED');
  } catch (error) {
    addTerminalLine(`ERROR / ${error.message}`, 'error');
    addLog('CMD', `Command failed: ${error.message}`, 'FAILED');
  } finally {
    $('#terminal-state').textContent = 'READY';
    const latency = Math.max(1, Math.round(performance.now() - started));
    $('#latency-count').textContent = `${latency}ms`;
  }
});

$('#clear-logs').addEventListener('click', () => {
  state.logs = [];
  renderLogs();
});

let pulseFrame;
function drawPulse() {
  const canvas = $('#pulse-canvas');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  cancelAnimationFrame(pulseFrame);

  let offset = 0;
  const render = () => {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(255,255,255,.055)';
    context.lineWidth = 1;
    for (let x = 0; x < width; x += 54) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }

    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(255,23,55,.06)');
    gradient.addColorStop(.55, 'rgba(255,23,55,.95)');
    gradient.addColorStop(1, 'rgba(255,23,55,.18)');
    context.strokeStyle = gradient;
    context.lineWidth = 2;
    context.shadowColor = 'rgba(255,23,55,.45)';
    context.shadowBlur = 13;
    context.beginPath();
    for (let x = 0; x <= width; x += 3) {
      const wave = Math.sin((x + offset) / 41) * 25 + Math.sin((x + offset) / 13) * 7;
      const spike = Math.abs(Math.sin((x + offset) / 102)) > .985 ? Math.sin(x) * 76 : 0;
      const y = height * .55 + wave + spike;
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
    context.shadowBlur = 0;
    offset += .9;
    pulseFrame = requestAnimationFrame(render);
  };
  render();
}

window.addEventListener('resize', () => {
  if ($('#tab-monitor').classList.contains('active')) drawPulse();
});
