import {
  FACTIONS, SKILLS, ROUND_PREDATION_VALUES, newGame, roleFromId,
  setPhase, startNextRound, predationValue, livingPlayers, resolvePredation,
  resolvePackFollowUps, awardSkill, transferLife, transferPredationCard,
  setParasiteHost, setPackmates, applyHabitatCollapse, useHawkEye
} from './engine.js';

const STORAGE_KEY='wild-australia-game-v1';
let state=null,roleTargetId=null,hawkPending=null,hiddenLog=false;
const $=id=>document.getElementById(id);
const setupView=$('setupView'),gameView=$('gameView');

function initialise(){
  renderNameInputs();bindStaticEvents();
  const saved=localStorage.getItem(STORAGE_KEY);
  if(saved){try{state=JSON.parse(saved);showGame();render();}catch{localStorage.removeItem(STORAGE_KEY);}}
  renderRules();
}
function renderNameInputs(){
  $('nameGrid').innerHTML=Array.from({length:10},(_,i)=>`<label class="name-field"><span>SEAT ${i+1}</span><input name="player${i+1}" value="Player ${i+1}" maxlength="24" required /></label>`).join('');
}
function bindStaticEvents(){
  $('setupForm').addEventListener('submit',e=>{e.preventDefault();const names=Array.from(new FormData(e.currentTarget).values()).map(v=>String(v).trim());if(new Set(names.map(n=>n.toLowerCase())).size!==10)return toast('Please use 10 different player names.');state=newGame(names);persist();showGame();render();});
  $('rulesBtn').addEventListener('click',()=>openDialog('rulesDialog'));
  $('advanceBtn').addEventListener('click',advancePhase);
  $('saveBtn').addEventListener('click',exportSave);
  $('resetBtn').addEventListener('click',resetGame);
  $('clearLogBtn').addEventListener('click',()=>{hiddenLog=!hiddenLog;renderLog();});
  $('revealRoleBtn').addEventListener('click',revealCurrentRole);
  $('hawkRevealBtn').addEventListener('click',revealHawkRole);
  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>$(btn.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
}
function showGame(){setupView.classList.add('hidden');gameView.classList.remove('hidden');$('saveBtn').classList.remove('hidden');$('resetBtn').classList.remove('hidden');}
function persist(){if(state)localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function render(){
  if(!state)return;
  $('roundText').textContent=`${state.round} / 4`;$('phaseText').textContent=phaseLabel();$('stakeText').textContent=state.phase==='predation'?`${predationValue(state)} life`:nextStakeLabel();$('livingText').textContent=livingPlayers(state).length;$('roundBadge').textContent=`Round ${state.round}`;$('controlTitle').textContent=`${phaseLabel()} Phase`;$('advanceBtn').textContent=advanceButtonLabel();
  renderPlayers();renderPhaseControls();renderLog();persist();
}
function phaseLabel(){if(state.phase==='predation'&&ROUND_PREDATION_VALUES[state.round].length>1)return`Predation ${state.predationStage+1}`;return state.phase.charAt(0).toUpperCase()+state.phase.slice(1);}
function nextStakeLabel(){return ROUND_PREDATION_VALUES[state.round].join(' / ')+' life';}
function renderPlayers(){
  $('playerGrid').innerHTML=state.players.map(p=>{
    const skillIcons=p.skills.map(id=>`<span class="skill-dot" title="${escapeHtml(SKILLS[id].name)} — ${escapeHtml(SKILLS[id].description)}">${SKILLS[id].icon}</span>`).join('');
    return`<article class="player-card ${p.alive?'':'eliminated'}"><div class="player-head"><div><p class="player-name">${escapeHtml(p.name)}</p><span class="muted">${p.predationCards.length} predation cards</span></div><span class="seat">${p.seat}</span></div><div class="life">❤️ ${p.life}</div><div class="status-row">${!p.alive?'<span class="status-chip">ELIMINATED</span>':''}${p.protected&&p.alive?'<span class="status-chip reserve">NATURE RESERVE</span>':''}${p.torpor&&p.alive?'<span class="status-chip torpor">TORPOR</span>':''}</div><div class="skills-mini">${skillIcons||'<span class="muted">No skills yet</span>'}</div><div class="player-actions"><button data-role="${p.id}" ${p.alive?'':'disabled'}>Secret role</button></div></article>`;
  }).join('');
  document.querySelectorAll('[data-role]').forEach(btn=>btn.addEventListener('click',()=>openRole(Number(btn.dataset.role))));
}
function aliveOptions(excludeIds=[]){return state.players.filter(p=>p.alive&&!excludeIds.includes(p.id)).map(p=>`<option value="${p.id}">${p.seat}. ${escapeHtml(p.name)}</option>`).join('');}
function allSkillOwnerOptions(skillId){return state.players.filter(p=>p.alive&&p.skills.includes(skillId)).map(p=>`<option value="${p.id}">${p.seat}. ${escapeHtml(p.name)}</option>`).join('');}
function renderPhaseControls(){const host=$('phaseControls');if(state.phase==='free')host.innerHTML=freeControls();else if(state.phase==='predation')host.innerHTML=predationControls();else if(state.phase==='evolution')host.innerHTML=evolutionControls();else host.innerHTML=finishedControls();bindDynamicControls();}
function commonSkillCard(){const owners=allSkillOwnerOptions('hawkEye');if(!owners)return'';return`<div class="tool-card full"><h3>🦅 Wedge-tail Vision</h3><p class="muted">Use once at any phase to secretly inspect one identity.</p><div class="field-grid"><div class="field"><label>Skill owner</label><select id="hawkOwner">${owners}</select></div><div class="field"><label>Target</label><select id="hawkTarget">${aliveOptions()}</select></div></div><button id="hawkUseBtn" class="primary">Use Wedge-tail Vision</button></div>`;}
function freeControls(){
  const parasiteOwners=state.players.filter(p=>p.alive&&p.skills.includes('parasite')&&!p.hostId),collapseOwners=state.players.filter(p=>p.alive&&p.skills.includes('habitatCollapse')&&!p.skillUses.habitatCollapse),leaders=state.players.filter(p=>p.alive&&p.skills.includes('dingoPackLeader')&&!p.packmates.length);
  return`<div class="control-grid">
    <div class="tool-card"><h3>❤️ Trade life</h3><p class="muted">A player may receive at most 10 traded life per round.</p><div class="field-grid three"><div class="field"><label>From</label><select id="lifeFrom">${aliveOptions()}</select></div><div class="field"><label>To</label><select id="lifeTo">${aliveOptions()}</select></div><div class="field"><label>Amount</label><input id="lifeAmount" type="number" min="1" value="1"></div></div><button id="lifeTradeBtn" class="primary">Transfer life</button></div>
    <div class="tool-card"><h3>🎴 Trade predation card</h3><p class="muted">Trading is allowed only in the Free Phase.</p><div class="field-grid three"><div class="field"><label>From</label><select id="cardFrom">${aliveOptions()}</select></div><div class="field"><label>To</label><select id="cardTo">${aliveOptions()}</select></div><div class="field"><label>Card number</label><input id="cardNumber" type="number" min="1" max="10" value="1"></div></div><button id="cardTradeBtn" class="primary">Transfer card</button></div>
    ${parasiteOwners.length?`<div class="tool-card"><h3>🪱 Parasite</h3><p class="muted">Choose a permanent host.</p><div class="field-grid"><div class="field"><label>Owner</label><select id="parasiteOwner">${parasiteOwners.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></div><div class="field"><label>Host</label><select id="parasiteHost">${aliveOptions()}</select></div></div><button id="parasiteBtn" class="primary">Lock host</button></div>`:''}
    ${collapseOwners.length?`<div class="tool-card"><h3>🔥 Habitat Collapse</h3><p class="muted">Once per game: all living members of one faction lose 5 life.</p><div class="field-grid"><div class="field"><label>Owner</label><select id="collapseOwner">${collapseOwners.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></div><div class="field"><label>Faction</label><select id="collapseFaction">${FACTIONS.map(f=>`<option value="${f.id}">${f.icon} ${f.name}</option>`).join('')}</select></div></div><button id="collapseBtn" class="primary">Trigger collapse</button></div>`:''}
    ${leaders.length?`<div class="tool-card"><h3>🐺 Dingo Pack Leader</h3><p class="muted">Choose two permanent packmates.</p><div class="field-grid three"><div class="field"><label>Leader</label><select id="packLeader">${leaders.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></div><div class="field"><label>Packmate 1</label><select id="packOne">${aliveOptions()}</select></div><div class="field"><label>Packmate 2</label><select id="packTwo">${aliveOptions()}</select></div></div><button id="packBtn" class="primary">Lock pack</button></div>`:''}
    ${commonSkillCard()}
  </div>`;
}
function predationControls(){
  const decoys=allSkillOwnerOptions('decoy'),sceptres=state.players.filter(p=>p.alive&&p.skills.includes('bushSceptre')),order=turnOrder();
  return`<div class="control-grid"><div class="tool-card full"><h3>🎯 Predation</h3><p class="muted">The engine resolves identities automatically. Optional reactive skills can be declared before resolving.</p><div class="field-grid"><div class="field"><label>Predator</label><select id="predator">${aliveOptions()}</select></div><div class="field"><label>Target</label><select id="prey">${aliveOptions()}</select></div></div><div class="field-grid"><div class="field"><label>Decoy interceptor (optional)</label><select id="decoy"><option value="">None</option>${decoys}</select></div><div class="field"><label>Tail Drop cards (optional, e.g. 2,7)</label><input id="tailDropCards" placeholder="2,7"></div></div><label class="check-row"><input id="evasive" type="checkbox"> Target uses Evasive Leap</label><button id="predationBtn" class="primary">Resolve Predation · ${predationValue(state)} life</button></div>
    <div class="tool-card"><h3>🧭 First seat</h3><p class="muted">${sceptres.length?'Bushland Sceptre may choose the starting seat.':'No Sceptre in play: roll a random starting seat.'}</p><div class="field-grid"><div class="field"><label>Starting player</label><select id="firstSeat">${aliveOptions()}</select></div><div class="field"><label>Method</label><button id="rollSeatBtn" class="ghost" type="button">${sceptres.length?'Set selected seat':'Roll random seat'}</button></div></div><div class="order-strip">${order.map(id=>{const p=state.players.find(x=>x.id===id);return`<span>${p.seat}. ${escapeHtml(p.name)}</span>`;}).join('')}</div></div>
    <div class="tool-card"><h3>🌱 Nature Reserve</h3><p class="muted">Rounds 1–2: a player who loses a predation cannot be targeted again that round. Rounds 3–4: the reserve is removed.</p></div>${commonSkillCard()}</div>`;
}
function evolutionControls(){
  if(!state.availableSkills.length)return`<div class="tool-card"><h3>All skills auctioned</h3><p class="muted">Advance to continue.</p></div>${commonSkillCard()}`;
  return`<div class="skill-market">${state.availableSkills.map(id=>{const s=SKILLS[id];return`<div class="skill-card"><div class="icon">${s.icon}</div><h3>${s.name}</h3><p>${s.description}</p><div class="field"><label>Winner</label><select id="winner-${id}">${aliveOptions()}</select></div><div class="field"><label>Winning bid (life)</label><input id="bid-${id}" type="number" min="1" value="1"></div><button class="primary auction-btn" data-skill="${id}">Award skill</button></div>`;}).join('')}</div>${commonSkillCard()}`;
}
function finishedControls(){const winners=state.winnerIds.map(id=>state.players.find(p=>p.id===id)).filter(Boolean);return`<div class="tool-card full"><h3>🏆 Game finished</h3><p>${winners.length?winners.map(w=>`<strong>${escapeHtml(w.name)}</strong> (${w.life} life)`).join(' & '):'<strong>No surviving player</strong>'} ${winners.length>1?'share':'takes'} the win.</p><p class="muted">Australian edition tiebreak: tied surviving leaders share the win.</p></div>`;}
function bindDynamicControls(){
  const on=(id,event,fn)=>{const el=$(id);if(el)el.addEventListener(event,fn);};
  on('lifeTradeBtn','click',()=>safe(()=>transferLife(state,num('lifeFrom'),num('lifeTo'),num('lifeAmount')),'Life transferred.'));
  on('cardTradeBtn','click',()=>safe(()=>transferPredationCard(state,num('cardFrom'),num('cardTo'),num('cardNumber')),'Predation card transferred.'));
  on('parasiteBtn','click',()=>safe(()=>setParasiteHost(state,num('parasiteOwner'),num('parasiteHost')),'Parasite host locked.'));
  on('collapseBtn','click',()=>safe(()=>applyHabitatCollapse(state,num('collapseOwner'),$('collapseFaction').value),'Habitat Collapse resolved.'));
  on('packBtn','click',()=>safe(()=>setPackmates(state,num('packLeader'),[num('packOne'),num('packTwo')]),'Packmates locked.'));
  on('hawkUseBtn','click',useHawkFromControls);on('predationBtn','click',doPredation);on('rollSeatBtn','click',setFirstSeat);
  document.querySelectorAll('.auction-btn').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.skill;safe(()=>awardSkill(state,id,Number($(`winner-${id}`).value),Number($(`bid-${id}`).value)),`${SKILLS[id].name} awarded.`);}));
}
function doPredation(){
  try{
    const attackerId=num('predator'),action={attackerId,defenderId:num('prey'),decoyId:$('decoy').value?num('decoy'):null,useEvasiveLeap:$('evasive').checked};
    const tail=$('tailDropCards').value.trim();if(tail)action.tailDropCards=tail.split(',').map(x=>Number(x.trim())).filter(Number.isFinite);
    const result=resolvePredation(state,action);let pack=[];const attacker=state.players.find(p=>p.id===attackerId);
    if(attacker?.alive&&attacker.skills.includes('dingoPackLeader')&&attacker.packmates.length===2){const target=state.players.find(p=>p.id===result.redirectedDefenderId);if(target?.alive)pack=resolvePackFollowUps(state,attackerId,target.id);}
    persist();render();const winner=state.players.find(p=>p.id===result.winnerId),loser=state.players.find(p=>p.id===result.loserId);
    showMessage('PREDATION RESULT',`${winner?.name||'Defender'} wins`,`<div class="result-card"><strong>${escapeHtml(winner?.name||'Winner')}</strong> wins ${result.amount} life against <strong>${escapeHtml(loser?.name||'Loser')}</strong>.</div>${result.tailDropUsed?'<p>🦎 Tail Drop prevented the prey life loss.</p>':''}${pack.length?`<p>🐺 Pack follow-ups resolved: ${pack.length}.</p>`:''}`);
  }catch(e){toast(e.message);}
}
function setFirstSeat(){
  const sceptreInPlay=state.players.some(p=>p.alive&&p.skills.includes('bushSceptre'));
  if(sceptreInPlay)state.firstSeat=num('firstSeat');else{const alive=livingPlayers(state);if(!alive.length)return;state.firstSeat=alive[Math.floor(Math.random()*alive.length)].id;$('firstSeat').value=state.firstSeat;}
  state.log.unshift(`Predation starts from seat ${state.players.find(p=>p.id===state.firstSeat).seat}.`);render();
}
function turnOrder(){const alive=livingPlayers(state);if(!alive.length)return[];const startId=state.firstSeat&&alive.some(p=>p.id===state.firstSeat)?state.firstSeat:alive[0].id,idx=state.players.findIndex(p=>p.id===startId),order=[];for(let n=0;n<state.players.length;n++){const p=state.players[(idx+n)%state.players.length];if(p.alive)order.push(p.id);}return order;}
function advancePhase(){try{if(state.phase==='free')setPhase(state,'predation',0);else if(state.phase==='predation'){const stages=ROUND_PREDATION_VALUES[state.round].length;if(state.predationStage+1<stages)setPhase(state,'predation',state.predationStage+1);else setPhase(state,'evolution');}else if(state.phase==='evolution')startNextRound(state);render();}catch(e){toast(e.message);}}
function advanceButtonLabel(){if(state.phase==='free')return'Start Predation';if(state.phase==='predation'&&state.predationStage+1<ROUND_PREDATION_VALUES[state.round].length)return'Next Predation Stage';if(state.phase==='predation')return'Start Evolution';if(state.phase==='evolution')return state.round===4?'Finish Game':'Next Round';return'Game Finished';}
function openRole(id){roleTargetId=id;const p=state.players.find(p=>p.id===id);$('roleOwner').textContent=p.name;$('roleRevealGate').classList.remove('hidden');$('roleReveal').classList.add('hidden');openDialog('roleDialog');}
function revealCurrentRole(){const p=state.players.find(p=>p.id===roleTargetId),r=roleFromId(p.roleId);$('roleIcon').textContent=r.icon;$('roleName').textContent=r.label;$('roleRule').textContent=r.id==='joker'?'As predator: always wins. As prey: always loses.':'Rank cycle: K › Q › J › K. Same rank uses the faction cycle.';$('roleRevealGate').classList.add('hidden');$('roleReveal').classList.remove('hidden');}
function useHawkFromControls(){try{const ownerId=num('hawkOwner'),targetId=num('hawkTarget');if(ownerId===targetId)throw new Error('Choose another player as the target.');hawkPending={ownerId,targetId,role:useHawkEye(state,ownerId,targetId)};const target=state.players.find(p=>p.id===targetId);$('hawkTargetName').textContent=target.name;$('hawkRevealGate').classList.remove('hidden');$('hawkReveal').classList.add('hidden');persist();render();openDialog('hawkDialog');}catch(e){toast(e.message);}}
function revealHawkRole(){if(!hawkPending)return;$('hawkRoleIcon').textContent=hawkPending.role.icon;$('hawkRoleName').textContent=hawkPending.role.label;$('hawkRevealGate').classList.add('hidden');$('hawkReveal').classList.remove('hidden');}
function renderLog(){if(!state)return;$('clearLogBtn').textContent=hiddenLog?'Show':'Hide';$('eventLog').innerHTML=hiddenLog?'<li>Log hidden.</li>':state.log.slice(0,60).map(x=>`<li>${escapeHtml(x)}</li>`).join('');}
function renderRules(){
  $('rulesContent').innerHTML=`<div class="rules-grid"><section class="rules-block"><h3>Core setup</h3><ul><li>Exactly 10 players. Identities are secret.</li><li>Three Australian factions — Outback, Great Barrier Reef and Bushland — each have K, Q and J, plus one Platypus Joker.</li><li>Everyone starts with 20 life and predation cards numbered 1–10.</li><li>At 0 life a player is eliminated.</li></ul></section><section class="rules-block"><h3>Predation</h3><p><strong>K › Q › J › K.</strong> Same rank follows <strong>Outback › Reef › Bushland › Outback</strong>. The Platypus Joker always wins as predator and loses as prey.</p><p>Initiating an attack normally spends the card matching the target's seat number.</p></section><section class="rules-block"><h3>Four rounds</h3><p>Each round: <strong>Free → Predation → Evolution</strong>.</p><p>Predation stakes: Round 1 = 2; Round 2 = 3; Round 3 = 4 then 5; Round 4 = 6 then 7 life.</p><p>Rounds 1–2 use a Nature Reserve: a predation loser cannot be targeted again that round. It is removed in Rounds 3–4.</p></section><section class="rules-block"><h3>Free & Evolution</h3><p>Free Phase allows information sharing, life trades and predation-card trades. A player may receive at most 10 traded life per round.</p><p>Evolution auctions that round's skills using public life bids. Highest bid wins; skills cannot be traded.</p></section></div><h3 style="margin:22px 0 10px">Australian skill deck</h3><div class="skills-rules">${Object.values(SKILLS).map(s=>`<div class="skill-rule"><span class="icon">${s.icon}</span><div><strong>${s.name}</strong><br><span class="muted">Round ${s.round} · ${s.description}</span></div></div>`).join('')}</div><p class="small-note">Australian-edition adaptation: the original mechanics were retained while the theme, naming and interface were localised for an Australian audience. End-of-game winner: surviving player(s) with the most life after Round 4.</p>`;
}
function safe(fn,success){try{fn();persist();render();toast(success);}catch(e){toast(e.message);}}
function num(id){return Number($(id).value);}
function openDialog(id){const d=$(id);if(!d.open)d.showModal();}
function showMessage(kicker,title,body){$('messageKicker').textContent=kicker;$('messageTitle').textContent=title;$('messageBody').innerHTML=body;openDialog('messageDialog');}
function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600);}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function exportSave(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`wild-australia-round-${state.round}.json`;a.click();URL.revokeObjectURL(url);}
function resetGame(){if(!confirm('Start a new game? The current browser save will be erased.'))return;localStorage.removeItem(STORAGE_KEY);state=null;location.reload();}
initialise();
