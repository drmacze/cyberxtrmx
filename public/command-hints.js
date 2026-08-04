(()=>{
'use strict';
const form=document.querySelector('#terminal-form');
const input=document.querySelector('#command-input');
if(!form||!input||document.querySelector('#terminal-command-hints'))return;

const commands=[
  {command:'help',category:'Core',description:'Show the main command index.'},
  {command:'help cloud',category:'Operations',description:'Show connected workspace commands.'},
  {command:'clear',category:'Shell',description:'Clear the terminal output.'},
  {command:'status',category:'Core',description:'Show the current workspace and operation state.'},
  {command:'boot --profile rednode',category:'Runtime',description:'Start the local runtime and operator context.'},
  {command:'pkg sync',category:'Runtime',description:'Refresh the local package registry.'},
  {command:'pkg list',category:'Runtime',description:'List available and installed modules.'},
  {command:'pkg install <module>',category:'Runtime',description:'Install a module from the local registry.'},
  {command:'source add <name> --region <code>',category:'Case flow',description:'Connect a source adapter for the current workflow.'},
  {command:'source list',category:'Case flow',description:'List connected source adapters.'},
  {command:'session new <name>',category:'Case flow',description:'Open a fresh local case session.'},
  {command:'session close',category:'Case flow',description:'Close the current local case session.'},
  {command:'target set <ml|ff|ip> <id> [region]',category:'Case flow',description:'Assign a subject to the current local case.'},
  {command:'surface enumerate',category:'Analysis',description:'Collect and normalize the public subject surface.'},
  {command:'fingerprint build',category:'Analysis',description:'Build a behavioral and identifier fingerprint.'},
  {command:'identity resolve',category:'Analysis',description:'Resolve the canonical identity graph.'},
  {command:'recon passive',category:'Analysis',description:'Run the low-noise reconnaissance chain.'},
  {command:'recon deep',category:'Analysis',description:'Extend the evidence window with deeper correlation.'},
  {command:'trace map',category:'Analysis',description:'Build the logical route graph.'},
  {command:'trace verify',category:'Analysis',description:'Verify route consistency and evidence binding.'},
  {command:'vault audit <password|email|id>',category:'Access review',description:'Review field eligibility against the current case evidence.'},
  {command:'gate assess',category:'Access review',description:'Assess the sensitive-operation gate.'},
  {command:'gate negotiate',category:'Access review',description:'Request a short-lived gate receipt.'},
  {command:'recovery inspect',category:'Access review',description:'Inspect eligible recovery routes.'},
  {command:'recovery verify',category:'Access review',description:'Verify the selected recovery route.'},
  {command:'mutation plan <password|email|id> <value>',category:'Case model',description:'Prepare a sensitive change inside the local case.'},
  {command:'mutation commit',category:'Case model',description:'Commit the active local change plan.'},
  {command:'op status',category:'Diagnostics',description:'Show operation flags, receipts, audits, and risk.'},
  {command:'op explain',category:'Diagnostics',description:'Explain the latest operation failure.'},
  {command:'op tree',category:'Diagnostics',description:'Show the full prerequisite chain.'},
  {command:'op reset',category:'Diagnostics',description:'Reset operation progress for the current subject.'},
  {command:'access init',category:'Access chain',description:'Attach the case context and open the access model.'},
  {command:'access fingerprint',category:'Access chain',description:'Build the access-chain identity fingerprint.'},
  {command:'access negotiate',category:'Access chain',description:'Negotiate the provisional access channel.'},
  {command:'access verify',category:'Access chain',description:'Verify the final authorization boundary.'},
  {command:'access status',category:'Access chain',description:'Show access-chain state, risk, and cooldown.'},
  {command:'access retry',category:'Access chain',description:'Check whether the retry window is open.'},
  {command:'access reset',category:'Access chain',description:'Clear the current access-chain state.'},
  {command:'cloud status',category:'Operations',description:'Show backend and account connection status.'},
  {command:'cloud refresh',category:'Operations',description:'Refresh cases, jobs, evidence, and check-ins.'},
  {command:'cloud open',category:'Operations',description:'Open the Operations workspace.'},
  {command:'auth create <email> <password>',category:'Account',description:'Create a connected workspace account.'},
  {command:'auth login <email> <password>',category:'Account',description:'Sign in to the connected workspace.'},
  {command:'auth logout',category:'Account',description:'Close the current connected session.'},
  {command:'case create <title>',category:'Operations',description:'Create a backend case.'},
  {command:'case list',category:'Operations',description:'List recent backend cases.'},
  {command:'case use <id>',category:'Operations',description:'Set the active backend case.'},
  {command:'scope add domain <domain>',category:'Scope',description:'Add a domain and generate its DNS ownership record.'},
  {command:'scope add ip <public-ip>',category:'Scope',description:'Add a public IPv4 entry for review.'},
  {command:'scope verify <id>',category:'Scope',description:'Check a domain ownership TXT record.'},
  {command:'scope list',category:'Scope',description:'List scope entries and verification states.'},
  {command:'lookup dns <domain>',category:'Collection',description:'Collect live public DNS records.'},
  {command:'lookup rdap <domain|ip>',category:'Collection',description:'Collect live registration data through RDAP.'},
  {command:'lookup ip <public-ip>',category:'Collection',description:'Collect public IP, network, ASN, and region metadata.'},
  {command:'checkin create <purpose>',category:'Check-in',description:'Create an expiring location request link.'},
  {command:'pwd',category:'Shell',description:'Print the current working path.'},
  {command:'ls',category:'Shell',description:'List files in the current path.'},
  {command:'cd <path>',category:'Shell',description:'Change the current working path.'},
  {command:'cat <file>',category:'Shell',description:'Read an available local file.'},
  {command:'tree',category:'Shell',description:'Show the local workspace tree.'},
  {command:'whoami',category:'Shell',description:'Show the active operator identity.'},
  {command:'uname',category:'Shell',description:'Show runtime information.'},
  {command:'ps',category:'Shell',description:'Show the local process table.'},
  {command:'history',category:'Shell',description:'Show commands entered in this session.'},
  {command:'reset',category:'Core',description:'Reset the local workspace after confirmation.'}
];

const quick=['cloud status','case list','op tree','status','help','clear'];
let matches=[];
let selected=0;
let visible=false;

const panel=document.createElement('section');
panel.id='terminal-command-hints';
panel.className='terminal-command-hints';
panel.hidden=true;
panel.setAttribute('aria-label','Command suggestions');
panel.innerHTML='<div class="terminal-hints-head"><span>COMMAND CLUES</span><small>↑↓ choose · Tab complete · Esc close</small></div><div class="terminal-hints-list" role="listbox"></div><div class="terminal-hints-foot">Start typing any command, subcommand, or keyword.</div>';
form.before(panel);

const style=document.createElement('style');
style.id='terminal-command-hints-style';
style.textContent=`
.terminal-command-hints{border-top:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(12,14,18,.98),rgba(8,10,13,.98));font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 -18px 38px rgba(0,0,0,.22)}
.terminal-hints-head,.terminal-hints-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;color:#646d77;font-size:8px;letter-spacing:.11em}
.terminal-hints-head span{color:#bdc3ca;font-weight:700}.terminal-hints-head small{font:inherit;color:#59616b}.terminal-hints-foot{border-top:1px solid rgba(255,255,255,.055);justify-content:flex-start}
.terminal-hints-list{max-height:252px;overflow:auto;padding:4px 7px 7px;overscroll-behavior:contain}
.terminal-hint{width:100%;display:grid;grid-template-columns:minmax(150px,1.1fr) minmax(170px,1fr) auto;gap:13px;align-items:center;padding:10px 9px;border:0;border-left:2px solid transparent;background:transparent;color:#c8cdd3;text-align:left;cursor:pointer}
.terminal-hint:hover,.terminal-hint.selected{background:rgba(255,255,255,.045);border-left-color:#df4259}
.terminal-hint code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e7e9ec;font:600 10px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.terminal-hint p{margin:0;color:#707984;font:9px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.terminal-hint em{color:#99505d;font:8px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-style:normal;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.terminal-hints-empty{padding:18px 14px;color:#68717b;font-size:10px}
@media(max-width:700px){.terminal-hints-head{align-items:flex-start}.terminal-hints-head small{max-width:145px;text-align:right;line-height:1.5}.terminal-hints-list{max-height:220px}.terminal-hint{grid-template-columns:1fr auto;gap:5px 10px;padding:11px 9px}.terminal-hint code{font-size:10px}.terminal-hint p{grid-column:1/-1;font-size:8px}.terminal-hint em{grid-column:2;grid-row:1}}
`;
document.head.append(style);

const list=panel.querySelector('.terminal-hints-list');
const footer=panel.querySelector('.terminal-hints-foot');

function tokens(value){return value.toLowerCase().trim().split(/\s+/).filter(Boolean)}
function rank(item,query){
  const command=item.command.toLowerCase();
  const description=item.description.toLowerCase();
  const category=item.category.toLowerCase();
  const queryTokens=tokens(query);
  if(!queryTokens.length)return quick.indexOf(item.command)>=0?quick.indexOf(item.command):1000;
  if(command.startsWith(query))return 0+command.length/1000;
  const commandTokens=tokens(command);
  if(queryTokens.every(token=>commandTokens.some(part=>part.startsWith(token))))return 10+command.length/1000;
  if(command.includes(query))return 20+command.length/1000;
  if(queryTokens.every(token=>command.includes(token)||description.includes(token)||category.includes(token)))return 30+command.length/1000;
  return Infinity;
}
function search(query){
  return commands.map(item=>({item,score:rank(item,query)})).filter(entry=>Number.isFinite(entry.score)).sort((a,b)=>a.score-b.score||a.item.command.localeCompare(b.item.command)).slice(0,9).map(entry=>entry.item);
}
function openPanel(){panel.hidden=false;visible=true}
function closePanel(){panel.hidden=true;visible=false;matches=[];selected=0}
function completion(command){
  const marker=command.search(/\s(?:<|\[)/);
  if(marker<0)return command;
  return `${command.slice(0,marker).trimEnd()} `;
}
function chooseMatch(index=selected){
  const item=matches[index];if(!item)return;
  input.value=completion(item.command);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.focus();
  input.setSelectionRange(input.value.length,input.value.length);
}
function updateSelection(next){
  if(!matches.length)return;
  selected=(next+matches.length)%matches.length;
  [...list.querySelectorAll('.terminal-hint')].forEach((button,index)=>button.classList.toggle('selected',index===selected));
  list.querySelector('.terminal-hint.selected')?.scrollIntoView({block:'nearest'});
}
function render(){
  if(input.disabled){closePanel();return}
  const query=input.value.toLowerCase().trim();
  matches=search(query);
  selected=Math.min(selected,Math.max(0,matches.length-1));
  if(!matches.length){
    list.innerHTML='<div class="terminal-hints-empty">No matching command. Try a shorter keyword.</div>';
    footer.textContent='No command matched the current text.';
    openPanel();return;
  }
  list.innerHTML='';
  matches.forEach((item,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className=`terminal-hint${index===selected?' selected':''}`;button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===selected));
    const code=document.createElement('code');code.textContent=item.command;
    const description=document.createElement('p');description.textContent=item.description;
    const category=document.createElement('em');category.textContent=item.category;
    button.append(code,description,category);
    button.addEventListener('pointerdown',event=>event.preventDefault());
    button.addEventListener('click',()=>chooseMatch(index));
    list.append(button);
  });
  footer.textContent=query?`${matches.length} matching command${matches.length===1?'':'s'} for “${query}”.`:'Quick commands. Start typing to narrow the list.';
  openPanel();
}

input.addEventListener('focus',render);
input.addEventListener('input',()=>{selected=0;render()});
input.addEventListener('keydown',event=>{
  if(!visible)return;
  if(event.key==='ArrowDown'){event.preventDefault();event.stopImmediatePropagation();updateSelection(selected+1)}
  else if(event.key==='ArrowUp'){event.preventDefault();event.stopImmediatePropagation();updateSelection(selected-1)}
  else if(event.key==='Tab'){event.preventDefault();event.stopImmediatePropagation();chooseMatch()}
  else if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closePanel()}
},true);
form.addEventListener('submit',()=>closePanel(),true);
document.addEventListener('pointerdown',event=>{if(!panel.contains(event.target)&&event.target!==input)closePanel()});
new MutationObserver(()=>{if(input.disabled)closePanel()}).observe(input,{attributes:true,attributeFilter:['disabled']});
window.CYBERTRMX_COMMAND_HINTS={commands,open:render,close:closePanel};
})();