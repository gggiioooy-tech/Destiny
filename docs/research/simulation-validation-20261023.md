# Simulator validation — 2026-10-23

Engine: `2026-10-23.1`. This is a reference simulator, not a validated winner predictor. The requested 90% accuracy has not been achieved.

## Changes

- Expanded privately cached raw replays from 40 to 160, covering 41 hero names. No raw replay, account identifier, private request path, battle result row or private stat table is published.
- Exported aggregate action duration and cooldown observations. Cooldown observations are differences between the server ready timestamp and stage time; they are not claimed to be universal animation constants.
- Corrected effect-application bonus to multiply skill probability, followed by a separate resistance check. Added hidden team modifiers to archived start-stat inputs without applying visible attack/HP bonuses twice.
- Added ordered debuff removal, freeze/petrification release damage, independent DOT instances, defense-scaled healing and additional conditional damage rules.
- Added selectable equipment sets inside the hero editor. Only hidden effects are added; visible panel bonuses must already be in the supplied stats.
- Expanded Rudy stance, Giyu mark, Seonran/Tanjiro conditional damage and Palanus mark handling. Giyu/Shinobu awakening gauge 120 was recovered from initial spawn packets.
- Updated Android and Vite patch versions; production dependency audit reports zero vulnerabilities. Development-tool audit still reports 10 findings requiring separate compatibility work; no forced major upgrades were applied.

## Evaluation

The original 40 records plus 60 new records were used for development. Another 60 records were held aside until the engine changes were frozen. These battles come from the same wars, so this is not an independent generalization benchmark. Aggregate timing uses the 160-replay corpus; outcome labels are not used to choose timing constants.

For each eligible battle, 32 seeded runs use only initial visible stats, initial reservations, known pet and initial formation/seat metadata. Winner, final HP, recorded damage and observed skill sequence never enter prediction inputs. Initial equipment sets and rings are not available in this archive and are left unspecified. Some real heroes differ from the simulator's full-growth assumption.

Held-aside results: 60 records, 59 eligible, 56 decided, 3 abstained, 24 correct. Accuracy among decided battles: 42.9%; among all eligible battles: 40.7%. The majority-class baseline is 59.3%. This engine is below that baseline. These results do not support real-use winner prediction or a 90% claim.

Development results: 100 records, 95 eligible, 93 decided, 2 abstained, 61 correct (65.6% among decided). Majority baseline: 70.5%. This development result is also below its baseline and cannot substitute for held-aside evaluation.

## Remaining uncertainties

All unique passives are not complete. Auto-skill AI, simultaneous triggers, source-death aura changes, exact buff-removal order, conditional buff collisions, some transformation/reaction attacks and exact critical/block/shred interaction remain incomplete or approximate. Formation-group mapping is inferred from initial packet identifiers. Multi-instance bleed amplification and some damage-over-time ordering require direct replay checks. Palanus/Giyu edge cases have unit tests but not complete replay certification. More archived samples alone cannot replace missing starting equipment, rings and exact AI rules.

## Sources

Mechanics were paraphrased; no full wiki articles are redistributed. Wiki material is community-maintained and is not treated as an official guarantee.

- [System rules](https://www.namu.moe/w/세븐나이츠%20리버스/시스템): effect probability, control/DOT descriptions, dispel behavior.
- [Equipment](https://www.namu.moe/w/세븐나이츠%20리버스/장비): set effects.
- [Awakened Rudy](https://www.namu.moe/w/루디(세븐나이츠%20리버스)/각성), [Seonran](https://www.namu.moe/w/선란/각성), [Giyu](https://www.namu.moe/w/토미오카%20기유(세븐나이츠%20리버스)/각성), [Hayeon](https://www.namu.moe/w/하연(세븐나이츠%20리버스)/각성): conditional effects.
- [Official Giyu/Shinobu announcement](https://forum.netmarble.com/sena_rebirth/view/10/2134), [Tanjiro/Zenitsu](https://forum.netmarble.com/sena_rebirth/view/10/2080), [Juri bug fix](https://forum.netmarble.com/sena_rebirth/view/10/376).
- [Palanus coverage](https://www.inven.co.kr/webzine/news/?news=313177&site=luna): persistent marks.
- [Community reflux experiment](https://gall.dcinside.com/mgallery/board/view/?id=sevennightsrebirth&no=357790): defense application. This is experimental evidence, not an official formula specification.

Wiki attribution: NamuWiki contributors, CC BY-NC-SA 2.0 KR where applicable. Checked 2026-10-23.
