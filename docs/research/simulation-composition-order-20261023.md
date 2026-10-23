# Composition, stacks and revival order — 2026-10-23

Engine `2026-10-23.6` fixes four previously missing hero role IDs: Giyu universal (5), Shinobu magic (2), Zenitsu attack (1), Tanjiro attack (1). All 176 supported heroes now have a role in 1–5. This changes composition predicates, role-filtered buffs/guards and role-dependent revival. It is not an outcome-tuned modifier.

## Composition

Role support requires two real matching members in a three-person starting team or three in a five-person team, then adds one effective member. Starting composition continues to count original members after deaths. Multiple support owners do not create an undocumented additive cascade. The simulator's production battle format remains three versus three; the five-member predicate is regression-tested as a helper, not a new five-person UI.

Milia's four-magic control immunity and five-magic shield remain unavailable when the actual effective starting count is below those requirements. Three-person mode does not automatically scale a five-person requirement down to three. Her conditional control immunity can no longer leak through the generic passive regex. Only qualifying magic allies attacking while a living Milia supplies the effect receive her defense-scaled shield.

## Stack and revival changes

- Seonran loses accumulated ghost-mask stacks and their modeled attack/critical-damage increments on death; resurrection does not grant the battle-start three stacks again. Her automatic six-stack attack is once per battle, consistent with the source; it is not an unlimited recast or a stack-consumption loop.
- Giyu's party-granted four-hit cleanse/gauge condition is tracked per recipient, rather than Giyu's counter triggering a simultaneous whole-party cleanse. This follows the target group and self-hit wording; exact server same-frame certification remains pending.
- Clemis awakening revives up to two eligible dead allies before its party heal. Attack/magic roles receive three-turn immortality; defense/support/universal roles return at 65% HP. The subsequent 26%-caster-max-HP heal cannot heal immortality. Active resurrection does not consume a native one-time resurrection flag. Annihilated targets remain ineligible.
- Crystal detonation's cooldown increase cancels the target's reservations. Its fixed damage bypasses blessing's per-hit cap, using the existing fixed-damage path.

## Sources and evidence boundaries

Rechecked [Hayeon](https://www.namu.moe/w/하연(세븐나이츠%20리버스)/각성), [Clemis](https://www.namu.moe/w/클레미스(세븐나이츠%20리버스)/각성), [Giyu](https://www.namu.moe/w/토미오카%20기유(세븐나이츠%20리버스)/각성), [Milia](https://d.namu.moe/w/밀리아(세븐나이츠%20리버스)), and [Seonran](https://www.namu.moe/w/선란/각성). Collaboration roles also match the user-supplied in-game cards and referenced hero source pack. Official collaboration references: [October 1](https://forum.netmarble.com/sena_rebirth/view/10/2080), [October 15](https://forum.netmarble.com/sena_rebirth/view/10/2134).

Community specifications are paraphrased with attribution to NamuWiki contributors, CC BY-NC-SA 2.0 KR where applicable. A page stating an effect does not certify every simultaneous interaction. The current engine still processes direct damage/survival, health/death/revival hooks, hit-triggered effects, and then queued reactions in model order. Full server priority among concurrent passives, stale queued actions across revival, source-death auras and all unique condition families remain incomplete. No exhaustive official priority list or readable local rule table was found. These gaps must not be relabeled as completed mechanics.

Regression tests cover role identity for the whole roster, three/five-member support thresholds, post-death starting-composition persistence, Milia's unmet thresholds, independent Giyu counters, Seonran stack reset, and Clemis mixed-role revival followed by healing. Private replay benchmarks are kept under ignored local storage; no observed winner or later action enters prediction inputs.

Retrospective benchmark: 160 records, 154 eligible, 152 decided, two abstained and 85 correct (55.9% among decided; 55.2% among eligible). This is lower than the preceding engine's 61.1% decided accuracy and below the 66.2% majority baseline. More source-consistent mechanics did not improve this incomplete-input benchmark; this must not be presented as a prediction-accuracy improvement. The 90% target remains unmet.
