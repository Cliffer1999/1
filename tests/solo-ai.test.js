import test from 'node:test';
import assert from 'node:assert/strict';
import { setPhase, awardSkill } from '../engine.js';
import {
  createSoloGame, botPredationCandidates, generateBotDiscussion,
  simulateAuction, resetSoloStageFlags, runBotPredationTurn
} from '../solo-ai.js';

const fixed = value => () => value;

test('solo game creates one human and nine AI players',()=>{
  const state=createSoloGame('Tester',fixed(.37));
  assert.equal(state.mode,'solo');
  assert.equal(state.humanPlayerId,1);
  assert.equal(state.players.length,10);
  assert.equal(state.players[0].name,'Tester');
  assert.equal(state.players.slice(1).length,9);
  assert.equal(state.players.every(p=>p.life===20),true);
});

test('AI discussion never reveals hidden role labels',()=>{
  const state=createSoloGame('Tester',fixed(.41));
  state.discussion=[];
  generateBotDiscussion(state,fixed(.22),8);
  assert.equal(state.discussion.length,8);
  for(const message of state.discussion){
    assert.equal(/Outback [KQJ]|Great Barrier Reef [KQJ]|Bushland [KQJ]|Platypus Joker/.test(message.text),false);
  }
});

test('bot target candidates respect cards and Nature Reserve',()=>{
  const state=createSoloGame('Tester',fixed(.33));
  setPhase(state,'predation',0);resetSoloStageFlags(state);
  const bot=state.players[1];
  const target=state.players[2];
  target.protected=true;
  const candidates=botPredationCandidates(state,bot.id);
  assert.equal(candidates.some(p=>p.id===target.id),false);
  const legal=candidates[0];
  assert.ok(legal);
  assert.equal(bot.predationCards.includes(legal.seat),true);
});

test('bot can resolve a legal predation turn through the core engine',()=>{
  const state=createSoloGame('Tester',fixed(.51));
  setPhase(state,'predation',0);resetSoloStageFlags(state);
  const bot=state.players[1];
  const output=runBotPredationTurn(state,bot.id,fixed(.9));
  assert.equal(Array.isArray(output.results),true);
  assert.equal(output.results.length<=3,true);
  assert.equal(bot.stageUses.attackCount>=0,true);
});

test('solo auction lets human compete against AI bids',()=>{
  const state=createSoloGame('Tester',fixed(.26));
  setPhase(state,'evolution');
  const skillId=state.availableSkills[0];
  const result=simulateAuction(state,skillId,12,fixed(.1));
  assert.equal(result.winnerId,1);
  assert.equal(state.players[0].skills.includes(skillId),true);
  assert.equal(state.availableSkills.includes(skillId),false);
});

test('core awardSkill remains compatible with solo state',()=>{
  const state=createSoloGame('Tester',fixed(.29));
  setPhase(state,'evolution');
  const skillId=state.availableSkills[0];
  awardSkill(state,skillId,2,1);
  assert.equal(state.players[1].skills.includes(skillId),true);
});
