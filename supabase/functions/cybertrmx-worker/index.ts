import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "postgres";

const DATABASE_URL=Deno.env.get("SUPABASE_DB_URL");
const VERSION="worker-v5.3.0";
if(!DATABASE_URL)throw new Error("BACKEND_ENVIRONMENT_INCOMPLETE");
const sql=postgres(DATABASE_URL,{prepare:false,max:3,idle_timeout:20,connect_timeout:10});
const encoder=new TextEncoder();

class WorkerError extends Error{
  constructor(code,message,retryable=false){super(message||code);this.code=code;this.retryable=retryable}
}
class CancelledError extends Error{constructor(){super("Job cancellation requested");this.code="JOB_CANCELLED"}}
const clean=(value,max=500)=>String(value??"").replace(/[<>]/g,"").trim().slice(0,max);
const domainPattern=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const ipv4Pattern=/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
function isPublicIPv4(ip){if(!ipv4Pattern.test(ip))return false;const[a,b]=ip.split(".").map(Number);return !(a===0||a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||a>=224)}
function stableJson(value){if(Array.isArray(value))return`[${value.map(stableJson).join(",")}]`;if(value&&typeof value==="object")return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;return JSON.stringify(value)}
async function sha256(value){const digest=await crypto.subtle.digest("SHA-256",encoder.encode(String(value)));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("")}
async function tokenMatches(candidate,expected){const[a,b]=await Promise.all([sha256(candidate||""),sha256(expected||"")]);if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function response(body,status=200){return new Response(JSON.stringify({ok:status<400,backend_version:VERSION,...body}),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-CYBERTRMX-Backend":VERSION}})}
async function authenticate(req){const rows=await sql`select worker_secret from private.job_worker_config where singleton=true`;if(!rows.length||!await tokenMatches(req.headers.get("x-worker-token")||"",rows[0].worker_secret))throw new WorkerError("WORKER_AUTH_INVALID","Worker authentication failed")}
async function heartbeat(job,workerId,progress,stage,message,meta={}){const rows=await sql`select * from private.heartbeat_job(${job.id}::uuid,${workerId}::uuid,${progress},${stage},${message},90,${JSON.stringify(meta)}::jsonb)`;const state=rows[0];if(!state?.accepted)throw new WorkerError("JOB_LEASE_LOST","The worker no longer owns this job",false);if(state.should_cancel)throw new CancelledError();return state}
async function providerFetch(url,timeoutSeconds,headers={}){let result;try{result=await fetch(url,{headers:{Accept:"application/json","User-Agent":"CYBERTRMX/5.3",...headers},redirect:"follow",signal:AbortSignal.timeout(Math.max(10000,Math.min(300000,timeoutSeconds*1000)))})}catch(error){if(error?.name==="TimeoutError"||error?.name==="AbortError")throw new WorkerError("JOB_TIMEOUT","Provider request exceeded the job timeout",true);throw new WorkerError("PROVIDER_NETWORK_ERROR",clean(error?.message,300)||"Provider network request failed",true)}if(!result.ok)throw new WorkerError(`PROVIDER_${result.status}`,`Provider returned HTTP ${result.status}`,result.status>=500||result.status===429);return result}
async function dnsQuery(domain,type,timeoutSeconds){const response=await providerFetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,timeoutSeconds,{Accept:"application/dns-json"});const body=await response.json();return(body.Answer||[]).map(answer=>({name:answer.name,type:answer.type,ttl:answer.TTL,data:answer.data}))}
async function executeJob(job,workerId){const payload=job.request_payload||{},input=clean(payload.input,253),timeout=Math.max(10,Math.min(300,Number(job.timeout_seconds)||45));if(!input)throw new WorkerError("LOOKUP_INPUT_REQUIRED","Queued job input is missing",false);await heartbeat(job,workerId,10,"VALIDATING_INPUT","Queued input accepted and normalized",{attempt:job.attempt_count});let result;
  if(job.job_type==="dns_inventory"){
    const domain=input.toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/\.$/,"");
    if(!domainPattern.test(domain))throw new WorkerError("DOMAIN_FORMAT_INVALID","Enter a valid domain name",false);
    const types=["A","AAAA","CNAME","MX","NS","TXT"],records={};
    await heartbeat(job,workerId,20,"QUERYING_DNS","Contacting public DNS resolvers");
    for(let index=0;index<types.length;index++){
      await heartbeat(job,workerId,24+index*9,"DNS_QUERY",`Requesting ${types[index]} records`,{type:types[index]});
      records[types[index]]=await dnsQuery(domain,types[index],timeout);
      await heartbeat(job,workerId,30+(index+1)*9,"DNS_RECEIVED",`${types[index]} records received`,{type:types[index],count:records[types[index]].length});
    }
    result={source:"Cloudflare DNS over HTTPS",collected_at:new Date().toISOString(),domain,records};
  }else if(job.job_type==="rdap_lookup"){
    const domain=input.toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/\.$/,"");
    const isDomain=domainPattern.test(domain),isIp=isPublicIPv4(input);
    if(!isDomain&&!isIp)throw new WorkerError("RDAP_INPUT_INVALID","Enter a valid domain or public IPv4 address",false);
    await heartbeat(job,workerId,30,"CONTACTING_RDAP","Requesting public registration data");
    const endpoint=isDomain?`https://rdap.org/domain/${encodeURIComponent(domain)}`:`https://rdap.org/ip/${encodeURIComponent(input)}`;
    const response=await providerFetch(endpoint,timeout,{Accept:"application/rdap+json, application/json"});
    await heartbeat(job,workerId,78,"PARSING_RDAP","Registration response received",{status:response.status});
    result={source:"RDAP bootstrap service",collected_at:new Date().toISOString(),query:isDomain?domain:input,response:await response.json()};
  }else if(job.job_type==="ip_enrichment"){
    if(!isPublicIPv4(input))throw new WorkerError("PUBLIC_IPV4_REQUIRED","Enter a public IPv4 address",false);
    await heartbeat(job,workerId,34,"CONTACTING_PROVIDER","Requesting public network metadata");
    const response=await providerFetch(`https://ipwho.is/${encodeURIComponent(input)}`,timeout);
    const body=await response.json();
    if(body.success===false)throw new WorkerError("IP_METADATA_UNAVAILABLE",clean(body.message,300)||"IP metadata is unavailable",true);
    await heartbeat(job,workerId,78,"NORMALIZING_METADATA","Network, ASN, timezone, and regional fields received");
    result={source:"ipwho.is",collected_at:new Date().toISOString(),query:input,response:body};
  }else throw new WorkerError("JOB_TYPE_NOT_SUPPORTED","That queued job type is not supported",false);
  await heartbeat(job,workerId,92,"SEALING_EVIDENCE","Calculating the evidence digest and committing the result");
  const digest=await sha256(stableJson(result));
  const rows=await sql`select private.complete_job(${job.id}::uuid,${workerId}::uuid,${JSON.stringify(result)}::jsonb,${job.job_type.toUpperCase()},${`${job.job_type}-${Date.now()}.json`},${digest}) as receipt`;
  return rows[0]?.receipt||{status:"completed",sha256:digest};
}
async function processOne(workerId){const claimed=await sql`select * from private.claim_next_job(${workerId}::uuid,90)`;if(!claimed.length)return null;const job=claimed[0];try{return{job_id:job.id,...await executeJob(job,workerId)}}catch(error){if(error instanceof CancelledError){const rows=await sql`select private.cancel_worker_job(${job.id}::uuid,${workerId}::uuid) as receipt`;return{job_id:job.id,...rows[0].receipt}}const code=error instanceof WorkerError?error.code:"WORKER_INTERNAL_ERROR",message=clean(error?.message,500)||"Worker execution failed",retryable=error instanceof WorkerError?error.retryable:true,delay=Math.min(300,10*Math.pow(2,Math.max(0,Number(job.attempt_count||1)-1)));try{const rows=await sql`select private.fail_job(${job.id}::uuid,${workerId}::uuid,${code},${message},${retryable},${delay}) as receipt`;return{job_id:job.id,error:code,...rows[0].receipt}}catch(commitError){console.error("CYBERTRMX_WORKER_FAILURE_COMMIT",job.id,commitError?.message||commitError);throw commitError}}
}

Deno.serve(async req=>{const requestId=crypto.randomUUID();if(req.method!=="POST")return response({request_id:requestId,error:"METHOD_NOT_ALLOWED"},405);try{await authenticate(req);await sql`select private.recover_stale_jobs()`;const workerId=crypto.randomUUID(),outcomes=[];for(let index=0;index<4;index++){const outcome=await processOne(workerId);if(!outcome)break;outcomes.push(outcome)}const remaining=await sql`select count(*)::integer as count from public.jobs where status in ('queued','retry_wait') and available_at<=now() and cancel_requested_at is null`;if(Number(remaining[0]?.count)>0)await sql`select private.kick_cybertrmx_worker('worker-chain')`;return response({request_id:requestId,worker_id:workerId,processed:outcomes.length,outcomes,remaining:Number(remaining[0]?.count)||0})}catch(error){const known=error instanceof WorkerError;console.error("CYBERTRMX_WORKER",requestId,error?.code||"INTERNAL",error?.message||error);return response({request_id:requestId,error:known?error.code:"WORKER_INTERNAL_ERROR",message:known?error.message:"Worker execution failed"},known?403:500)}});
