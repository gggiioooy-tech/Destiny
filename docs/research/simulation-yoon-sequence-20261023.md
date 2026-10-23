# Yoon active sequence follow-up — 2026-10-23

Engine `2026-10-23.8` repairs omissions in the dedicated Yoon handler rather than assuming the generic compiler already executes every published effect.

- Basic attack applies a one-turn timed-buff decrease after a landed attack, subject to resistance. Damage immunity does not prevent the separately applied turn reduction.
- Skill 1 applies its two-buff dispel after damage, using the shared ordered removable-buff ledger.
- Skill 2 checks the original at-least-50%-HP condition for Aura, then converts the whole target group before running HP-threshold rescue handlers. This prevents later group conversion from erasing an earlier target's Hayeon rescue heal. The exact server batching of simultaneous thresholds remains a model assumption.
- Aura is compiled as control. Its landed-hit extra damage uses 15% caster attack as fixed damage, a separate nonrecursive event. It is not treated as Shock's defense-mitigated 40% damage.
- A killing active skill can trigger the opposite active skill at 70% damage power, at most once. The follow-up consumes its observed/fallback action duration and spacing and is skipped if it cannot fit before the 210-second limit. It does not recursively trigger a third active cast.

The triggered follow-up's damage/effects are modeled, but its interaction with every own-skill/party-skill passive counter and exact interrupt order is not certified. Aura damage on mixed-scaling components currently follows the logical-hit convention introduced in the previous experiment. Those are remaining uncertainties, not completed server rules.

Sources rechecked: [awakened Yoon](https://www.namu.moe/w/윤건(세븐나이츠%20리버스)/각성), [update announcement mirror](https://www.inven.co.kr/board/sena/6379/1465), and [Hayeon](https://www.namu.moe/w/하연(세븐나이츠%20리버스)/각성). The non-awakened announcement is corroboration for named effects, not a replacement for awakened coefficients. Community descriptions are paraphrased with attribution to NamuWiki contributors, CC BY-NC-SA 2.0 KR where applicable.

Regression tests cover group HP conversion/rescue, ordered active dispel, bounded opposite-skill follow-up with elapsed time, awakening Aura compilation and basic turn reduction through damage immunity. Full benchmark and production checks are recorded with the public validation metadata. Raw replay input and per-battle evaluation rows remain private.

The roster import had lost the three-magic-members condition header. Restored it and gated Yoon basic/assist nullification refill, all own-skill refill (including awakening), and the once-only control cleanse by the shared composition rule. Regression coverage includes teams below and at the effective magic-member threshold.

Release validation: all 200 repository tests and SSR UI checks pass; production dependency audit reports zero vulnerabilities. Retrospective evaluation: 160 archived inputs, 154 eligible, 153 decided, 1 abstention, 92 correct (60.13%). Majority-class baseline is 66.23%; this is not independent holdout validation and does not support a 90% reliability claim. No new server downloads were used.
