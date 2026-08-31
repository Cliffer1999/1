import {
  FACTIONS, SKILLS, ROUND_PREDATION_VALUES, roleFromId, livingPlayers, predationValue,
  setPhase, startNextRound, resolvePredation, transferLife, transferPredationCard,
  setParasiteHost, setPackmates, applyHabitatCollapse, useHawkEye
} from './engine.js';
import {
  createSoloGame, generateBotDiscussion, addHumanDiscussion, resetSoloStageFlags,
  runAllBotPredationTurns, applySoloPassPenalties, simulateAuction,
  autoAuctionRemaining, configureBotFreePhaseSkills, publicSoloPlayers
} from './solo-ai.js';

const SAVE_KEY='wild-australia-solo-v1';
const $=id=>document.getElementById(id);
const esc=(value='')=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const asInt=value=>Number.parseInt(value,10);
let state=null;

function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600);}
function save(){if(state)localStorage.setItem(SAVE_KEY,JSON.stringify(state));}
function normalise(){
  if(!state)return;
  state.mode='solo';state.humanPlayerId=state.humanPlayerId||1;state.discussion=state.discussion||[];state.log=state.log||[];state.soloPreparedRound=state.soloPreparedRound||0;
  state.players.forEach(p=>{p.passedStage=Boolean(p.passedStage);p.targetedStage=Boolean(p.targetedStage);p.stageUses=p.stageUses||{evasiveLeap:false,decoy:false,attackCount:0,attackTargets:[]};p.stageUses.attackTargets=p.stageUses.attackTargets||[];p.skillUses=p.skillUses||{};p.packmates=p.packmates||[];p.decoyTargets=p.decoyTargets||[];});
}
function load(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;state=JSON.parse(raw);normalise();return true;}catch{return false;}}
function human(){return state?.players.find(p=>p.id===state.humanPlayerId);}
function bots(){return state.players.filter(p=>p.id!==state.humanPlayerId);}
function phaseLabel(){if(state.phase==='free')return'Discussion / Free';if(state.phase==='predation')return`Predation ${state.predationStage+1}/${ROUND_PREDATION_VALUES[state.round].length}`;if(state.phase==='evolution')return'Evolution Auction';return'Final Standings';}
function playerOptionList(players){return players.map(p=>`<option value="${p.id}">#${p.seat} ${esc(p.name)}</option>`).join('');}
function showMessage(kicker,title,body){$('messageKicker').textContent=kicker;$('messageTitle').textContent=title;$('messageBody').innerHTML=body;$('messageDialog').showModal();}
function safe(fn,message){try{const out=fn();save();render();if(message)toast(message);return out;}catch(err){toast(err.message);return null;}}

function prepareFreeRound(){
  if(!state||state.phase!=='free'||state.soloPreparedRound===state.round)return;
  configureBotFreePhaseSkills(state);
  generateBotDiscussion(state,Math.random,4);
  state.soloPreparedRound=state.round;
  state.log.unshift(`Round ${state.round} discussion opened. AI players are negotiating.`);
}

function render(){
  if(!state){$('soloSetup').classList.remove('hidden');$('soloGame').classList.add('hidden');$('resetBtn').classList.add('hidden');return;}
  prepareFreeRound();
  $('soloSetup').classList.add('hidden');$('soloGame').classList.remove('hidden');$('resetBtn').classList.remove('hidden');
  $('roundText').textContent=`${state.round} / 4`;$('phaseText').textContent=phaseLabel();$('stakeText').textContent=state.phase==='predation'?`${predationValue(state)} life`:`${ROUND_PREDATION_VALUES[state.round].join(' / ')} life`;$('livingText').textContent=String(livingPlayers(state).length);$('roundBadge').textContent=`Round ${state.round}`;
  renderHuman();renderPlayers();renderDiscussion();renderControls();renderLog();save();
}

