# Aquila starting link — 2026-10-24.15

The six-transcendence passive's all-allies three-turn link was absent from initialization. It now starts on Aquila's team, while the opposing team remains unchanged. Overlap with Rudy's two-turn starting link retains three turns. The existing link routing model applies, and durations decrease on each affected hero's own basic-attack turn.

Reference: [Aquila's current passive table](https://m.namu.moe/w/아킬라(세븐나이츠%20리버스)). This adds the missing activation; it does not independently certify the model's exact link/guard overlap damage formula. Routed result flags must not be treated as the direct recipient's own critical/block opportunity; the probability audit correction records that separate limitation.

491 JavaScript tests pass, including initial team scope, three-way routing, personal-turn expiration and Rudy overlap. The targeted mixed-ring/shield sweep covers 350 placements and 16,429 actions with zero invariant failures. The same 160-record retrospective development evaluation remains 94/150 decided (62.67%), four abstentions, six exclusions; eligible coverage 97.40%, Wilson 95% [54.70%, 70.00%], majority baseline 66.23%. No new holdout was consumed; the 90% target remains unmet.
