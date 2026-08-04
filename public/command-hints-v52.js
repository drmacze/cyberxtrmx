(()=>{
'use strict';
function apply(){
  const api=window.CYBERTRMX_COMMAND_HINTS;if(!api?.commands)return false;
  const commands=api.commands;
  for(let index=commands.length-1;index>=0;index--){if(/^auth\s+(?:create|login)\b/i.test(commands[index].command))commands.splice(index,1)}
  const additions=[
    {command:'auth open',category:'Account',description:'Open the protected account form.'},
    {command:'auth logout',category:'Account',description:'Close the current connected session.'},
    {command:'security status',category:'Security',description:'Show assurance level, device ID, and request context.'},
    {command:'security open',category:'Security',description:'Open account security and device controls.'},
    {command:'device list',category:'Security',description:'List registered account devices.'},
    {command:'device rename <id> <label>',category:'Security',description:'Give a registered device a clear name.'},
    {command:'device revoke <id>',category:'Security',description:'Revoke account access from a registered device.'},
    {command:'mfa status',category:'Security',description:'Show authenticator factor and assurance status.'},
    {command:'mfa enroll',category:'Security',description:'Open authenticator-app enrollment.'},
    {command:'job list',category:'Queue',description:'List recent persistent worker jobs.'},
    {command:'job status <id>',category:'Queue',description:'Show job state, progress, and retry attempt.'},
    {command:'job cancel <id>',category:'Queue',description:'Request cancellation at the next worker checkpoint.'},
    {command:'job retry <id>',category:'Queue',description:'Queue a new attempt from a terminal job.'}
  ];
  additions.forEach(item=>{if(!commands.some(existing=>existing.command===item.command))commands.push(item)});
  return true;
}
if(!apply()){let tries=0;const timer=setInterval(()=>{tries++;if(apply()||tries>40)clearInterval(timer)},100)}
})();