function renderHuman(){
  const p=human();if(!p)return;
  $('yourName').textContent=p.name;$('yourLife').textContent=String(p.life);$('yourCards').textContent=String(p.predationCards.length);$('yourSkillCount').textContent=String(p.skills.length);
  $('yourSkills').innerHTML=p.skills.length?p.skills.map(id=>`<span class="skill-badge">${SKILLS[id].icon} ${esc(SKILLS[id].name)}</span>`).join(''):'<span class="muted">No skills yet</span>';
}
function renderPlayers(){
  $('soloPlayerGrid').innerHTML=publicSoloPlayers(state).map(p=>`<article class="player-card ${p.alive?'':'eliminated'} ${p.isHuman?'human-card':''}"><div class="player-head"><div><p class="player-name">${p.isHuman?'⭐ ':''}${esc(p.name)}</p><span class="muted">${p.cards} cards</span></div><span class="seat">${p.seat}</span></div><div class="life">❤️ ${p.life}</div><div class="status-row">${!p.alive?'<span class="status-chip">ELIMINATED</span>':''}${p.protected&&p.alive?'<span class="status-chip reserve">NATURE RESERVE</span>':''}${p.torpor&&p.alive?'<span class="status-chip torpor">TORPOR</span>':''}</div><div class="skills-mini">${p.skills.map(id=>`<span class="skill-dot" title="${esc(SKILLS[id].name)}">${SKILLS[id].icon}</span>`).join('')||'<span class="muted">No skills</span>'}</div></article>`).join('');
}
function renderDiscussion(){
  const messages=(state.discussion||[]).slice(-35);
  $('discussionLog').innerHTML=messages.map(m=>`<div class="chat-line ${m.bot?'bot':'human'}"><strong>${esc(m.speaker)}</strong><span>${esc(m.text)}</span></div>`).join('')||'<p class="muted">The table is quiet.</p>';
  $('discussionLog').scrollTop=$('discussionLog').scrollHeight;
}
function renderLog(){$('soloEventLog').innerHTML=state.log.slice(0,60).map(x=>`<li>${esc(x)}</li>`).join('');}

function renderControls(){
  if(state.phase==='free'){ $('soloControlTitle').textContent='Discussion & Free Phase';$('soloControls').innerHTML=freeControls();bindFreeControls();return; }
  if(state.phase==='predation'){ $('soloControlTitle').textContent=`Predation Stage ${state.predationStage+1}`;$('soloControls').innerHTML=predationControls();bindPredationControls();return; }
  if(state.phase==='evolution'){ $('soloControlTitle').textContent='Evolution Auction';$('soloControls').innerHTML=evolutionControls();bindEvolutionControls();return; }
  $('soloControlTitle').textContent='Final Standings';$('soloControls').innerHTML=finishedControls();const b=$('newSoloBtn');if(b)b.addEventListener('click',resetGame);
}

function freeControls(){
  const p=human(),livingBots=bots().filter(b=>b.alive);if(!p.alive)return`<div class="tool-card full"><h3>You were eliminated</h3><p class="muted">The AI table will continue the simulation.</p><button id="beginPredationBtn" class="primary">Continue Round</button></div>`;
  const special=[];
  if(p.skills.includes('parasite')&&!p.hostId)special.push(`<div class="tool-card"><h3>🪱 Choose Parasite host</h3><select id="humanParasiteHost">${playerOptionList(livingPlayers(state).filter(x=>x.id!==p.id))}</select><button id="humanParasiteBtn" class="primary">Lock host</button></div>`);
  if(p.skills.includes('habitatCollapse')&&!p.skillUses?.habitatCollapse)special.push(`<div class="tool-card"><h3>🔥 Habitat Collapse</h3><select id="humanCollapseFaction">${FACTIONS.map(f=>`<option value="${f.id}">${f.icon} ${f.name}</option>`).join('')}</select><button id="humanCollapseBtn" class="primary">Trigger collapse</button></div>`);
  if(p.skills.includes('dingoPackLeader')&&!p.packmates.length&&livingBots.length>=2)special.push(`<div class="tool-card full"><h3>🐺 Choose two packmates</h3><div class="field-grid"><select id="humanPackOne">${playerOptionList(livingBots)}</select><select id="humanPackTwo">${playerOptionList(livingBots)}</select></div><button id="humanPackBtn" class="primary">Lock pack</button></div>`);
  if(p.skills.includes('hawkEye')&&!p.skillUses?.hawkEye)special.push(`<div class="tool-card"><h3>🦅 Wedge-tail Vision</h3><select id="humanHawkTarget">${playerOptionList(livingPlayers(state).filter(x=>x.id!==p.id))}</select><button id="humanHawkBtn" class="primary">Secretly inspect</button></div>`);
  return`<div class="control-grid"><div class="tool-card"><h3>🤝 Negotiate a life trade</h3><p class="muted">Offers are guaranteed; requests depend on whether the AI accepts.</p><div class="field-grid"><div class="field"><label>AI player</label><select id="tradeTarget">${playerOptionList(livingBots)}</select></div><div class="field"><label>Amount</label><input id="tradeAmount" type="number" min="1" max="3" value="1"></div></div><div class="button-row"><button id="offerLifeBtn" class="ghost">Offer life</button><button id="requestLifeBtn" class="ghost">Request life</button></div></div><div class="tool-card"><h3>🎴 Negotiate a card trade</h3><p class="muted">Offer one of your remaining numbered predation cards, or ask an AI player for one they hold.</p><div class="field-grid"><div class="field"><label>AI player</label><select id="cardTradeTarget">${playerOptionList(livingBots)}</select></div><div class="field"><label>Card #</label><input id="tradeCard" type="number" min="1" max="10" value="1"></div></div><div class="button-row"><button id="offerCardBtn" class="ghost">Offer card</button><button id="requestCardBtn" class="ghost">Request card</button></div></div>${special.join('')}<div class="tool-card full phase-cta"><h3>Ready to hunt?</h3><p class="muted">Finish discussion when you are ready. AI players will carry their own choices into the predation stage.</p><button id="beginPredationBtn" class="primary jumbo">Begin Predation · ${ROUND_PREDATION_VALUES[state.round][0]} life</button></div></div>`;
}

