(()=>{
'use strict';
const PRODUCTION_URL='https://drmacze.github.io/cyberxtrmx/';
if(!window.supabase||window.supabase.__cybertrmxRedirectPatched)return;
const originalCreateClient=window.supabase.createClient.bind(window.supabase);
window.supabase.createClient=(url,key,options)=>{
  const client=originalCreateClient(url,key,options);
  if(client?.auth&&!client.auth.__cybertrmxRedirectPatched){
    const originalSignUp=client.auth.signUp.bind(client.auth);
    client.auth.signUp=(credentials={})=>{
      const existing=credentials.options||{};
      return originalSignUp({
        ...credentials,
        options:{
          ...existing,
          emailRedirectTo:PRODUCTION_URL,
          data:{...(existing.data||{})}
        }
      });
    };
    const originalReset=client.auth.resetPasswordForEmail?.bind(client.auth);
    if(originalReset){
      client.auth.resetPasswordForEmail=(email,opts={})=>originalReset(email,{...opts,redirectTo:PRODUCTION_URL});
    }
    client.auth.__cybertrmxRedirectPatched=true;
  }
  return client;
};
window.supabase.__cybertrmxRedirectPatched=true;
})();
