(()=>{
'use strict';
const VERSION='5.3.5';
function headers(){
  const security=window.CYBERTRMX_SECURITY;
  const id=security?.getDeviceId?.()||localStorage.getItem('cybertrmx-device-id-v1')||'';
  const meta=security?.deviceMeta?.()||{platform:'iPhone',browser:'Safari',label:'iPhone / Safari'};
  return {
    'x-device-id':id,
    'x-device-label':meta.label,
    'x-device-platform':meta.platform,
    'x-device-browser':meta.browser,
    'x-client-version':VERSION
  };
}
function install(){
  const supabase=window.supabase;
  if(!supabase?.createClient||supabase.createClient.__cybertrmxDeviceTransport)return false;
  const original=supabase.createClient.bind(supabase);
  const wrapped=(url,key,options={})=>{
    const globalOptions=options.global||{};
    return original(url,key,{
      ...options,
      global:{
        ...globalOptions,
        headers:{...headers(),...(globalOptions.headers||{})}
      }
    });
  };
  wrapped.__cybertrmxDeviceTransport=true;
  wrapped.__cybertrmxOriginal=original;
  supabase.createClient=wrapped;
  window.CYBERTRMX_DEVICE_TRANSPORT={version:VERSION,headers,installed:true};
  window.dispatchEvent(new CustomEvent('cybertrmx:device-transport-ready',{detail:{version:VERSION,device_id:headers()['x-device-id']}}));
  return true;
}
if(!install()){
  let attempts=0;
  const timer=setInterval(()=>{attempts++;if(install()||attempts>=80)clearInterval(timer)},50);
}
})();