function bindFreeControls(){
  const on=(id,fn)=>{const el=$(id);if(el)el.addEventListener('click',fn);};
  on('offerLifeBtn',()=>safe(()=>{const target=asInt($('tradeTarget').value),amount=asInt($('tradeAmount').value);transferLife(state,human().id,target,amount);state.discussion.push({speaker:human().name,text:`I offered ${amount} life to ${state.players.find(p=>p.id===target).name}.`,bot:false});},'Life offer completed.'));
  on('requestLifeBtn',()=>safe(()=>{const target=asInt($('tradeTarget').value),amount=asInt($('tradeAmount').value),bot=state.players.find(p=>p.id===target);if(Math.random()<0.55&&bot.life>amount+1){transferLife(state,target,human().id,amount);state.discussion.push({speaker:bot.name,text:`Deal. I will send you ${amount} life.`,bot:true});}else state.discussion.push({speaker:bot.name,text:'No deal. I need my life for the next stage.',bot:true});},'Request answered.'));
  on('offerCardBtn',()=>safe(()=>{const target=asInt($('cardTradeTarget').value),card=asInt($('tradeCard').value);transferPredationCard(state,human().id,target,card);state.discussion.push({speaker:human().name,text:`I offered card ${card} to ${state.players.find(p=>p.id===target).name}.`,bot:false});},'Card offered.'));
  on('requestCardBtn',()=>safe(()=>{const target=asInt($('cardTradeTarget').value),card=asInt($('tradeCard').value),bot=state.players.find(p=>p.id===target);if(Math.random()<0.5&&bot.predationCards.includes(card)){transferPredationCard(state,target,human().id,card);state.discussion.push({speaker:bot.name,text:`Fine. You can have card ${card}.`,bot:true});}else state.discussion.push({speaker:bot.name,text:`I am keeping card ${card}.`,bot:true});},'Card request answered.'));
  on('humanParasiteBtn',()=>safe(()=>setParasiteHost(state,human().id,asInt($('humanParasiteHost').value)),'Parasite host locked.'));
  on('humanCollapseBtn',()=>safe(()=>applyHabitatCollapse(state,human().id,$('humanCollapseFaction').value),'Habitat Collapse resolved.'));
  on('humanPackBtn',()=>safe(()=>setPackmates(state,human().id,[asInt($('humanPackOne').value),asInt($('humanPackTwo').value)]),'Packmates locked.'));
  on('humanHawkBtn',()=>safe(()=>{const target=asInt($('humanHawkTarget').value),role=useHawkEye(state,human().id,target),targetName=state.players.find(p=>p.id===target).name;showMessage('SECRET INFORMATION',`${targetName}: ${role.label}`,`<div class="role-icon">${role.icon}</div><p>Only you learn this identity.</p>`);},null));
  on('beginPredationBtn',beginPredation);
}

function beginPredation(){safe(()=>{setPhase(state,'predation',0);resetSoloStageFlags(state);state.log.unshift('Predation begins after the discussion phase.');},'Predation started.');}

