import {
  FACTIONS, SKILLS, newGame, livingPlayers, resolvePredation, awardSkill,
  setParasiteHost, setPackmates, applyHabitatCollapse, eliminatePlayer,
  predationValue
} from './engine.js';

export const BOT_NAMES = ['Mia','Jack','Chloe','Noah','Ruby','Liam','Zoe','Ethan','Isla'];

const discussionTemplates = [
  '{speaker}: I am not showing my hand yet, but {target} looks dangerous.',
  '{speaker}: Anyone want a temporary truce before predation starts?',
  '{speaker}: I think {target} is bluffing about their matchup.',
  '{speaker}: I would rather trade than lose life this round.',
  '{speaker}: Watch the card counts. Someone is running out of options.',
  '{speaker}: If {target} comes after me, I will retaliate next stage.',
  '{speaker}: I am open to an alliance, but only for this round.',
  '{speaker}: The Nature Reserve changes everything in the early rounds.'
];

const pick = (list, rng=Math.random) => list[Math.floor(rng()*list.length)];

export function resetSoloStageFlags(state){
  state.players.forEach(p=>{p.passedStage=false;p.targetedStage=false;});
}

export function createSoloGame(humanName='You', rng=Math.random){
  const state=newGame([humanName || 'You', ...BOT_NAMES], rng);
  state.mode='solo';
  state.humanPlayerId=1;
  state.discussion=[];
  state.soloPreparedRound=0;
  resetSoloStageFlags(state);
  generateBotDiscussion(state,rng,5);
  return state;
}

export function generateBotDiscussion(state,rng=Math.random,count=4){
  state.discussion=state.discussion||[];
  const bots=livingPlayers(state).filter(p=>p.id!==state.humanPlayerId);
  if(!bots.length)return [];
  const added=[];
  for(let i=0;i<count;i++){
    const speaker=pick(bots,rng);
    const targets=livingPlayers(state).filter(p=>p.id!==speaker.id);
    const target=targets.length?pick(targets,rng):speaker;
    const template=pick(discussionTemplates,rng);
    const text=template.replace('{speaker}: ','').replaceAll('{speaker}',speaker.name).replaceAll('{target}',target.name);
    const msg={speaker:speaker.name,text,bot:true,at:Date.now()+i};
    state.discussion.push(msg);added.push(msg);
  }
  if(state.discussion.length>80)state.discussion=state.discussion.slice(-80);
  return added;
}

export function addHumanDiscussion(state,text,rng=Math.random){
  const clean=String(text||'').trim().slice(0,220);
  if(!clean)return [];
  const human=state.players.find(p=>p.id===state.humanPlayerId);
  state.discussion=state.discussion||[];
  state.discussion.push({speaker:human?.name||'You',text:clean,bot:false,at:Date.now()});
  return generateBotDiscussion(state,rng,1+Math.floor(rng()*2));
}

export function botPredationCandidates(state,botId){
  const bot=state.players.find(p=>p.id===botId);
  if(!bot||!bot.alive)return[];
  return livingPlayers(state).filter(target=>{
    if(target.id===bot.id||target.protected||target.torpor)return false;
    if(bot.skills.includes('dingoPackLeader')&&bot.packmates.includes(target.id))return false;
    if(bot.stageUses?.attackTargets?.includes(target.id))return false;
    return bot.skills.includes('apexBloodline')||bot.predationCards.includes(target.seat);
  });
}

export function runBotPredationTurn(state,botId,rng=Math.random){
  const bot=state.players.find(p=>p.id===botId);
  if(!bot||!bot.alive)return{passed:true,results:[]};
  const maxAttacks=bot.skills.includes('threeHeadedDingo')?3:1;
  const results=[];
  const shouldPass=(bot.life>6?rng()<0.18:rng()<0.06);
  if(shouldPass){bot.passedStage=true;state.log.unshift(`${bot.name} passed during the discussion and predation window.`);return{passed:true,results};}

  for(let attempt=bot.stageUses?.attackCount||0;attempt<maxAttacks;attempt++){
    const candidates=botPredationCandidates(state,bot.id);
    if(!candidates.length)break;
    const shuffled=[...candidates].sort(()=>rng()-.5);
    let resolved=false;
    for(const target of shuffled){
      try{
        const action={attackerId:bot.id,defenderId:target.id,useEvasiveLeap:false};
        if(target.skills.includes('tailDrop')&&target.predationCards.length>=2){action.tailDropCards=target.predationCards.slice(0,2);}
        const result=resolvePredation(state,action);
        const actual=state.players.find(p=>p.id===result.redirectedDefenderId);
        target.targetedStage=true;if(actual)actual.targetedStage=true;
        bot.passedStage=false;results.push(result);resolved=true;break;
      }catch{
        // Try a different legal-looking target. The engine remains authoritative.
      }
    }
    if(!resolved)break;
    if(!bot.alive)break;
  }
  if(!results.length){bot.passedStage=true;state.log.unshift(`${bot.name} could not find a legal predation target and passed.`);}
  return{passed:!results.length,results};
}

