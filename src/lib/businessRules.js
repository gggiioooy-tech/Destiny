export const HERO_SEARCH_ALIASES = {
  "프레": "프레이야",
  "프레이야": "프레이야",
  "칼헤론": "칼 헤론",
  "칼 헤론": "칼 헤론",
  "레긴": "레긴레이프",
  "레긴레이프": "레긴레이프",
  "라드": "라드그리드",
  "라드그리드": "라드그리드",
  "란드": "란드그리드",
  "란드그리드": "란드그리드",
  "겔두": "겔리두스",
  "겔리두스": "겔리두스",
  "델롱": "델론즈",
  "델롱이": "델론즈",
  "델론즈": "델론즈",
  "실베": "실베스타",
  "실베스타": "실베스타",
  "브브": "브란즈&브란셀",
  "브란즈브란셀": "브란즈&브란셀",
  "브란즈&브란셀": "브란즈&브란셀",
  "밀리아": "밀리야",
  "밀리야": "밀리야",
  "동영": "동영",
  "동녕": "동영",
  "동형": "동영",
};

export function compactHeroText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").trim();
}

export function canonicalizeHeroText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compacted = compactHeroText(raw);
  for (const [alias, canonical] of Object.entries(HERO_SEARCH_ALIASES)) {
    if (compactHeroText(alias) === compacted) return canonical;
  }
  return raw;
}

