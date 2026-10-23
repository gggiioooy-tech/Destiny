# Buff lifecycle follow-up — 2026-10-23

Engine `2026-10-23.3` adds a shared removable-buff ledger. Instrumented skill applications and timed stat buffs retain application order; expired entries are pruned. Initial simultaneous passives have no authoritative ordering timestamps, and some custom passive paths are still observed only when damage or an active effect next synchronizes the ledger. This is an improvement over always removing shields first, not a claim of exact server trigger ordering.

Dispel leaves damage immunity, hit-count nullification and guts untouched. It can remove ordinary control immunity, shields, stat buffs, regeneration, stealth, links, clones and immortality. Removing immortality kills immediately and invokes death rules. Turn reduction now keeps debuffs unchanged and handles supported timed buffs and regeneration consistently. Immortality expiry also invokes death rules and reflux spread, rather than only setting HP to zero.

Generic healing now uses the shared recovery function, which prevents healing during immortality and indomitable survival. Fixed damage skips blessing's per-hit cap while retaining shield absorption and other applicable survival checks. The explicit fixed flag is passed for Rad's reaction and conditional fixed extra hits.

Hayeon-triggered ordinary assists use transformed basic-hit count and HP-scaled components; supported basic control, DOT and defense-decrease effects are applied. Giyu's hit-limited mark can expire during reactions. Assist actions still consume animation time without advancing the helper's personal turn. Full secondary-trigger recursion, all transformation effects and exact same-frame ordering remain incomplete.

The private replay schema was inspected locally to check whether starting rings/sets could be recovered without outcome inference. Initial character packets include formation, skills, growth, HP/barrier and awakening gauge, but no direct equipment inventory. Pet packets expose potential metadata. No ring was inferred from later damage/death events; absent equipment is still unspecified.

Sources rechecked: [system mechanics](https://www.namu.moe/w/세븐나이츠%20리버스/시스템), [awakened Rudy](https://www.namu.moe/w/루디(세븐나이츠%20리버스)/각성). Community rules are paraphrased, attributed to NamuWiki contributors (CC BY-NC-SA 2.0 KR where applicable). User-confirmed timeout and ring rules retain precedence over conflicting community descriptions.

Regression: 155 tests pass; SSR UI checks, production build and dependency audit are checked separately. Reused 160-record benchmark: 154 eligible, 149 decided, 5 abstained, 90 correct. Decided accuracy 60.4%, overall eligible accuracy 58.4%; majority baseline 66.2%. No independent holdout or 90% accuracy claim is supported. All private records remain outside Git and deployment artifacts.
