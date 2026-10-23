import fs from 'node:fs';
import {SIM_ROSTER} from '../src/lib/simulationSkills.js';
import {passiveShieldRules,startingShieldRules} from '../src/lib/passiveShields.js';
const rows=SIM_ROSTER.map(h=>({hero:h.name,hasPassive:h.skills.some(s=>s.code===4),source:h.source,starting:startingShieldRules(h.name).map(({scale,value,turns})=>({scale,value,turns})),shieldTriggers:[...new Set(passiveShieldRules(h.name).map(r=>r.trigger))],conditionalShieldRules:passiveShieldRules(h.name).filter(r=>r.conditional).length}));
const summary={heroes:rows.length,withPassive:rows.filter(r=>r.hasPassive).length,withShieldRules:rows.filter(r=>r.shieldTriggers.length).length,withStartingShield:rows.filter(r=>r.starting.length).length,note:'Rule extraction and initialization audit; not certification of every unique passive or simultaneous trigger.'};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({summary,rows},null,2));
console.log(JSON.stringify(summary,null,2));
