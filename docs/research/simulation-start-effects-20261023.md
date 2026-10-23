# Starting effects and conditional damage — 2026-10-23

Engine `2026-10-23.4` corrects Choseon's own initial shield to 45% maximum HP for full skill enhancement. After her basic attack, living attack/magic allies other than herself receive a 22%-of-caster-maximum-HP shield and two-turn control immunity, subject to buff blocking. These allied effects are not granted at battle start or after ordinary skills. Existing stronger shields are retained.

Conditional extra-hit eligibility now reads a target snapshot taken before the main hit. This prevents the main hit from moving a target below a threshold and incorrectly activating a low-HP condition on that same hit. Cooldown-increase effects now cancel the affected hero's skill reservations unless cooldown immunity prevents application.

Evidence: [Choseon description](https://www.namu.moe/w/초선(세븐나이츠%20리버스)), [official introduction](https://forum.netmarble.com/sena_rebirth/view/10/808), and [system rules](https://www.namu.moe/w/세븐나이츠%20리버스/시스템). Community material is paraphrased with attribution to NamuWiki contributors (CC BY-NC-SA 2.0 KR where applicable). HP-threshold snapshot order is a model correction rather than a claim of complete server trigger certification.

Validation: 156 tests pass, including full-skill Choseon shield and conditional allied application. SSR UI verification and production build pass; production dependency audit reports zero vulnerabilities. Existing 160-record retrospective evaluation has 154 eligible battles, 149 decided, five abstained and 91 correct: 61.1% among decided or 59.1% among all eligible. Majority baseline remains 66.2%. The engine does not meet a 90% winner-prediction target.

The first-action diagnostic still matches all 154 eligible first ordinary active skills. Choseon's own shield discrepancy is removed, but 101 battles still have some initial barrier mismatch on other heroes. This count must not be misreported as 101 Choseon errors or as a certified missing global shield rule. No observed starting barrier is copied into predictions to artificially improve this benchmark.
