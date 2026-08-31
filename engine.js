export const FACTIONS=[
  {id:'outback',name:'Outback',icon:'🦘',colour:'#C65A2E'},
  {id:'reef',name:'Great Barrier Reef',icon:'🐠',colour:'#007C91'},
  {id:'bush',name:'Bushland',icon:'🌿',colour:'#3D6B45'}
];
export const RANKS=['K','Q','J'];
export const ROLE_IDS=[...FACTIONS.flatMap(f=>RANKS.map(rank=>`${f.id}-${rank}`)),'joker'];
export const SKILLS={
  hawkEye:{name:'Wedge-tail Vision',round:1,icon:'🦅',once:true,description:'Secretly learn one player identity. The table is told the skill was used.'},
  bloodRush:{name:'Blood Rush',round:1,icon:'🩸',description:'When you initiate and win a predation, gain 2 extra life and the loser pays 2 extra.'},
  geneticAdaptation:{name:'Genetic Adaptation',round:1,icon:'🧬',description:'When winning another skill at auction, pay 3 less life, minimum cost 1.'},
  amphibious:{name:'Amphibious',round:2,icon:'🐊',description:'Against the same rank in another faction, you win regardless of faction cycle.'},
  parasite:{name:'Parasite',round:2,icon:'🪱',description:'Choose one host. Whenever the host gains life in predation, gain the same amount.'},
  evasiveLeap:{name:'Evasive Leap',round:2,icon:'🦘',description:'Once per predation stage, redirect an attack on you to the next living seat.'},
  habitatCollapse:{name:'Habitat Collapse',round:2,icon:'🔥',once:true,description:'Choose one faction; all three players of that faction lose 5 life.'},
  threeHeadedDingo:{name:'Three-Headed Dingo',round:3,icon:'🐕',description:'May initiate predation against up to three different targets in the same predation stage.'},
  decoy:{name:'Decoy',round:3,icon:'🎭',description:'Once per predation stage, intercept an attack aimed at another player.'},
  dingoPackLeader:{name:'Dingo Pack Leader',round:3,icon:'🐺',description:'Choose two packmates. When the leader attacks, packmates also attack the same target without cards.'},
  echidnaSpines:{name:'Echidna Spines',round:3,icon:'🦔',description:'An attacker targeting you loses 1 life before the predation resolves.'},
  taipanVenom:{name:'Inland Taipan Venom',round:3,icon:'🐍',description:'When eliminated, the player who caused that elimination is eliminated as well; both lose all predation cards.'},
  bushSceptre:{name:'Bushland Sceptre',round:4,icon:'🪄',description:'At the start of each predation stage, choose the first seat instead of rolling.'},
  tailDrop:{name:'Tail Drop',round:4,icon:'🦎',description:'When losing as prey, discard any two predation cards instead of losing life. Predator still gains life.'},
  apexBloodline:{name:'Apex Bloodline',round:4,icon:'👑',description:'Initiating predation no longer consumes a predation card.'},
  torpor:{name:'Torpor',round:4,icon:'😴',description:'After initiating and winning life, enter torpor and cannot be targeted again this stage.'},
  scavenger:{name:'Scavenger',round:4,icon:'🦅',description:'Whenever any player is eliminated, gain 5 life.'}
};
export const ROUND_PREDATION_VALUES={1:[2],2:[3],3:[4,5],4:[6,7]};
const rankBeats={K:'Q',Q:'J',J:'K'};
const factionBeats={outback:'reef',reef:'bush',bush:'outback'};