function humanTargets(){
  const p=human();if(!p||!p.alive)return[];
  return livingPlayers(state).filter(t=>t.id!==p.id&&!t.protected&&!t.torpor&&!(p.skills.includes('dingoPackLeader')&&p.packmates.includes(t.id))&&!p.stageUses.attackTargets.includes(t.id)&&(p.skills.includes('apexBloodline')||p.predationCards.includes(t.seat)));
}
function predationControls(){
  const p=human(),targets=humanTargets();
  if(!p.alive)return`<div class="tool-card full"><h3>AI predation stage</h3><p>You have been eliminated. Continue to simulate the remaining players.</p><button id="endSoloStageBtn" class="primary jumbo">Run AI Stage</button></div>`;
  const max=p.skills.includes('threeHeadedDingo')?3:1,used=p.stageUses.attackCount||0;
  return`<div class="control-grid"><div class="tool-card full"><h3>🎯 Choose your prey</h3><p class="muted">Attack ${used}/${max} used this stage. The numbered card matching the prey's seat is consumed unless Apex Bloodline is active.</p>${targets.length?`<div class="field"><label>Target</label><select id="soloPrey">${playerOptionList(targets)}</select></div><button id="soloAttackBtn" class="primary">Resolve my predation · ${predationValue(state)} life</button>`:'<p><strong>No legal targets remain.</strong></p>'}</div><div class="tool-card"><h3>⏭ Pass / stop attacking</h3><p class="muted">If you finish the stage without attacking and nobody targets you, you lose ${predationValue(state)} life.</p><button id="soloPassBtn" class="ghost">Mark me as passing</button></div><div class="tool-card"><h3>🤖 Run the AI table</h3><p class="muted">Nine AI players will make their predation choices, then the stage resolves.</p><button id="endSoloStageBtn" class="primary">End my turn & run AI</button></div></div>`;
}
function bindPredationControls(){const a=$('soloAttackBtn');if(a)a.addEventListener('click',attackHuman);const p=$('soloPassBtn');if(p)p.addEventListener('click',()=>safe(()=>{human().passedStage=true;state.log.unshift(`${human().name} chose to pass.`);},'Pass marked.'));$('endSoloStageBtn').addEventListener('click',finishPredationStage);}
function attackHuman(){safe(()=>{
  const targetId=asInt($('soloPrey').value),target=state.players.find(p=>p.id===targetId),action={attackerId:human().id,defenderId:targetId,useEvasiveLeap:false};
  if(target.skills.includes('tailDrop')&&target.predationCards.length>=2)action.tailDropCards=target.predationCards.slice(0,2);
  const result=resolvePredation(state,action);human().passedStage=false;target.targetedStage=true;const actual=state.players.find(p=>p.id===result.redirectedDefenderId);if(actual)actual.targetedStage=true;
  const winner=state.players.find(p=>p.id===result.winnerId),loser=state.players.find(p=>p.id===result.loserId);
  showMessage('YOUR PREDATION',`${winner.name} wins`,`<p><strong>${esc(winner.name)}</strong> takes the exchange against <strong>${esc(loser.name)}</strong> for ${result.amount} life.</p>${result.tailDropUsed?'<p>Tail Drop prevented the prey life loss.</p>':''}`);
},null);}

function finishPredationStage(){safe(()=>{
  const p=human();if(p?.alive&&(p.stageUses.attackCount||0)===0&&!p.passedStage)p.passedStage=true;
  runAllBotPredationTurns(state);applySoloPassPenalties(state);
  const values=ROUND_PREDATION_VALUES[state.round];
  if(state.predationStage+1<values.length){setPhase(state,'predation',state.predationStage+1);resetSoloStageFlags(state);generateBotDiscussion(state,Math.random,2);state.log.unshift(`Predation stage ${state.predationStage+1} begins.`);}else{setPhase(state,'evolution');state.log.unshift('Evolution auction begins.');}
},'AI stage resolved.');}

