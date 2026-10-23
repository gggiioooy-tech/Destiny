# Skill lifecycle and interaction pass — 2026-10-23.10

Implemented and regression-tested:

- Full-enhancement Karin resurrection count/HP (two allies, 70%) plus revival passive hooks in generic resurrection.
- Rudy awakening gauge reduction, Nox party cooldown reduction, Hellenia party reset and Sylvesta self reset.
- Matching physical/magic immunity, penetration, expiry and turn reduction. Fixed damage has no physical/magic family.
- Revival clears old-life timed stat decreases and ailments (including unremovable DOT), without executing freeze/petrification release bursts from the dead life. Native and ring resurrection use the same reset.
- Multi-target kill recasts reselect all remaining targets, reapply cast effects, respect repeat limits and consume duration/spacing; death followed by revival counts as a lethal event. The full server interrupt order and skill-counter semantics of triggered casts remain unverified.
- Skills explicitly requiring removable ally ailments/enemy buffs have a usability gate.
- Skuld magic-vulnerability conditions, full-enhancement cooldown probability, HP conversion and Hayeon rescue ordering. Conversion is batched per effect before threshold hooks and before the next listed effect; this is the explicit model ordering.
- Missed attacks cannot be classified as blocked just because the critical branch was suppressed. Reaction attacks now apply stealth/superiority and basic-skill probability bonuses.

Verification: 394 repository tests; exhaustive distinct hero-pair invariant run in same-party and opposing-party placements: 30,800 battles, 612,860 actions, no invariant failures. This is not exhaustive six-hero semantic verification. The private retrospective benchmark remains below the majority baseline and does not certify 90% prediction.

The first-action forensic comparator now compares the end of the original active packet, including its recorded additional actions, rather than mixing a main-action snapshot with the model's post-reaction snapshot. Optional `--observed-start-barriers` is diagnostic-only; it deliberately injects the recorded initial shield and is not used by prediction or validation accuracy. In that diagnostic, 142 hero HP states remained outside the 32-seed envelope across 154 eligible battles. Missing rings/equipment are not imputed from battle winners or final HP.

Rechecked sources: [equipment](https://www.namu.moe/w/세븐나이츠%20리버스/장비), [Wukong](https://www.namu.moe/w/손오공(세븐나이츠%20리버스)), and the existing per-hero roster source/skill records. NamuWiki contributors, CC BY-NC-SA 2.0 KR where applicable; descriptions are paraphrased. Existing Wukong clone branches already matched the published full-enhancement coefficients, so no replacement branch was invented.

Outstanding evidence gaps: exact server interrupt priority, all source-death aura lifetimes, triggered cast counters, historical rings/equipment, and uncompiled unique conditions. These remain open rather than being hidden by generic passing tests.

Observed sequence pass: split pre-cast hooks for Yoon nullification, Lynn nullification, Clemis regeneration, Aris shields, Vanessa vulnerability and Yeonhee shields. Yeonhee's dedicated branch no longer bypasses buff block. The public sequence catalog contains aggregate packet order and bounded follow-up timing profiles only. At least five observed sequences are required to mark follow-up spacing/duration observed; smaller samples remain estimates. Zero-duration status records are excluded from follow-up duration sampling.

A direct lethal hit is now distinguished from secondary Shock/Aura/reflux deaths for direct-skill kill recast conditions. This prevents secondary damage from incorrectly earning a direct-kill recast.

Frozen-engine validation: existing 160 archives, 154 eligible, 147 decided, 92 correct, 7 abstentions (62.59% among decided). Downloaded 60 additional already-observed archive references, one-second spacing, no redirects, no guessed URLs, no game API queries or uploads. All 60 downloaded/decoded successfully and have zero record overlap with the prior 160. Before inspecting their outcomes, froze the engine source snapshot; all 60 decided, 47 correct (78.33%; Wilson 95% interval 66.38–86.88%). Same-guild archive correlation remains; this is previously-unused archive holdout, not independent external validation. The original majority baseline remains higher than the original-sample model.

Raw transcendence values are literal, not divided by two: 12-transcendence exists in official notices. Five development records and one new archive record contain a hero below six transcendence; primary stats are recorded actual start values, while skill/passive rules remain the user's requested six-transcendence/full-enhancement model. No artificial normalization of outcomes was performed.
