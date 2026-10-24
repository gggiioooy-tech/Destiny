# Lin skill enhancement and direct kill reset — 2026-10-24

Engine: 2026-10-24.17.

The skill compiler skipped the fully enhanced weak-point conditional extra damage because its published line starts with a damage-addition heading. Normalize that narrow heading before parsing the existing conditional-damage rule. Lin skill 1 now adds 37% magic attack damage on every landed weak-point hit. Ordinary hits do not receive it.

The published six-transcendence condition resets this skill's cooldown after its own direct kill. Compile a matching named-skill condition and reset only the used skill after the cast. A kill from its non-fixed conditional skill-damage component also counts; independent shock damage does not. No unconditional party reset is added.

Source: [Lin skill descriptions](https://namu.moe/w/린(세븐나이츠%20리버스)), checked 2026-10-24. Full enhancement and six-transcendence remain the simulation defaults. Confusion hit-count consumption and its cast-wide behavior remain unsupported pending ordering evidence; this change does not claim Lin is fully implemented.

Validation: 498 JavaScript tests pass, including five focused checks for compilation, per-hit weak-point extras, own cooldown isolation, secondary-shock exclusion and a lethal extra component. Focused mixed-ring/starting-shield sweep: 350 placements, 13,620 actions, zero invariant failures. Production build and tier-four SSR check pass. Browser visual verification was not performed. Production dependency audit is clean; six existing moderate development-tool findings remain.

Final reused-development evaluation: 160 records, 154 eligible, 150 decided, four abstentions, six excluded for missing reservations; 96 correct (64.00%), coverage 97.40%, Wilson 95% 56.06–71.24%. Majority baseline is 66.23%. These records are correlated and reused for corrections, not a fresh holdout; the small score change does not establish generalization or the 90% goal. No new records were downloaded and unknown equipment was not inferred from outcomes. A preceding intermediate run before the lethal-extra correction is superseded by this final run.
