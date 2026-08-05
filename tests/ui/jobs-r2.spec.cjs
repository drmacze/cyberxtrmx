const {test,expect}=require('@playwright/test');

const session={
  access_token:'staging-test-token',
  expires_at:1999999999,
  user:{id:'11111111-1111-4111-8111-111111111111',email:'staging@example.com'}
};

const supabaseStub=`
window.supabase={createClient(){
 const channel={on(){return channel},subscribe(callback){callback&&callback('SUBSCRIBED');return channel},unsubscribe(){return Promise.resolve('ok')}};
 const auth={
  getSession:async()=>({data:{session:${JSON.stringify(session)}},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signInWithPassword:async()=>({data:{session:${JSON.stringify(session)}},error:null}),
  signUp:async()=>({data:{session:${JSON.stringify(session)}},error:null}),
  signOut:async()=>({error:null}),
  mfa:{
   listFactors:async()=>({data:{totp:[],phone:[]},error:null}),
   getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal1'},error:null}),
   enroll:async()=>({data:{id:'factor',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"></svg>',secret:'ABC123'}},error:null}),
   unenroll:async()=>({data:null,error:null}),
   challenge:async()=>({data:null,error:null}),
   verify:async()=>({data:null,error:null})
  }
 };
 return {auth,functions:{invoke:async()=>({data:{},error:null})},channel:()=>channel,removeChannel:async()=>({data:'ok',error:null})};
}};
`;

function cors(){
  return {
    'access-control-allow-origin':'http://127.0.0.1:4173',
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization, apikey, content-type, x-device-id, x-device-label, x-device-platform, x-device-browser, x-idempotency-key, x-client-version',
    'content-type':'application/json',
    'x-request-id':'22222222-2222-4222-8222-222222222222'
  };
}

async function installRoutes(page){
  let job=null;
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();
    if(url.pathname.endsWith('supabase.min.js'))return route.fulfill({status:200,contentType:'application/javascript',body:supabaseStub});
    if(url.pathname.includes('/functions/v1/')){
      if(request.method()==='OPTIONS')return route.fulfill({status:200,headers:cors(),body:'{}'});
      const body=JSON.parse(request.postData()||'{}');
      if(url.pathname.endsWith('/cybertrmx-ops')){
        const dashboard={ok:true,request_id:'ops-request',backend_version:'ops-smoke',workspace:{id:'workspace-1',name:'Staging Workspace'},role:'owner',cases:[],scope:[],jobs:[],evidence:[],checkins:[],audit:[],locations:[],devices:[],security_events:[],server_time:new Date().toISOString()};
        const payload=body.action==='security_status'?{ok:true,request_id:'security-request',backend_version:'ops-smoke',aal:'aal1',devices:[]}:dashboard;
        return route.fulfill({status:200,headers:cors(),body:JSON.stringify(payload)});
      }
      if(url.pathname.endsWith('/cybertrmx-jobs')){
        if(body.action==='run_lookup'){
          job={id:'33333333-3333-4333-8333-333333333333',job_type:body.job_type,status:'queued',progress:0,attempt_count:0,max_attempts:3,request_payload:{input:body.input},created_at:new Date().toISOString()};
          return route.fulfill({status:202,headers:{...cors(),'x-cybertrmx-backend':'jobs-smoke'},body:JSON.stringify({ok:true,request_id:'queue-request',backend_version:'jobs-smoke',job_id:job.id,status:'queued',job,poll_after_ms:50})});
        }
        if(body.action==='job_status'){
          job={...job,status:'completed',progress:100,attempt_count:1,result:JSON.stringify({source:'test',records:{A:[{data:'203.0.113.10'}]}})};
          return route.fulfill({status:200,headers:{...cors(),'x-cybertrmx-backend':'jobs-smoke'},body:JSON.stringify({ok:true,request_id:'status-request',backend_version:'jobs-smoke',job,events:[{progress:0,stage:'QUEUED',message:'Job accepted by the persistent queue'},{progress:100,stage:'COMPLETED',message:'Evidence sealed'}],poll_after_ms:10000})});
        }
        if(body.action==='queue_status'){
          const jobs=job?[job]:[],counts=job?[{status:job.status,count:1}]:[];
          return route.fulfill({status:200,headers:{...cors(),'x-cybertrmx-backend':'jobs-smoke'},body:JSON.stringify({ok:true,request_id:'list-request',backend_version:'jobs-smoke',jobs,counts,poll_after_ms:5000})});
        }
      }
      return route.fulfill({status:400,headers:cors(),body:JSON.stringify({error:'ACTION_NOT_SUPPORTED'})});
    }
    if(url.pathname.endsWith('.js'))return route.fulfill({status:200,contentType:'application/javascript',body:''});
    if(url.pathname.endsWith('.css'))return route.fulfill({status:200,contentType:'text/css',body:''});
    return route.abort();
  });
}

test('staging R3 owns terminal and form execution while Operations stays online',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await installRoutes(page);
  await page.goto('/?jobs_r3=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#boot-screen')).toHaveClass(/done/,{timeout:5000});
  await expect.poll(()=>page.evaluate(()=>typeof window.CYBERTRMX_OPERATIONS?.open)).toBe('function');
  await page.evaluate(()=>window.CYBERTRMX_OPERATIONS.open());
  await expect(page.locator('#ops-r3-queue-card')).toBeVisible();
  await expect(page.locator('#ops-runtime-state')).toHaveText('ONLINE');
  await page.locator('#ops-lookup-type').selectOption('dns_inventory');
  await page.locator('#ops-lookup-input').fill('example.com');
  await page.locator('#ops-run-lookup').click();
  await expect(page.locator('#ops-job-label')).toHaveText('COMPLETED',{timeout:7000});
  await expect(page.locator('#ops-job-events')).toContainText(/persistent queue/i);
  await expect(page.locator('#ops-job-result')).toContainText('A: 1 record(s)');
  await expect(page.locator('#ops-runtime-state')).toHaveText('ONLINE');
  await page.locator('[data-tab="terminal"]').first().click();
  await page.locator('#command-input').fill('job list');
  await page.locator('#terminal-form button').click();
  await expect(page.locator('#terminal-output')).toContainText('33333333-3333-4333-8333-333333333333');
  await expect(page.locator('#terminal-output')).not.toContainText('command not found: job');
  expect(errors).toEqual([]);
});
