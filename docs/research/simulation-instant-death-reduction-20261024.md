# Instant-death countdown reduction and full-skill chances — 2026-10-24.14

Aquila's first active skill now recognizes its per-hit one-turn instant-death countdown reduction, including the published full-skill 70% chance. It affects an already active countdown only, applies ordinary resistance/application checks, and executes at zero using the shared death/revival path. It does not create instant-death stacks on unaffected units or invent an intermediate natural-turn HP tick. Exact server same-frame ordering remains a validation limit.

Full-skill application upgrades now give Aquila's second active skill 40%, Kris's first active skill 60% plus its separate 6-transcendence 30% application, and Kris's second active skill 30%. The upgrade is not incorrectly copied onto the later separate application. Consumed instant-death stacks/countdown are cleared after execution; an earlier assignment order could restore stale values from the damage result.

References: [current Aquila table](https://m.namu.moe/w/아킬라(세븐나이츠%20리버스)), [current Kris table](https://m.namu.moe/w/크리스(세븐나이츠%20리버스)), [Aquila release note copy](https://m.inven.co.kr/board/sena/6379/1216?iskin=sena&vtype=mobile). Only the specified chance/countdown rules are changed; unrelated historical damage coefficients are not replaced with release-version numbers.

489 JavaScript tests pass. Integration cases cover per-hit expiration, no invented stacks, resistance, an available revival ring, damage immunity/nullification/shield bypass for execution, annihilation blocking revival, and consumed state after a double application. Focused Aquila/Kris mixed-ring/shield sweeps cover 700 placements and 31,521 actions with zero invariant failures.

The unchanged full development evaluation remains 94/150 decided (62.67%), four abstentions, six missing-reservation exclusions, eligible coverage 97.40%; Wilson 95% [54.70%, 70.00%], majority baseline 66.23%. No new holdout was consumed. These are rule corrections, not proof of 90% outcome accuracy; that goal remains unmet.
