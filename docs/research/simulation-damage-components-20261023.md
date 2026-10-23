# Mixed-scaling damage component experiment — 2026-10-23

Engine `2026-10-23.7` splits mixed-scaling and conditional damage components for Giyu and Seonran only. It does not extrapolate this representation to every hero. Replay result rows show multiple positive-damage module entries per target for these attacks, consistent with separately represented attack/defense, attack/target-HP and conditional extra-damage terms.

Aggregate local observations include six positive rows for many Seonran three-hit skill-3 target actions and two positive rows for many Giyu one-hit skill-2/3 target actions. First-action observations are smaller and can contain additional effects. Result-row counts alone are not proof of universal independent rolls or exact passive hit counting; nested reactions and guards can also add rows.

The implemented model applies separately rounded damage, nullification, barrier and blessing to each component. Components share the main logical hit's critical/block/weak/miss result and retain damage sharing/deferred-pain routing. Hit-triggered passives, reflux/crystal hit counting and Giyu's mark count remain once per logical hit. These choices are explicit modeling assumptions requiring further packet-sequence validation. Damage logs expose the separate components so discrepancies can be inspected.

Regression tests demonstrate a one-nullification target taking the second component and blessing capping each component without duplicate logical hit counting. Full suite: 168 tests; SSR UI and production dependency audit pass. This is functional validation, not evidence of a specified game prediction accuracy.

Earlier source references: [Giyu skill terms](https://www.namu.moe/w/토미오카%20기유(세븐나이츠%20리버스)/각성), [Seonran skill terms](https://www.namu.moe/w/선란/각성), and [survival effects](https://www.namu.moe/w/세븐나이츠%20리버스/시스템). Community content is paraphrased with attribution to NamuWiki contributors, CC BY-NC-SA 2.0 KR where applicable. Module grouping is local replay evidence, not an official full combat specification. No private battle data is included here.

Reused-record evaluation: 160 records, 154 eligible, 151 decided, three abstained, 86 correct. Decided accuracy is 57.0%, overall eligible accuracy 55.8%, compared with a 66.2% majority baseline. This result does not validate real-use winner prediction or 90% accuracy. The model remains experimental.
