const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Trace Lab is opt-in and leaves default runtime unchanged',()=>{
  const bootstrap=read('public/cloud-bootstrap.js');
  const manifest=JSON.parse(read('public/candidate-540.json'));
  assert.match(bootstrap,/trace540/);
  assert.match(bootstrap,/localStorage\.getItem\('cybertrmx-trace-540'\)/);
  assert.match(bootstrap,/if\(TRACE_540\).*trace-lab-v540/s);
  assert.equal(manifest.opt_in,true);
  assert.equal(manifest.default_runtime,'5.3.5');
  assert.equal(manifest.production_ui_changed_without_opt_in,false);
});

test('Web Trace requires visible authorization and rejects invasive capabilities',()=>{
  const source=read('public/trace-lab-v540.js');
  const manifest=JSON.parse(read('public/candidate-540.json'));
  assert.match(source,/trace540-web-permission/);
  assert.match(source,/permission_confirmed:true/);
  assert.equal(manifest.web_collection.authorization_confirmation_required,true);
  assert.equal(manifest.web_collection.port_scanning,false);
  assert.equal(manifest.web_collection.exploitation,false);
  assert.equal(manifest.web_collection.private_network_targets_rejected,true);
});

test('Phone Intelligence is numbering-plan metadata only',()=>{
  const source=read('public/trace-lab-v540.js');
  const manifest=JSON.parse(read('public/candidate-540.json'));
  assert.match(source,/trace540-phone-purpose/);
  assert.match(source,/lawful_purpose_confirmed:true/);
  assert.equal(manifest.phone_intelligence.live_location,false);
  assert.equal(manifest.phone_intelligence.subscriber_identity,false);
  assert.equal(manifest.phone_intelligence.raw_number_stored,false);
});

test('Check-In 2 map stays explicitly opt-in and scoped to its result',()=>{
  const source=read('public/checkin-map-v540.js');
  assert.match(source,/get\('map_v2'\)!=='1'/);
  assert.match(source,/new MutationObserver\(render\)\.observe\(coordinate/);
  assert.doesNotMatch(source,/observe\(document\.body/);
});

test('Trace backend is registered and browser table writes are not used',()=>{
  const config=read('public/backend-config.js');
  const source=read('public/trace-lab-v540.js');
  const migration=read('supabase/migrations/20260807_create_trace_intelligence_v540.sql');
  assert.match(config,/traceFunction: 'cybertrmx-trace'/);
  assert.match(source,/functions\/v1\/\$\{TRACE_FUNCTION\}/);
  assert.match(migration,/revoke all privileges on table public\.trace_assets from anon, authenticated/);
  assert.match(migration,/security definer/);
});

test('Trace terminal never executes web or phone collection without form confirmation',()=>{
  const source=read('public/trace-lab-v540.js');
  assert.match(source,/trace web requires confirmation in the Trace Lab form/);
  assert.match(source,/trace phone requires lawful-purpose confirmation in the Trace Lab form/);
  assert.match(source,/trace disable/);
});
