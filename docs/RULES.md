# Rules & Australian adaptation notes

This implementation uses the supplied Chinese rules as its mechanical specification and adapts the presentation for an Australian audience.

## Core game retained

- 10 secret identities: three groups of K/Q/J plus one Joker-type special identity.
- 20 starting life.
- Predation cards numbered 1–10.
- Rank cycle: K > Q > J > K.
- Same-rank group cycle retained as a three-way cycle.
- Joker special identity: wins when initiating predation, loses when targeted.
- Four rounds with Free, Predation and Evolution phases.
- Predation life stakes: 2; 3; 4 then 5; 6 then 7.
- Rounds 1–2 Nature Reserve for a player who loses a predation; Rounds 3–4 remove it.
- Skill auctions use life as public bids.
- The supplied 17 skill effects are implemented.

## Localised identities

| Mechanical group | Australian edition |
|---|---|
| Group / suit 1 | 🦘 Outback |
| Group / suit 2 | 🐠 Great Barrier Reef |
| Group / suit 3 | 🌿 Bushland |
| Joker | 🦆 Platypus Joker |

Same-rank group cycle:

```text
Outback > Great Barrier Reef > Bushland > Outback
```

## Skill mapping

| Supplied skill | Australian edition |
|---|---|
| 鹰眼 | Wedge-tail Vision |
| 嗜血 | Blood Rush |
| 基因突变 | Genetic Adaptation |
| 两栖 | Amphibious |
| 寄生 | Parasite |
| 闪避 | Evasive Leap |
| 物种消亡 | Habitat Collapse |
| 三头犬 | Three-Headed Dingo |
| 替罪羊 | Decoy |
| 狼王号召 | Dingo Pack Leader |
| 尖刺 | Echidna Spines |
| 剧毒 | Inland Taipan Venom |
| 森林权杖 | Bushland Sceptre |
| 断尾 | Tail Drop |
| 无敌血统 | Apex Bloodline |
| 冬眠 | Torpor |
| 食腐 | Scavenger |

## Australian-edition rule clarifications

The supplied screenshots do not state an explicit final winner/tiebreak sentence. To make the digital game loop complete, this prototype uses the following clearly marked adaptation rule:

> After Round 4, surviving player(s) with the highest life total win. A tie is shared.

Skill availability is grouped into four round decks for the digital implementation while keeping every supplied skill effect. This grouping is part of the Australian-edition balancing/presentation pass rather than a claim about the original production rules.
