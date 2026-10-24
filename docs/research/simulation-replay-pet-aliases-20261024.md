# Replay pet name normalization — 2026-10-24.12

Nineteen of the 320 development-team summaries spell Melpero as 멜패로. The supported UI uses 멜페로. Although manual normalization already recognized the alias, replay conversion checked the unnormalized name first and silently left the pet as none. As a result its full-skill 12% effect-application bonus was absent from historical simulation setup. The catalog's 25% accuracy bonus is already in detailed starting stats and must not be added twice.

Replay conversion and manual normalization now share the same canonical-pet function, also covering 카마도 네즈코 → 네즈코. Two regressions verify equivalent setups and retained hidden modifiers/aura entries. All 480 JavaScript tests pass; initial stats, reservations, missing-equipment handling and tier-four restrictions remain unchanged. No player data or raw replay is published.

The same retrospective development evaluation remains 94/150 decided (62.67%), four abstentions and six exclusions; coverage 97.40% of 154 eligible records, Wilson 95% [54.70%, 70.00%], majority baseline 66.23%. No new holdout was consumed and no outcome improvement is claimed. The 90% goal remains unmet.