export function roleFromId(id){
  if(id==='joker')return{id,faction:null,rank:'JOKER',label:'Platypus Joker',icon:'🦆'};
  const[faction,rank]=id.split('-');
  const info=FACTIONS.find(f=>f.id===faction);
  return{id,faction,rank,label:`${info.name} ${rank}`,icon:info.icon};
}
export function shuffledRoles(rng=Math.random){
  const list=[...ROLE_IDS];
  for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  return list;
}
function freshStageUses(){return{evasiveLeap:false,decoy:false,attackCount:0,attackTargets:[]};}
export function makePlayer(index,name,roleId){
  return{id:index+1,seat:index+1,name:name||`Player ${index+1}`,roleId,life:20,alive:true,skills:[],predationCards:Array.from({length:10},(_,i)=>i+1),hostId:null,packmates:[],torpor:false,stageUses:freshStageUses(),skillUses:{},protected:false,lastPredatorId:null,tradedLifeReceived:0,decoyTargets:[]};
}
export function newGame(names,rng=Math.random){
  if(!Array.isArray(names)||names.length!==10)throw new Error('Wild Australia requires exactly 10 players.');
  const roles=shuffledRoles(rng);
  return{round:1,phase:'free',predationStage:0,players:names.map((name,i)=>makePlayer(i,name,roles[i])),availableSkills:Object.entries(SKILLS).filter(([,s])=>s.round===1).map(([id])=>id),auctionedSkills:[],firstSeat:null,log:['Game created. Roles were assigned secretly.'],winnerIds:[]};
}
export function compareRoles(attacker,defender,attackerSkills=[],defenderSkills=[]){
  const a=roleFromId(attacker.roleId||attacker),d=roleFromId(defender.roleId||defender);
  if(a.id===d.id)return 0;
  if(a.id==='joker')return 1;
  if(d.id==='joker')return 1;
  if(a.rank===d.rank){
    if(attackerSkills.includes('amphibious')&&a.faction!==d.faction)return 1;
    if(defenderSkills.includes('amphibious')&&a.faction!==d.faction)return-1;
    return factionBeats[a.faction]===d.faction?1:-1;
  }
  return rankBeats[a.rank]===d.rank?1:-1;
}
export function nextLivingSeat(state,playerId){
  const start=state.players.findIndex(p=>p.id===playerId);
  for(let step=1;step<state.players.length;step++){const p=state.players[(start+step)%state.players.length];if(p.alive)return p.id;}
  return null;
}
export function predationValue(state){const values=ROUND_PREDATION_VALUES[state.round];return values[Math.min(state.predationStage,values.length-1)];}
export function resetPredationStage(state){state.players.forEach(p=>{p.torpor=false;p.stageUses=freshStageUses();});}
export function setPhase(state,phase,predationStage=0){
  if(!['free','predation','evolution','finished'].includes(phase))throw new Error('Invalid phase');
  state.phase=phase;
  if(phase==='predation'){state.predationStage=predationStage;resetPredationStage(state);}
  state.log.unshift(`Phase changed to ${phase}.`);return state;
}
export function startNextRound(state){
  if(state.round>=4){state.phase='finished';const alive=state.players.filter(p=>p.alive);const maxLife=alive.length?Math.max(...alive.map(p=>p.life)):0;state.winnerIds=alive.filter(p=>p.life===maxLife).map(p=>p.id);return state;}
  state.round+=1;state.players.forEach(p=>{p.protected=false;p.tradedLifeReceived=0;});state.phase='free';state.predationStage=0;state.availableSkills=Object.entries(SKILLS).filter(([,s])=>s.round===state.round).map(([id])=>id);state.log.unshift(`Round ${state.round} begins.`);return state;
}
export function useHawkEye(state,ownerId,targetId){
  const owner=getAlivePlayer(state,ownerId);if(!owner.skills.includes('hawkEye'))throw new Error('Player does not own Wedge-tail Vision.');if(owner.skillUses.hawkEye)throw new Error('Wedge-tail Vision has already been used.');const target=getAlivePlayer(state,targetId);owner.skillUses.hawkEye=true;state.log.unshift(`${owner.name} used Wedge-tail Vision.`);return roleFromId(target.roleId);
}
export function setParasiteHost(state,ownerId,hostId){
  const owner=getAlivePlayer(state,ownerId);if(!owner.skills.includes('parasite'))throw new Error('Player does not own Parasite.');if(state.phase!=='free')throw new Error('Parasite host can only be chosen during the free phase.');if(owner.hostId)throw new Error('Parasite host cannot be changed.');if(ownerId===hostId)throw new Error('Cannot choose yourself as host.');getAlivePlayer(state,hostId);owner.hostId=hostId;state.log.unshift(`${owner.name} locked in a Parasite host.`);
}
export function setPackmates(state,leaderId,packmateIds){
  const leader=getAlivePlayer(state,leaderId);if(!leader.skills.includes('dingoPackLeader'))throw new Error('Player is not the Dingo Pack Leader.');if(state.phase!=='free')throw new Error('Packmates are selected during the free phase.');if(leader.packmates.length)throw new Error('Packmates cannot be changed.');const unique=[...new Set(packmateIds.map(Number))];if(unique.length!==2||unique.includes(leaderId))throw new Error('Choose exactly two other players.');unique.forEach(id=>getAlivePlayer(state,id));leader.packmates=unique;state.log.unshift(`${leader.name} selected two packmates.`);
}
export function applyHabitatCollapse(state,ownerId,factionId){
  const owner=getAlivePlayer(state,ownerId);if(!owner.skills.includes('habitatCollapse'))throw new Error('Player does not own Habitat Collapse.');if(owner.skillUses.habitatCollapse)throw new Error('Habitat Collapse has already been used.');if(state.phase!=='free')throw new Error('Habitat Collapse can only be used in the free phase.');if(!FACTIONS.some(f=>f.id===factionId))throw new Error('Invalid faction.');owner.skillUses.habitatCollapse=true;const affected=state.players.filter(p=>p.alive&&roleFromId(p.roleId).faction===factionId);affected.forEach(p=>loseLife(state,p,5,owner.id,'Habitat Collapse'));state.log.unshift(`${owner.name} triggered Habitat Collapse against ${FACTIONS.find(f=>f.id===factionId).name}.`);return affected.map(p=>p.id);
}
export function transferLife(state,fromId,toId,amount){
  if(state.phase!=='free')throw new Error('Life can only be traded in the free phase.');if(!Number.isInteger(amount)||amount<=0)throw new Error('Amount must be a positive integer.');const from=getAlivePlayer(state,fromId),to=getAlivePlayer(state,toId);if(from.id===to.id)throw new Error('Choose two different players.');if(from.life<=amount)throw new Error('A player must keep at least 1 life when trading.');if(to.tradedLifeReceived+amount>10)throw new Error('A player may receive at most 10 traded life per round.');from.life-=amount;to.life+=amount;to.tradedLifeReceived+=amount;state.log.unshift(`${from.name} transferred ${amount} life to ${to.name}.`);
}
export function transferPredationCard(state,fromId,toId,card){
  if(state.phase!=='free')throw new Error('Predation cards can only be traded in the free phase.');const from=getAlivePlayer(state,fromId),to=getAlivePlayer(state,toId);if(from.id===to.id)throw new Error('Choose two different players.');const idx=from.predationCards.indexOf(Number(card));if(idx<0)throw new Error('Card is not available.');from.predationCards.splice(idx,1);to.predationCards.push(Number(card));to.predationCards.sort((a,b)=>a-b);state.log.unshift(`${from.name} transferred predation card ${card} to ${to.name}.`);
}
export function awardSkill(state,skillId,winnerId,bid){
  if(state.phase!=='evolution')throw new Error('Skills are auctioned during evolution.');if(!state.availableSkills.includes(skillId))throw new Error('Skill is not available this round.');const winner=getAlivePlayer(state,winnerId);if(!Number.isInteger(bid)||bid<=0)throw new Error('Bid must be a positive integer.');const cost=winner.skills.includes('geneticAdaptation')&&skillId!=='geneticAdaptation'?Math.max(1,bid-3):bid;if(winner.life<=cost)throw new Error('Bid would eliminate the winner.');winner.life-=cost;winner.skills.push(skillId);state.availableSkills=state.availableSkills.filter(id=>id!==skillId);state.auctionedSkills.push(skillId);state.log.unshift(`${winner.name} won ${SKILLS[skillId].name} for ${bid} (paid ${cost}).`);return cost;
}
function ensureEligibleTarget(player){if(player.torpor)throw new Error('Target is in torpor and cannot be targeted this stage.');if(player.protected)throw new Error('Target is in the Nature Reserve for this round.');}
export function resolvePredation(state,action){
  if(state.phase!=='predation')throw new Error('Predation can only occur in the predation phase.');
  const attacker=getAlivePlayer(state,action.attackerId);let defender=getAlivePlayer(state,action.defenderId);const originalDefender=defender;
  if(attacker.id===defender.id)throw new Error('Cannot prey on yourself.');ensureEligibleTarget(defender);
  for(const leader of state.players.filter(p=>p.alive&&p.skills.includes('dingoPackLeader'))){if(leader.id===attacker.id&&leader.packmates.includes(defender.id))throw new Error('Dingo Pack Leader cannot prey on a packmate.');}
  const maxAttacks=attacker.skills.includes('threeHeadedDingo')?3:1;if(attacker.stageUses.attackCount>=maxAttacks)throw new Error(`This player may only initiate ${maxAttacks} predation(s) this stage.`);if(attacker.stageUses.attackTargets.includes(originalDefender.id))throw new Error('Three-Headed Dingo must choose different predation targets in the same stage.');
  if(action.decoyId){const decoy=getAlivePlayer(state,action.decoyId);if(!decoy.skills.includes('decoy'))throw new Error('Selected player does not own Decoy.');if(decoy.stageUses.decoy)throw new Error('Decoy has already been used this stage.');if(decoy.id===attacker.id)throw new Error('Attacker cannot intercept their own attack.');if(decoy.id===originalDefender.id)throw new Error('Decoy must be another player.');if(decoy.decoyTargets.includes(originalDefender.id))throw new Error('Decoy cannot intercept the same original target twice.');ensureEligibleTarget(decoy);decoy.stageUses.decoy=true;decoy.decoyTargets.push(originalDefender.id);defender=decoy;}
  if(action.useEvasiveLeap){if(!defender.skills.includes('evasiveLeap'))throw new Error('Defender does not own Evasive Leap.');if(defender.stageUses.evasiveLeap)throw new Error('Evasive Leap has already been used this stage.');if(action.decoyId)throw new Error('A Decoy interception cannot be redirected by Evasive Leap.');const nextId=nextLivingSeat(state,defender.id);defender.stageUses.evasiveLeap=true;defender=getAlivePlayer(state,nextId);if(defender.id===attacker.id)throw new Error('Evasive Leap cannot redirect the attack back to the predator.');ensureEligibleTarget(defender);}
  if(!attacker.skills.includes('apexBloodline')){const cardIndex=attacker.predationCards.indexOf(originalDefender.seat);if(cardIndex<0)throw new Error(`Predation card ${originalDefender.seat} is not available.`);attacker.predationCards.splice(cardIndex,1);}
  attacker.stageUses.attackCount+=1;attacker.stageUses.attackTargets.push(originalDefender.id);defender.lastPredatorId=attacker.id;
  if(defender.skills.includes('echidnaSpines'))loseLife(state,attacker,1,defender.id,'Echidna Spines');
  if(!attacker.alive)return{winnerId:defender.id,loserId:attacker.id,amount:0,redirectedDefenderId:defender.id,originalDefenderId:originalDefender.id,attackerEliminatedBySpines:true};
  const cmp=compareRoles(attacker,defender,attacker.skills,defender.skills),attackerWins=cmp>=0,winner=attackerWins?attacker:defender,loser=attackerWins?defender:attacker;
  let amount=predationValue(state);if(attackerWins&&attacker.skills.includes('bloodRush'))amount+=2;
  const canTailDrop=attackerWins&&defender.id===loser.id&&defender.skills.includes('tailDrop')&&Array.isArray(action.tailDropCards)&&action.tailDropCards.length===2;
  if(canTailDrop){const cards=[...new Set(action.tailDropCards.map(Number))];if(cards.length!==2||!cards.every(c=>defender.predationCards.includes(c)))throw new Error('Tail Drop requires two cards the defender owns.');defender.predationCards=defender.predationCards.filter(c=>!cards.includes(c));}else loseLife(state,loser,amount,winner.id,'Predation');
  gainLife(state,winner,amount,'Predation');if(state.round<=2&&loser.alive)loser.protected=true;if(attackerWins&&attacker.skills.includes('torpor')&&attacker.alive)attacker.torpor=true;
  state.log.unshift(`${attacker.name} preyed on ${defender.name}: ${winner.name} won ${amount} life.`);
  return{winnerId:winner.id,loserId:loser.id,amount,attackerWins,redirectedDefenderId:defender.id,originalDefenderId:originalDefender.id,tailDropUsed:canTailDrop};
}
export function resolvePackFollowUps(state,leaderId,defenderId){
  const leader=getAlivePlayer(state,leaderId);if(!leader.skills.includes('dingoPackLeader')||leader.packmates.length!==2)return[];const defender=getAlivePlayer(state,defenderId),results=[];
  for(const pupId of leader.packmates){const pup=state.players.find(p=>p.id===pupId);if(!pup||!pup.alive||!defender.alive)continue;if(defender.torpor||defender.protected)break;defender.lastPredatorId=pup.id;const pupWins=compareRoles(pup,defender,pup.skills,defender.skills)>=0,amount=predationValue(state);if(defender.skills.includes('echidnaSpines'))loseLife(state,pup,1,defender.id,'Echidna Spines');if(!pup.alive){results.push({pupId,pupWins:false,amount:0,eliminatedBySpines:true});continue;}if(pupWins){loseLife(state,defender,amount,pup.id,'Pack attack');const leaderShare=Math.min(3,amount);gainLife(state,leader,leaderShare,'Pack share');gainLife(state,pup,amount-leaderShare,'Pack attack');if(state.round<=2&&defender.alive)defender.protected=true;}else{loseLife(state,pup,amount,defender.id,'Pack attack');gainLife(state,defender,amount,'Pack defence');if(state.round<=2&&pup.alive)pup.protected=true;}results.push({pupId,pupWins,amount});}
  return results;
}
function gainLife(state,player,amount,reason){if(!player.alive||amount<=0)return;player.life+=amount;state.players.filter(p=>p.alive&&p.skills.includes('parasite')&&p.hostId===player.id).forEach(parasite=>{parasite.life+=amount;state.log.unshift(`${parasite.name} gained ${amount} life from Parasite (${reason}).`);});}
function loseLife(state,player,amount,killerId=null,reason=''){if(!player.alive||amount<=0)return;player.life-=amount;if(player.life<=0)eliminatePlayer(state,player.id,killerId,reason);}
export function eliminatePlayer(state,playerId,killerId=null,reason=''){
  const player=state.players.find(p=>p.id===playerId);if(!player||!player.alive)return;const cards=[...player.predationCards],bonusPredatorId=player.lastPredatorId,venomKillerId=player.skills.includes('taipanVenom')?killerId:null;
  player.alive=false;player.life=0;player.predationCards=[];state.log.unshift(`${player.name} was eliminated${reason?` (${reason})`:''}.`);
  if(bonusPredatorId){const predator=state.players.find(p=>p.id===bonusPredatorId);if(predator&&predator.alive){gainLife(state,predator,3,'Elimination bonus');predator.predationCards.push(...cards);predator.predationCards.sort((a,b)=>a-b);state.log.unshift(`${predator.name} gained 3 life and ${cards.length} predation card(s) from the elimination.`);}}
  triggerScavengers(state);
  if(venomKillerId){const killer=state.players.find(p=>p.id===venomKillerId);if(killer&&killer.alive){killer.alive=false;killer.life=0;killer.predationCards=[];state.log.unshift(`${killer.name} was eliminated by Inland Taipan Venom.`);triggerScavengers(state);}}
}
function triggerScavengers(state){state.players.filter(p=>p.alive&&p.skills.includes('scavenger')).forEach(s=>{s.life+=5;state.log.unshift(`${s.name} gained 5 life from Scavenger.`);});}
export function livingPlayers(state){return state.players.filter(p=>p.alive);}
export function getAlivePlayer(state,id){const p=state.players.find(p=>p.id===Number(id));if(!p)throw new Error('Player not found.');if(!p.alive)throw new Error(`${p.name} has been eliminated.`);return p;}
export function publicPlayer(player){return{id:player.id,seat:player.seat,name:player.name,life:player.life,alive:player.alive,skills:[...player.skills],predationCardCount:player.predationCards.length,torpor:player.torpor};}
