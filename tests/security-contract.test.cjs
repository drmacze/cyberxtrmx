const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('PWA uses a small 5.3.3 startup shell',()=>{
  const sw=read('public/sw.js');
  assert.match(sw,/cybertrmx-v31/);
  assert.match(sw,/const SHELL/);
  assert.match(sw,/mobile-performance-v533\.css/);
  assert.match(sw,/ignoreSearch:\s*true/);
  assert.doesNotMatch(sw,/Promise\.allSettled/);
  const shellBlock=sw.match(/const SHELL = \[([\s\S]*?)\];/)?.[1]||'';
  assert.ok((shellBlock.match(/'\.\//g)||[]).length<=12,'startup shell must remain compact');
});

test('5.3.3 HTML does not block on external motion libraries',()=>{
  const html=read('public/index.html');
  const motion=read('public/motion.js');
  assert.doesNotMatch(html,/gsap\.min\.js/);
  assert.doesNotMatch(html,/ScrollTrigger\.min\.js/);
  assert.doesNotMatch(html,/lenis\.min\.js/);
  assert.match(html,/app\.js\?v=5\.3\.3/);
  assert.match(html,/motion\.js\?v=5\.3\.3/);
  assert.match(html,/@media\(pointer:coarse\).*boot-screen/s);
  assert.match(motion,/scheduleFeatureModules/);
  assert.match(motion,/loadDesktopMotion/);
  assert.match(motion,/touch-shell/);
  assert.match(motion,/scrollRestoration='manual'/);
});

test('security modules remain behind the protected bootstrap path',()=>{
  const bootstrap=read('public/cloud-bootstrap.js');
  const source=read('public/device-v531.js');
  assert.match(bootstrap,/security-utils\.js/);
  assert.match(bootstrap,/device-v531\.js/);
  assert.match(bootstrap,/security-v52\.js/);
  assert.ok(bootstrap.indexOf('device-v531.js')<bootstrap.indexOf('security-v52.js'));
  assert.match(source,/x-device-id/);
  assert.match(source,/x-idempotency-key/);
  assert.match(source,/DEVICE_ID_REQUIRED/);
  assert.doesNotMatch(source,/cybertrmx-checkin/);
});

test('terminal blocks password-bearing account commands',()=>{
  const source=read('public/security-v52.js');
  assert.match(source,/Credentials are only accepted in the protected account form/);
  const hints=read('public/command-hints-v52.js');
  assert.match(hints,/splice/);
  assert.match(hints,/auth open/);
  assert.doesNotMatch(hints,/auth create <email> <password>/);
});

test('check-in uses a stable submission key and structured errors',()=>{
  const source=read('public/checkin.js');
  assert.match(source,/x-submission-key/);
  assert.match(source,/submissionKey=submissionKey\|\|crypto\.randomUUID/);
  assert.match(source,/requestId/);
});