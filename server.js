import http from 'node:http';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const requestWindows = new Map();
function rateLimited(key) {
  const now = Date.now();
  const previous = requestWindows.get(key) || [];
  const recent = previous.filter((time) => now - time < 60_000);
  if (recent.length >= 45) return true;
  recent.push(now);
  requestWindows.set(key, recent);
  return false;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value, max = 80) => String(value ?? '').trim().slice(0, max);

function seededNumber(seed, min, max) {
  const digest = crypto.createHash('sha256').update(seed).digest();
  const raw = digest.readUInt32BE(0) / 0xffffffff;
  return Math.floor(min + raw * (max - min + 1));
}

function seededPick(seed, values, offset = '') {
  return values[seededNumber(`${seed}:${offset}`, 0, values.length - 1)];
}

function redact(value) {
  const text = clean(value, 120);
  if (!text) return 'UNSPECIFIED';
  if (text.includes('@')) {
    const [name, domain = 'hidden.local'] = text.split('@');
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(3, name.length - 2))}@${domain}`;
  }
  if (text.length <= 5) return `${text[0] || '*'}****`;
  return `${text.slice(0, 3)}${'*'.repeat(Math.min(12, text.length - 5))}${text.slice(-2)}`;
}

function isPrivateOrReservedIp(ip) {
  if (net.isIP(ip) === 0) return true;
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }
  const parts = ip.split('.').map(Number);
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    parts[0] >= 224
  );
}

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Upstream returned ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function simulatedMlProfile(playerId, zoneId) {
  const seed = `ml:${playerId}:${zoneId}`;
  const ranks = ['Epic', 'Legend', 'Mythic', 'Mythical Honor', 'Mythical Glory'];
  const statuses = ['ONLINE', 'IDLE', 'MATCHMAKING', 'OFFLINE'];
  return {
    source: 'isolated-simulation',
    verified: false,
    platform: 'Mobile Legends',
    playerId,
    zoneId,
    nickname: `TRMX_${seededNumber(seed, 1000, 9999)}`,
    level: seededNumber(`${seed}:level`, 22, 168),
    rank: seededPick(seed, ranks, 'rank'),
    stars: seededNumber(`${seed}:stars`, 1, 119),
    matchesIndexed: seededNumber(`${seed}:matches`, 240, 7400),
    winRate: `${seededNumber(`${seed}:wr`, 46, 73)}.${seededNumber(`${seed}:dec`, 0, 9)}%`,
    activity: seededPick(seed, statuses, 'status'),
    note: 'No authenticated public player adapter was available; this record is generated inside the isolated lab.'
  };
}

function simulatedFfProfile(uid, region) {
  const seed = `ff:${uid}:${region}`;
  const ranks = ['Gold', 'Platinum', 'Diamond', 'Heroic', 'Grandmaster'];
  return {
    source: 'isolated-simulation',
    verified: false,
    platform: 'Free Fire',
    uid,
    region: region.toUpperCase(),
    nickname: `N0VA-${seededNumber(seed, 100, 999)}`,
    level: seededNumber(`${seed}:level`, 18, 92),
    rank: seededPick(seed, ranks, 'rank'),
    likes: seededNumber(`${seed}:likes`, 260, 98000),
    accountAgeDays: seededNumber(`${seed}:age`, 120, 2600),
    guild: seededPick(seed, ['VOID CELL', 'RED CIRCUIT', 'NO GUILD', 'TRMX UNIT'], 'guild'),
    note: 'Live public lookup was unavailable; this record is generated inside the isolated lab.'
  };
}

async function lookupFreeFire(uid, region) {
  const apiKey = process.env.FF_API_KEY;
  const baseUrl = process.env.FF_API_BASE_URL || 'https://developers.freefirecommunity.com/api/v1';
  if (!apiKey) return simulatedFfProfile(uid, region);

  try {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/info`);
    url.searchParams.set('uid', uid);
    url.searchParams.set('region', region.toLowerCase());
    const data = await fetchJson(url, { headers: { 'x-api-key': apiKey, accept: 'application/json' } });
    const basic = data?.basicInfo || {};
    const clan = data?.clanBasicInfo || {};
    const social = data?.socialInfo || {};
    return {
      source: 'public-adapter',
      verified: true,
      platform: 'Free Fire',
      uid: String(basic.accountId || uid),
      region: String(basic.region || region).toUpperCase(),
      nickname: clean(basic.nickname || 'UNKNOWN', 40),
      level: basic.level ?? null,
      rank: basic.rank ?? null,
      seasonId: basic.seasonId ?? null,
      guild: clean(clan.clanName || 'NO GUILD', 50),
      guildLevel: clan.clanLevel ?? null,
      signature: clean(social.signature || '', 120),
      note: 'Public profile metadata returned by the configured community API adapter.'
    };
  } catch (error) {
    return { ...simulatedFfProfile(uid, region), adapterError: clean(error.message, 120) };
  }
}

