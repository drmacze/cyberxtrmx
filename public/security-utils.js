(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CYBERTRMX_SECURITY=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DEVICE_KEY='cybertrmx-device-id-v1';
  const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const commonFragments=['password','qwerty','admin','welcome','letmein','cybertrmx','123456','abcdef'];
  function uuid(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    const bytes=new Uint8Array(16);globalThis.crypto?.getRandomValues?.(bytes);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    return [...bytes].map((byte,index)=>([4,6,8,10].includes(index)?'-':'')+byte.toString(16).padStart(2,'0')).join('');
  }
  function getDeviceId(storage=globalThis.localStorage){
    let value='';try{value=storage?.getItem(DEVICE_KEY)||''}catch{}
    if(!uuidPattern.test(value)){value=uuid();try{storage?.setItem(DEVICE_KEY,value)}catch{}}
    return value;
  }
  function idempotencyKey(){return uuid()}
  function deviceMeta(navigatorLike=globalThis.navigator||{}){
    const ua=String(navigatorLike.userAgent||''),platform=String(navigatorLike.platform||'');
    const family=/iPhone/i.test(ua)?'iPhone':/iPad/i.test(ua)?'iPad':/Android/i.test(ua)?'Android':/Mac/i.test(ua+platform)?'macOS':/Win/i.test(ua+platform)?'Windows':/Linux/i.test(ua+platform)?'Linux':'Device';
    const browser=/CriOS|Chrome/i.test(ua)?'Chrome':/FxiOS|Firefox/i.test(ua)?'Firefox':/EdgiOS|Edg/i.test(ua)?'Edge':/Safari/i.test(ua)?'Safari':'Browser';
    return {platform:family,browser,label:`${family} · ${browser}`};
  }
  function passwordAssessment(password){
    const value=String(password||''),lower=value.toLowerCase();let score=0;const notes=[];
    if(value.length>=12)score++;else notes.push('Use at least 12 characters.');
    if(value.length>=16)score++;
    if(/[a-z]/.test(value)&&/[A-Z]/.test(value))score++;else notes.push('Mix upper and lower case letters.');
    if(/\d/.test(value))score++;else notes.push('Add at least one number.');
    if(/[^A-Za-z0-9]/.test(value))score++;else notes.push('Add at least one symbol.');
    if(commonFragments.some(fragment=>lower.includes(fragment))){score=Math.max(0,score-2);notes.push('Avoid common or product-related phrases.');}
    if(/(.)\1{3,}/.test(value)||/(0123|1234|2345|abcd|qwer)/i.test(value)){score=Math.max(0,score-1);notes.push('Avoid repeated or predictable sequences.');}
    return {score:Math.min(5,score),strong:value.length>=12&&score>=4,notes:[...new Set(notes)]};
  }
  async function sha1Hex(value){
    const bytes=new TextEncoder().encode(String(value));
    const digest=await globalThis.crypto.subtle.digest('SHA-1',bytes);
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  async function compromisedPasswordCount(password,fetchImpl=globalThis.fetch){
    if(typeof fetchImpl!=='function')throw new Error('BREACH_CHECK_UNAVAILABLE');
    const hash=await sha1Hex(password),prefix=hash.slice(0,5),suffix=hash.slice(5);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);
    try{
      const response=await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`,{headers:{'Add-Padding':'true'},signal:controller.signal});
      if(!response.ok)throw new Error(`BREACH_CHECK_${response.status}`);
      const text=await response.text();
      const line=text.split(/\r?\n/).find(row=>row.startsWith(`${suffix}:`));
      return line?Number(line.split(':')[1])||1:0;
    }finally{clearTimeout(timer)}
  }
  function friendlyError(payload,fallback='The request could not be completed.'){
    if(!payload)return fallback;
    if(typeof payload==='string')return payload;
    return payload.message||payload.error_description||payload.error||fallback;
  }
  return {DEVICE_KEY,uuidPattern,uuid,getDeviceId,idempotencyKey,deviceMeta,passwordAssessment,sha1Hex,compromisedPasswordCount,friendlyError};
});