const {test,expect}=require('@playwright/test');
const build=require('../../package.json').version;

const supabaseStub=`
window.supabase={createClient(){
 const channel={on(){return channel},subscribe(callback){callback&&callback('SUBSCRIBED');return channel}};
 const auth={
  getSession:async()=>({data:{session:null},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signInWithPassword:async()=>({data:{session:null},error:{message:'Smoke test sign-in disabled'}}),
  signUp:async()=>({data:{session:null},error:{message:'Smoke test sign-up disabled'}}),
  signOut:async()=>({error:null}),
  mfa:{listFactors:async()=>({data:{totp:[],phone:[]},error:null}),getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal1'},error:null}),enroll:async()=>({data:null,error:{message:'Smoke test MFA disabled'}}),unenroll:async()=>({data:null,error:null}),challenge:async()=>({data:null,error:null}),verify:async()=>({data:null,error:null})}
 };
 return {auth,functions:{invoke:async()=>({data:{},error:null})},channel:()=>channel,removeChannel:async()=>({data:'ok',error:null})};
}};
`;

async function routeExternal(page,{backend=true}={}){
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();
  if(url.pathname.endsWith('supabase.min.js')){
   if(!backend)return route.abort();
   return route.fulfill({status:200,contentType:'application/javascript',body:supabaseStub});
  }
  if(url.pathname.endsWith('.js'))return route.fulfill({status:200,contentType:'application/javascript',body:''});
  if(url.pathname.endsWith('.css'))return route.fulfill({status:200,contentType:'text/css',body:''});
  return route.abort();
 });
}

async function openStableShell(page,options={}){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await routeExternal(page,options);
 await page.goto(`/?smoke=${encodeURIComponent(build)}`,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.floating-nav')).toHaveCount(1);
 await expect(page.locator('#boot-screen')).toHaveClass(/done/,{timeout:5000});
 await expect(page.locator('#view-overview')).toHaveClass(/active/);
 return errors;
}

test('the stable shell boots without a blank screen',async({page})=>{
 const errors=await openStableShell(page);
 await expect(page.locator('main')).toBeVisible();
 await expect(page.locator('#view-overview')).toBeVisible();
 const state=await page.evaluate(()=>({text:document.querySelector('main')?.innerText.trim().length||0,active:document.querySelectorAll('.view.active').length,width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
 expect(state.text).toBeGreaterThan(250);expect(state.active).toBe(1);expect(state.width).toBeLessThanOrEqual(state.viewport+2);expect(errors).toEqual([]);
});

test('core navigation opens every built-in workspace view',async({page})=>{
 const errors=await openStableShell(page);
 for(const tab of ['overview','terminal','intel','monitor','profile']){
  await page.locator(`.nav-item[data-tab="${tab}"]`).evaluate(element=>element.click());
  await expect(page.locator(`#view-${tab}`)).toHaveClass(/active/);
  await expect(page.locator(`#view-${tab}`)).toBeVisible();
 }
 expect(errors).toEqual([]);
});

test('Guide, Patch, and Operations open without replacing the shell',async({page})=>{
 const errors=await openStableShell(page);
 await expect.poll(()=>page.evaluate(()=>typeof window.openCyberGuide)).toBe('function');
 await page.evaluate(()=>window.openCyberGuide());
 await expect(page.locator('#view-guide')).toHaveClass(/active/);
 await page.locator('.floating-trigger').click();
 await page.locator('.floating-links [data-go="patch"]').click();
 await expect(page.locator('#view-patch')).toHaveClass(/active/);
 await expect(page.locator('#view-patch')).toContainText(`CURRENT BUILD / ${build}`);
 await expect.poll(()=>page.evaluate(()=>typeof window.CYBERTRMX_OPERATIONS?.open)).toBe('function');
 await page.evaluate(()=>window.CYBERTRMX_OPERATIONS.open());
 await expect(page.locator('#view-operations')).toHaveClass(/active/);
 await expect(page.locator('#ops-auth-card')).toBeVisible();
 expect(errors).toEqual([]);
});

test('production terminal routes job list to the persistent queue bridge',async({page})=>{
 const errors=await openStableShell(page);
 await page.locator('.nav-item[data-tab="terminal"]').evaluate(element=>element.click());
 await expect.poll(()=>page.evaluate(()=>Boolean(window.CYBERTRMX_R3_TERMINAL_BRIDGE?.execute&&window.execute?.__cybertrmxQueue531)),{timeout:10000}).toBe(true);
 await page.locator('#command-input').fill('job list');
 await page.locator('#terminal-form').evaluate(form=>form.requestSubmit());
 await expect(page.locator('#terminal-output')).not.toContainText('command not found: job');
 await expect(page.locator('#terminal-output')).toContainText(/sign in|persistent queue|job/i);
 expect(errors).toEqual([]);
});

test('Production Guard mounts in Profile and exposes diagnostics',async({page})=>{
 const errors=await openStableShell(page);
 await page.locator('.nav-item[data-tab="profile"]').evaluate(element=>element.click());
 await expect(page.locator('#cybertrmx-guard')).toBeVisible({timeout:5000});
 await expect(page.locator('#cybertrmx-guard')).toContainText('PRODUCTION GUARD /');
 await page.locator('#guard-toggle').click();
 await expect(page.locator('#guard-panel')).toBeVisible();
 await expect(page.locator('#guard-details')).toContainText('Frontend');
 await expect(page.locator('#guard-details')).toContainText('Service worker');
 await expect(page.locator('#guard-recover')).toBeVisible();
 expect(errors).toEqual([]);
});

test('iPhone controls remain inside the viewport and accept taps',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='iphone-webkit','iPhone-specific interaction check');
 const errors=await openStableShell(page);const trigger=page.locator('.floating-trigger');
 await expect(trigger).toBeVisible();await trigger.click();await expect(page.locator('.floating-nav')).toHaveClass(/open/);
 const box=await trigger.boundingBox(),viewport=page.viewportSize();
 expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);
 await page.locator('#menu').click();await expect(page.locator('#rail')).toHaveClass(/open/);
 await page.locator('#rail .nav-item[data-tab="terminal"]').click();await expect(page.locator('#view-terminal')).toBeVisible();expect(errors).toEqual([]);
});

test('backend library failure never blanks or blocks the core interface',async({page})=>{
 const errors=await openStableShell(page,{backend:false});
 await expect(page.locator('#view-overview')).toBeVisible();
 await page.locator('.nav-item[data-tab="terminal"]').evaluate(element=>element.click());
 await expect(page.locator('#view-terminal')).toBeVisible();
 await expect(page.locator('.floating-trigger')).toBeVisible();
 await page.locator('.nav-item[data-tab="profile"]').evaluate(element=>element.click());
 await expect(page.locator('#cybertrmx-guard')).toBeVisible();expect(errors).toEqual([]);
});