async function lookupMlbb(playerId, zoneId) {
  const template = process.env.MLBB_PUBLIC_API_URL;
  if (!template) return simulatedMlProfile(playerId, zoneId);

  try {
    const url = template
      .replaceAll('{playerId}', encodeURIComponent(playerId))
      .replaceAll('{zoneId}', encodeURIComponent(zoneId));
    const headers = { accept: 'application/json' };
    if (process.env.MLBB_PUBLIC_API_KEY) headers.authorization = `Bearer ${process.env.MLBB_PUBLIC_API_KEY}`;
    const data = await fetchJson(url, { headers });
    return {
      source: 'public-adapter',
      verified: true,
      platform: 'Mobile Legends',
      playerId,
      zoneId,
      publicData: data,
      note: 'Public profile metadata returned by the configured MLBB adapter.'
    };
  } catch (error) {
    return { ...simulatedMlProfile(playerId, zoneId), adapterError: clean(error.message, 120) };
  }
}

async function lookupIp(ip) {
  if (net.isIP(ip) === 0) throw new Error('Invalid IPv4 or IPv6 address.');
  if (isPrivateOrReservedIp(ip)) {
    return {
      source: 'local-classifier',
      verified: true,
      ip,
      scope: 'PRIVATE_OR_RESERVED',
      note: 'No external lookup was performed for private or reserved address space.'
    };
  }

  if (process.env.IPWHO_API_KEY) {
    const url = new URL(`https://api.ipwho.org/ip/${encodeURIComponent(ip)}`);
    url.searchParams.set('apiKey', process.env.IPWHO_API_KEY);
    const payload = await fetchJson(url);
    const data = payload?.data || {};
    return {
      source: 'public-ip-metadata',
      verified: Boolean(payload?.success),
      ip: data.ip || ip,
      country: data.geoLocation?.country || null,
      region: data.geoLocation?.region || null,
      city: data.geoLocation?.city || null,
      latitude: data.geoLocation?.latitude ?? null,
      longitude: data.geoLocation?.longitude ?? null,
      timezone: data.timezone?.time_zone || null,
      asn: data.connection?.asn_number || null,
      organization: data.connection?.asn_org || data.connection?.isp || null,
      vpn: data.security?.isVpn ?? null,
      tor: data.security?.isTor ?? null,
      note: 'Coarse public network metadata; this does not identify a person or exact device location.'
    };
  }

  const fields = ['success', 'message', 'ip', 'type', 'continent', 'country', 'country_code', 'region', 'city', 'latitude', 'longitude', 'timezone', 'connection'].join(',');
  const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}?fields=${encodeURIComponent(fields)}`);
  if (!data?.success) throw new Error(data?.message || 'Public IP lookup failed.');
  return {
    source: 'public-ip-metadata',
    verified: true,
    ip: data.ip || ip,
    type: data.type || null,
    continent: data.continent || null,
    country: data.country || null,
    countryCode: data.country_code || null,
    region: data.region || null,
    city: data.city || null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    timezone: data.timezone?.id || null,
    asn: data.connection?.asn || null,
    organization: data.connection?.org || data.connection?.isp || null,
    note: 'Coarse public network metadata; this does not identify a person or exact device location.'
  };
}

function simulateAccess(vector, target) {
  const runId = crypto.randomBytes(5).toString('hex').toUpperCase();
  const success = crypto.randomInt(0, 100) >= 38;
  const confidence = success ? crypto.randomInt(71, 99) : crypto.randomInt(12, 58);
  const phasePool = {
    password: ['HASH MODEL INITIALIZED', 'DICTIONARY SPACE EMULATED', 'RATE GATE TESTED', 'TOKEN MATERIAL SYNTHESIZED'],
    email: ['IDENTIFIER NORMALIZED', 'DOMAIN SURFACE MAPPED', 'RECOVERY PATH EMULATED', 'SESSION TOKEN SYNTHESIZED'],
    id: ['IDENTIFIER RESOLVED', 'PUBLIC GRAPH INDEXED', 'CORRELATION MODEL EXECUTED', 'ACCESS TOKEN SYNTHESIZED']
  };
  return {
    source: 'isolated-simulation',
    verified: false,
    runId,
    operation: `${vector.toUpperCase()} ACCESS EMULATION`,
    target: redact(target),
    outcome: success ? 'SUCCESS' : 'FAILED',
    confidence: `${confidence}%`,
    generatedArtifact: success ? `LAB-${crypto.randomBytes(9).toString('base64url').toUpperCase()}` : null,
    phases: phasePool[vector],
    note: 'No login attempt, password guessing, account change, email access, or external write occurred.'
  };
}

function parseCommand(command) {
  const parts = command.trim().split(/\s+/);
  const [root = '', action = '', ...args] = parts;
  return { root: root.toLowerCase(), action: action.toLowerCase(), args };
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_384) throw new Error('Request payload exceeds 16KB.');
  }
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw new Error('Malformed JSON payload.'); }
}

async function executeCommand(command) {
  const { root, action, args } = parseCommand(command);
  const startedAt = Date.now();
  await wait(280 + crypto.randomInt(120, 720));
  let result;

  if (root === 'status') {
    result = {
      source: 'system', system: 'CYBERTRMX', mode: 'ISOLATED_LAB', api: 'ONLINE',
      ffAdapter: process.env.FF_API_KEY ? 'CONFIGURED' : 'SIMULATION_FALLBACK',
      mlbbAdapter: process.env.MLBB_PUBLIC_API_URL ? 'CONFIGURED' : 'SIMULATION_FALLBACK',
      ipMetadata: 'PUBLIC_METADATA_ONLY'
    };
  } else if (root === 'probe' && action === 'ml') {
    const [playerId, zoneId] = args.map((value) => clean(value, 32));
    if (!/^\d{5,20}$/.test(playerId || '') || !/^\d{1,10}$/.test(zoneId || '')) throw new Error('ML probe requires numeric player and zone identifiers.');
    result = await lookupMlbb(playerId, zoneId);
  } else if (root === 'probe' && action === 'ff') {
    const [uid, region] = args.map((value) => clean(value, 16));
    if (!/^\d{5,15}$/.test(uid || '') || !/^[a-z]{2,5}$/i.test(region || '')) throw new Error('FF probe requires a 5–15 digit UID and a short region code.');
    result = await lookupFreeFire(uid, region);
  } else if (root === 'inspect' && action === 'ip') {
    result = await lookupIp(clean(args[0], 64));
  } else if (root === 'simulate' && action === 'access') {
    const vector = clean(args.shift(), 16).toLowerCase();
    const target = clean(args.join(' '), 120);
    if (!['password', 'email', 'id'].includes(vector) || !target) throw new Error('Access simulation requires a supported vector and target label.');
    result = simulateAccess(vector, target);
  } else {
    const error = new Error('Command signature rejected.');
    error.code = 'UNKNOWN_COMMAND';
    throw error;
  }

  return { ok: true, elapsedMs: Date.now() - startedAt, timestamp: new Date().toISOString(), result };
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = path.join(publicDir, normalized);
  if (!filePath.startsWith(publicDir)) filePath = path.join(publicDir, 'index.html');
  try {
    const data = await fs.readFile(filePath);
    const type = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { ...securityHeaders, 'Content-Type': type, 'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600' });
    res.end(data);
  } catch {
    const data = await fs.readFile(path.join(publicDir, 'index.html'));
    res.writeHead(200, { ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const clientKey = req.socket.remoteAddress || 'unknown';
  try {
    if (url.pathname.startsWith('/api/') && rateLimited(clientKey)) {
      return jsonResponse(res, 429, { ok: false, error: 'RATE_LIMIT', message: 'Command channel temporarily saturated.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return jsonResponse(res, 200, { ok: true, system: 'CYBERTRMX', mode: 'ISOLATED_LAB', timestamp: new Date().toISOString() });
    }
    if (req.method === 'POST' && url.pathname === '/api/command') {
      const body = await readJsonBody(req);
      const command = clean(body.command, 180);
      if (!command) return jsonResponse(res, 400, { ok: false, error: 'EMPTY_COMMAND', message: 'Command payload is empty.' });
      try {
        const payload = await executeCommand(command);
        return jsonResponse(res, 200, payload);
      } catch (error) {
        return jsonResponse(res, 400, {
          ok: false, error: error.code || 'COMMAND_FAILED', timestamp: new Date().toISOString(), message: clean(error.message || 'Command failed.', 180)
        });
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return jsonResponse(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
    }
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    return jsonResponse(res, 500, { ok: false, error: 'INTERNAL_ERROR', message: clean(error.message || 'Internal error.', 180) });
  }
});

server.listen(port, () => {
  console.log(`CYBERTRMX node active on port ${port}`);
});
