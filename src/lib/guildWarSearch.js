import {searchTokens} from './heroSearch.js';
const normalize=value=>String(value||'').normalize('NFC').replace(/\s/gu,'').toLowerCase();
// Every term must occur; hero order and spacing between terms are irrelevant.
export function matchesGuildWarSearch(fields,query){
 const values=fields.map(normalize);
 return searchTokens(query).every(token=>values.some(value=>value.includes(normalize(token))));
}
