# Clock sensitivity diagnostic — 2026-10-24.2

The current product retains the user-confirmed 210-second guild-war limit. The [official developer note](https://game.naver.com/lounge/sena_rebirth/board/detail/8168815) discusses increasing the old 150-second limit to 210 seconds. It does not establish how elapsed replay stage fields map to the displayed clock.

The local raw-packet audit in `replay-clock-evidence-20261024.json` finds 160 round-end packets: stage-time range 59,157–154,600 ms, median 125,600 ms. Fifty-nine end between 149 and 155 seconds; none exceeds 210 seconds. Across 6,199 turn packets, `StageSkillTime - StartStageTime` ranges from -938 to 7,536 ms, with median 2,001 ms. These are separate protocol clocks, not a proven wall-time conversion. Some reconstructed final HP snapshots also leave both teams alive; that observation alone does not certify a timeout, because report completeness and terminal effect application need checking.

A fixed-limit diagnostic applies 150,000 ms uniformly to all eligible development records, using the same inputs, seed mixer and 32 samples per battle as the production evaluator. The target winner and end state are used only after simulation for scoring. It yields 100 correct of 150 decided, four abstentions, 154 eligible (66.67% among decided). The current production 210,000-ms model yields 97/150 (64.67%). Both remain near the 66.23% majority baseline. Neither is independent validation or evidence of 90% accuracy; the diagnostic score is not substituted into the product's accuracy metadata.

No product time-limit adjustment follows from this sensitivity check. Future work must establish clock semantics independently, then freeze an engine and evaluate it on previously unused records. Repeating the same cutoff comparison without new timing evidence does not constitute progress.

Reproduction tools: `scripts/audit-replay-clocks.py` consumes private config and local raw replays, exporting aggregates only. `scripts/diagnose-battle-clock-sensitivity.mjs` writes private per-record results to the caller's output path and labels them diagnostic, separate from production accuracy. Neither performs network requests.
