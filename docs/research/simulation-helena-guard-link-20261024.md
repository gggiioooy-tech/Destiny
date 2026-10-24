# Helena guard and link exclusion — 2026-10-24

Engine: 2026-10-24.16.

Helena-protected allies must not join link damage distribution. The direct-hit guard selection included Helena, but the separate link eligibility check only included Giyu and Rad. Both now use the same living-guard predicate. Guard death restores link eligibility without deleting the remaining link buff.

Sources: [Helena](https://namu.moe/w/헬레니아(세븐나이츠%20리버스)), [awakened Helena](https://dark.namu.moe/w/헬레니아(세븐나이츠%20리버스)/각성), [June 25 update copy](https://m.inven.co.kr/board/sena/6379/1430?category=%EC%86%8C%EC%8B%9D&p=1).

Validation: 493 JavaScript tests pass. Focused sweep: 350 placements, 17,524 actions, zero invariant failures. This does not establish complete server equivalence. The reduction applied to a lone eligible linked unit remains unverified and unchanged.

Reused development evaluation: 160 records; 154 eligible; 150 decided; 4 abstentions; 6 excluded for missing initial reservations. Correct 94/150 (62.67%), coverage 97.40%, Wilson 95% interval 54.70–70.00%. Majority baseline 66.23%. These correlated records were reused for development, not a new holdout. No gain in aggregate accuracy; the 90% goal remains unmet. No new replay downloads or inferred equipment inputs.
