import { canonicalizeHeroText } from "./businessRules.js";

export function uniqueHeroNames(names) {
  return [...new Set(names.map((name) => canonicalizeHeroText(name || "")).filter(Boolean))];
}

export function getHeroAlternatives(details, index) {
  const item = details[index];
  const occupied = uniqueHeroNames(details.filter((_, slot) => slot !== index).map((hero) => hero.name));
  return uniqueHeroNames((item?.candidates || []).map((hero) => hero.name))
    .filter((name) => name !== canonicalizeHeroText(item?.name || "") && !occupied.includes(name)).slice(0, 3);
}

export function correctRecognitionHero(result, index, chosenName) {
  const name = canonicalizeHeroText(chosenName || "");
  const item = result?.details?.[index];
  if (!item || !name || name === item.name) return result;
  if (result.details.some((hero, slot) => slot !== index && canonicalizeHeroText(hero.name || "") === name)) return result;
  const details = result.details.map((hero, slot) => slot === index
    ? { ...hero, originalName: hero.originalName ?? hero.name, name, corrected: true, saveState: "saving" }
    : hero);
  return { ...result, details, heroes: details.map((hero) => hero.name) };
}

// Serialize the same user's crop across repeated corrections, including a new upload.
// A slow earlier request must not overwrite their latest choice in shared learning.
export function createCorrectionQueue() {
  const pending = new Map();
  return (key, save) => {
    const task = (pending.get(key) || Promise.resolve()).catch(() => {}).then(save);
    pending.set(key, task);
    task.finally(() => { if (pending.get(key) === task) pending.delete(key); }).catch(() => {});
    return task;
  };
}
