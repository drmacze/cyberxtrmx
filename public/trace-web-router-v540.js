(()=>{
'use strict';
if(window.fetch?.__cybertrmxTraceWebRc3)return;
const original=window.fetch.bind(window);
const wrapped=(input,init)=>{
 try{
  const requestUrl=typeof input==='string'?input:input instanceof URL?input.toString():input?.url||'';
  if(requestUrl.includes('/functions/v1/cybertrmx-trace')&&init?.method?.toUpperCase()==='POST'&&typeof init.body==='string'){
   const body=JSON.parse(init.body);
   if(body?.action==='web_scan'){
    const url=new URL(requestUrl);
    url.pathname=url.pathname.replace(/\/cybertrmx-trace$/,'/cybertrmx-trace-web-v2');
    return original(url.toString(),init);
   }
  }
 }catch(error){console.warn('CYBERTRMX trace web router skipped',error)}
 return original(input,init);
};
wrapped.__cybertrmxTraceWebRc3=true;
wrapped.__cybertrmxOriginal=original;
window.fetch=wrapped;
window.CYBERTRMX_TRACE_WEB_ROUTER={version:'5.4.0-rc3',endpoint:'cybertrmx-trace-web-v2'};
})();