export function runAllBotPredationTurns(state,rng=Math.random){
  const outputs=[];
  for(const bot of state.players.filter(p=>p.id!==state.humanPlayerId))outputs.push({botId:bot.id,...runBotPredationTurn(state,bot.id,rng)});
  return outputs;
}

export function applySoloPassPenalties(state){
  const amount=predationValue(state);
  const penalised=[];
  for(const p of state.players.filter(p=>p.alive&&p.passedStage&&!p.targetedStage)){
    p.life-=amount;penalised.push(p.id);
    state.log.unshift(`${p.name} remained out of predation and was not targeted: -${amount} life.`);
    if(p.life<=0)eliminatePlayer(state,p.id,null,'Refused predation');
  }
  return penalised;
}

export function simulateAuction(state,skillId,humanMaxBid=0,rng=Math.random){
  if(!state.availableSkills.includes(skillId))throw new Error('Skill is no longer available.');
  const human=state.players.find(p=>p.id===state.humanPlayerId&&p.alive);
  const entries=[];
  for(const bot of livingPlayers(state).filter(p=>p.id!==state.humanPlayerId&&p.life>2)){
    const ceiling=Math.max(1,Math.min(bot.life-1,3+state.round*2));
    const bid=1+Math.floor(rng()*ceiling);
    entries.push({playerId:bot.id,bid});
  }
  const maxHuman=Math.max(0,Math.min(Number(humanMaxBid)||0,human?human.life-1:0));
  if(human&&maxHuman>0)entries.push({playerId:human.id,bid:maxHuman});
  if(!entries.length)throw new Error('No living player can afford this auction.');
  const top=Math.max(...entries.map(e=>e.bid));
  const topEntries=entries.filter(e=>e.bid===top);
  const winner=pick(topEntries,rng);
  const cost=awardSkill(state,skillId,winner.playerId,winner.bid);
  return{skillId,winnerId:winner.playerId,bid:winner.bid,cost,bids:entries};
}

export function autoAuctionRemaining(state,rng=Math.random){
  const results=[];
  for(const skillId of [...state.availableSkills])results.push(simulateAuction(state,skillId,0,rng));
  return results;
}

export function configureBotFreePhaseSkills(state,rng=Math.random){
  if(state.phase!=='free')return[];
  const actions=[];
  for(const bot of livingPlayers(state).filter(p=>p.id!==state.humanPlayerId)){
    if(bot.skills.includes('parasite')&&!bot.hostId){
      const targets=livingPlayers(state).filter(p=>p.id!==bot.id);
      if(targets.length){const host=pick(targets,rng);try{setParasiteHost(state,bot.id,host.id);actions.push(`Parasite:${bot.id}`);}catch{}}
    }
    if(bot.skills.includes('dingoPackLeader')&&!bot.packmates.length){
      const mates=livingPlayers(state).filter(p=>p.id!==bot.id).sort(()=>rng()-.5).slice(0,2);
      if(mates.length===2){try{setPackmates(state,bot.id,mates.map(p=>p.id));actions.push(`Pack:${bot.id}`);}catch{}}
    }
    if(bot.skills.includes('habitatCollapse')&&!bot.skillUses?.habitatCollapse&&rng()<0.45){
      const counts=FACTIONS.map(f=>({id:f.id,count:livingPlayers(state).filter(p=>p.roleId.startsWith(`${f.id}-`)).length})).sort((a,b)=>b.count-a.count);
      const faction=counts[0]?.id;
      if(faction){try{applyHabitatCollapse(state,bot.id,faction);actions.push(`Collapse:${bot.id}`);}catch{}}
    }
  }
  return actions;
}

export function publicSoloPlayers(state){
  return state.players.map(p=>({id:p.id,seat:p.seat,name:p.name,life:p.life,alive:p.alive,skills:[...p.skills],cards:p.predationCards.length,protected:p.protected,torpor:p.torpor,isHuman:p.id===state.humanPlayerId}));
}

export function skillSummary(skillId){return SKILLS[skillId]||null;}
