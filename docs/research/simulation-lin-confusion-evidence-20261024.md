# Lin confusion counter evidence — 2026-10-24

Offline inspection of 160 cached development replays found one battle containing Lin. No new server request was made. This is one correlated development battle, not a validation sample of general confusion behavior.

Lin skill 2 applies two effects to three recipients: module 1014160309 with duration type 1, and module 1014160310 with duration type 2. Both start with a remaining value of three. The former changes in turn-effect containers; the latter changes during its owner's attacks. Combined with the published three-turn weak-point reduction and three-hit confusion descriptions, this supports identifying the latter as the hit-count confusion effect. This is a contextual inference, not official documentation of the entire duration enum.

Observed counter transitions for that effect:

| Owner action | Remaining values in packet order | Scope |
| --- | --- | --- |
| Zenitsu skill 2, two logical hits | 2, 1 | Multiple damage recipients; two counter updates |
| Zenitsu next basic attack | 0 (removed) | Last count consumed |
| Aileen skill 1, three logical hits | 2, 1, 0 (removed) | Three counter updates |
| Dellons basic attack | 2 | One counter update |

The counter cannot be decremented once for every recipient/result component: a two-hit multi-target action consumed two counts, not one for every positive result row. Counter consumption is also distinct from personal-turn expiry.

However, a Zenitsu result container has both a weak-point flag and a slip flag. Result flags can mix component and routing provenance, so they do not by themselves establish whether weak-point bypass is decided per cast, target or hit. The single record also does not settle count exhaustion halfway through a longer action, misses against protection, or all assist/counter scopes. Do not enable a guessed implementation or claim full Lin support from these observations.

Source for the published effects: [Lin skill descriptions](https://namu.moe/w/린(세븐나이츠%20리버스)). Detailed packet traces remain private under the ignored local analysis folder. Publicly retained information here is restricted to effect identifiers and aggregate transitions.

Implementation follow-up: `simulation-confusion-hit-count-20261024.md` adds the hit-count/cast-latch model after checking the developer's rollback note. It explicitly retains weak-point ordering and pre-attack effect ordering as unverified assumptions; the single replay still does not certify those details.
