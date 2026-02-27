# FRIENDS – Frenzy Mode
A Simultaneous-Action Minority Resolution Game Engine

---

## 1. System Overview

Frenzy Mode is a simultaneous hidden-action game system built around:

- Minority resolution logic
- Stack-based spell interruption
- Persistent resource scarcity
- Multi-winner elimination structure

Unlike traditional turn-based games, all players commit actions simultaneously, and outcomes are resolved through comparative distribution analysis.

---

## 2. Core System Model

### 2.1 Simultaneous Commitment Phase

All players secretly commit 1 Action card.
No outcome is determined until after the Spell Phase concludes.

This creates:
- Hidden information tension
- Prediction-based decision making
- Meta-level behavioral analysis

---

### 2.2 Minority Resolution Engine

After reveal:

- The least represented Action wins.
- The most represented Action loses.
- Ties among minorities result in multiple winners.

This produces:

- Non-linear payoff curves
- Anti-majority equilibrium
- Dynamic probability shifts each round

---

### 2.3 Stack-Based Spell System

Spells are resolved in a structured sequential loop.

Each spell:
- Can alter state
- Can interrupt previous spell (Nope)
- Can be copied (Copycat)
- Can reverse global resolution logic (Reflection)

The spell system behaves like a controlled stack:

- Effects resolve before Action Reveal
- Resolution ends only when all players consecutively pass
- Win condition check occurs only after spell resolution fully stabilizes

---

### 2.4 Persistent State Architecture

Game state includes:

- Player hands (Action + Spell)
- Scored Zone (permanent, non-recyclable)
- Draw pile
- Discard pile
- Active global effects

Scored Zone introduces irreversible resource removal, creating systemic scarcity over time.

This shifts probability distribution in later rounds.

---

## 3. Win Condition Logic

A player wins when their Scored Zone contains:

- 3 identical Action cards
OR
- 3 distinct Action cards

Number of winners per game:
⌈(Players / 2)⌉ − 1

Winners exit the game.
System continues until ranking is fully resolved.

---

## 4. Edge Case Handling

### 4.1 Reflection
Inverts resolution logic:
Majority wins instead of Minority.
Multiple Reflections toggle repeatedly.

### 4.2 Faint
Removes a player's participation in:
- Action reveal
- Spell casting
May cause automatic win if only one valid Action remains.

### 4.3 Gamble
Resets full hand state (excluding Scored Zone).

### 4.4 Sudden Death
Triggered when:
Draw + Discard < number of players

System forces:
- Hand exhaustion
- Player elimination if insufficient score
- Resource reinjection into draw pile

This prevents infinite loop states.

---

## 5. Event Injection System

5 global event cards are randomly embedded into the deck.

When drawn:
- Immediate global resolution
- Overrides current round flow

Examples include:
- Global hand reset
- Spell wipe
- Forced discard
- Scored Zone burn
- Draw restriction (Frostbite)

Events introduce systemic volatility.

---

## 6. Strategic Complexity Dimensions

The system blends:

- Minority game theory
- Social manipulation
- Hidden commitment mechanics
- Stack interruption logic
- Resource scarcity economics

Players must reason not only about probability,
but about meta-prediction of other players’ reasoning depth.

---

## 7. Implementation Philosophy

The engine prioritizes:

- Deterministic resolution order
- Structured effect validation
- Clear state mutation control
- Prevention of ambiguous timing conflicts

All win conditions are checked only after:
1. Spell Phase termination
2. Stable state confirmation

---

## 8. Design Intent

Frenzy Mode is designed as a social chaos engine that gradually becomes more mathematically constrained over time due to resource depletion.

Early game:
High entropy.

Mid game:
Strategic tension.

Late game:
Probability compression + elimination pressure.

---

## 9. Current Status

Physical version: Playtested  
System design: Fully structured  
Digital prototype: Logic engine in development