function evolutionControls(){
  if(!state.availableSkills.length)return`<div class="tool-card full phase-cta"><h3>Evolution complete</h3><p>All Round ${state.round} skills have been auctioned.</p><button id="nextRoundBtn" class="primary jumbo">${state.round===4?'Finish Game':'Start Next Round'}</button></div>`;
  return`<div class="skill-market solo-market">${state.availableSkills.map(id=>{const s=SKILLS[id];return`<div class="skill-card"><div class="icon">${s.icon}</div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><div class="field"><label>Your maximum bid (0 = sit out)</label><input id="solo-bid-${id}" type="number" min="0" value="0"></div><button class="primary solo-auction-btn" data-skill="${id}">Run auction</button></div>`;}).join('')}</div><div class="tool-card solo-auto-auction"><h3>🤖 Quick resolve</h3><p class="muted">Let the AI finish every remaining auction if you do not want to bid.</p><button id="autoAuctionBtn" class="ghost">Auto-auction remaining skills</button></div>`;
}
function bindEvolutionControls(){
  document.querySelectorAll('.solo-auction-btn').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.skill;safe(()=>{const result=simulateAuction(state,id,asInt($(`solo-bid-${id}`).value)||0),winner=state.players.find(p=>p.id===result.winnerId);showMessage('EVOLUTION AUCTION',`${winner.name} wins ${SKILLS[id].name}`,`<p>Winning bid: <strong>${result.bid} life</strong>.</p><p>${winner.id===state.humanPlayerId?'You gained this ability.':'An AI rival gained this ability.'}</p>`);},null);}));
  const auto=$('autoAuctionBtn');if(auto)auto.addEventListener('click',()=>safe(()=>autoAuctionRemaining(state),'Remaining auctions resolved.'));
  const next=$('nextRoundBtn');if(next)next.addEventListener('click',continueAfterEvolution);
}
function continueAfterEvolution(){safe(()=>{startNextRound(state);if(state.phase==='free'){state.soloPreparedRound=0;prepareFreeRound();}},state.round===4&&state.phase==='finished'?'Game finished.':'Next round started.');}

function finishedControls(){const winners=new Set(state.winnerIds||[]);return`<div class="standings-grid">${[...state.players].sort((a,b)=>b.life-a.life).map((p,i)=>`<div class="tool-card ${winners.has(p.id)?'winner-card':''}"><span class="label">#${i+1}</span><h3>${winners.has(p.id)?'🏆 ':''}${esc(p.name)}</h3><p><strong>${p.life} life</strong> · ${esc(roleFromId(p.roleId).label)}</p><p class="muted">${p.skills.map(id=>SKILLS[id].name).join(', ')||'No skills'}</p></div>`).join('')}</div><button id="newSoloBtn" class="primary jumbo" style="margin-top:14px">Play Another Solo Game</button>`;}

function revealRole(){const p=human(),r=roleFromId(p.roleId);$('soloRoleIcon').textContent=r.icon;$('soloRoleName').textContent=r.label;$('soloRoleRule').textContent=r.id==='joker'?'As predator you always win; as prey you always lose.':'K › Q › J › K. Same-rank battles use Outback › Reef › Bushland › Outback.';$('soloRoleDialog').showModal();}
function rules(){return`<div class="rules-grid"><section class="rules-block"><h3>Solo adaptation</h3><p>You control Seat 1. Nine AI opponents control the remaining seats while the original four-round structure stays intact.</p></section><section class="rules-block"><h3>Discussion</h3><p>During every Free Phase, AI players generate table talk. You can type your own bluff, negotiate life or card trades, and use free-phase abilities before predation.</p></section><section class="rules-block"><h3>Predation</h3><p>You choose your targets. When you end your turn, AI opponents resolve their own legal attacks and passes using the same engine rules.</p></section><section class="rules-block"><h3>Evolution</h3><p>Set a maximum life bid for any skill you want. AI players submit competing bids and the highest bidder receives the ability.</p></section></div><h3 style="margin:22px 0 10px">17-skill deck</h3><div class="skills-rules">${Object.values(SKILLS).map(s=>`<div class="skill-rule"><span class="icon">${s.icon}</span><div><strong>${esc(s.name)}</strong><br><span class="muted">Round ${s.round} · ${esc(s.description)}</span></div></div>`).join('')}</div>`;}
function resetGame(){if(state&&!confirm('Delete this solo run and start again?'))return;localStorage.removeItem(SAVE_KEY);state=null;location.reload();}

$('soloSetupForm').addEventListener('submit',e=>{e.preventDefault();state=createSoloGame($('soloName').value.trim()||'Player');normalise();save();render();});
$('discussionForm').addEventListener('submit',e=>{e.preventDefault();if(!state)return;const text=$('discussionInput').value;safe(()=>addHumanDiscussion(state,text),null);$('discussionInput').value='';});
$('botTalkBtn').addEventListener('click',()=>{if(state)safe(()=>generateBotDiscussion(state,Math.random,3),'The AI table keeps talking.');});
$('revealSoloRoleBtn').addEventListener('click',revealRole);$('rulesBtn').addEventListener('click',()=>{$('rulesContent').innerHTML=rules();$('rulesDialog').showModal();});$('resetBtn').addEventListener('click',resetGame);
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>$(btn.dataset.close).close()));document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
if(load())render();else render();
