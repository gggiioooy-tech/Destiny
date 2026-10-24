# Named cooldown reset and full Pascal upgrades — 2026-10-24

Engine 2026-10-24.18 adds the missing named-skill cooldown reset effect. A support skill targeting one named skill now resets only that matching skill; an unknown name never falls back to a full reset. Existing explicit full reset effects retain their behavior.

Pascal's fully enhanced first skill now grants two nullifications, uses the two-transcendence 40-second listed cooldown, and resets the second skill. The reset still works under buff block while the nullification grant is rejected. These rules follow the [published Pascal skill descriptions](https://namu.moe/w/파스칼(세븐나이츠%20리버스)). This does not establish Pascal's complete server equivalence or improve a guild-war sample by selecting favorable cases.

503 JavaScript tests pass. Focused Pascal pair sweep: 350 placements, 14,689 actions, zero invariant failures. These tests cover named reset isolation, buff-block interaction, upgrade parsing and existing regressions. Tier-four access remains enforced.

The full-upgrade cooldown parser also correctly selects the explicitly published reduced values for Lee (both active skills 68s), Bidam (skill 1 55s), Snipper (skill 1 45s), Lee Joohee (skill 2 75s), Charon (skill 2 91s) and Karin (skill 1 61s). These are fallback published values; existing sufficiently sampled replay cooldown measurements still take precedence. A table-driven regression covers all eight affected skills, including Pascal.

Reused-development evaluation remains 96/150 decided (64.00%) from 154 eligible records out of 160: four abstentions and six missing-reservation exclusions. Coverage 97.40%, Wilson 95% 56.06–71.24%, majority baseline 66.23%. No fresh holdout was consumed and the 90% target remains unvalidated. Production build, tier-four SSR and production dependency audit pass; previously known six moderate development-tool findings and the bundle-size warning remain.
