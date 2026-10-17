import catalog from './gameCatalog.json';

export function resolveGameSide(side) {
  if (!side) return side;
  const ids=side.heroIds || [];
  return {...side,
    heroes:ids.length ? ids.map((id,i)=>catalog.heroes[id] || side.heroes?.[i] || `영웅 #${id}`) : side.heroes,
    pet:catalog.pets[side.petId] || side.pet,
    namesResolved:ids.length===3 && ids.every(id=>catalog.heroes[id]) && (!side.petId || !!catalog.pets[side.petId]),
    skills:(side.skills || []).map(skill=>({...skill,hero:catalog.heroes[skill.heroId] || skill.hero})),
  };
}
