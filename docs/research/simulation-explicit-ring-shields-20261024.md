# Explicit starting shield equipment — 2026-10-24.8

Manual hero editing now separates survival-ring behavior from a six-star starting-shield option. Supported options are 기합 (90% attack), 철벽 (100% defense), and 건강 (18% maximum HP), lasting two personal turns. The default is unknown/none. Saved setups retain the explicit choice; older setups default to none and changing a hero clears it.

References checked 2026-10-24: [equipment table](https://www.namu.moe/w/세븐나이츠%20리버스/장비) and public equipment definitions at 7knightshub `/data/items/equipment/10461029.json`, `10461030.json`, `10461031.json`. These specify that the shield does not stack with native hero shields. The existing single-pool rule keeps the stronger grant; priority where a native shield is weaker than the item remains a model assumption requiring replay verification. Lower-star options are outside this selector's scope.

No historical equipment is inferred from observed shields, final HP, winner, or subsequent replay actions. Historical records without this input remain unchanged. Native starting-shield differences against Hayeon are a separate investigation and are not corrected by inventing equipment.

Validation: 467 JavaScript tests pass. A targeted Yoongeon pair sweep covers 350 placements and 11,390 actions with mixed survival rings and all four starting-shield selections, with no number, clock, or termination failures. These are software invariants, not measured outcome accuracy or exhaustive simultaneous-effect validation. Tier-four SSR restrictions are preserved; no browser visual verification is claimed.

The unchanged 160-record retrospective development evaluation remains 96/151 decided (63.58%), three abstentions, six exclusions and 98.05% eligible coverage; Wilson 95% [55.65%, 70.83%], majority baseline 66.23%. No new holdout was consumed. Production build succeeds; production audit has zero findings, with six existing moderate development-tool findings. The 90% goal is not met.
