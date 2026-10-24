# Replay result attribution hints

The offline report now preserves `MSkillResult.AppliedModuleIds`, `CalcDamageScore`, and `TotalBattleScore` as `appliedModuleIds`, `calcDamageScore`, and `totalBattleScore`. Module order is retained and absent optional scores remain null rather than becoming zero. These fields are forensic comparison data, not prediction inputs or a declared direct-hit classifier.

A raw audit of the existing 160 development replays exercises the helper on 91,330 result rows: 19,593 have applied module lists; 34,553 explicitly contain calculated damage score; none explicitly contains total battle score. There are 7,852 positive-damage rows with an explicit zero calculated score. Thus score equality/zero alone must not be used to identify direct versus routed damage. A reviewed guard example lists the same applied module on both protected and guarding recipients.

Two additional synthetic protobuf tests preserve module-list order/repetition and absent-versus-zero scores; all four Python report-fidelity tests pass. The actual-schema audit contains no network operation. Existing private timelines are not silently overwritten, and no raw result, player identifier, replay reference, key or token is published. The aggregate reproduction is `scripts/audit-replay-result-metadata.py` with private config/cache arguments.

The production engine remains 2026-10-24.15. Its 491 JavaScript tests and tier-four restrictions are unchanged. The same retrospective score remains 94/150 decided, four abstentions and six exclusions, with 97.40% eligible coverage; 62.67% among decided, Wilson 95% [54.70%, 70.00%], majority baseline 66.23%. This reporting improvement is not a new holdout or proof of 90% accuracy.
