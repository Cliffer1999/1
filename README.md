# 🇦🇺 Wild Australia: Evolution Clash

A browser-based, 10-player pass-and-play social strategy game adapted for an Australian audience.

The project takes the supplied **Forest Evolution / Forest Battle** ruleset as its mechanical base and localises the presentation around three Australian habitats: **Outback**, **Great Barrier Reef** and **Bushland**. Core mechanics such as secret identities, life points, numbered predation cards, cyclic match-ups, four rounds, Free / Predation / Evolution phases and the supplied skill effects are retained.

> This repository is an independent game prototype. It is not affiliated with the original television programme, production company or rights holders. The Australian names, interface and artwork treatment in this repository are original to this adaptation.

## Play

No build step is required.

1. Download or clone the repository.
2. Serve the folder with any static web server.
3. Enter exactly 10 player names.
4. Pass the device around for private identity checks, then use the public game dashboard as the referee / game state tracker.

For local serving:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Australian edition

### Identities

- 🦘 Outback K / Q / J
- 🐠 Great Barrier Reef K / Q / J
- 🌿 Bushland K / Q / J
- 🦆 Platypus Joker

Match-ups preserve the original cyclic structure:

```text
K > Q > J > K
Outback > Reef > Bushland > Outback  (same rank only)
```

Platypus Joker wins whenever it is the predator and loses whenever it is the prey.

### Rounds

| Round | Predation stakes | Nature Reserve |
|---|---:|---|
| 1 | 2 | Yes |
| 2 | 3 | Yes |
| 3 | 4, then 5 | No |
| 4 | 6, then 7 | No |

Each round follows:

```text
Free Phase → Predation Phase(s) → Evolution Phase
```

### Australian-localised skill deck

The 17 supplied skills are implemented with localised names, including **Wedge-tail Vision**, **Three-Headed Dingo**, **Dingo Pack Leader**, **Echidna Spines**, **Inland Taipan Venom**, **Bushland Sceptre**, **Tail Drop** and **Torpor**.

## Implemented game systems

- Secret random identity assignment for 10 players
- Public life, skill, card-count and status board
- Private identity reveal workflow
- Cyclic K/Q/J and faction combat resolution
- Platypus Joker special rule
- Predation cards 1–10 and card consumption
- Free-phase life and predation-card trading
- 10-life received-trade cap per round
- Round-based predation values (2 / 3 / 4+5 / 6+7)
- Nature Reserve protection in Rounds 1–2
- Two predation stages in Rounds 3–4
- Evolution skill auctions using life bids
- Genetic Adaptation auction discount
- Wedge-tail Vision private reveal
- Parasite host selection and copied predation gains
- Evasive Leap redirect
- Habitat Collapse faction damage
- Three-Headed Dingo multi-attack allowance
- Decoy interception
- Dingo Pack Leader + two packmate follow-up attacks
- Echidna Spines entry damage
- Inland Taipan Venom mutual elimination
- Bushland Sceptre / first-seat control
- Tail Drop card sacrifice
- Apex Bloodline no-card predation
- Torpor target protection
- Scavenger elimination gains
- Elimination bonus (+3 life + eliminated player's remaining predation cards)
- Browser local autosave + JSON save export
- Responsive desktop / tablet / mobile UI

## Testing

The game engine is separated from the browser UI and tested with Node's built-in test runner.

```bash
npm test
```

The test suite covers core match-ups, Joker behaviour, Amphibious override, predation values, card consumption, Blood Rush, Apex Bloodline, Evasive Leap, Decoy, Three-Headed Dingo, Echidna Spines, Tail Drop, Torpor, Parasite, Genetic Adaptation, Habitat Collapse, Inland Taipan Venom, Scavenger, trading rules, Wedge-tail Vision, round skill pools, Dingo Pack Leader follow-ups, Nature Reserve behaviour and elimination rewards.

## Technical notes

- Vanilla HTML / CSS / JavaScript
- ES modules
- No runtime dependencies
- `localStorage` autosave
- Node `node:test` unit tests
- GitHub Actions CI

## Portfolio angle

This project demonstrates translating a detailed rule specification into a working state machine, handling edge cases and conflicting skill interactions, building a pass-and-play UI, writing automated tests, and shipping the result as a dependency-free web application.

## Licence

Code in this repository is released under the MIT License. The supplied source rules remain the responsibility of their respective rights holders; this repository only contains the independent Australian-themed implementation and explanatory summary needed to operate the prototype.
