# Public, installed-data and archived-protocol audit — 2026-10-23

This is a bounded read-only audit of currently available evidence. It is not a claim that all client code or server logic has been recovered. No game API request, new replay download, process-memory inspection or archive decryption was performed in this audit.

## Installed data

The inspected installation contains one base PAK and 22 downloaded PAKs; all 23 inspected archive indexes are encrypted. Downloaded content also contains 22 manifest files. The two previously targeted base/data archives were rechecked. Readable markers do not establish a usable skill database or formula implementation. No complete readable combat rules table was extracted.

The inspected ReplayData directory currently contains zero files. Saved logs contain 806 small log files, about 99 KB in total. Searches for SkillCooltime, DamageFormula, BattleRule, StatusEffect, Shield, Barrier and TurnRecord found no occurrences. Eight occurrences of Critical are not evidence of a critical-hit formula. Account/webcache/config payloads were not printed or exported. These counts describe the inspected paths, not every possible install or Windows cache.

## Previously archived communication

The private captured-frame archive contains one guild-war information response and 21 battle-history responses. The available local protocol descriptor includes 139 combat/formation/skill/status/guild-war-related message types, but no message whose name identifies a combat-rules table.

Skill result records expose target, module/skill ID, damage, healing, current/max HP, barrier, death, critical/weak/block flags, changed cooldown and applied module IDs. Status records expose module ID, remaining turns, duration type, sequence and stacks. Active notifications also contain speed boost, turn/team metadata, awakening gauges and cooldown-turn fields. These are outcomes and state observations; they do not by themselves reveal the formula, RNG seed, every hidden starting equipment effect or the exact client auto-selection algorithm. Undecoded module IDs must not be assigned effect names by guesswork.

## First-action diagnostic

Added `scripts/diagnose-first-action.mjs`, an offline diagnostic that compares replay observations against model output, without feeding observed outcomes into prediction. Reports contain private battle keys and must remain under ignored local storage.

On 160 locally cached replays, 154 had eligible initial input and six were excluded for reservation metadata. All 154 eligible first ordinary active skills match the model's source/team/skill across the sampled comparison. Passive skill-code-4 notifications must be excluded from this comparison; treating them as the initial ordinary skill falsely produces 32 mismatches.

Initial barrier differs in 101 eligible battles. This indicates either missing initial effects or a mismatch in state interpretation; it does not prove that all 101 cases share one missing passive. At the first active-skill boundary, 190 individual hero HP observations lie outside the 32-seed sampled envelope by more than one percentage point. This envelope is not an exhaustive probability interval; packet boundaries and complete model-action boundaries can differ, especially when reactions are nested. This is a debugging signal, not an accuracy score.

One concrete source-supported discrepancy is Choseon's own starting shield: the engine reads the base 39% maximum-HP shield, whereas full skill enhancement specifies 45%. The observed repeated barrier ratio is approximately 45/39. Her allied 22% shield is conditional on her basic attack and eligible attack/magic allies, so it must not be added indiscriminately at battle start. This finding is recorded for a separate tested engine change; this audit does not silently alter gameplay calculations.

## Public evidence

- [Official January 22 update](https://forum.netmarble.com/sena_rebirth/view/10/808): Choseon and Palanus skill descriptions and conditional effects.
- [Official October 1 update](https://forum.netmarble.com/sena_rebirth/view/10/2080): combat stat display, passive awakening tooltip improvements and Hayeon bug fixes. Public patch descriptions can clarify mechanics, but are not a complete executable rules specification.
- [Official March 19 update](https://forum.netmarble.com/sena_rebirth/view/10/965): hero passive descriptions and wording changes.
- [Choseon reference](https://www.namu.moe/w/초선(세븐나이츠%20리버스)): own shield 39→45%, allied conditional shield 20→22% after basic attacks.
- [Awakened Dellons reference](https://www.namu.moe/w/델론즈(세븐나이츠%20리버스)/각성): the kill-triggered follow-up is at most once, not an unrestricted kill chain. The current one-follow-up cap is consistent with that description.

NamuWiki contributors are credited for paraphrased community descriptions, CC BY-NC-SA 2.0 KR where applicable. Official notices, community text, initial-state observations and inferred behavior are distinct evidence categories. No private replay files, personal stats, source keys or request paths are published with this report.
