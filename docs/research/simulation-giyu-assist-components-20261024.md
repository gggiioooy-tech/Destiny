# Giyu cover damage components — 2026-10-24

Engine 2026-10-24.23 splits Giyu's Hayeon-cover basic damage into its physical-attack and defense-based parts, matching his existing normal-attack calculation. The previous assist branch combined both bases into one hit amount, changing per-component rounding and survival protection such as blessing.

The existing offline cover-context audit found 56 Giyu code-1 actions in Hayeon basic packets. Fifty have positive result rows for both module 4020180101 and 4020180102, one row for each module, with the same recipient in the inspected examples. These are separate skill-damage modules, not a second attack or a shock/routing row counted as a component. No winner or later equipment state was used as an input. The remaining six actions are not assumed to have caused damage.

The two parts reuse the same attack's critical/block/weak/miss outcome. Both pass through the existing damage/survival pipeline; the second is explicitly a component so it does not create a second hit passive or shock proc. Healing and mark consumption still execute once when the assist finishes. When one part kills an enemy, the second part stops unless that enemy has revived, matching the existing primary Giyu path. All simultaneous protection/ring priorities remain experimental.

534 JavaScript tests pass, including separate component output, one self-heal/mark use and independent blessing caps for both components. Focused Giyu mixed-ring/starting-shield sweep: 350 placements, 15,557 actions, zero invariant failures. Production build and tier-four SSR pass; browser visual QA was not available. Production dependency audit is clean. Existing large-chunk and six moderate development-tool findings remain. Outcome evaluation is appended after completion.

Reference: [awakened Giyu](https://namu.moe/w/토미오카%20기유(세븐나이츠%20리버스)/각성). Private packet traces stay in the ignored local analysis folder.

Final reused-development evaluation remains 96/150 decided (64.00%), with four abstentions and six missing-reservation exclusions out of 160; eligible coverage 97.40%, Wilson 95% 56.06–71.24%, majority baseline 66.23%. Compared with .21, ten records have different model outcome frequencies but none crosses the winner decision boundary. No aggregate accuracy gain is claimed. These records were reused for development and no fresh holdout was consumed. The 90% target remains unmet.
