# Tanjiro enemy-death cooldown reset — 2026-10-24

Engine 2026-10-24.19.

The awakened Tanjiro second active skill had an unimplemented enemy-death cooldown reset. It now observes new enemy deaths during the cast, including an enemy's revival, and resets only that skill. Already-dead enemies and allied deaths do not satisfy it. This differs from Lin's explicit direct-kill restriction: secondary damage during the cast can satisfy Tanjiro's enemy-death wording. This scope does not grant a standing reset when unrelated later actions kill an enemy.

Sources: [October 1 official update copy](https://m.inven.co.kr/board/sena/6379/1496?iskin=party&vtype=mobile), [awakened Tanjiro](https://namu.moe/w/카마도%20탄지로(세븐나이츠%20리버스)/각성).

Offline raw replay inspection found Tanjiro in 65 of the 160 reused development battles. Across 118 casts of his second active skill, 33 containers explicitly reset his own skill code 3 to zero cooldown, attributed to module 4019871301. The same containers do not reset his skill code 2. This supports reset existence and target isolation, not every death/indomitable interaction: raw IsDie alone did not establish each triggering death. Model revival handling remains separately tested rather than claimed as independently certified by those flags. No equipment was inferred from these observations.

The offline timeline analyzer also retains ChangedCoolTime entries with original order and explicit zero versus absent values. It does not assume nonzero values are relative durations rather than deadlines. Old private timelines were not overwritten.

509 JavaScript tests and five Python report-fidelity tests pass. Focused mixed-ring/starting-shield sweep: 350 placements, 13,425 actions, zero invariant failures. Production build, tier-four SSR and production dependency audit pass. The known large-chunk warning and six moderate development-only audit findings remain.

Reused-development outcome evaluation is unchanged: 96/150 decided (64.00%); 154 eligible of 160, four abstentions, six missing-reservation exclusions; coverage 97.40%; Wilson 95% 56.06–71.24%; majority baseline 66.23%. No independent holdout was consumed, no accuracy gain is claimed, and the 90% target remains unmet.

First-action diagnostic of .18 also found all 154 eligible battles matched initial caster and skill code. Ninety had an initial shield discrepancy and 173 hero HP observations fell outside a 32-seed first-packet envelope. Unknown equipment, sampled RNG and packet-versus-model reaction boundaries prevent interpreting those discrepancies as isolated formula errors. Observed later HP is a comparison target only, never a prediction input.
