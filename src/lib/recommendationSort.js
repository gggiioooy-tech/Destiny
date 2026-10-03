export function getRecommendationScore(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  const score = Number(match?.[0]);
  return Number.isFinite(score) ? score : 0;
}

export function sortByRecommendation(items) {
  return [...(items || [])].sort(
    (a, b) => getRecommendationScore(b?.power) - getRecommendationScore(a?.power)
  );
}
