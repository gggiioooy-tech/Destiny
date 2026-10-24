# Dongyoung stacked healing reduction and prediction errors — 2026-10-24

Engine 2026-10-24.24 registers Dongyoung's healing reduction as one removable debuff with 20 percentage points per stack, capped at three stacks. Previously the passive directly incremented a numeric field; cleansing and revival could leave that penalty behind. It now participates in the existing cleanse/revival ledger, and reapplication after removal starts at one stack. The source has no listed turn duration, so it does not expire through ordinary turn ticking.

Offline development replay inspection found 174 removals of the relevant module and 76 later reapplications; all 76 restarted at one stack. Removals include lifecycle events and must not all be described as cleanses. Overlap with ordinary healing reduction retains the model's existing strongest-value rule; that overlap rule is not independently verified. Reference: [awakened Dongyoung](https://namu.moe/w/동영(세븐나이츠%20리버스)/각성). Private traces remain local.

545 JavaScript tests pass, including stack cap, cleanse, revival, ordinary-debuff overlap/expiry and actual healing restoration. Focused Dongyoung sweep: 350 placements and 13,340 actions without invariant failures. Build and tier-four SSR verification pass. Browser visual QA was unavailable.

Reused development evaluation: 98/150 decided (65.33%), four abstentions, six missing-reservation exclusions from 160 records. Eligible coverage 97.40%; Wilson 95% interval 57.42–72.48%. Previous engine .23 was 96/150 (64%). Majority baseline remains 102/154 (66.23%). No new holdout was consumed and 90% is not validated.

## Why accuracy remains low

The accompanying aggregate prediction-error diagnostics describe engine .23, before this fix. Among 54 incorrect decisions, 33 had first-action HP outside the 32 sampled model paths. Even substituting observed starting shields for diagnostic comparison left 29 such cases. Twenty-four incorrect decisions strongly favored their chosen side (at least 29/32 model paths). Increasing sample count alone therefore does not address missing combat rules or lifecycle behavior. Model outcome frequency is not a calibrated real-world probability.

Unknown starting shields/gear contribute uncertainty, but are not established as the dominant cause: shield discrepancies occurred in 27/54 incorrect decisions and 59/96 correct decisions. Observed shields were used only in a diagnostic comparison, never to infer hidden equipment or feed normal predictions. A finite 32-path envelope and differing packet/reaction boundaries also limit conclusions from first-action HP discrepancies. Correlated reused records cannot establish independent accuracy or quantify each cause's contribution.
