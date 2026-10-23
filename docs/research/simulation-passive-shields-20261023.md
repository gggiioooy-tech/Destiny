# Roster-wide shield/passive-path audit — 2026-10-23

Engine `2026-10-23.5` scans all 176 currently supported heroes. The source pack has passive entries for 164 heroes and no passive entry for 12 minor heroes. This is an initialization and shield-path audit, not certification that every unique passive is implemented.

## Implemented changes

A shared shield rule reader distinguishes initial, skill, basic, hit, HP-threshold, guts, revival, death and cleanse conditions. It applies explicit full-enhancement overrides while keeping target groups separate. All 176 initial states are tested against a separately specified starting-shield map. Only unconditional self starting grants initialize a barrier; conditional guts shields such as Silvesta's cannot be misread as starting effects because of spacing differences.

Verified starting map under the current source pack:

| Hero | Basis | Ratio |
|---|---|---|
| 녹스 | own maximum HP | 45% |
| 니아 | own attack | 185% |
| 메이 | own attack | 160% |
| 벨리카 | own attack | 185% |
| 엘리시아 | own attack | 160% |
| 오를리 | own maximum HP | 45% |
| 윤건 | own attack | 185% |
| 젠이츠 | own attack | 160% |
| 초선 | own maximum HP | 45% |
| 크리스 | own attack | 160% |

Regeneration and shield-reduction rules still apply to those bases. Other heroes do not receive an invented starting barrier to fit observed data.

Ordinary skill-triggered shields now respect the stated skill count, including Daisy's every-second-skill effect. Explicit shield enhancement is applied to supported skill and revival grants. A shielding passive no longer erroneously heals its owner after a skill. Native guts and ring guts retain the stronger shield at the shared trigger. Branz/Bransel's enemy-death shield requires the attack-role composition. Existing dedicated handlers remain for conditional Hayeon, Rad, Choseon and other unique paths.

## Limits

32 heroes have explicit compiled shield rules. This does not mean all 32 have every conditional rule executed: magic-bond conditions, reaction timing, conditional allies and some nested effects still need dedicated handling. Lina's source has an enhancement-only shield description without a complete matching base grant; no unconditional effect is fabricated. Skuld's shield-reduction debuff is not a shield grant. All unique passive stacking, source-death auras and same-frame priorities are not complete.

Evidence includes the existing attributed source pack and rechecked [awakened Velika](https://www.namu.moe/w/벨리카(세븐나이츠%20리버스)/각성) and [Nia](https://www.namu.moe/w/니아(세븐나이츠%20리버스)) descriptions. NamuWiki contributors are credited for paraphrased community material under CC BY-NC-SA 2.0 KR where applicable. These are community specifications, not an official executable combat engine.

## Validation

160 tests pass, including roster-wide initialization, enhancement overrides, no shield-as-heal regression, repeated-skill counting and native/ring guts interaction. The offline `scripts/audit-passive-shields.mjs` emits per-hero rule metadata without private records.

On the existing 160-record retrospective benchmark, 154 are eligible, 149 decided, five abstained and 91 correct (61.1% among decided). Majority baseline is 66.2%; 90% accuracy remains unvalidated. Initial-barrier mismatch falls from 101 to 97 battles; first ordinary skill still matches all eligible records. Remaining barriers are not fitted from observed outcomes. Raw replays, accounts, per-battle stats and output rows remain private.
