const {defineConfig,devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/ui',
  timeout:30000,
  expect:{timeout:7000},
  retries:1,
  workers:2,
  reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
  use:{
    baseURL:'http://127.0.0.1:4173',
    serviceWorkers:'block',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
    {name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit'}}
  ],
  webServer:{
    command:'python3 -m http.server 4173 --directory public',
    url:'http://127.0.0.1:4173/index.html',
    reuseExistingServer:false,
    timeout:15000
  }
});
