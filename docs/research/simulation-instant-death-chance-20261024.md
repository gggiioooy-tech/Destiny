# Scoped instant-death application bonus — 2026-10-24.13

Nox and Aquila's 25% instant-death application bonus was not parsed: the generic effect-chance label matched the line, but could not find a generic definition under its scoped name. Both panel and detailed-start setup now carry a separate `instantDeathChanceBonus`. The shared effect roll adds it to ordinary application bonuses only for the instant-death status. It does not boost stun, poison, or untyped debuffs; resistance is still calculated separately.

References rechecked: [awakened Nox skill table](https://www.namu.moe/w/녹스(세븐나이츠%20리버스)/각성), [Aquila skill table](https://www.namu.moe/w/아킬라(세븐나이츠%20리버스)), and [independent game-guide explanation of ordinary/scoped synergy](https://trees.gamemeca.com/amp/view.php?gid=1767604). The existing strongest-same-family aura policy is retained; no new claim about stacking two identical scoped auras is made.

482 JavaScript tests pass. Both input bases and ally/enemy scope are covered; a 50% base, 10% ordinary bonus, 25% scoped bonus and 20% remaining resistance produces 54%, while other statuses receive only the ordinary bonus. Targeted mixed-ring/shield sweeps cover 700 placements and 32,709 actions with zero invariant failures.

The seven development records containing Nox/Aquila remain part of the same full 160-record evaluation. Result: 94/150 decided (62.67%), four abstentions, six exclusions, eligible coverage 97.40%; Wilson 95% [54.70%, 70.00%], majority baseline 66.23%. No new holdout or accuracy improvement is claimed. The 90% goal remains unmet.
