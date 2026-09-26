/* 15월의 인식엔진 ver 4.5.11
 * Pure-JS worker: no OpenCV/CDN dependency.
 * - card detection: multi-threshold Sobel/connected-components + geometry fallback
 * - hero recognition: cached local reference pack + descriptor coarse rank + lightweight NCC rerank
 */

const WORKER_VERSION = "4.5.11";
const REF_PACK_URL = "/hero-recognition/hero-reference-v10.json?v=4.5.11";
const VIEW_W = 1920;
const VIEW_H = 1080;
const VIEW_CARD_W = 84;
const VIEW_CARD_H = 91;
const CARD_W = 98;
const CARD_H = 106;
const DESC_W = 32;
const DESC_H = 35;
const REF_W = 40;
const REF_H = 40;
const SLOT_X = { left: 1205.142857, right: 1296 };
const SLOT_ROWS = {
  1: [461.142857],
  2: [415.714286, 507.428571],
  3: [369.428571, 461.142857, 552.857143],
  4: [324, 415.714286, 507.428571, 599.142857],
};

// v8.4: 화면 모드에 따라 오른쪽 방어 패널의 가로 위치가 달라진다.
// 연습전/일부 모바일 UI와 길드전 좌측 메뉴 UI를 별도 프로필로 두고
// 전체 이미지의 정규화 좌표로 슬롯을 잡는다. 16:9 가상화면 letterbox 추정에 의존하지 않는다.
const SCREEN_GEOMETRY_PROFILES = [
  { id: "practice", leftX: 0.6285, rightX: 0.6708 },
  { id: "guild-menu", leftX: 0.6430, rightX: 0.6865 },
  { id: "middle", leftX: 0.6358, rightX: 0.6787 },
];
const SCREEN_SLOT_ROWS = {
  1: [0.3795],
  2: [0.3348, 0.4258],
  3: [0.2893, 0.3803, 0.4713],
  4: [0.2438, 0.3348, 0.4258, 0.5168],
};
const SCREEN_CARD_W = 0.0402;
const SCREEN_CARD_H = 0.0902;
const SCREEN_X_OFFSETS = [-0.006, 0, 0.006];
const SCREEN_Y_OFFSETS = [-0.007, 0, 0.007];

// v8.7: 화면비와 전체 폭에 독립적인 슬롯 좌표계.
// 게임 UI 크기는 전체 폭보다 화면 높이에 훨씬 안정적으로 비례하므로,
// x도 `이미지 중앙 + 화면높이 * 오프셋`으로 계산한다.
// 16:9 / 2.1:1 와이드폰 / 좌측 메뉴 PC 레이아웃을 모두 후보로 검사하고
// 실제 79개 영웅 기준 초상화와 가장 유사한 프로필을 최종 선택한다.
const HEIGHT_GEOMETRY_PROFILES = [
  { id: "height-classic-classic", leftH: 0.227, rightH: 0.311, rows: "classic", family: "practice" },
  { id: "height-classic-wide", leftH: 0.227, rightH: 0.311, rows: "wide", family: "practice" },
  { id: "height-wide-practice", leftH: 0.279, rightH: 0.371, rows: "wide", family: "practice" },
  { id: "height-wide-practice-classic", leftH: 0.279, rightH: 0.371, rows: "classic", family: "practice" },
  { id: "height-wide-middle", leftH: 0.293, rightH: 0.386, rows: "wide", family: "middle" },
  { id: "height-wide-guild", leftH: 0.307, rightH: 0.400, rows: "wide", family: "left-menu" },
  { id: "height-team-compose", leftH: 0.098, rightH: 0.148, rows: "team", family: "team-compose" },
  { id: "height-team-compose-wide", leftH: 0.112, rightH: 0.166, rows: "team", family: "team-compose" },
  { id: "height-guildwar-vs", leftH: 0.108, rightH: 0.160, rows: "team", family: "guildwar-vs" },
];
const HEIGHT_CLASSIC_SLOT_ROWS = {
  1: [461.142857 / 1080],
  2: [415.714286 / 1080, 507.428571 / 1080],
  3: [369.428571 / 1080, 461.142857 / 1080, 552.857143 / 1080],
  4: [324 / 1080, 415.714286 / 1080, 507.428571 / 1080, 599.142857 / 1080],
};
const HEIGHT_WIDE_SLOT_ROWS = SCREEN_SLOT_ROWS;
const HEIGHT_TEAM_SLOT_ROWS = {
  1: [0.389],
  2: [0.353, 0.425],
  3: [0.317, 0.389, 0.461],
  4: [0.281, 0.353, 0.425, 0.497],
};
const HEIGHT_CARD_W = 0.086;
const HEIGHT_CARD_H = 0.091;
const GEOM_COARSE = [0.96, 1, 1.04].flatMap((scale) =>
  [-48, 0, 48].flatMap((dx) => [-28, 0, 28].map((dy) => ({ scale, dx, dy })))
);
const TARGET_VARIANTS = [{ scale: 1, dx: 0, dy: 0 }];
const NCC_SCALES = [0.94, 1, 1.06];
const NCC_SHIFTS = [-3, 0, 3];
const EDGE_THRESHOLDS = [34, 46, 60, 76];
const TOP_PRECISE = 79;
const EXPANDED_PRECISE = 79;

let referencePackPromise = null;
let referenceTeamPriors = [];

// Hero class badges are drawn at the lower-left of every hero portrait and
// are absent from pets. They are therefore a stable geometry anchor across
// aspect ratios, even when the outer card border is faint or partly clipped.
// The five references below are the user's clean in-game captures, normalized
// to 12x12 RGB so the worker can compare both the colour tile and white glyph.
const TYPE_BADGE_REF_SIZE = 12;
const TYPE_BADGE_REFERENCE_DATA = [
  { id: "magic", name: "마법형", rgb: "koWjeYG2Rmy2OmazNWCuO2CjU2aKSGGVRWe2UHG4S261W4HGamqUTXTGPXvZNnbYOHfcPHnaPXjSO3bUM3DQOnPOOG/IQHjRN1ibO3rbR3vJl6vNVn68Q3K5Sne7M2SvW3+0OGawJV2zMGa8OmS2QIDkNGi7zNHc9PT07e3v9PTz3N/l19ncMlubIFeqLWG3O2SzQX/iLGW7pbPI/fz6q7K+naa07OztyM3WHEyPIFSlK12vPme1P33eL2e5x87au7/HtLrE2NvetbnA1NbbJk+OGk6eK16tQ2mwP3zaJ2C1qrXIvL/Hn6e2vMLLsLO6vMHLGEOJGk2cKluqSWutPXjVMWKus7nCycrNL0p4WmyI7OrnqLG+DDuAGEuZKVqoUHGxPHXQMWOwPGCWLVKNHkmMVm+WqbC67ermboCdDT2GKFmnU3KzOnLJKmC1IlepIFSkIlOhE0OPDTV1m6Kv8+3lT2mRHE6eU3SxNWvDJVywI1ipIFSjHlGfHE6cE0WSHkF6oKWvaXucEkKRV3y3P3bNL2O3K16wKFqqKFmoKFmnKlqnG0yYFECFHEeNID+A" },
  { id: "universal", name: "만능형", rgb: "35guxYFKh0yChEekhEmnf0SkdjuYf0KhfEGZej+WeT+Vf0KduoBbp2Sjj0zOkUzXj0jWh03BnH69fUG9gEHDej66cjqyczu1iFCQj0zOiUfQh0bLejfAiGWx7O/qdE6hazGsajWoYTCgYjGhh0qnkUvVfTrDeDa+YSWhrJ6/9/j1l4OwShaKVSOVTyCOWimXfUKkj1vCl3m4mn24sqHF0c3XeGaP2NXbnpCyhnOifmqbXzuOej6egVev0dLT6u3no5mvhHSZa1mDgHKSpZ+v9fjxvrzEUTR9gUmkeDq5Z0KUurPDkIOghXeY9Pbya1yBnJSoqqSzQCZqRR1/f0ejg0XGYyukYkGJw7/IZFN7komeaVt9wL7EOR5jPBd2TiWJfUWhfUDAYy2kdFiZvLrAkoifu7rBjYWauLW8UTh3Pxl6TCOHekSedDy3ViOTj4Gl5OffmpKnWEZ2pqGu5unhcmGLNxJxSyOHd0KdbDauUyeLgnSVaViDOBVrNxNvNBVjcmWHcmWJNRNuVimNeEGWcTeuXC2WTCWCRR1+UCWJTyeJSyCEPhZzRiN5WCqKmFaK" },
  { id: "attack", name: "공격형", rgb: "XWJzbEZTgjc9iDo+hThAiD1DjT0+hDU6jD5GlUhJjEBGkElUeEZPwE9K0UQ2zUAy0UY41U1B0UtAzEY8yEQ7w0I7vzw1sz4+uUQ83FFAyoeA1KejwnRrxToq0EY3yEI0wj0wujcttjEnpzQxyEI2y1hJ6+3t////8vT0smRcujEkwD0yuDctsTIprCsjozMywD4xxVRH5OTj/////f7/5OLho0dAsSshsTIqqSwlpSYgojEzwEU5zkM0p2BZ5ePj9ff38PHx1crIlS8opyQdpCgioCMdnS4wvUI33Uw8si8jmk1G2dXV5ODg393dwq2riSEdmSIenSAbnC4vukE32Eg6wz8zqCgdjT04zcTE083NwLW1p5CRjTY0lxgTmy0vtz830EM3vDkvtTQsniAZhC8ssaGhxL++vLKzeRgWlhYTnC8xsTs0yD0yszQqrS8nqCskjhYRiVNTjWdowbq5s5qaihwbmCYqrDYwwjctrS4lpichoCMemCAbiRoXewcFgjo2sJ+ehyknpTg+my8uuzQwqi8rqzEuqzIvqTAupy4spi4smicljyYinjY0z4uR" },
  { id: "support", name: "지원형", rgb: "1I0vzIcstYEkuIgqu4wsu4wku4okuYchtoQhtYIhs4Ihw4okvoY35rMr8swd8s8b58Ui17gt0rMr17Up3rYX3LQY1q4X2KUfwJUq+NYc8dUU6swJx7I35eXd8PDox72LwqEEzqoPxKEPx5kZyaAl+toZ4cYZ07cStZoA3NfC////qpQ/r4sAtJQWuZUPwpQZx6Al9dQQyLQ70s2yuqxlxsGnzMm8tql6wbaOua2Epn4DwI8Zx6Al784Ovag88fT/8/b/rKaGmY9p0tHJ////wrmdmXEAvo0Zx50l7ckPu6U7vrikn5FOsKqMu7apmoxdq595r6KAm3MCtocXxJsl6cUWw5ol4r4XzKoRx6EOqIQFvrWf4uTtmH0zp3sDqH0LqX8Nq3wXrYUd2bQWxqESvJQKnoMn1dXX7vL+q5x4m3AAqn8Op3wLtYoiqXoc0qwUwJsQs4sFnIM4urarvruuppl5mHEHqn4KqHwIsIcsoWogyZUduIcZtIIYpnYVlWcRj2MPmXEUrH0ZroAatI0wvJxj" },
  { id: "defense", name: "방어형", rgb: "tlR+qVBvh0RMcUI2YT4xhVU2h1c3aUI0WDcuYTw0c0o/gVNJkkhhq2JbyotZz5NZyI5SwYVGuHxEt3xHsnpJqnFGpGtDnmREgVJJz5NZ251Vx4xHtYNKxKiKzbuoqYFbnmc1nWM0nGI6k1k6lWtN2p1ZvZRlwq2W3dfR/v//////7+7uyLyzo4t6hlc6jFQ4lmtMyI1KwK2X////////+vz99vf4////////6OrreFI9gkkylmlMyYtKr5Fz9vj8/P7/sqSak35u7vDw////yMLAZDcifkYxkGFHyYxOo39d7O7wu7GreEopcj8cjHlt+vz9qZuXXSwZeUQxil1ExohQm3BL3t3dy8bCfFQ5bT4goZKK+Pz+kHx1WycUdkExiltEwIROk2I3vrWv+P3/vLWxopWP7/Hz5ujpb1FGYCoZdT8vfU08tntKlF8ziGxa3d/h7fDx6uzt7/LzoZiVViobZzEhcz4uhFhEqXJFll86dEIkfmld0tPT4+bnk4iEUywfYi4eZzIicz4tglVBqGxCk1s4h08xajUcdFNIfmRcVygYaTIhbzcmbTUjhlNE" },
];
let typeBadgeReferenceCache = null;

function postProgress(id, stage, progress = 0) {
  self.postMessage({ type: "progress", id, stage, progress });
}

function sleepTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clampRect(rect, iw, ih) {
  const x = clamp(rect.x, 0, Math.max(0, iw - 1));
  const y = clamp(rect.y, 0, Math.max(0, ih - 1));
  const w = clamp(rect.w, 1, Math.max(1, iw - x));
  const h = clamp(rect.h, 1, Math.max(1, ih - y));
  return { ...rect, x, y, w, h };
}

function badgeDescriptorFromRgb(rgb, sampleWidth = TYPE_BADGE_REF_SIZE, sampleHeight = TYPE_BADGE_REF_SIZE) {
  const luminance = new Float32Array(sampleWidth * sampleHeight);
  const chroma = new Float32Array(sampleWidth * sampleHeight * 2);
  const glyph = new Float32Array(sampleWidth * sampleHeight);
  for (let p = 0; p < luminance.length; p += 1) {
    const r = rgb[p * 3] / 255, g = rgb[p * 3 + 1] / 255, b = rgb[p * 3 + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    luminance[p] = r * 0.299 + g * 0.587 + b * 0.114;
    chroma[p * 2] = r - g;
    chroma[p * 2 + 1] = b - g;
    // The white class glyph matters as much as the tile colour. This keeps a
    // red/orange portrait or equipment star from masquerading as an attack
    // or support badge.
    glyph[p] = max > 0.58 && max - min < 0.30 ? max : 0;
  }
  return {
    luminance: normalizeVector(luminance, true),
    chroma: normalizeVector(chroma, true),
    glyph: normalizeVector(glyph, true),
  };
}

function getTypeBadgeReferences() {
  if (typeBadgeReferenceCache) return typeBadgeReferenceCache;
  typeBadgeReferenceCache = TYPE_BADGE_REFERENCE_DATA.map((item) => ({
    ...item,
    descriptor: badgeDescriptorFromRgb(rgbFromBase64(item.rgb)),
  }));
  return typeBadgeReferenceCache;
}

function badgeDescriptorDot(a, b) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) sum += a[i] * b[i];
  return sum;
}

function compareBadgeDescriptor(a, b) {
  return badgeDescriptorDot(a.luminance, b.luminance) * 0.30 +
    badgeDescriptorDot(a.chroma, b.chroma) * 0.38 +
    badgeDescriptorDot(a.glyph, b.glyph) * 0.32;
}

function sampledBadgeRgb(rgba, imageWidth, imageHeight, x, y, size) {
  const out = new Uint8Array(TYPE_BADGE_REF_SIZE * TYPE_BADGE_REF_SIZE * 3);
  let k = 0;
  for (let oy = 0; oy < TYPE_BADGE_REF_SIZE; oy += 1) {
    const sy = clamp(Math.round(y + (oy + 0.5) * size / TYPE_BADGE_REF_SIZE), 0, imageHeight - 1);
    for (let ox = 0; ox < TYPE_BADGE_REF_SIZE; ox += 1) {
      const sx = clamp(Math.round(x + (ox + 0.5) * size / TYPE_BADGE_REF_SIZE), 0, imageWidth - 1);
      const i = (sy * imageWidth + sx) * 4;
      out[k++] = rgba[i]; out[k++] = rgba[i + 1]; out[k++] = rgba[i + 2];
    }
  }
  return out;
}

function findBestTypeBadgeNearCard(sourceCanvas, seed) {
  if (!sourceCanvas || !seed?.w || !seed?.h) return null;
  const references = getTypeBadgeReferences();
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const search = clampRect({
    x: seed.x - seed.w * 0.24,
    y: seed.y + seed.h * 0.18,
    w: seed.w * 0.70,
    h: seed.h * 1.02,
  }, sourceCanvas.width, sourceCanvas.height);
  const sx = Math.floor(search.x), sy = Math.floor(search.y);
  const sw = Math.max(2, Math.ceil(search.x + search.w) - sx);
  const sh = Math.max(2, Math.ceil(search.y + search.h) - sy);
  const rgba = ctx.getImageData(sx, sy, sw, sh).data;
  let best = null;
  const sizes = [0.20, 0.235, 0.27].map((ratio) => Math.max(7, seed.w * ratio));
  const xStep = Math.max(1.5, seed.w * 0.045);
  const yStep = Math.max(1.5, seed.h * 0.050);
  for (const size of sizes) {
    for (let y = 0; y <= sh - size; y += yStep) {
      for (let x = 0; x <= sw - size; x += xStep) {
        const descriptor = badgeDescriptorFromRgb(sampledBadgeRgb(rgba, sw, sh, x, y, size));
        for (const reference of references) {
          const score = compareBadgeDescriptor(descriptor, reference.descriptor);
          if (!best || score > best.score) {
            best = { x: sx + x, y: sy + y, size, score, id: reference.id, name: reference.name };
          }
        }
      }
    }
  }
  return best;
}

function refineSelectedCardByTypeBadge(sourceCanvas, seed, references) {
  if (!seed || !references?.length) return seed;
  const badge = findBestTypeBadgeNearCard(sourceCanvas, seed);
  if (!badge || badge.score < 0.54) return seed;
  const baseMetrics = seed.metrics || seed.portraitMetrics || portraitVisualMetrics(sourceCanvas, seed);
  const baseFooter = seed.footer || baseMetrics.footer || cardFooterMetrics(sourceCanvas, seed);
  const baseMatch = quickHeroBestMatch(sourceCanvas, seed, references);
  let best = null;
  for (const scale of [0.96, 1, 1.04]) {
    const w = seed.w * scale, h = seed.h * scale;
    for (const badgeXRatio of [-0.015, 0.015, 0.045]) {
      for (const badgeYRatio of [0.48, 0.54, 0.60, 0.66]) {
        const rect = clampRect({
          ...seed,
          x: badge.x - badgeXRatio * w,
          y: badge.y - badgeYRatio * h,
          w, h,
        }, sourceCanvas.width, sourceCanvas.height);
        const metrics = portraitVisualMetrics(sourceCanvas, rect);
        const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
        if (metrics.emptyLike || metrics.std < 28 || (footer.edgeRatio < 0.016 && footer.colorfulRatio < 0.018)) continue;
        const heroMatch = quickHeroBestMatch(sourceCanvas, rect, references);
        const movement = Math.hypot(rect.x - seed.x, rect.y - seed.y) / Math.max(1, seed.w);
        const score = Math.max(0, heroMatch.score) * 2.25 + Math.max(0, heroMatch.margin || 0) * 0.32 +
          Math.min(1, footer.blackAnchorRatio || 0) * 0.34 + Math.min(0.45, footer.colorfulRatio || 0) * 0.24 - movement * 0.08;
        if (!best || score > best.score) best = { ...rect, metrics, portraitMetrics: metrics, footer, heroMatch, score };
      }
    }
  }
  if (!best?.heroMatch) return { ...seed, typeBadgeScore: badge.score, typeBadgeName: badge.name };
  const moved = Math.hypot(best.x - seed.x, best.y - seed.y) > Math.max(1.5, seed.w * 0.025);
  if (!moved) return { ...seed, typeBadgeScore: badge.score, typeBadgeName: badge.name };
  const referenceGain = best.heroMatch.score - baseMatch.score;
  const footerGain = (best.footer?.blackAnchorRatio || 0) - (baseFooter.blackAnchorRatio || 0);
  const strictBadge = badge.score >= 0.63;
  const referenceBetter = referenceGain >= 0.038 ||
    (baseMatch.score < 0.82 && referenceGain >= 0.018 && best.heroMatch.margin >= 0.020);
  const missingFooterRecovered = (baseFooter.blackAnchorRatio || 0) < 0.12 &&
    (best.footer?.blackAnchorRatio || 0) >= 0.42 && footerGain >= 0.24 && best.heroMatch.score >= 0.72;
  if (!strictBadge || best.heroMatch.score < 0.56 || (!referenceBetter && !missingFooterRecovered)) {
    return { ...seed, typeBadgeScore: badge.score, typeBadgeName: badge.name };
  }
  return {
    ...best,
    validUi: true,
    heroSimilarity: best.heroMatch.score,
    heroMargin: best.heroMatch.margin || 0,
    heroNameHint: best.heroMatch.name || "",
    typeBadgeScore: badge.score,
    typeBadgeName: badge.name,
    typeBadgeRecovery: true,
  };
}

function rectIou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, x2 - x1);
  const ih = Math.max(0, y2 - y1);
  const inter = iw * ih;
  if (!inter) return 0;
  return inter / Math.max(1, a.w * a.h + b.w * b.h - inter);
}

function normalizeCard(rect, iw, ih) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const side = Math.max(rect.w, rect.h) * 1.035;
  return clampRect({ x: cx - side / 2, y: cy - side / 2, w: side, h: side, rawRect: rect }, iw, ih);
}

function nicknameCropFromCards(cards, iw, ih, profile = "") {
  if (!cards?.length) return null;
  const sides = cards.map((c) => Math.max(c.w, c.h)).sort((a, b) => a - b);
  const side = sides[Math.floor(sides.length / 2)] || ih * 0.07;
  const minX = Math.min(...cards.map((c) => c.x));
  const minY = Math.min(...cards.map((c) => c.y));
  // practice 화면은 카드와 헤더가 가깝고, guild-menu/middle 화면은 헤더가 훨씬 위에 있다.
  // v8.3은 모든 화면에 1.72배를 써서 2048x955 계열에서 닉네임 아래를 잘라버렸다.
  const headerFar = /guild|middle/.test(String(profile || ""));
  const yFactor = headerFar ? 3.05 : 2.85;
  const hFactor = headerFar ? 1.30 : 1.16;
  return clampRect({
    x: minX - side * 0.24,
    y: minY - side * yFactor,
    w: side * 3.34,
    h: side * hFactor,
  }, iw, ih);
}

function nicknameCropFromDetectedPanel(sourceCanvas, panel, gridH, cards, iw, ih) {
  if (!sourceCanvas || !panel || !cards?.length) return nicknameCropFromPanel(panel, gridH, iw, ih);

  const sides = cards.map((card) => Math.max(card.w, card.h)).sort((a, b) => a - b);
  const side = sides[Math.floor(sides.length / 2)] || Math.max(16, gridH * 0.12);
  const minCardY = Math.min(...cards.map((card) => card.y));
  // The circular refresh button occupies the far-right side of the panel
  // header. Long names reach close to it, so the OCR crop must stop before
  // the icon instead of relying on OCR to ignore the icon's bright strokes.
  const headerLeft = panel.x + panel.w * 0.035;
  const headerRight = panel.x + panel.w * 0.845;
  const safeHeaderFallback = () => {
    // Anchor the fallback to the detected panel top. Card-relative fallback
    // alone can climb into the global system-notification ticker on tall PC
    // screenshots when the first occupied card is unusually low.
    const y1 = Math.max(0, panel.y - side * 0.22);
    const y2 = Math.max(
      y1 + side * 0.65,
      Math.min(minCardY - side * 1.18, panel.y + side * 0.72),
    );
    return clampRect({
      x: headerLeft,
      y: y1,
      w: Math.max(1, headerRight - headerLeft),
      h: y2 - y1,
    }, iw, ih);
  };
  const searchRect = clampRect({
    x: headerLeft,
    y: minCardY - side * 3.55,
    w: Math.max(1, headerRight - headerLeft),
    h: side * 2.78,
  }, iw, ih);
  if (!searchRect || searchRect.w < 12 || searchRect.h < 10) return nicknameCropFromPanel(panel, gridH, iw, ih);

  const scale = Math.min(1, 420 / Math.max(1, searchRect.w));
  const sw = Math.max(80, Math.round(searchRect.w * scale));
  const sh = Math.max(24, Math.round(searchRect.h * scale));
  const canvas = makeCanvas(sw, sh);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, searchRect.x, searchRect.y, searchRect.w, searchRect.h, 0, 0, sw, sh);
  const rgba = ctx.getImageData(0, 0, sw, sh).data;
  const mask = new Uint8Array(sw * sh);
  const rowCounts = new Uint16Array(sh);

  for (let y = 0; y < sh; y += 1) {
    let rowCount = 0;
    for (let x = 0; x < sw; x += 1) {
      const i = (y * sw + x) * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      // Nicknames are rendered in bright cream/white. This also keeps pale
      // anti-aliased edges while rejecting the purple panel background.
      if (lum >= 158 && max - min <= 92 && r >= b * 0.82) {
        mask[y * sw + x] = 1;
        rowCount += 1;
      }
    }
    rowCounts[y] = rowCount;
  }

  const scaledSide = side * scale;
  const minBandH = Math.max(8, Math.round(scaledSide * 0.24));
  const maxBandH = Math.max(minBandH, Math.round(scaledSide * 0.62));
  const expectedCenter = ((panel.x + panel.w * 0.5) - searchRect.x) / searchRect.w * sw;
  let best = null;

  for (let bandH = minBandH; bandH <= maxBandH; bandH += Math.max(2, Math.round(scaledSide * 0.06))) {
    for (let y0 = 0; y0 + bandH <= sh; y0 += 2) {
      const colCounts = new Uint16Array(sw);
      let active = 0, activeRows = 0, peakRow = 0;
      for (let y = y0; y < y0 + bandH; y += 1) {
        const rowCount = rowCounts[y];
        active += rowCount;
        peakRow = Math.max(peakRow, rowCount);
        if (rowCount >= 3) activeRows += 1;
        for (let x = 0; x < sw; x += 1) colCounts[x] += mask[y * sw + x];
      }
      if (activeRows < Math.max(4, bandH * 0.24) || active < bandH * 1.4) continue;

      const minColPixels = Math.max(2, Math.round(bandH * 0.10));
      const activeCols = [];
      for (let x = 0; x < sw; x += 1) if (colCounts[x] >= minColPixels) activeCols.push(x);
      if (activeCols.length < Math.max(4, sw * 0.025)) continue;
      const minX = activeCols[0], maxX = activeCols[activeCols.length - 1];
      const textWidth = maxX - minX + 1;
      const widthRatio = textWidth / sw;
      if (widthRatio < 0.06 || widthRatio > 0.86) continue;
      const center = (minX + maxX) / 2;
      const centerOffset = Math.abs(center - expectedCenter) / Math.max(1, sw);
      const borderLike = peakRow > sw * 0.70 ? 1 : 0;
      const bottomRatio = (y0 + bandH / 2) / sh;
      const bandCenterY = searchRect.y + (y0 + bandH / 2) / scale;
      const cardDistance = (minCardY - bandCenterY) / Math.max(1, side);
      // System notifications sit above the opponent panel and can be wider
      // and brighter than the actual nickname. Use card size for tolerance:
      // gridH can cover the whole panel, which previously allowed the global
      // notification row to pass on 1440x720 team-composition screenshots.
      // The diamond ornament sits on the panel's top border and can resemble
      // one bright Hangul syllable. A real nickname baseline is always inside
      // the header, not centred on or above that border.
      if (bandCenterY < panel.y + side * 0.06) continue;
      // The combat-power pill is normally only about one card-height above
      // the first portrait. The nickname header is always farther away.
      if (cardDistance < 1.75) continue;
      // The power/currency pill sits right of centre and below the nickname.
      // Prefer a compact, centred text band and only use vertical position as
      // a gentle tie-breaker so partially cropped panels still work.
      const score = active + activeRows * 3.0 + Math.min(textWidth, sw * 0.58) * 0.75 -
        centerOffset * sw * 5.4 - borderLike * sw * 1.4 - bottomRatio * sw * 0.10;
      if (!best || score > best.score) best = { score, y0, bandH, minX, maxX, centerOffset, widthRatio };
    }
  }

  if (!best || best.centerOffset > 0.25) return safeHeaderFallback();
  const inv = 1 / scale;
  const padX = Math.max(side * 0.18, (best.maxX - best.minX) * inv * 0.14);
  const padY = Math.max(side * 0.10, best.bandH * inv * 0.20);
  const cropX = Math.max(headerLeft, searchRect.x + best.minX * inv - padX);
  const cropRight = Math.min(headerRight, searchRect.x + (best.maxX + 1) * inv + padX);
  return clampRect({
    x: cropX,
    y: searchRect.y + best.y0 * inv - padY,
    w: Math.max(1, cropRight - cropX),
    h: best.bandH * inv + padY * 2,
  }, iw, ih);
}

function makeCanvas(w, h) {
  return new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function canvasFromBitmap(bitmap) {
  const canvas = makeCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

function occupancyScore(sourceCanvas, rect) {
  const w = 49, h = 53;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const count = w * h;
  const lum = new Float32Array(count);
  let satTotal = 0, mean = 0, bottomSat = 0, bottomCount = 0;
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max > 0 ? ((max - min) / max) * 255 : 0;
    const v = r * 0.299 + g * 0.587 + b * 0.114;
    lum[p] = v;
    satTotal += sat;
    mean += v;
    if (Math.floor(p / w) >= 36) {
      bottomCount += 1;
      if (sat > 100) bottomSat += 1;
    }
  }
  mean /= count;
  let variance = 0, edges = 0, edgeCount = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const d = lum[idx] - mean;
      variance += d * d;
      if (x + 1 < w) { edgeCount += 1; if (Math.abs(lum[idx] - lum[idx + 1]) > 38) edges += 1; }
      if (y + 1 < h) { edgeCount += 1; if (Math.abs(lum[idx] - lum[idx + w]) > 38) edges += 1; }
    }
  }
  const std = Math.sqrt(variance / count);
  const satMean = satTotal / count;
  const bottomRatio = bottomCount ? bottomSat / bottomCount : 0;
  const edgeRatio = edgeCount ? edges / edgeCount : 0;
  return satMean * 0.45 + std * 0.25 + bottomRatio * 35 + edgeRatio * 30;
}



function localCardFrameScore(sourceCanvas, rect) {
  const w = 44, h = 48;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  let mean = 0, satSum = 0;
  for (let p = 0, i = 0; p < lum.length; p += 1, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    lum[p] = r * 0.299 + g * 0.587 + b * 0.114;
    mean += lum[p];
    satSum += max > 0 ? ((max - min) / max) * 255 : 0;
  }
  mean /= lum.length;
  let variance = 0;
  for (let i = 0; i < lum.length; i += 1) { const d = lum[i] - mean; variance += d * d; }
  const std = Math.sqrt(variance / lum.length);

  let leftEdge = 0, rightEdge = 0, topEdge = 0, bottomEdge = 0;
  let verticalN = 0, horizontalN = 0, footerEdges = 0, footerN = 0;
  for (let y = 3; y < h - 3; y += 1) {
    const li = y * w + 2, ri = y * w + (w - 3);
    leftEdge += Math.abs(lum[li + 1] - lum[li - 1]);
    rightEdge += Math.abs(lum[ri + 1] - lum[ri - 1]);
    verticalN += 1;
  }
  for (let x = 3; x < w - 3; x += 1) {
    const ti = 2 * w + x, bi = (h - 3) * w + x;
    topEdge += Math.abs(lum[ti + w] - lum[ti - w]);
    bottomEdge += Math.abs(lum[bi + w] - lum[bi - w]);
    horizontalN += 1;
  }
  const fy0 = Math.floor(h * 0.62);
  for (let y = fy0; y < h - 2; y += 1) {
    for (let x = 2; x < w - 2; x += 1) {
      const i = y * w + x;
      footerN += 2;
      if (Math.abs(lum[i] - lum[i + 1]) > 22) footerEdges += 1;
      if (Math.abs(lum[i] - lum[i + w]) > 22) footerEdges += 1;
    }
  }
  const border = ((leftEdge + rightEdge) / Math.max(1, verticalN) + (topEdge + bottomEdge) / Math.max(1, horizontalN)) * 0.5;
  const footerEdgeRatio = footerEdges / Math.max(1, footerN);
  const saturation = satSum / lum.length;
  // 실제 영웅 카드는 테두리 + 내부 일러스트 + 하단 별/LV UI가 모두 존재한다.
  // 너무 큰 crop은 양옆 패널 배경 때문에 테두리 점수가 떨어지고, 빈 슬롯은 내부 표준편차가 낮다.
  return border * 0.72 + std * 0.58 + footerEdgeRatio * 85 + saturation * 0.035;
}

function localPeaks(profile, from, to, maxCount = 12) {
  const peaks = [];
  const smooth = (i) => {
    let sum = 0, n = 0;
    for (let k = -2; k <= 2; k += 1) {
      const j = i + k;
      if (j >= 0 && j < profile.length) { sum += profile[j]; n += 1; }
    }
    return sum / Math.max(1, n);
  };
  const lo = Math.max(2, Math.floor(from));
  const hi = Math.min(profile.length - 3, Math.ceil(to));
  for (let i = lo; i <= hi; i += 1) {
    const v = smooth(i);
    if (v >= smooth(i - 1) && v >= smooth(i + 1)) peaks.push({ i, v });
  }
  peaks.sort((a, b) => b.v - a.v);
  const kept = [];
  for (const p of peaks) {
    if (kept.some((q) => Math.abs(q.i - p.i) < 3)) continue;
    kept.push(p);
    if (kept.length >= maxCount) break;
  }
  return kept;
}

function bestEdgePairs(profile, expectedCenter, expectedSize, minFactor, maxFactor, maxPairs = 5) {
  const peaks = localPeaks(profile, expectedCenter - expectedSize * 1.15, expectedCenter + expectedSize * 1.15, 16);
  const pairs = [];
  const minSize = expectedSize * minFactor;
  const maxSize = expectedSize * maxFactor;
  for (let a = 0; a < peaks.length; a += 1) {
    for (let b = a + 1; b < peaks.length; b += 1) {
      const p1 = peaks[a], p2 = peaks[b];
      const left = Math.min(p1.i, p2.i), right = Math.max(p1.i, p2.i);
      const size = right - left;
      if (size < minSize || size > maxSize) continue;
      const center = (left + right) / 2;
      const sizePenalty = Math.abs(size - expectedSize) / Math.max(1, expectedSize) * 0.22;
      const centerPenalty = Math.abs(center - expectedCenter) / Math.max(1, expectedSize) * 0.30;
      const strength = (p1.v + p2.v) / 2;
      const score = strength * (1 - Math.min(0.72, sizePenalty + centerPenalty));
      pairs.push({ a: left, b: right, score, strength });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  return pairs.slice(0, maxPairs);
}

function edgePairCandidates(sourceCanvas, seed, iw, ih, profile = "") {
  // 15월의 인식엔진 1.0.0
  // 좌/우 테두리로 실제 카드 폭을 먼저 결정한 뒤, 그 폭에서 예상되는 '거의 정사각형' 카드 높이를 기준으로
  // 위/아래 테두리를 다시 찾는다. 패널 전체의 가로선을 보는 기존 방식보다 닉네임/전투력/빈 슬롯 선에 덜 끌린다.
  const padX = seed.w * 0.42;
  const padY = seed.h * 0.36;
  const region = clampRect({ x: seed.x - padX, y: seed.y - padY, w: seed.w + padX * 2, h: seed.h + padY * 2 }, iw, ih);
  const sw = 112, sh = 128;
  const c = makeCanvas(sw, sh);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, region.x, region.y, region.w, region.h, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;
  const lum = new Float32Array(sw * sh);
  for (let p = 0, i = 0; p < lum.length; p += 1, i += 4) lum[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

  const seedCx = ((seed.x + seed.w / 2) - region.x) / region.w * sw;
  const seedCy = ((seed.y + seed.h / 2) - region.y) / region.h * sh;
  const seedW = seed.w / region.w * sw;

  // 1) 좌/우 테두리: 세로 방향 대부분을 사용하되, 상하 UI 간섭을 줄이기 위해 바깥 12%는 제외한다.
  const vProf = new Float32Array(sw);
  const vy0 = Math.floor(sh * 0.12), vy1 = Math.floor(sh * 0.88);
  for (let x = 1; x < sw; x += 1) {
    let sum = 0;
    for (let y = vy0; y < vy1; y += 1) sum += Math.abs(lum[y * sw + x] - lum[y * sw + x - 1]);
    vProf[x] = sum / Math.max(1, vy1 - vy0);
  }
  const xpairs = bestEdgePairs(vProf, seedCx, seedW, 0.44, 1.24, 6);
  const out = [];

  for (const xp of xpairs) {
    const xWidth = Math.max(2, xp.b - xp.a);
    const origWidth = region.w * (xWidth / sw);
    // 실제 길드전 영웅 카드는 별/LV 영역까지 포함하면 거의 정사각형이다.
    // 폭을 먼저 믿고 높이를 0.96~1.12배 안에서만 찾으면 위/아래가 엉뚱한 UI 선으로 튀는 걸 막을 수 있다.
    const expectedOrigH = origWidth * 1.035;
    const expectedH = expectedOrigH / region.h * sh;

    // 2) 위/아래 테두리: 방금 찾은 좌/우 테두리 '안쪽'에서만 수평 엣지를 계산한다.
    // 이게 핵심. 옆 빈 슬롯, 패널 헤더, 전투력 선은 점수에 거의 들어오지 않는다.
    const hProf = new Float32Array(sh);
    const innerPad = Math.max(2, Math.round(xWidth * 0.10));
    const hx0 = clamp(Math.round(xp.a + innerPad), 1, sw - 2);
    const hx1 = clamp(Math.round(xp.b - innerPad), hx0 + 1, sw - 1);
    for (let y = 1; y < sh; y += 1) {
      let sum = 0;
      for (let x = hx0; x < hx1; x += 1) sum += Math.abs(lum[y * sw + x] - lum[(y - 1) * sw + x]);
      hProf[y] = sum / Math.max(1, hx1 - hx0);
    }

    const ypairs = bestEdgePairs(hProf, seedCy, expectedH, 0.90, 1.13, 5);
    for (const yp of ypairs) {
      const rect = clampRect({
        x: region.x + region.w * (xp.a / sw),
        y: region.y + region.h * (yp.a / sh),
        w: region.w * ((xp.b - xp.a) / sw),
        h: region.h * ((yp.b - yp.a) / sh),
        slotKey: seed.slotKey,
      }, iw, ih);
      if (!rectWithinPanelBounds(rect, iw, ih, profile)) continue;
      if (isBottomRosterLike(sourceCanvas, rect, iw, ih)) continue;

      const aspect = rect.h / Math.max(1, rect.w);
      if (aspect < 0.91 || aspect > 1.17) continue;
      const metrics = portraitVisualMetrics(sourceCanvas, rect);
      if (metrics.emptyLike) continue;
      const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
      const frameScore = localCardFrameScore(sourceCanvas, rect);
      const pairStrength = xp.score + yp.score;
      const centerDx = Math.abs((rect.x + rect.w / 2) - (seed.x + seed.w / 2)) / Math.max(1, seed.w);
      const centerDy = Math.abs((rect.y + rect.h / 2) - (seed.y + seed.h / 2)) / Math.max(1, seed.h);
      const aspectPenalty = Math.abs(aspect - 1.035) * 32;
      // 위/아래 위치는 하단 별/LV UI가 실제 crop 안에 들어왔는지 footer 점수로 한 번 더 확인한다.
      const score = pairStrength * 1.55 + frameScore * 0.66 + metrics.portraitScore * 0.14 + footer.edgeRatio * 48 + footer.colorfulRatio * 11 - (centerDx * 5 + centerDy * 7) - aspectPenalty;
      out.push({ ...rect, score, edgePairScore: pairStrength, frameScore, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer, snapped: true, aspect });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 5);
}

function fitCardBoxAdaptive(sourceCanvas, seed, iw, ih, profile = "") {
  const candidates = edgePairCandidates(sourceCanvas, seed, iw, ih, profile);
  if (candidates.length) return candidates[0];
  return seed;
}

function snapCardToLocalFrame(sourceCanvas, seed, iw, ih, profile = "") {
  // 1.0.0: 카드 중심을 소폭만 흔들고, 실제 테두리 쌍이 만든 박스만 사용한다.
  // 과도한 상하 이동은 같은 카드를 두 슬롯에서 중복으로 잡는 원인이므로 제한한다.
  const centerSeeds = [
    seed,
    { ...seed, x: seed.x - seed.w * 0.08 },
    { ...seed, x: seed.x + seed.w * 0.08 },
    { ...seed, y: seed.y - seed.h * 0.055 },
    { ...seed, y: seed.y + seed.h * 0.055 },
  ];
  let best = null;
  for (const s of centerSeeds) {
    const candidates = edgePairCandidates(sourceCanvas, s, iw, ih, profile);
    for (const rect of candidates.slice(0, 3)) {
      const dx = (rect.x + rect.w / 2) - (seed.x + seed.w / 2);
      const dy = (rect.y + rect.h / 2) - (seed.y + seed.h / 2);
      const drift = Math.hypot(dx, dy) / Math.max(1, seed.w);
      const verticalPenalty = Math.abs(dy) / Math.max(1, seed.h) * 6;
      const score = rect.score - drift * 4.5 - verticalPenalty;
      if (!best || score > best.score) best = { ...rect, score };
    }
  }
  return best || seed;
}

function cardFooterMetrics(sourceCanvas, rect) {
  const w = 56, h = 60;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const y0 = Math.floor(h * 0.64), y1 = h - 2;
  const lum = new Float32Array(w * h);
  for (let y = y0; y < y1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = (y * w + x) * 4;
      lum[y * w + x] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
  }
  let edges = 0, edgeCount = 0, colorful = 0, bright = 0, count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = 2; x < w - 2; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const saturation = max > 0 ? (max - min) / max : 0;
      const l = lum[y * w + x];
      count += 1;
      if (saturation > 0.35 && l > 78) colorful += 1;
      if (l > 150) bright += 1;
      edgeCount += 2;
      if (Math.abs(l - lum[y * w + x + 1]) > 24) edges += 1;
      if (y + 1 < y1 && Math.abs(l - lum[(y + 1) * w + x]) > 24) edges += 1;
    }
  }
  const edgeRatio = edges / Math.max(1, edgeCount);
  const colorfulRatio = colorful / Math.max(1, count);
  const brightRatio = bright / Math.max(1, count);
  // The star/equipment footer has at least one almost-black horizontal row.
  // Its exact y-position moves with aspect ratio and formation, so use the
  // strongest row in the lower 30% as a stable bottom anchor.
  let blackAnchorRatio = 0;
  for (let y = Math.floor(h * 0.70); y < h - 1; y += 1) {
    let black = 0, rowCount = 0;
    for (let x = 2; x < w - 2; x += 1) {
      const i = (y * w + x) * 4;
      const l = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      rowCount += 1;
      if (l < 42) black += 1;
    }
    blackAnchorRatio = Math.max(blackAnchorRatio, black / Math.max(1, rowCount));
  }
  const score = edgeRatio * 100 + colorfulRatio * 22 + brightRatio * 7;
  // 실제 영웅 카드는 하단의 별/LV/+강화 UI 때문에 가로·세로 엣지가 반드시 생긴다.
  // 빈 빨간 슬롯이나 회색 + 슬롯은 이 값이 매우 낮다.
  const uiLike = edgeRatio >= 0.032 || (edgeRatio >= 0.022 && colorfulRatio >= 0.12);
  return { edgeRatio, colorfulRatio, brightRatio, blackAnchorRatio, score, uiLike };
}

function portraitVisualMetrics(sourceCanvas, rect) {
  const w = 56, h = 60;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const x0 = 4, x1 = w - 4, y0 = 4, y1 = Math.round(h * 0.76);
  const rw = x1 - x0, rh = y1 - y0;
  const lum = new Float32Array(rw * rh);
  const bins = new Uint8Array(512);
  let sum = 0, satSum = 0, p = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max > 0 ? ((max - min) / max) * 255 : 0;
      const v = r * 0.299 + g * 0.587 + b * 0.114;
      lum[p++] = v;
      sum += v;
      satSum += sat;
      bins[((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)] = 1;
    }
  }

  const count = Math.max(1, p);
  const mean = sum / count;
  let variance = 0, edges = 0, edgeCount = 0;
  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      const idx = y * rw + x;
      const d = lum[idx] - mean;
      variance += d * d;
      if (x + 1 < rw) { edgeCount += 1; if (Math.abs(lum[idx] - lum[idx + 1]) > 25) edges += 1; }
      if (y + 1 < rh) { edgeCount += 1; if (Math.abs(lum[idx] - lum[idx + rw]) > 25) edges += 1; }
    }
  }

  let uniqueBins = 0;
  for (let i = 0; i < bins.length; i += 1) uniqueBins += bins[i];
  const std = Math.sqrt(variance / count);
  const edgeRatio = edgeCount ? edges / edgeCount : 0;
  const saturation = satSum / count;
  const footer = cardFooterMetrics(sourceCanvas, rect);

  const portraitScore = std + edgeRatio * 100 + Math.min(120, uniqueBins) * 0.30 + saturation * 0.08 + footer.edgeRatio * 34;
  const emptyLike = (std < 17 && edgeRatio < 0.015 && uniqueBins < 18) || (!footer.uiLike && std < 30 && uniqueBins < 35);
  return { portraitScore, std, edgeRatio, uniqueBins, saturation, emptyLike, footer };
}

function hardPanelBounds(iw, ih, profile = "") {
  const id = String(profile || "");
  let left = iw * 0.585;
  let right = iw * 0.735;
  let top = ih * 0.205;
  let bottom = ih * 0.635;
  if (/left-menu|guild/.test(id)) {
    left = iw * 0.605;
    right = iw * 0.755;
    top = ih * 0.205;
    bottom = ih * 0.635;
  } else if (/team-compose|guildwar-vs/.test(id)) {
    left = iw * 0.515;
    right = iw * 0.675;
    top = ih * 0.205;
    bottom = ih * 0.615;
  } else if (/middle/.test(id)) {
    left = iw * 0.595;
    right = iw * 0.745;
    top = ih * 0.195;
    bottom = ih * 0.63;
  }
  return { left, right, top, bottom };
}

function rectWithinPanelBounds(rect, iw, ih, profile = "") {
  const b = hardPanelBounds(iw, ih, profile);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const bottom = rect.y + rect.h;
  return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom && bottom <= b.bottom + rect.h * 0.24;
}

function bandMetrics(sourceCanvas, rect) {
  const c = makeCanvas(rect.w, rect.h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const data = ctx.getImageData(0, 0, rect.w, rect.h).data;
  let mean = 0, count = rect.w * rect.h, bright = 0, satBright = 0, edge = 0, edgeCount = 0;
  const lum = new Float32Array(count);
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max > 0 ? ((max - min) / max) * 255 : 0;
    const v = r * 0.299 + g * 0.587 + b * 0.114;
    lum[p] = v;
    mean += v;
    if (v > 150) bright += 1;
    if (v > 120 && sat > 40) satBright += 1;
  }
  mean /= Math.max(1, count);
  for (let y = 0; y < rect.h; y += 1) {
    for (let x = 0; x < rect.w; x += 1) {
      const idx = y * rect.w + x;
      if (x + 1 < rect.w) { edgeCount += 1; if (Math.abs(lum[idx] - lum[idx + 1]) > 24) edge += 1; }
      if (y + 1 < rect.h) { edgeCount += 1; if (Math.abs(lum[idx] - lum[idx + rect.w]) > 24) edge += 1; }
    }
  }
  return { mean, brightRatio: bright / Math.max(1, count), satBrightRatio: satBright / Math.max(1, count), edgeRatio: edge / Math.max(1, edgeCount) };
}

function detectScreenContext(sourceCanvas, iw, ih) {
  const leftMenuRect = { x: Math.round(iw * 0.01), y: Math.round(ih * 0.13), w: Math.max(12, Math.round(iw * 0.17)), h: Math.max(12, Math.round(ih * 0.42)) };
  const bottomBarRect = { x: Math.round(iw * 0.12), y: Math.round(ih * 0.72), w: Math.max(12, Math.round(iw * 0.76)), h: Math.max(12, Math.round(ih * 0.18)) };
  const titleRect = { x: Math.round(iw * 0.02), y: Math.round(ih * 0.01), w: Math.max(12, Math.round(iw * 0.24)), h: Math.max(12, Math.round(ih * 0.13)) };
  const leftM = bandMetrics(sourceCanvas, leftMenuRect);
  const bottomM = bandMetrics(sourceCanvas, bottomBarRect);
  const titleM = bandMetrics(sourceCanvas, titleRect);
  const aspect = iw / Math.max(1, ih);
  const hasLeftMenu = leftM.brightRatio > 0.14 && leftM.edgeRatio > 0.025;
  const heavyBottomBar = bottomM.brightRatio > 0.18 && bottomM.edgeRatio > 0.035;
  const brightTitle = titleM.brightRatio > 0.10;
  let family = hasLeftMenu ? "left-menu" : "practice";
  if (!hasLeftMenu && heavyBottomBar && brightTitle && aspect > 1.7) family = "team-compose";
  if (!hasLeftMenu && !heavyBottomBar && aspect > 1.7) family = "guildwar-vs";
  if (!hasLeftMenu && aspect > 2.0) family = "middle";
  return { family, hasLeftMenu, heavyBottomBar, brightTitle, aspect };
}

function preferredHeightProfiles(sourceCanvas, iw, ih) {
  const ctx = detectScreenContext(sourceCanvas, iw, ih);
  const preferred = [ctx.family, "practice", "middle", "left-menu", "team-compose", "guildwar-vs"];
  const order = [...new Set(preferred)];
  const out = [];
  for (const family of order) out.push(...HEIGHT_GEOMETRY_PROFILES.filter((p) => p.family === family));
  return out.length ? out : HEIGHT_GEOMETRY_PROFILES;
}

function isBottomRosterLike(sourceCanvas, rect, iw, ih) {
  // 하단 덱 바 판별은 진짜 화면 하단 후보에만 적용한다.
  // 상대 패널 내부에서 세로로 붙은 영웅 카드가 다음 카드 때문에 오인되는 것을 막는다.
  if ((rect.y + rect.h / 2) < ih * 0.62) return false;
  const gapY = rect.y + rect.h + rect.h * 0.03;
  const h = Math.round(rect.h * 0.18);
  if (gapY + h >= ih) return false;
  const sample = clampRect({ x: rect.x, y: gapY, w: rect.w, h }, iw, ih);
  const m = bandMetrics(sourceCanvas, sample);
  return m.mean < 92 && m.edgeRatio > 0.045;
}

function plausibleHeroPosition(rect, iw, ih, profile = "") {
  if(rect?.searchMode === "adaptive-anchor") {
    const cx=(rect.x+rect.w/2)/Math.max(1,iw), cy=(rect.y+rect.h/2)/Math.max(1,ih);
    return cx>=0.535 && cx<=0.82 && cy>=0.23 && cy<=0.66 && !(cx>0.705 && cy<0.43);
  }
  return rectWithinPanelBounds(rect, iw, ih, profile);
}

function isPlausibleHeroCard(sourceCanvas, rect, iw, ih, minScore = 43, profile = "") {
  if (!plausibleHeroPosition(rect, iw, ih, profile)) return false;
  if (isBottomRosterLike(sourceCanvas, rect, iw, ih)) return false;
  const metrics = rect.portraitMetrics || portraitVisualMetrics(sourceCanvas, rect);
  const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
  const similarityOk = Number.isFinite(rect.heroSimilarity) && rect.heroSimilarity >= 0.44;
  return !metrics.emptyLike && metrics.portraitScore >= minScore && (footer.uiLike || similarityOk);
}

function refineCardVisual(sourceCanvas, card, iw, ih) {
  let best = null;
  const baseW = card.w, baseH = card.h;
  for (const scale of [0.96, 1, 1.04]) {
    const w = baseW * scale, h = baseH * scale;
    for (const fy of [-0.12, 0, 0.12]) {
      for (const fx of [-0.12, 0, 0.12]) {
        const cx = card.x + baseW / 2 + fx * baseW;
        const cy = card.y + baseH / 2 + fy * baseH;
        const rect = clampRect({ ...card, x: cx - w / 2, y: cy - h / 2, w, h }, iw, ih);
        const m = portraitVisualMetrics(sourceCanvas, rect);
        const footer = m.footer || cardFooterMetrics(sourceCanvas, rect);
        const score = m.portraitScore + footer.edgeRatio * 52 + footer.colorfulRatio * 7 - (Math.abs(fx) + Math.abs(fy)) * 3 - Math.abs(scale - 1) * 10;
        if (!best || score > best.score) best = { ...rect, score, portraitMetrics: m, portraitScore: m.portraitScore };
      }
    }
  }
  return best || card;
}

function chooseCards(sourceCanvas, iw, ih, rawCandidates) {
  const scored = [];
  for (const raw of rawCandidates) {
    const rect = normalizeCard(raw, iw, ih);
    if (!plausibleHeroPosition(rect, iw, ih, "")) continue;
    if (isBottomRosterLike(sourceCanvas, rect, iw, ih)) continue;
    const metrics = portraitVisualMetrics(sourceCanvas, rect);
    if (metrics.emptyLike || metrics.portraitScore < 43) continue;
    const occupancy = occupancyScore(sourceCanvas, rect);
    const aspect = Math.min(raw.w, raw.h) / Math.max(raw.w, raw.h);
    const squareness = clamp((aspect - 0.64) / 0.36, 0, 1);
    // 사각형 모양보다 실제 일러스트의 복잡도를 훨씬 중요하게 둔다.
    const score = metrics.portraitScore * 0.78 + occupancy * 0.22 + squareness * 4.5;
    scored.push({ ...rect, occupancy, portraitMetrics: metrics, portraitScore: metrics.portraitScore, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const deduped = [];
  for (const candidate of scored) {
    const duplicate = deduped.some((kept) => {
      const dx = (candidate.x + candidate.w / 2) - (kept.x + kept.w / 2);
      const dy = (candidate.y + candidate.h / 2) - (kept.y + kept.h / 2);
      return rectIou(candidate, kept) > 0.38 || Math.hypot(dx, dy) < Math.min(candidate.w, kept.w) * 0.28;
    });
    if (!duplicate) deduped.push(candidate);
    if (deduped.length >= 12) break;
  }

  let bestCombo = null;
  const pool = deduped.slice(0, 9);
  for (let a = 0; a < pool.length; a += 1) {
    for (let b = a + 1; b < pool.length; b += 1) {
      for (let c = b + 1; c < pool.length; c += 1) {
        const combo = [pool[a], pool[b], pool[c]];
        const sides = combo.map((x) => Math.max(x.w, x.h));
        const maxSide = Math.max(...sides), minSide = Math.min(...sides);
        if (maxSide > minSide * 1.38) continue;
        const xs = combo.map((x) => x.x + x.w / 2).sort((x, y) => x - y);
        const ys = combo.map((x) => x.y + x.h / 2).sort((x, y) => x - y);
        const side = sides.reduce((s, x) => s + x, 0) / sides.length;
        const twoColumnPenalty = Math.min(xs[1] - xs[0], xs[2] - xs[1]) > side * 0.82 ? 24 : 0;
        const tooFlatPenalty = (ys[2] - ys[0]) < side * 0.30 ? 18 : 0;
        const sizePenalty = ((maxSide - minSide) / Math.max(1, side)) * 32;
        const objective = combo.reduce((s, x) => s + x.score, 0) - twoColumnPenalty - tooFlatPenalty - sizePenalty;
        if (!bestCombo || objective > bestCombo.objective) bestCombo = { objective, combo };
      }
    }
  }
  const selectedBase = bestCombo?.combo || deduped.slice(0, 3);
  const cards = selectedBase.map((x) => refineCardVisual(sourceCanvas, x, iw, ih)).sort((a, b) => a.y - b.y || a.x - b.x);
  const fourth = deduped.find((x) => !selectedBase.includes(x));
  const quality = cards.length === 3 ? Math.max(0, Math.min(...cards.map((x) => x.portraitScore || 0)) - (fourth?.portraitScore || 0)) : 0;
  return { cards, quality, candidateCount: deduped.length, objective: bestCombo?.objective || 0 };
}

function connectedComponents(binary, w, h) {
  const seen = new Uint8Array(binary.length);
  const queue = new Int32Array(binary.length);
  const boxes = [];
  for (let start = 0; start < binary.length; start += 1) {
    if (!binary[start] || seen[start]) continue;
    let qh = 0, qt = 0;
    queue[qt++] = start;
    seen[start] = 1;
    let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
    while (qh < qt) {
      const idx = queue[qh++];
      const y = Math.floor(idx / w), x = idx - y * w;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      count += 1;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy += 1) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx += 1) {
          const ni = yy * w + xx;
          if (binary[ni] && !seen[ni]) { seen[ni] = 1; queue[qt++] = ni; }
        }
      }
    }
    if (count >= 6) boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area: count });
  }
  return boxes;
}

function buildEdgeBinary(gray, w, h, threshold) {
  const edge = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const tl = gray[i - w - 1], tc = gray[i - w], tr = gray[i - w + 1];
      const ml = gray[i - 1], mr = gray[i + 1];
      const bl = gray[i + w - 1], bc = gray[i + w], br = gray[i + w + 1];
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      if ((Math.abs(gx) + Math.abs(gy)) * 0.5 > threshold) edge[i] = 1;
    }
  }
  const dilated = new Uint8Array(edge.length);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      if (!edge[i]) continue;
      for (let yy = y - 1; yy <= y + 1; yy += 1) {
        const base = yy * w;
        dilated[base + x - 1] = 1;
        dilated[base + x] = 1;
        dilated[base + x + 1] = 1;
      }
    }
  }
  return dilated;
}

function detectRawCandidatesPure(sourceCanvas, iw, ih) {
  const rx = Math.floor(iw * 0.49);
  const ry = Math.floor(ih * 0.125);
  const rw = Math.max(2, Math.min(iw - rx, Math.ceil(iw * 0.36)));
  const rh = Math.max(2, Math.min(ih - ry, Math.ceil(ih * 0.535)));
  const ds = Math.min(1, 600 / rh);
  const sw = Math.max(2, Math.round(rw * ds));
  const sh = Math.max(2, Math.round(rh * ds));
  const c = makeCanvas(sw, sh);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, rx, ry, rw, rh, 0, 0, sw, sh);
  const pixels = ctx.getImageData(0, 0, sw, sh).data;
  const gray0 = new Uint8Array(sw * sh);
  for (let p = 0, i = 0; p < gray0.length; p += 1, i += 4) gray0[p] = Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
  const gray = new Uint8Array(gray0.length);
  for (let y = 1; y < sh - 1; y += 1) {
    for (let x = 1; x < sw - 1; x += 1) {
      const i = y * sw + x;
      gray[i] = Math.round((gray0[i] * 4 + gray0[i - 1] + gray0[i + 1] + gray0[i - sw] + gray0[i + sw]) / 8);
    }
  }

  const inv = 1 / ds;
  const minSide = ih * 0.032, maxSide = ih * 0.150;
  const raw = [];
  const pushBox = (x, y, w, h, source) => {
    if (w < minSide * 0.72 || h < minSide * 0.72) return;
    raw.push(clampRect({ x: rx + x, y: ry + y, w, h, source }, iw, ih));
  };

  for (const threshold of EDGE_THRESHOLDS) {
    const binary = buildEdgeBinary(gray, sw, sh, threshold);
    const boxes = connectedComponents(binary, sw, sh);
    for (const b of boxes) {
      const x = b.x * inv, y = b.y * inv, w = b.w * inv, h = b.h * inv;
      const aspect = w / Math.max(1, h);
      if (w >= minSide && w <= maxSide && h >= minSide && h <= maxSide && aspect >= 0.64 && aspect <= 1.45) {
        pushBox(x, y, w, h, `edge-${threshold}`);
        continue;
      }
      if (w >= minSide && w <= maxSide && h > w * 1.42 && h <= w * 4.35) {
        const count = clamp(Math.round(h / Math.max(1, w)), 2, 4);
        const segH = h / count;
        for (let k = 0; k < count; k += 1) pushBox(x, y + segH * k, w, segH, `edge-v-${threshold}`);
        continue;
      }
      if (h >= minSide && h <= maxSide && w > h * 1.42 && w <= h * 2.75) {
        const count = clamp(Math.round(w / Math.max(1, h)), 2, 3);
        const segW = w / count;
        for (let k = 0; k < count; k += 1) pushBox(x + segW * k, y, segW, h, `edge-h-${threshold}`);
      }
    }
  }
  return raw;
}

function getViewportTransform(iw, ih, variant = { scale: 1, dx: 0, dy: 0 }) {
  const fitScale = Math.min(iw / VIEW_W, ih / VIEW_H);
  const scale = fitScale * (variant.scale || 1);
  const centerX = iw / 2 + (variant.dx || 0) * fitScale;
  const centerY = ih / 2 + (variant.dy || 0) * fitScale;
  return { fitScale, scale, ox: centerX - VIEW_W * scale / 2, oy: centerY - VIEW_H * scale / 2, variant };
}

function geometryRefine(seed) {
  return [-0.018, 0, 0.018].flatMap((so) => [-18, 0, 18].flatMap((dx) => [-12, 0, 12].map((dy) => ({
    scale: clamp((seed.scale || 1) + so, 0.9, 1.1), dx: (seed.dx || 0) + dx, dy: (seed.dy || 0) + dy,
  }))));
}

function evaluateGeometry(sourceCanvas, iw, ih, variants) {
  let best = null;
  for (const variant of variants) {
    const t = getViewportTransform(iw, ih, variant);
    for (let leftCount = 1; leftCount <= 4; leftCount += 1) {
      const rightCount = 5 - leftCount;
      const defs = [
        ...SLOT_ROWS[leftCount].map((y) => ({ x: SLOT_X.left, y })),
        ...SLOT_ROWS[rightCount].map((y) => ({ x: SLOT_X.right, y })),
      ];
      const slots = defs.map((s) => {
        const rect = clampRect({ x: t.ox + s.x * t.scale, y: t.oy + s.y * t.scale, w: VIEW_CARD_W * t.scale, h: VIEW_CARD_H * t.scale }, iw, ih);
        const metrics = portraitVisualMetrics(sourceCanvas, rect);
        const occupancy = occupancyScore(sourceCanvas, rect);
        const score = metrics.portraitScore * 0.76 + occupancy * 0.24;
        return { ...rect, score, occupancy, portraitMetrics: metrics, portraitScore: metrics.portraitScore };
      });
      const sorted = [...slots].sort((a, b) => b.score - a.score);
      const gap = (sorted[2]?.score || 0) - (sorted[3]?.score || 0);
      const minTop = sorted[2]?.score || 0;
      const topSum = sorted.slice(0, 3).reduce((s, x) => s + x.score, 0);
      const restSum = sorted.slice(3).reduce((s, x) => s + x.score, 0);
      const emptyPenalty = sorted.slice(0, 3).reduce((s, x) => s + (x.portraitMetrics?.emptyLike ? 85 : 0), 0);
      const penalty = Math.abs((variant.scale || 1) - 1) * 38 + Math.abs(variant.dx || 0) * 0.014 + Math.abs(variant.dy || 0) * 0.018;
      const objective = topSum - restSum * 0.54 + gap * 2.55 + minTop * 0.28 - penalty - emptyPenalty;
      if (!best || objective > best.objective) best = { objective, slots: sorted.slice(0, 3), allSlots: sorted, transform: t, leftCount };
    }
  }
  if (best?.slots?.length === 3) best.slots = best.slots.map((slot) => refineCardVisual(sourceCanvas, slot, iw, ih));
  return best;
}


function quickHeroSimilarity(sourceCanvas, card, references) {
  if (!references?.length) return 0;
  const c = makeCanvas(DESC_W, DESC_H);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, card.x, card.y, card.w, card.h, 0, 0, DESC_W, DESC_H);
  const descriptor = descriptorFromCanvas(c);
  let best = -1;
  for (const ref of references) {
    if (!ref?.descriptor) continue;
    const score = compareDescriptor(descriptor, ref.descriptor);
    if (score > best) best = score;
  }
  return best;
}

function quickHeroBestMatch(sourceCanvas, card, references) {
  if (!references?.length) return { score: -1, name: "", margin: 0 };
  const c = makeCanvas(DESC_W, DESC_H);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, card.x, card.y, card.w, card.h, 0, 0, DESC_W, DESC_H);
  const descriptor = descriptorFromCanvas(c);
  let best=-1, second=-1, name="";
  for(const ref of references){
    if(!ref?.descriptor) continue;
    const s=compareDescriptor(descriptor,ref.descriptor);
    if(s>best){second=best;best=s;name=ref.name||"";} else if(s>second) second=s;
  }
  return {score:best,name,margin:best-second};
}

function rerankKnownGeometrySlots(sourceCanvas, iw, ih, geometry, references) {
  const slots = geometry?.allSlots || [];
  if (slots.length < 5 || !references?.length) return null;
  const reranked = slots.map((slot) => {
    const refined = refineCardVisual(sourceCanvas, slot, iw, ih);
    const metrics = refined.portraitMetrics || portraitVisualMetrics(sourceCanvas, refined);
    const footer = metrics.footer || cardFooterMetrics(sourceCanvas, refined);
    const heroSimilarity = quickHeroSimilarity(sourceCanvas, refined, references);
    const validUi = footer.uiLike && !metrics.emptyLike;
    const score = heroSimilarity * 100 + metrics.portraitScore * 0.16 + footer.edgeRatio * 90 + footer.colorfulRatio * 10 + (validUi ? 8 : -30);
    return { ...refined, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer, heroSimilarity, score, validUi };
  }).sort((a, b) => b.score - a.score);
  const selected = reranked.filter((x) => x.validUi).slice(0, 3);
  if (selected.length !== 3) return null;
  const minSimilarity = Math.min(...selected.map((x) => x.heroSimilarity));
  const fourth = reranked.find((x) => !selected.includes(x));
  const quality = Math.max(0, Math.min(...selected.map((x) => x.score)) - (fourth?.score || 0));
  return { cards: selected.sort((a, b) => a.y - b.y || a.x - b.x), quality, minSimilarity, allSlots: reranked };
}


function evaluateNormalizedProfile(sourceCanvas, iw, ih, profile) {
  let best = null;
  for (const xOff of SCREEN_X_OFFSETS) {
    for (const yOff of SCREEN_Y_OFFSETS) {
      for (let leftCount = 1; leftCount <= 4; leftCount += 1) {
        const rightCount = 5 - leftCount;
        const defs = [
          ...SCREEN_SLOT_ROWS[leftCount].map((y) => ({ x: profile.leftX + xOff, y: y + yOff })),
          ...SCREEN_SLOT_ROWS[rightCount].map((y) => ({ x: profile.rightX + xOff, y: y + yOff })),
        ];
        const slots = defs.map((s) => {
          const rect = clampRect({ x: s.x * iw, y: s.y * ih, w: SCREEN_CARD_W * iw, h: SCREEN_CARD_H * ih }, iw, ih);
          const metrics = portraitVisualMetrics(sourceCanvas, rect);
          const occupancy = occupancyScore(sourceCanvas, rect);
          const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
          const score = metrics.portraitScore * 0.70 + occupancy * 0.18 + footer.edgeRatio * 28 + (footer.uiLike ? 5 : -4);
          return { ...rect, score, occupancy, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer };
        });
        const sorted = [...slots].sort((a, b) => b.score - a.score);
        const gap = (sorted[2]?.score || 0) - (sorted[3]?.score || 0);
        const minTop = sorted[2]?.score || 0;
        const emptyPenalty = sorted.slice(0, 3).reduce((s, x) => s + (x.portraitMetrics?.emptyLike ? 60 : 0), 0);
        const offsetPenalty = (Math.abs(xOff) / 0.006 + Math.abs(yOff) / 0.007) * 0.8;
        const objective = sorted.slice(0, 3).reduce((s, x) => s + x.score, 0) + gap * 2.2 + minTop * 0.18 - emptyPenalty - offsetPenalty;
        if (!best || objective > best.objective) best = { objective, slots: sorted.slice(0, 3), allSlots: slots, leftCount, profile: profile.id, xOff, yOff };
      }
    }
  }
  return best;
}


function evaluateHeightAnchoredProfile(sourceCanvas, iw, ih, profile) {
  let best = null;
  const rows = profile.rows === "classic" ? HEIGHT_CLASSIC_SLOT_ROWS : (profile.rows === "team" ? HEIGHT_TEAM_SLOT_ROWS : HEIGHT_WIDE_SLOT_ROWS);
  const cx = iw / 2;
  for (let leftCount = 1; leftCount <= 4; leftCount += 1) {
    const rightCount = 5 - leftCount;
    const defs = [
      ...rows[leftCount].map((y, i) => ({ xH: profile.leftH, y, slotKey: `L${leftCount}-${i}` })),
      ...rows[rightCount].map((y, i) => ({ xH: profile.rightH, y, slotKey: `R${rightCount}-${i}` })),
    ];
    const bounds = hardPanelBounds(iw, ih, profile.id);
    const slots = defs.map((s) => {
      const rect = clampRect({
        x: cx + s.xH * ih,
        y: s.y * ih,
        w: HEIGHT_CARD_W * ih,
        h: HEIGHT_CARD_H * ih,
        slotKey: s.slotKey,
      }, iw, ih);
      if (!rectWithinPanelBounds(rect, iw, ih, profile.id) || isBottomRosterLike(sourceCanvas, rect, iw, ih)) {
        const metrics = portraitVisualMetrics(sourceCanvas, rect);
        const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
        return { ...rect, score: -999, occupancy: 0, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer };
      }
      const metrics = portraitVisualMetrics(sourceCanvas, rect);
      const occupancy = occupancyScore(sourceCanvas, rect);
      const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
      const score = metrics.portraitScore * 0.70 + occupancy * 0.18 + footer.edgeRatio * 28 + (footer.uiLike ? 5 : -4);
      return { ...rect, score, occupancy, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer };
    });
    const sorted = [...slots].sort((a, b) => b.score - a.score);
    const gap = (sorted[2]?.score || 0) - (sorted[3]?.score || 0);
    const minTop = sorted[2]?.score || 0;
    const emptyPenalty = sorted.slice(0, 3).reduce((sum, x) => sum + (x.portraitMetrics?.emptyLike ? 60 : 0), 0);
    const objective = sorted.slice(0, 3).reduce((sum, x) => sum + x.score, 0) + gap * 2.2 + minTop * 0.18 - emptyPenalty;
    if (!best || objective > best.objective) {
      best = { objective, slots: sorted.slice(0, 3), allSlots: slots, leftCount, profile: profile.id, family: profile.family || "unknown" };
    }
  }
  return best;
}

function scoreGeometrySeedsByReferences(sourceCanvas, geometry, references) {
  if (!geometry?.allSlots?.length || !references?.length) return { score: -Infinity, slots: [] };
  const slots = geometry.allSlots.map((slot) => {
    const metrics = slot.portraitMetrics || portraitVisualMetrics(sourceCanvas, slot);
    const footer = metrics.footer || cardFooterMetrics(sourceCanvas, slot);
    const heroSimilarity = quickHeroSimilarity(sourceCanvas, slot, references);
    const validUi = !metrics.emptyLike && (footer.uiLike || heroSimilarity >= 0.40);
    const score = heroSimilarity * 100 + metrics.portraitScore * 0.10 + footer.edgeRatio * 40 + (validUi ? 6 : -18);
    return { ...slot, seedRect: slot, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer, heroSimilarity, validUi, score };
  }).sort((a, b) => b.score - a.score);
  const top = slots.slice(0, 3);
  const fourth = slots[3];
  const simMin = Math.min(...top.map((x) => x.heroSimilarity || -1));
  const simSum = top.reduce((s, x) => s + (x.heroSimilarity || 0), 0);
  const validCount = top.filter((x) => x.validUi).length;
  const gap = (top[2]?.score || 0) - (fourth?.score || 0);
  return { score: simSum * 100 + simMin * 65 + gap * 1.15 + validCount * 9, slots, simMin };
}

function refineCardByReference(sourceCanvas, seed, iw, ih, references, profile = "") {
  const edgeCandidates = edgePairCandidates(sourceCanvas, seed, iw, ih, profile);
  const base = edgeCandidates.length ? edgeCandidates : [seed];
  const variants = [];
  for (const candidate of base.slice(0, 4)) {
    variants.push(candidate);
    for (const scale of [0.95, 1.05]) {
      const cx = candidate.x + candidate.w / 2, cy = candidate.y + candidate.h / 2;
      variants.push(clampRect({ ...candidate, x: cx - candidate.w * scale / 2, y: cy - candidate.h * scale / 2, w: candidate.w * scale, h: candidate.h * scale }, iw, ih));
    }
  }
  let best = null;
  for (const rect0 of variants) {
    const rect = { ...rect0, slotKey: seed.slotKey };
    if (!rectWithinPanelBounds(rect, iw, ih, profile) || isBottomRosterLike(sourceCanvas, rect, iw, ih)) continue;
    const metrics = rect.portraitMetrics || portraitVisualMetrics(sourceCanvas, rect);
    if (metrics.emptyLike) continue;
    const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
    const heroSimilarity = quickHeroSimilarity(sourceCanvas, rect, references);
    const frameScore = rect.frameScore || localCardFrameScore(sourceCanvas, rect);
    const score = heroSimilarity * 100 + metrics.portraitScore * 0.11 + footer.edgeRatio * 48 + footer.colorfulRatio * 7 + frameScore * 0.17 + (footer.uiLike ? 6 : 0);
    if (!best || score > best.score) best = { ...rect, score, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer, heroSimilarity, frameScore, snapped: true };
  }
  return best || seed;
}

function selectSpatiallyDistinct(ranked, count = 3) {
  const selected = [];
  for (const item of ranked) {
    if (selected.some((s) => s.slotKey && item.slotKey && s.slotKey === item.slotKey)) continue;
    const duplicate = selected.some((s) => {
      const iou = rectIou(s, item);
      const dx = (s.x + s.w / 2) - (item.x + item.w / 2);
      const dy = (s.y + s.h / 2) - (item.y + item.h / 2);
      const minSide = Math.min(s.w, s.h, item.w, item.h);
      return iou > 0.13 || Math.hypot(dx, dy) < minSide * 0.72;
    });
    if (duplicate) continue;
    selected.push(item);
    if (selected.length >= count) break;
  }
  return selected;
}

function refineSelectedGeometryByReferences(sourceCanvas, iw, ih, geometry, references) {
  if (!geometry?.allSlots?.length || !references?.length) return null;
  const refined = geometry.allSlots.map((slot) => {
    const snapped = snapCardToLocalFrame(sourceCanvas, slot, iw, ih, geometry.profile || "");
    return refineCardByReference(sourceCanvas, snapped, iw, ih, references, geometry.profile || "");
  });
  const ranked = refined.map((slot) => {
    const metrics = slot.portraitMetrics || portraitVisualMetrics(sourceCanvas, slot);
    const footer = slot.footer || metrics.footer || cardFooterMetrics(sourceCanvas, slot);
    const heroSimilarity = Number.isFinite(slot.heroSimilarity) ? slot.heroSimilarity : quickHeroSimilarity(sourceCanvas, slot, references);
    const validUi = !metrics.emptyLike && (footer.uiLike || heroSimilarity >= 0.44);
    const score = heroSimilarity * 100 + metrics.portraitScore * 0.12 + footer.edgeRatio * 60 + footer.colorfulRatio * 8 + (validUi ? 8 : -30);
    return { ...slot, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer, heroSimilarity, validUi, score };
  }).sort((a, b) => b.score - a.score);
  const selected = selectSpatiallyDistinct(ranked.filter((x) => x.validUi && x.heroSimilarity >= 0.34), 3);
  if (selected.length !== 3) return null;
  const fourth = ranked.find((x) => !selected.includes(x));
  const quality = Math.max(0, Math.min(...selected.map((x) => x.score)) - (fourth?.score || 0));
  return { cards: selected.sort((a, b) => a.y - b.y || a.x - b.x), quality, allSlots: ranked, minSimilarity: Math.min(...selected.map((x) => x.heroSimilarity)), profile: geometry.profile || 'legacy' };
}


// 15월의 인식엔진 2.0.0
// 핵심 변경: 개별 영웅 카드의 테두리를 화면 전체에서 억지로 찾지 않고,
// 먼저 오른쪽 상대 방어팀 패널의 큰 외곽선을 찾은 뒤 패널 내부의 고정 슬롯 그리드를 사용한다.
// 패널 경계는 여러 후보를 유지하고, 실제 79개 영웅 초상화와 가장 잘 맞는 후보를 최종 선택한다.
const PANEL_SLOT_ROWS = {
  1: [0.485],
  2: [0.405, 0.575],
  3: [0.325, 0.495, 0.665],
  4: [0.245, 0.415, 0.585, 0.755],
};
const PANEL_LEFT_X = 0.055;
const PANEL_RIGHT_X = 0.315;
const PANEL_CARD_W = 0.245;
const PANEL_GRID_HEIGHT_PER_WIDTH = 1.62;
const PANEL_CARD_H = 0.150;

// 팀 편성/연습 전투 공통 우측 패널용 고정 슬롯 템플릿
// 펫은 우측 상단의 별도 슬롯에 존재하므로 영웅 슬롯 후보에서 제외합니다.
const TEAM_PANEL_HERO_SLOTS = [
  { key: "L1", x: 0.055, y: 0.255 },
  { key: "L2", x: 0.055, y: 0.435 },
  { key: "L3", x: 0.055, y: 0.615 },
  { key: "R1", x: 0.305, y: 0.345 },
  { key: "R2", x: 0.305, y: 0.525 },
];
const TEAM_PANEL_PET_ZONE = { x: 0.50, y: 0.06, w: 0.36, h: 0.24 };

function isRectInTeamPetZone(rect, panel, gridH) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const x1 = panel.x + TEAM_PANEL_PET_ZONE.x * panel.w;
  const y1 = panel.y + TEAM_PANEL_PET_ZONE.y * gridH;
  const x2 = x1 + TEAM_PANEL_PET_ZONE.w * panel.w;
  const y2 = y1 + TEAM_PANEL_PET_ZONE.h * gridH;
  return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
}

function smoothNumberProfile(values, radius = 2) {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0, count = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = i + k;
      if (j < 0 || j >= values.length) continue;
      sum += values[j];
      count += 1;
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

function strongestSeparatedPeaks(values, lo, hi, maxCount = 32, minDistance = 5) {
  const indices = [];
  const start = Math.max(0, Math.floor(lo));
  const end = Math.min(values.length, Math.ceil(hi));
  for (let i = start; i < end; i += 1) indices.push(i);
  indices.sort((a, b) => values[b] - values[a]);
  const selected = [];
  for (const i of indices) {
    if (selected.some((j) => Math.abs(i - j) < minDistance)) continue;
    selected.push(i);
    if (selected.length >= maxCount) break;
  }
  return selected;
}

// 15월의 인식엔진 ver 3.0.0
// 화면 전체 비율을 직접 신뢰하지 않고, 상대 패널의 좌우 세로 테두리를 먼저 찾습니다.
// 패널 폭은 모든 기기에서 UI 배율을 그대로 반영하므로 카드 크기/간격의 기준으로 사용합니다.
function smoothProfileV3(values, radius = 2) {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    let s = 0, n = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = i + k;
      if (j < 0 || j >= values.length) continue;
      s += values[j]; n += 1;
    }
    out[i] = s / Math.max(1, n);
  }
  return out;
}

function strongestPeaksV3(profile, start, end, maxCount, minDistance) {
  const idx = [];
  for (let i = Math.max(1, Math.floor(start)); i <= Math.min(profile.length - 2, Math.floor(end)); i += 1) idx.push(i);
  idx.sort((a, b) => profile[b] - profile[a]);
  const out = [];
  for (const i of idx) {
    if (out.some((j) => Math.abs(i - j) < minDistance)) continue;
    out.push(i);
    if (out.length >= maxCount) break;
  }
  return out;
}

function detectPanelLineCandidatesV3(sourceCanvas, iw, ih, maxCandidates = 4) {
  const scale = Math.min(1, 480 / Math.max(1, ih));
  const sw = Math.max(16, Math.round(iw * scale));
  const sh = Math.max(16, Math.round(ih * scale));
  const c = makeCanvas(sw, sh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, 0, 0, iw, ih, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;
  const gray = new Uint8Array(sw * sh);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) gray[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);

  const y0 = Math.floor(sh * 0.15), y1 = Math.floor(sh * 0.70);
  const vRaw = new Float32Array(sw);
  for (let x = 1; x < sw - 1; x += 1) {
    let sum = 0;
    for (let y = y0; y < y1; y += 1) {
      const row = y * sw;
      sum += Math.abs(gray[row + x + 1] - gray[row + x - 1]);
    }
    vRaw[x] = sum / Math.max(1, y1 - y0);
  }
  const v = smoothProfileV3(vRaw, 2);
  const xPeaks = strongestPeaksV3(v, sw * 0.52, sw * 0.90, 26, Math.max(4, Math.round(sh * 0.008)));
  const pairCandidates = [];
  for (let a = 0; a < xPeaks.length; a += 1) {
    for (let b = a + 1; b < xPeaks.length; b += 1) {
      const left = Math.min(xPeaks[a], xPeaks[b]);
      const right = Math.max(xPeaks[a], xPeaks[b]);
      const pw = right - left;
      if (pw < sh * 0.27 || pw > sh * 0.37) continue;
      const centerOffset = (((left + right) / 2) - sw / 2) / Math.max(1, sh);
      // 일반 팀 편성/연습전/좌측메뉴 화면을 모두 허용하되 중앙에서 지나치게 먼 선쌍은 감점합니다.
      const positionPenalty = Math.min(Math.abs(centerOffset - 0.34), Math.abs(centerOffset - 0.28), Math.abs(centerOffset - 0.40)) * 42;
      const score = v[left] + v[right] - positionPenalty;
      pairCandidates.push({ left, right, pw, score });
    }
  }
  pairCandidates.sort((a, b) => b.score - a.score);

  const hEdge = new Float32Array(sh * sw);
  for (let y = 1; y < sh - 1; y += 1) {
    const row = y * sw, up = (y - 1) * sw, down = (y + 1) * sw;
    for (let x = 0; x < sw; x += 1) hEdge[row + x] = Math.abs(gray[down + x] - gray[up + x]);
  }

  const out = [];
  for (const pair of pairCandidates.slice(0, 10)) {
    const innerL = Math.min(pair.right - 2, pair.left + Math.max(3, Math.round(pair.pw * 0.04)));
    const innerR = Math.max(innerL + 2, pair.right - Math.max(3, Math.round(pair.pw * 0.04)));
    const hRaw = new Float32Array(sh);
    for (let y = 1; y < sh - 1; y += 1) {
      let s = 0;
      const row = y * sw;
      for (let x = innerL; x <= innerR; x += 1) s += hEdge[row + x];
      hRaw[y] = s / Math.max(1, innerR - innerL + 1);
    }
    const hp = smoothProfileV3(hRaw, 2);
    // 패널 상단 헤더선은 실제 샘플에서 높이의 약 15~23%에 안정적으로 존재합니다.
    const topPeaks = strongestPeaksV3(hp, sh * 0.15, sh * 0.24, 4, Math.max(3, Math.round(sh * 0.008)));
    for (const top of topPeaks) {
      const panelW = pair.pw / scale;
      const panel = {
        x: pair.left / scale,
        y: top / scale,
        w: panelW,
        h: panelW * PANEL_GRID_HEIGHT_PER_WIDTH,
        panelScore: pair.score + hp[top],
        lineGridV3: true,
      };
      if (panel.y + panel.h > ih * 0.82) continue;
      const duplicate = out.some((p) => Math.abs(p.x - panel.x) < panel.w * 0.05 && Math.abs(p.y - panel.y) < panel.w * 0.06 && Math.abs(p.w - panel.w) < panel.w * 0.05);
      if (!duplicate) out.push(panel);
      if (out.length >= maxCandidates) break;
    }
    if (out.length >= maxCandidates) break;
  }
  return out;
}

function bestSlotV3(sourceCanvas, panel, gridH, xRatio, yRatio, references, slotKey) {
  let best = null;
  const shifts = [-0.009, 0, 0.009];
  for (const dx of shifts) for (const dy of shifts) {
    const rect = clampRect({
      x: panel.x + (xRatio + dx) * panel.w,
      y: panel.y + (yRatio + dy) * gridH,
      w: PANEL_CARD_W * panel.w,
      h: PANEL_CARD_H * gridH,
      slotKey,
      searchMode: 'panel-line-grid-v3',
    }, sourceCanvas.width, sourceCanvas.height);
    const metrics = portraitVisualMetrics(sourceCanvas, rect);
    const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
    // 빈 슬롯은 여기서 대부분 제거되어 79개 초상화 비교를 수행하지 않습니다.
    const visuallyAlive = !metrics.emptyLike && metrics.std >= 28 && (footer.edgeRatio >= 0.016 || footer.colorfulRatio >= 0.018);
    const score = Math.min(metrics.std, 80) / 80 * 0.45 + Math.min(metrics.saturation || 0, 150) / 150 * 0.24 + Math.min(footer.colorfulRatio, 0.40) * 0.95 + Math.min(footer.edgeRatio, 0.45) * 0.45 + (visuallyAlive ? 0.18 : -0.65);
    if (!best || score > best.v3Score) best = { ...rect, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer, heroSimilarity: -1, heroMargin: 0, heroNameHint: '', validUi: visuallyAlive, v3Score: score };
  }
  // Compare references once for the best visual alignment, instead of doing
  // it for all 9 alignments. This keeps formation selection reliable without
  // multiplying 79-reference work across every tiny geometry variation.
  if (best?.validUi && references?.length) {
    const match = quickHeroBestMatch(sourceCanvas, best, references);
    best.heroSimilarity = match.score;
    best.heroMargin = match.margin || 0;
    best.heroNameHint = match.name || '';
    best.v3Score += Math.max(0, match.score) * 1.45 + Math.min(best.heroMargin, 0.15) * 0.28;
  }
  return best;
}

function evaluatePanelLineGridV3(sourceCanvas, panel, references) {
  const gridH = panel.w * PANEL_GRID_HEIGHT_PER_WIDTH;
  let bestFormation = null;
  for (let leftCount = 1; leftCount <= 4; leftCount += 1) {
    const rightCount = 5 - leftCount;
    const defs = [
      ...PANEL_SLOT_ROWS[leftCount].map((y, i) => ({ x: PANEL_LEFT_X, y, key: `L${leftCount}-${i}` })),
      ...PANEL_SLOT_ROWS[rightCount].map((y, i) => ({ x: PANEL_RIGHT_X, y, key: `R${rightCount}-${i}` })),
    ];
    const slots = defs.map((d) => bestSlotV3(sourceCanvas, panel, gridH, d.x, d.y, references, d.key));
    const ranked = [...slots].sort((a, b) => b.v3Score - a.v3Score);
    const top = ranked.slice(0, 3);
    const fourth = ranked[3];
    const validCount = top.filter((x) => x.validUi).length;
    const gap = (top[2]?.v3Score || -1) - (fourth?.v3Score || -1);
    const minSimilarity = Math.min(...top.map((x) => x.heroSimilarity || -1));
    const objective = top.reduce((sum, x) => sum + x.v3Score, 0) + validCount * 0.25 + Math.max(0, minSimilarity) * 1.10 + gap * 0.55 + (panel.panelScore || 0) * 0.0004;
    if (!bestFormation || objective > bestFormation.objective) bestFormation = { objective, top, slots, panel, gridH, leftCount };
  }
  return bestFormation;
}

function detectCardsPanelLineGridV3(sourceCanvas, iw, ih, references = []) {
  if (!references?.length) return null;
  const panels = detectPanelLineCandidatesV3(sourceCanvas, iw, ih, 4);
  if (!panels.length) return null;
  let best = null;
  for (const panel of panels) {
    const e = evaluatePanelLineGridV3(sourceCanvas, panel, references);
    if (e && (!best || e.objective > best.objective)) best = e;
  }
  if (!best) return null;
  const selected = selectSpatiallyDistinct(best.top.filter((x) => x.validUi), 3);
  if (selected.length !== 3) return null;
  const refined = selected.map((slot) => {
    const visual = refinePanelSelectedCard(sourceCanvas, slot, best.panel, best.gridH, references);
    const black = visual.footer?.blackAnchorRatio ?? visual.metrics?.footer?.blackAnchorRatio ?? 0;
    const footerAligned = black < 0.18
      ? refineSelectedCardByFooterConsensus(sourceCanvas, visual, best.panel, best.gridH, references)
      : visual;
    return refineSelectedCardByTypeBadge(sourceCanvas, footerAligned, references);
  });
  // Refinement is allowed to improve alignment, never to collapse two slot
  // seeds onto the same portrait. Keep the distinct grid seeds when that
  // happens; they already passed visual and reference validation above.
  const distinctRefined = areDetectedCardsDistinct(refined) ? refined : selected;
  const valid = distinctRefined.filter((x) => !x.metrics?.emptyLike && !x.portraitMetrics?.emptyLike && x.validUi);
  if (valid.length !== 3) return null;
  const cards = valid.sort((a, b) => a.y - b.y || a.x - b.x);
  return {
    cards,
    quality: Math.min(...cards.map((x) => x.heroSimilarity || 0)),
    candidateCount: panels.length,
    nicknameCrop: nicknameCropFromDetectedPanel(sourceCanvas, best.panel, best.gridH, cards, iw, ih),
    detector: 'panel-line-grid-reference-v3',
    leftCount: best.leftCount,
    panel: best.panel,
    minHeroSimilarity: Math.min(...cards.map((x) => x.heroSimilarity || -1)),
  };
}

function detectOpponentPanelCandidates(sourceCanvas, iw, ih, maxCandidates = 6) {
  const scale = Math.min(1, 480 / Math.max(1, ih));
  const sw = Math.max(8, Math.round(iw * scale));
  const sh = Math.max(8, Math.round(ih * scale));
  const c = makeCanvas(sw, sh);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, 0, 0, iw, ih, 0, 0, sw, sh);
  const rgba = ctx.getImageData(0, 0, sw, sh).data;
  const gray = new Uint8Array(sw * sh);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    gray[p] = Math.round(rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114);
  }

  const yStart = Math.floor(sh * 0.10);
  const yEnd = Math.floor(sh * 0.80);
  const vRaw = new Float32Array(sw);
  for (let x = 1; x < sw - 1; x += 1) {
    let sum = 0;
    for (let y = yStart; y < yEnd; y += 1) {
      const row = y * sw;
      sum += Math.abs(gray[row + x + 1] - gray[row + x - 1]);
    }
    vRaw[x] = sum / Math.max(1, yEnd - yStart);
  }
  const v = smoothNumberProfile(vRaw, 2);

  // 각 행의 수평 경계 강도를 빠르게 계산하기 위한 prefix sum.
  const stride = sw + 1;
  const hPrefix = new Float32Array(sh * stride);
  for (let y = 1; y < sh - 1; y += 1) {
    const rowOffset = y * stride;
    const up = (y - 1) * sw;
    const down = (y + 1) * sw;
    let running = 0;
    for (let x = 0; x < sw; x += 1) {
      running += Math.abs(gray[down + x] - gray[up + x]);
      hPrefix[rowOffset + x + 1] = running;
    }
  }

  // A desktop snip can contain the whole game, only the VS area, or almost
  // nothing except the opponent panel. Search the complete image instead of
  // assuming that the panel always occupies a narrow band on the right.
  const xLo = Math.max(1, Math.floor(sw * 0.005));
  const xHi = Math.min(sw - 2, Math.ceil(sw * 0.995));
  const xPeaks = strongestSeparatedPeaks(v, xLo, xHi, 72, Math.max(3, Math.floor(sh * 0.007)));
  const candidates = [];
  const verticalPairs = [];

  for (let ai = 0; ai < xPeaks.length; ai += 1) {
    const x1 = xPeaks[ai];
    for (let bi = 0; bi < xPeaks.length; bi += 1) {
      const x2 = xPeaks[bi];
      if (x2 <= x1) continue;
      const panelW = x2 - x1;
      if (panelW < sh * 0.15 || panelW > sh * 0.72) continue;

      const centerRatio = ((x1 + x2) / 2) / Math.max(1, sw);
      const rightEdgeRatio = x2 / Math.max(1, sw);
      // The enemy panel is the right-hand member of the VS layout. A crop may
      // contain only that panel, but a centre/logo fragment must not outrank a
      // real panel merely because its border happens to have stronger edges.
      const rightPreference = centerRatio >= 0.50 ? 1.8 : 0;
      const opponentPreference = clamp((rightEdgeRatio - 0.54) / 0.38, 0, 1) * 18.0;
      verticalPairs.push({ x1, x2, panelW, pairScore: v[x1] + v[x2] + rightPreference + opponentPreference });
    }
  }

  // Only the strongest line pairs need the more expensive horizontal scan.
  verticalPairs.sort((a, b) => b.pairScore - a.pairScore);
  for (const pair of verticalPairs.slice(0, 42)) {
      const { x1, x2, panelW } = pair;

      const hRaw = new Float32Array(sh);
      for (let y = 1; y < sh - 1; y += 1) {
        const rowOffset = y * stride;
        hRaw[y] = (hPrefix[rowOffset + x2] - hPrefix[rowOffset + x1]) / Math.max(1, panelW);
      }
      const hProfile = smoothNumberProfile(hRaw, 2);
      const topPeaks = strongestSeparatedPeaks(hProfile, sh * 0.005, sh * 0.48, 12, Math.max(3, Math.floor(sh * 0.007)));
      const bottomPeaks = strongestSeparatedPeaks(hProfile, sh * 0.34, sh * 0.995, 12, Math.max(3, Math.floor(sh * 0.007)));

      for (const y1 of topPeaks) {
        for (const y2 of bottomPeaks) {
          if (y2 <= y1) continue;
          const panelH = y2 - y1;
          // Portrait desktop snips can leave large empty space above/below the
          // game UI, making a complete panel only ~20% of the image height.
          if (panelH < sh * 0.20 || panelH > sh * 0.995) continue;
          const aspect = panelW / Math.max(1, panelH);
          if (aspect < 0.47 || aspect > 0.74) continue;
          const score = pair.pairScore + hProfile[y1] + hProfile[y2] - Math.abs(aspect - 0.61) * 36;
          candidates.push({
            x: x1 / scale,
            y: y1 / scale,
            w: panelW / scale,
            h: panelH / scale,
            panelScore: score,
          });
        }
      }
  }

  candidates.sort((a, b) => b.panelScore - a.panelScore);
  const deduped = [];
  for (const candidate of candidates) {
    const cx = candidate.x + candidate.w / 2;
    const cy = candidate.y + candidate.h / 2;
    const duplicate = deduped.some((kept) => {
      const kcx = kept.x + kept.w / 2;
      const kcy = kept.y + kept.h / 2;
      return Math.abs(cx - kcx) < candidate.h * 0.08 &&
        Math.abs(cy - kcy) < candidate.h * 0.06 &&
        Math.abs(candidate.w - kept.w) < candidate.h * 0.08;
    });
    if (duplicate) continue;
    deduped.push(candidate);
    if (deduped.length >= maxCandidates) break;
  }
  return deduped;
}

function panelCardVisualEvidence(sourceCanvas, rect, references, extra = null) {
  const metrics = portraitVisualMetrics(sourceCanvas, rect);
  const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
  const bestMatch = quickHeroBestMatch(sourceCanvas, rect, references);
  const heroSimilarity = bestMatch.score;
  const heroMargin = bestMatch.margin || 0;
  const inPetZone = extra?.panel ? isRectInTeamPetZone(rect, extra.panel, extra.gridH || extra.panel.h) : false;
  const footerOk = (footer.colorfulRatio > 0.040 && footer.edgeRatio > 0.020) ||
    (footer.colorfulRatio > 0.024 && footer.edgeRatio > 0.070);
  const validUi = !metrics.emptyLike && metrics.std >= 38 && footerOk;
  let normalizedScore = heroSimilarity + Math.min(footer.colorfulRatio, 0.30) * 0.46 +
    Math.min(footer.edgeRatio, 0.30) * 0.22 + Math.min(heroMargin, 0.15) * 0.30 + (validUi ? 0.12 : -0.45);
  if (inPetZone) normalizedScore -= 0.85;
  return { metrics, footer, heroSimilarity, heroMargin, validUi, normalizedScore, inPetZone };
}

function bestLocalPanelSlot(sourceCanvas, panel, gridH, xRatio, yRatio, references, options = {}) {
  // 2.2.1: 패널 후보 단계에서는 중심 위치만 빠르게 미세 탐색합니다.
  // 크기 보정은 최종 선택된 3개 카드에만 수행해 연산량을 크게 줄입니다.
  let best = null;
  const dxs = options.tight ? [-0.012, 0, 0.012] : [-0.018, 0, 0.018];
  const dys = options.tight ? [-0.010, 0, 0.010] : [-0.016, 0, 0.016];
  for (const dx of dxs) {
    for (const dy of dys) {
      const rect = clampRect({
        x: panel.x + (xRatio + dx) * panel.w,
        y: panel.y + (yRatio + dy) * gridH,
        w: PANEL_CARD_W * panel.w,
        h: PANEL_CARD_H * gridH,
      }, sourceCanvas.width, sourceCanvas.height);
      const ev = panelCardVisualEvidence(sourceCanvas, rect, references, { panel, gridH });
      let score = ev.normalizedScore;
      if (options.preferHeroFooter && ev.heroSimilarity < 0.30) score -= 0.20;
      if (!best || score > best.normalizedScore) best = { ...rect, ...ev, normalizedScore: score };
    }
  }
  return best;
}

function opponentPanelPositionScore(sourceCanvas, panel) {
  const imageW = Math.max(1, sourceCanvas.width);
  const rightEdgeRatio = (panel.x + panel.w) / imageW;
  const panelWidthRatio = panel.w / imageW;
  const rightness = clamp((rightEdgeRatio - 0.54) / 0.38, 0, 1);
  // Panel-only screenshots can place the panel across most of the image. They
  // are valid even when there is no surrounding VS layout to compare against.
  const panelOnlyBonus = clamp((panelWidthRatio - 0.56) / 0.24, 0, 1) * 0.45;
  return rightness * 4.0 + panelOnlyBonus;
}

function evaluateTeamPanelCandidate(sourceCanvas, panel, references) {
  const gridH = Math.min(panel.h, panel.w * PANEL_GRID_HEIGHT_PER_WIDTH);
  const slots = TEAM_PANEL_HERO_SLOTS.map((def) => ({
    ...bestLocalPanelSlot(sourceCanvas, panel, gridH, def.x, def.y, references, { preferHeroFooter: true }),
    slotKey: `T:${def.key}`
  }));
  const ranked = [...slots].sort((a, b) => {
    if (a.validUi !== b.validUi) return a.validUi ? -1 : 1;
    return b.normalizedScore - a.normalizedScore;
  });
  const top = ranked.slice(0, 3);
  const fourth = ranked[3];
  const validCount = top.filter((x) => x.validUi && !x.inPetZone).length;
  const minSimilarity = Math.min(...top.map((x) => x.heroSimilarity || -1));
  const gap = (top[2]?.normalizedScore || 0) - (fourth?.normalizedScore || 0);
  const objective = top.reduce((sum, x) => sum + x.normalizedScore, 0) +
    validCount * 0.48 + minSimilarity * 0.70 + gap * 0.25 +
    opponentPanelPositionScore(sourceCanvas, panel) + (panel.panelScore || 0) * 0.0005;
  return { objective, top, slots, leftCount: 0, gridH, panel, profile: "team-fixed-v2.2", validCount, minSimilarity };
}

function evaluatePanelCandidate(sourceCanvas, panel, references) {
  const gridH = Math.min(panel.h, panel.w * PANEL_GRID_HEIGHT_PER_WIDTH);
  let bestFormation = null;
  for (let leftCount = 1; leftCount <= 4; leftCount += 1) {
    const rightCount = 5 - leftCount;
    const defs = [
      ...PANEL_SLOT_ROWS[leftCount].map((y) => ({ x: PANEL_LEFT_X, y, side: "L" })),
      ...PANEL_SLOT_ROWS[rightCount].map((y) => ({ x: PANEL_RIGHT_X, y, side: "R" })),
    ];
    const slots = defs.map((def, index) => ({
      ...bestLocalPanelSlot(sourceCanvas, panel, gridH, def.x, def.y, references),
      slotKey: `${leftCount}:${def.side}:${index}`,
    }));
    const ranked = [...slots].sort((a, b) => {
      if (a.validUi !== b.validUi) return a.validUi ? -1 : 1;
      return b.normalizedScore - a.normalizedScore;
    });
    const top = ranked.slice(0, 3);
    const fourth = ranked[3];
    const validCount = top.filter((x) => x.validUi).length;
    const minSimilarity = Math.min(...top.map((x) => x.heroSimilarity || -1));
    const gap = (top[2]?.normalizedScore || 0) - (fourth?.normalizedScore || 0);
    const objective = top.reduce((sum, x) => sum + x.normalizedScore, 0) +
      validCount * 0.42 + minSimilarity * 0.55 + gap * 0.20 +
      opponentPanelPositionScore(sourceCanvas, panel) + (panel.panelScore || 0) * 0.0005;
    if (!bestFormation || objective > bestFormation.objective) {
      bestFormation = { objective, top, slots, leftCount, gridH, panel, validCount, minSimilarity, profile: "generic-grid" };
    }
  }
  return bestFormation;
}

function refinePanelSelectedCard(sourceCanvas, seed, panel, gridH, references) {
  const baseCx = seed.x + seed.w / 2;
  const baseCy = seed.y + seed.h / 2;
  let best = null;
  const seedFooter = seed.footer || seed.portraitMetrics?.footer || cardFooterMetrics(sourceCanvas, seed);
  const recoveryEligibleSlot = seed.slotKey === "L1-0" || /^\d+:[LR]:\d+$/.test(seed.slotKey || "");
  // Do not let an already healthy upper card walk down onto the next hero.
  // The old unconditional L1 recovery produced two identical crops and lost
  // 오르카 in the 마비킥 sample. Wide recovery is only for a genuinely clipped
  // seed whose footer/reference evidence is weak.
  const needsDownwardRecovery = recoveryEligibleSlot && (
    !seed.validUi ||
    (seedFooter.blackAnchorRatio || 0) < 0.18 ||
    (seed.heroSimilarity || 0) < 0.75
  );
  const verticalOffsets = needsDownwardRecovery
    ? [-0.006, 0, 0.006, 0.024, 0.036, 0.048, 0.060, 0.072]
    : [-0.006, 0, 0.006];
  for (const dx of [-0.006, 0, 0.006]) {
    // Some narrow iPhone layouts place a lower-left hero one row step below
    // the generic formation anchor. Include downward-only recovery offsets;
    // the visual/footer score keeps normally aligned cards at their seed.
    for (const dy of verticalOffsets) {
          const w = seed.w, h = seed.h;
          const rect = clampRect({
            x: baseCx + dx * panel.w - w / 2,
            y: baseCy + dy * gridH - h / 2,
            w, h, slotKey: seed.slotKey,
          }, sourceCanvas.width, sourceCanvas.height);
          const metrics = portraitVisualMetrics(sourceCanvas, rect);
          const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
          const validUi = !metrics.emptyLike && metrics.std >= 28 && (footer.edgeRatio >= 0.016 || footer.colorfulRatio >= 0.018);
          const heroMatch = needsDownwardRecovery && validUi
            ? quickHeroBestMatch(sourceCanvas, rect, references)
            : { score: -1, name: "", margin: 0 };
          const score = Math.min(metrics.std, 80) / 80 * 0.52 + Math.min(footer.colorfulRatio, 0.40) * 0.95 + Math.min(footer.edgeRatio, 0.45) * 0.42 + (needsDownwardRecovery ? Math.min(1, footer.blackAnchorRatio || 0) * 0.68 : 0) +
            (validUi ? 0.18 : -0.65) + (needsDownwardRecovery ? Math.max(0, heroMatch.score) * 2.40 + Math.max(0, heroMatch.margin) * 0.35 : 0);
          if (!best || score > best.refineScore) best = { ...rect, metrics, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer, validUi, refineScore: score, heroMatch };
    }
  }
  if (!best) return seed;
  const match = best.heroMatch?.score >= 0 ? best.heroMatch : quickHeroBestMatch(sourceCanvas, best, references);
  return { ...best, heroSimilarity: match.score, heroMargin: match.margin || 0, heroNameHint: match.name || '' };
}

function refineSelectedCardByFooterConsensus(sourceCanvas, seed, panel, gridH, references) {
  if (!seed || !panel || !references?.length) return seed;
  const baseMetrics = seed.metrics || seed.portraitMetrics || portraitVisualMetrics(sourceCanvas, seed);
  const baseFooter = seed.footer || baseMetrics.footer || cardFooterMetrics(sourceCanvas, seed);
  const baseMatch = quickHeroBestMatch(sourceCanvas, seed, references);
  const baseBlack = baseFooter.blackAnchorRatio || 0;
  // A visible footer means the existing visual/reference refinement already
  // found the vertical card bounds. Do not second-guess a healthy crop; this
  // pass is reserved for the clipped-above-card failure mode.
  if (baseBlack >= 0.18) return seed;
  const baseCx = seed.x + seed.w / 2;
  const baseCy = seed.y + seed.h / 2;
  const structuralCandidates = [];

  // The near-black star/equipment strip is more stable than the portrait
  // itself across phones. Find it independently around the selected slot,
  // then require the portrait reference to agree before moving the crop.
  for (const dx of [-0.008, 0, 0.008]) {
    // gridH is roughly one card-row step. The previous ±0.08 range was only
    // a few pixels on dense S25 captures; cover up to about a quarter row so
    // a crop starting above the portrait can reach its true black footer.
    for (const dy of [-0.040, -0.020, 0, 0.020, 0.030, 0.033, 0.035, 0.040, 0.060, 0.080, 0.100, 0.120, 0.160, 0.200, 0.240, 0.280]) {
      const rect = clampRect({
        ...seed,
        x: baseCx + dx * panel.w - seed.w / 2,
        y: baseCy + dy * gridH - seed.h / 2,
      }, sourceCanvas.width, sourceCanvas.height);
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      if (cx < panel.x - panel.w * 0.03 || cx > panel.x + panel.w * 1.03 ||
          cy < panel.y + panel.h * 0.12 || cy > panel.y + panel.h * 0.90) continue;
      const metrics = portraitVisualMetrics(sourceCanvas, rect);
      const footer = metrics.footer || cardFooterMetrics(sourceCanvas, rect);
      const validUi = !metrics.emptyLike && metrics.std >= 28 &&
        (footer.edgeRatio >= 0.016 || footer.colorfulRatio >= 0.018);
      if (!validUi || (footer.blackAnchorRatio || 0) < 0.10) continue;
      const structuralScore = Math.min(1, footer.blackAnchorRatio || 0) * 1.38 +
        Math.min(0.45, footer.colorfulRatio || 0) * 0.42 +
        Math.min(0.45, footer.edgeRatio || 0) * 0.28 +
        Math.min(80, metrics.std) / 80 * 0.22 - Math.max(0, Math.abs(dy) - 0.018) * 0.35;
      structuralCandidates.push({ ...rect, metrics, portraitMetrics: metrics, portraitScore: metrics.portraitScore, footer, validUi, structuralScore, footerOffsetRatio: dy });
    }
  }
  if (!structuralCandidates.length) return seed;

  structuralCandidates.sort((a, b) => b.structuralScore - a.structuralScore);
  const evaluatedCandidates = [];
  let best = {
    ...seed,
    metrics: baseMetrics,
    portraitMetrics: baseMetrics,
    footer: baseFooter,
    heroMatch: baseMatch,
    consensusScore: baseBlack * 1.38 + Math.max(0, baseMatch.score) * 1.75 + Math.max(0, baseMatch.margin) * 0.22,
  };
  // A crop whose footer is missing is precisely the case this pass is meant
  // to recover. Evaluate every nearby structural candidate (at most 48) so a
  // strong portrait score from a vertically clipped crop cannot hide the
  // correctly anchored one.
  for (const candidate of structuralCandidates) {
    const heroMatch = quickHeroBestMatch(sourceCanvas, candidate, references);
    const consensusScore = candidate.structuralScore + Math.max(0, heroMatch.score) * 1.75 + Math.max(0, heroMatch.margin) * 0.22;
    evaluatedCandidates.push({ candidate, heroMatch, consensusScore });
    if (consensusScore > best.consensusScore) best = { ...candidate, heroMatch, consensusScore };
  }

  // If the original crop has no footer at all, a nearly full-black strip can
  // mean we moved too far down. In that failure mode, prefer a candidate that
  // contains a real partial footer and has an unambiguous reference match.
  if (baseBlack < 0.18) {
    const recovery = evaluatedCandidates
      .filter(({ candidate }) => {
        const black = candidate.footer?.blackAnchorRatio || 0;
        return black >= 0.10 && black <= 0.78;
      })
      .sort((a, b) => (b.heroMatch.score + b.heroMatch.margin * 0.30) - (a.heroMatch.score + a.heroMatch.margin * 0.30))[0];
    if (recovery && recovery.heroMatch.score >= 0.90 && recovery.heroMatch.margin >= 0.04 &&
        recovery.heroMatch.score >= baseMatch.score + 0.06) {
      best = { ...recovery.candidate, heroMatch: recovery.heroMatch, consensusScore: recovery.consensusScore, footerReferenceRecovery: true };
    }

    // Costumes can be visually far from the shipped portrait references. In
    // that case reference agreement must not keep a crop floating above the
    // actual card. A real card still has two independent structural anchors:
    // a near-black bottom strip and colorful/edged star UI. Only accept a
    // nearby downward move with a large black-strip gain, so an empty red slot
    // or the next formation row cannot pull the crop away.
    const footerGeometryRecovery = evaluatedCandidates
      .filter(({ candidate, heroMatch }) => {
        const black = candidate.footer?.blackAnchorRatio || 0;
        const colorful = candidate.footer?.colorfulRatio || 0;
        const edge = candidate.footer?.edgeRatio || 0;
        const dy = candidate.footerOffsetRatio || 0;
        const strongFooter = black >= 0.62 && black - baseBlack >= 0.42 && colorful >= 0.12 && edge >= 0.045;
        const partialFooter = baseBlack < 0.06 && black >= 0.46 && black - baseBlack >= 0.36 && colorful >= 0.16 && edge >= 0.10;
        return dy >= 0.018 && dy <= 0.13 &&
          (strongFooter || partialFooter) &&
          candidate.metrics?.std >= 32 && heroMatch.score >= 0.28;
      })
      .sort((a, b) => {
        const score = ({ candidate, heroMatch }) =>
          (candidate.footer?.blackAnchorRatio || 0) * 1.55 +
          Math.min(0.45, candidate.footer?.colorfulRatio || 0) * 0.48 +
          Math.min(0.45, candidate.footer?.edgeRatio || 0) * 0.30 +
          Math.max(0, heroMatch.score) * 0.20 -
          Math.abs(candidate.footerOffsetRatio || 0) * 0.35;
        return score(b) - score(a);
      })[0];
    if (footerGeometryRecovery) {
      const referenceChoiceHasFooter = (best.footer?.blackAnchorRatio || 0) >= 0.62;
      const geometryBlack = footerGeometryRecovery.candidate.footer?.blackAnchorRatio || 0;
      const referenceBlack = best.footer?.blackAnchorRatio || 0;
      if (!referenceChoiceHasFooter || geometryBlack >= referenceBlack - 0.08) {
        best = {
          ...footerGeometryRecovery.candidate,
          heroMatch: footerGeometryRecovery.heroMatch,
          consensusScore: footerGeometryRecovery.consensusScore,
          footerGeometryRecovery: true,
        };
      }
    }
  }

  const moved = Math.hypot(best.x - seed.x, best.y - seed.y) > Math.max(1.5, seed.w * 0.018);
  if (!moved || !best.heroMatch) return seed;
  const bestBlack = best.footer?.blackAnchorRatio || 0;
  const blackGain = bestBlack - baseBlack;
  const referenceGain = best.heroMatch.score - baseMatch.score;
  const sameHero = Boolean(best.heroMatch.name && best.heroMatch.name === baseMatch.name);
  const missingBaseFooter = best.footerReferenceRecovery === true || best.footerGeometryRecovery === true ||
    (baseBlack < 0.18 && bestBlack >= 0.56 && best.heroMatch.score >= 0.84 && best.heroMatch.margin >= 0.008);
  const referenceCompatible = missingBaseFooter || sameHero || referenceGain >= 0.045 ||
    (baseMatch.margin < 0.012 && best.heroMatch.margin >= 0.025 && referenceGain >= 0.015);
  const footerClearlyBetter = best.footerReferenceRecovery === true || best.footerGeometryRecovery === true ||
    (bestBlack >= 0.56 && blackGain >= 0.20 &&
      (missingBaseFooter || best.heroMatch.score >= baseMatch.score - 0.025));
  const portraitClearlyBetter = referenceGain >= 0.065 && bestBlack >= Math.max(0.46, baseBlack - 0.04);
  if (!referenceCompatible || (!footerClearlyBetter && !portraitClearlyBetter)) return seed;
  return {
    ...best,
    heroSimilarity: best.heroMatch.score,
    heroMargin: best.heroMatch.margin || 0,
    heroNameHint: best.heroMatch.name || '',
    footerConsensus: true,
  };
}

function nicknameCropFromPanel(panel, gridH, iw, ih) {
  // 패널 헤더 전체를 조금 넉넉하게 넘기고 실제 글자 줄은 메인 스레드에서 다시 타이트하게 찾습니다.
  return clampRect({
    x: panel.x + panel.w * 0.055,
    y: panel.y + gridH * 0.000,
    w: panel.w * 0.77,
    h: gridH * 0.135,
  }, iw, ih);
}

function detectCardsPanelFirst(sourceCanvas, iw, ih, references = []) {
  if (!references?.length) return null;
  const panelCandidates = detectOpponentPanelCandidates(sourceCanvas, iw, ih, 8);
  if (!panelCandidates.length) return null;
  let best = null;
  // 패널 외곽선 점수가 높은 후보부터 최대 6개만 정밀 평가합니다.
  for (const panel of panelCandidates.slice(0, 6)) {
    const specific = evaluateTeamPanelCandidate(sourceCanvas, panel, references);
    let evaluated = specific;
    // 전용 슬롯 템플릿이 충분히 신뢰되면 일반 4개 진형 전체 탐색을 생략합니다.
    if (!specific || specific.validCount < 3 || specific.minSimilarity < 0.36) {
      const generic = evaluatePanelCandidate(sourceCanvas, panel, references);
      if ((generic?.objective || -Infinity) > (specific?.objective || -Infinity)) evaluated = generic;
    }
    if (!evaluated) continue;
    if (!best || evaluated.objective > best.objective) best = evaluated;
    // 매우 강한 패널이면 나머지 후보를 더 볼 필요가 없습니다.
    const bestRightEdgeRatio = (best.panel.x + best.panel.w) / Math.max(1, iw);
    if (best.validCount >= 3 && best.minSimilarity >= 0.58 && bestRightEdgeRatio >= 0.74) break;
  }
  if (!best) return null;

  const refined = best.top.map((slot) => {
    const visual = refinePanelSelectedCard(sourceCanvas, slot, best.panel, best.gridH, references);
    const black = visual.footer?.blackAnchorRatio ?? visual.metrics?.footer?.blackAnchorRatio ?? 0;
    const footerAligned = black < 0.18
      ? refineSelectedCardByFooterConsensus(sourceCanvas, visual, best.panel, best.gridH, references)
      : visual;
    return refineSelectedCardByTypeBadge(sourceCanvas, footerAligned, references);
  });
  // A refinement may discover the right footer but walk two neighboring slot
  // seeds onto the same portrait. Reject this panel candidate entirely; the
  // independent line-grid/adaptive paths can recover it without returning a
  // duplicated hero card.
  if (!areDetectedCardsDistinct(refined)) return null;
  const valid = refined.filter((x) => x.validUi && !x.inPetZone && x.heroSimilarity >= 0.36 && x.metrics?.std >= 38);
  if (valid.length !== 3) return null;
  const cards = valid.sort((a, b) => a.y - b.y || a.x - b.x);
  const fourth = best.slots.find((x) => !best.top.includes(x));
  const quality = Math.max(0, Math.min(...cards.map((x) => x.normalizedScore || 0)) - (fourth?.normalizedScore || 0));
  return {
    cards, quality, candidateCount: panelCandidates.length,
    nicknameCrop: nicknameCropFromDetectedPanel(sourceCanvas, best.panel, best.gridH, cards, iw, ih),
    detector: best.profile === "team-fixed-v2.2" ? "panel-team-fixed-reference-v3" : "panel-grid-reference-v3",
    leftCount: best.leftCount || 0, panel: best.panel,
    minHeroSimilarity: Math.min(...cards.map((x) => x.heroSimilarity || -1)),
  };
}

// 15월의 인식엔진 2.2.0 - 적응형 앵커 탐색
// 폰 해상도/화면비가 달라도 먼저 실제 카드처럼 보이는 사각형 1~3개를 앵커로 찾은 뒤,
// 그 카드의 실제 크기와 간격을 기준으로 주변 슬롯을 복원합니다.
function broadHeroPosition(rect,iw,ih){
  const cx=(rect.x+rect.w/2)/iw,cy=(rect.y+rect.h/2)/ih;
  return cx>=0.525&&cx<=0.82&&cy>=0.21&&cy<=0.68&&!(cx>0.665&&cy<0.47);
}

function adaptiveCandidateVariants(raw,iw,ih){
  const cx=raw.x+raw.w/2,cy=raw.y+raw.h/2;
  const out=[];
  const push=(w,h)=>{if(w<ih*0.052||h<ih*0.055||w>ih*0.115||h>ih*0.125)return;const r=clampRect({x:cx-w/2,y:cy-h/2,w,h,searchMode:"adaptive-anchor"},iw,ih);if(broadHeroPosition(r,iw,ih))out.push(r);};
  push(raw.w*1.02,raw.h*1.02);
  push(raw.w,raw.w*1.06);
  push(raw.h/1.06,raw.h);
  const s=Math.sqrt(Math.max(1,raw.w*raw.h)); push(s*0.95,s*1.03);
  return out;
}

function scoreAdaptiveCard(sourceCanvas,rect,references){
  const metrics=portraitVisualMetrics(sourceCanvas,rect);
  if(metrics.emptyLike||metrics.std<24||metrics.uniqueBins<24)return null;
  const footer=metrics.footer||cardFooterMetrics(sourceCanvas,rect);
  const match=quickHeroBestMatch(sourceCanvas,rect,references);
  const visualBonus=Math.min(0.075,footer.colorfulRatio*0.20)+Math.min(0.045,footer.edgeRatio*0.15);
  const score=match.score+visualBonus+Math.min(0.02,match.margin*0.22);
  return {...rect,portraitMetrics:metrics,portraitScore:metrics.portraitScore,footer,heroSimilarity:match.score,heroNameHint:match.name,heroMargin:match.margin,adaptiveScore:score,searchMode:"adaptive-anchor"};
}

function dedupeAdaptive(items,limit=28){
  const out=[];
  for(const item of items){
    const dup=out.some(k=>{const dx=(item.x+item.w/2)-(k.x+k.w/2),dy=(item.y+item.h/2)-(k.y+k.h/2);const m=Math.min(item.w,item.h,k.w,k.h);return rectIou(item,k)>0.15||Math.hypot(dx,dy)<m*0.58;});
    if(!dup)out.push(item); if(out.length>=limit)break;
  }
  return out;
}

function generateAnchorCompletion(sourceCanvas,anchors,iw,ih,references){
  const out=[];
  for(const anchor of anchors.slice(0,6)){
    const w=anchor.w,h=anchor.h,cx=anchor.x+w/2,cy=anchor.y+h/2;
    // 두 열 + 여러 행을 카드 자체 크기로 생성합니다. 특정 폰의 픽셀 좌표는 사용하지 않습니다.
    for(const col of [-1.10,-0.55,0,0.55,1.10]){
      for(const row of [-3,-2,-1,0,1,2,3]){
        if(col===0&&row===0)continue;
        for(const scale of [0.94,1.04]){
          const rw=w*scale,rh=h*scale;
          const rect=clampRect({x:cx+col*w-rw/2,y:cy+row*h*0.98-rh/2,w:rw,h:rh,searchMode:"adaptive-anchor"},iw,ih);
          if(!broadHeroPosition(rect,iw,ih))continue;
          const scored=scoreAdaptiveCard(sourceCanvas,rect,references);
          if(scored&&scored.heroSimilarity>=0.30)out.push(scored);
        }
      }
    }
  }
  return out;
}

function refineAdaptiveCard(sourceCanvas,seed,iw,ih,references){
  const cx=seed.x+seed.w/2,cy=seed.y+seed.h/2;let best=seed;
  for(const ws of [0.90,0.98,1.06])for(const hs of [0.92,1.00,1.08])for(const dx of [-0.08,0,0.08])for(const dy of [-0.07,0,0.07]){
    const w=seed.w*ws,h=seed.h*hs;const rect=clampRect({x:cx+dx*seed.w-w/2,y:cy+dy*seed.h-h/2,w,h,searchMode:"adaptive-anchor"},iw,ih);
    if(!broadHeroPosition(rect,iw,ih))continue;const s=scoreAdaptiveCard(sourceCanvas,rect,references);if(s&&s.adaptiveScore>(best.adaptiveScore??-1))best=s;
  }
  return best;
}

function chooseAdaptiveThree(ranked){
  const pool=ranked.slice(0,18);let best=null;
  for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let c=b+1;c<pool.length;c++){
    const combo=[pool[a],pool[b],pool[c]];let bad=false;
    for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const p=combo[i],q=combo[j],dx=(p.x+p.w/2)-(q.x+q.w/2),dy=(p.y+p.h/2)-(q.y+q.h/2),m=Math.min(p.w,p.h,q.w,q.h);if(rectIou(p,q)>0.10||Math.hypot(dx,dy)<m*0.74)bad=true;}
    if(bad)continue;const sides=combo.map(x=>Math.sqrt(x.w*x.h)),avg=sides.reduce((s,x)=>s+x,0)/3,spread=(Math.max(...sides)-Math.min(...sides))/Math.max(1,avg);if(spread>0.34)continue;
    const xs=combo.map(x=>x.x+x.w/2).sort((x,y)=>x-y),ys=combo.map(x=>x.y+x.h/2).sort((x,y)=>x-y);if(xs[2]-xs[0]>avg*2.4)continue;
    const objective=combo.reduce((s,x)=>s+(x.adaptiveScore||0),0)-spread*0.42-((ys[2]-ys[0])<avg*0.25?0.18:0);
    if(!best||objective>best.objective)best={objective,combo};
  }
  return best?.combo||selectSpatiallyDistinct(pool,3);
}

function detectCardsAdaptiveAnchor(sourceCanvas,iw,ih,references=[]){
  if(!references?.length)return null;
  const raw=detectRawCandidatesPure(sourceCanvas,iw,ih);const scored=[];
  for(const r of raw.slice(0,180))for(const rect of adaptiveCandidateVariants(r,iw,ih)){const s=scoreAdaptiveCard(sourceCanvas,rect,references);if(s&&s.heroSimilarity>=0.28)scored.push(s);}
  scored.sort((a,b)=>b.adaptiveScore-a.adaptiveScore);let anchors=dedupeAdaptive(scored,24);
  if(anchors.length){const completed=generateAnchorCompletion(sourceCanvas,anchors,iw,ih,references);anchors=dedupeAdaptive([...anchors,...completed].sort((a,b)=>b.adaptiveScore-a.adaptiveScore),30);}
  if(anchors.length<3)return null;
  const refined=anchors.slice(0,18).map(x=>refineAdaptiveCard(sourceCanvas,x,iw,ih,references)).sort((a,b)=>b.adaptiveScore-a.adaptiveScore);
  const cards=chooseAdaptiveThree(refined);if(cards.length!==3)return null;
  const minSimilarity=Math.min(...cards.map(x=>x.heroSimilarity||-1));if(minSimilarity<0.38)return null;
  const colorful = cards.map((x) => (x.footer || x.portraitMetrics?.footer || cardFooterMetrics(sourceCanvas, x)).colorfulRatio || 0);
  if (colorful.filter((x) => x >= 0.14).length < 2 || Math.min(...colorful) < 0.04) return null;
  const sorted=cards.sort((a,b)=>a.y-b.y||a.x-b.x);
  return {cards:sorted,quality:Math.max(0,minSimilarity-0.30),candidateCount:raw.length,nicknameCrop:nicknameCropFromCards(sorted,iw,ih,"adaptive-anchor"),detector:"adaptive-anchor-reference-v3",leftCount:0,minHeroSimilarity:minSimilarity};
}

function detectCardsPure(sourceCanvas, iw, ih, references = []) {
  // Run both geometry paths. Normal full-screen captures are usually best on
  // the fast line-grid path, while aggressively cropped desktop images need
  // the complete-panel path. Reference evidence decides between them.
  const lineGridV3 = detectCardsPanelLineGridV3(sourceCanvas, iw, ih, references);
  const panelFirst = detectCardsPanelFirst(sourceCanvas, iw, ih, references);
  if (lineGridV3?.cards?.length === 3 && panelFirst?.cards?.length === 3) {
    const lineScore = Number(lineGridV3.minHeroSimilarity || 0);
    const panelScore = Number(panelFirst.minHeroSimilarity || 0);
    const minBlackAnchor = (detection) => Math.min(...detection.cards.map((card) =>
      Number(card.footer?.blackAnchorRatio ?? card.portraitMetrics?.footer?.blackAnchorRatio ?? 0)));
    const lineBlack = minBlackAnchor(lineGridV3);
    const panelBlack = minBlackAnchor(panelFirst);
    // A large false panel can still match a face fragment very strongly while
    // missing the black star strip on two cards. When the independent line
    // grid has that footer on all three cards, trust the structural evidence.
    // The inverse rule keeps tall/narrow phone captures on panel-first when
    // the line grid itself is the path missing the footer.
    const chosen = panelBlack < 0.30 && lineBlack >= 0.46
      ? lineGridV3
      : lineBlack < 0.30 && panelBlack >= 0.46
        ? panelFirst
        : panelScore >= lineScore + 0.055 ? panelFirst : lineGridV3;
    return chosen;
  }
  if (lineGridV3?.cards?.length === 3) return lineGridV3;
  if (panelFirst?.cards?.length === 3) return panelFirst;

  // 패널 외곽선을 찾지 못한 기기/화면비에서만 적응형 앵커 탐색을 사용합니다.
  const adaptive = detectCardsAdaptiveAnchor(sourceCanvas, iw, ih, references);
  if (adaptive?.cards?.length === 3) return adaptive;

  // 기존 방식은 패널/적응형 앵커 탐색이 모두 실패한 특이 캡처에만 사용하는 fallback입니다.
  // v8.4 우선순위:
  // 1) 화면 모드별 정규화 슬롯 프로필을 모두 검사
  // 2) 79개 기준 초상화와 실제 유사도가 가장 높은 프로필/진형을 선택
  // 3) 선택된 5개 슬롯 안에서만 미세 정렬 -> 칸 밖으로 도망가는 현상 방지
  // 4) 윤곽선 검출은 보조 수단으로만 사용
  const raw = detectRawCandidatesPure(sourceCanvas, iw, ih);
  const edgeBase = chooseCards(sourceCanvas, iw, ih, raw);
  const edgeCardsSnapped = selectSpatiallyDistinct(edgeBase.cards.map((card) => snapCardToLocalFrame(sourceCanvas, card, iw, ih, "")).sort((a,b)=>(b.score||0)-(a.score||0)), 3);
  const edge = { ...edgeBase, cards: edgeCardsSnapped };

  const normalizedCandidates = preferredHeightProfiles(sourceCanvas, iw, ih)
    .map((profile) => evaluateHeightAnchoredProfile(sourceCanvas, iw, ih, profile))
    .filter(Boolean)
    .map((geometry) => ({ geometry, refScore: scoreGeometrySeedsByReferences(sourceCanvas, geometry, references) }))
    .sort((a, b) => b.refScore.score - a.refScore.score);

  let normalized = null;
  const familyBest = new Map();
  for (const c of normalizedCandidates) {
    const family = c.geometry.family || c.geometry.profile || "unknown";
    if (!familyBest.has(family)) familyBest.set(family, c);
  }
  const refinePool = [];
  const seenProfiles = new Set();
  for (const c of [...normalizedCandidates.slice(0, 2), ...familyBest.values()]) {
    if (!c?.geometry || seenProfiles.has(c.geometry.profile)) continue;
    seenProfiles.add(c.geometry.profile);
    refinePool.push(c);
    if (refinePool.length >= 6) break;
  }
  const refinedNormalized = [];
  for (const candidate of refinePool) {
    const refined = refineSelectedGeometryByReferences(sourceCanvas, iw, ih, candidate.geometry, references);
    if (!refined?.cards?.length) continue;
    refined.leftCount = candidate.geometry.leftCount;
    refined.family = candidate.geometry.family || "unknown";
    const sims = refined.cards.map((c) => c.heroSimilarity || 0);
    refined.finalScore = sims.reduce((a, b) => a + b, 0) * 100 + Math.min(...sims) * 88 + (refined.quality || 0) * 0.35;
    refinedNormalized.push(refined);
  }
  refinedNormalized.sort((a, b) => b.finalScore - a.finalScore);
  normalized = refinedNormalized[0] || null;

  // 기존 16:9 기반 geometry는 아주 오래된/특이 캡처용 fallback으로만 남긴다.
  const coarseLegacy = evaluateGeometry(sourceCanvas, iw, ih, GEOM_COARSE);
  const legacyRerank = rerankKnownGeometrySlots(sourceCanvas, iw, ih, coarseLegacy, references);
  const legacyCards = (legacyRerank?.cards || coarseLegacy?.slots || []).sort((a, b) => a.y - b.y || a.x - b.x);

  const edgeValid = edge.cards.length === 3 && edge.cards.every((card) => isPlausibleHeroCard(sourceCanvas, card, iw, ih, 44, ""));
  const normalizedValid = normalized?.cards?.length === 3 && normalized.cards.every((card) => isPlausibleHeroCard(sourceCanvas, card, iw, ih, 38, normalized.profile || ""));
  const legacyValid = legacyCards.length === 3 && legacyCards.every((card) => isPlausibleHeroCard(sourceCanvas, card, iw, ih, 40, "legacy"));

  const minRef = (cards) => cards?.length === 3 ? Math.min(...cards.map((c) => Number.isFinite(c.heroSimilarity) ? c.heroSimilarity : quickHeroSimilarity(sourceCanvas, c, references))) : -1;
  const normalizedRef = normalizedValid ? minRef(normalized.cards) : -1;
  const edgeRef = edgeValid ? minRef(edge.cards) : -1;
  const legacyRef = legacyValid ? minRef(legacyCards) : -1;

  if (normalizedValid && normalizedRef >= 0.36 && normalizedRef >= Math.max(edgeRef - 0.035, legacyRef - 0.025)) {
    return {
      cards: normalized.cards,
      quality: normalized.quality || 0,
      candidateCount: raw.length,
      nicknameCrop: nicknameCropFromCards(normalized.cards, iw, ih, normalized.profile),
      detector: `screen-exactbox-${normalized.profile}-reference-v1`,
      leftCount: normalized.leftCount || 0,
    };
  }

  if (edgeValid && edgeRef >= Math.max(0.39, legacyRef - 0.02)) {
    const cards = edge.cards.map((c) => ({ ...c, heroSimilarity: quickHeroSimilarity(sourceCanvas, c, references) }));
    return { ...edge, cards, nicknameCrop: nicknameCropFromCards(cards, iw, ih), detector: "edge-exactbox-reference-v1" };
  }

  if (legacyValid) {
    return {
      cards: legacyCards,
      quality: legacyRerank?.quality || 0,
      candidateCount: raw.length,
      nicknameCrop: nicknameCropFromCards(legacyCards, iw, ih),
      detector: "legacy-exactbox-reference-v1",
      leftCount: coarseLegacy?.leftCount || 0,
    };
  }

  if (normalized?.cards?.length === 3) {
    return {
      cards: normalized.cards,
      quality: normalized.quality || 0,
      candidateCount: raw.length,
      nicknameCrop: nicknameCropFromCards(normalized.cards, iw, ih, normalized.profile),
      detector: `screen-framefit-low-confidence-${normalized.profile}-v1`,
      leftCount: normalized.leftCount || 0,
    };
  }

  return { ...edge, nicknameCrop: nicknameCropFromCards(edge.cards, iw, ih), detector: "edge-exactbox-low-confidence-v1" };
}

function normalizeVector(values, standardize = false) {
  const out = new Float32Array(values.length);
  if (!values.length) return out;
  let mean = 0;
  if (standardize) {
    for (let i = 0; i < values.length; i += 1) mean += values[i];
    mean /= values.length;
  }
  let scale = 1;
  if (standardize) {
    let v = 0;
    for (let i = 0; i < values.length; i += 1) { const d = values[i] - mean; v += d * d; }
    scale = Math.sqrt(v / values.length) || 1;
  }
  let norm = 0;
  for (let i = 0; i < values.length; i += 1) {
    const x = (values[i] - mean) / scale;
    out[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i += 1) out[i] /= norm;
  return out;
}

function rgbToHsv01(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  return [h, max <= 1e-6 ? 0 : d / max, max];
}

function isDescPixel(x, y) {
  if (x < 2 || x >= 30 || y < 2 || y >= 21) return false;
  if (x >= 23 && y >= 1 && y < 12) return false;
  if (x < 9 && y >= 16) return false;
  if (x >= 13 && y >= 18) return false;
  return true;
}

function descriptorFromCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, DESC_W, DESC_H).data;
  const count = DESC_W * DESC_H;
  const gray = new Float32Array(count), rgb = new Float32Array(count * 3);
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    rgb[p * 3] = r; rgb[p * 3 + 1] = g; rgb[p * 3 + 2] = b;
    gray[p] = r * 0.299 + g * 0.587 + b * 0.114;
  }
  const gxAll = new Float32Array(count), gyAll = new Float32Array(count);
  for (let y = 1; y < DESC_H - 1; y += 1) {
    for (let x = 1; x < DESC_W - 1; x += 1) {
      const idx = y * DESC_W + x;
      const tl = gray[idx - DESC_W - 1], tc = gray[idx - DESC_W], tr = gray[idx - DESC_W + 1];
      const ml = gray[idx - 1], mr = gray[idx + 1];
      const bl = gray[idx + DESC_W - 1], bc = gray[idx + DESC_W], br = gray[idx + DESC_W + 1];
      gxAll[idx] = -tl + tr - 2 * ml + 2 * mr - bl + br;
      gyAll[idx] = -tl - 2 * tc - tr + bl + 2 * bc + br;
    }
  }
  const selectedGray = [], gradient = [], hog = new Float32Array(4 * 4 * 9), hist = new Float32Array(24);
  for (let y = 0; y < DESC_H; y += 1) {
    for (let x = 0; x < DESC_W; x += 1) {
      if (!isDescPixel(x, y)) continue;
      const idx = y * DESC_W + x;
      selectedGray.push(gray[idx]);
      gradient.push(gxAll[idx], gyAll[idx]);
      const gx = gxAll[idx], gy = gyAll[idx], mag = Math.sqrt(gx * gx + gy * gy);
      let angle = Math.atan2(gy, gx); if (angle < 0) angle += Math.PI; if (angle >= Math.PI) angle -= Math.PI;
      const bin = Math.min(8, Math.floor((angle / Math.PI) * 9));
      const cx = Math.min(3, Math.floor((x / DESC_W) * 4)), cy = Math.min(3, Math.floor((y / DESC_H) * 4));
      hog[(cy * 4 + cx) * 9 + bin] += mag;
      const base = idx * 3;
      const [hh, ss, vv] = rgbToHsv01(rgb[base], rgb[base + 1], rgb[base + 2]);
      hist[Math.min(7, Math.floor(hh * 8))] += 1;
      hist[8 + Math.min(7, Math.floor(ss * 8))] += 1;
      hist[16 + Math.min(7, Math.floor(vv * 8))] += 1;
    }
  }
  return { gray: normalizeVector(selectedGray, true), gradient: normalizeVector(gradient), hog: normalizeVector(hog), hist: normalizeVector(hist) };
}

function descriptorDot(a, b) {
  const n = Math.min(a?.length || 0, b?.length || 0);
  let s = 0;
  for (let i = 0; i < n; i += 1) s += a[i] * b[i];
  return s;
}

function compareDescriptor(a, b) {
  if (!a || !b) return -1;
  return descriptorDot(a.gray, b.gray) * 0.25 + descriptorDot(a.gradient, b.gradient) * 0.15 + descriptorDot(a.hog, b.hog) * 0.25 + descriptorDot(a.hist, b.hist) * 0.35;
}

function decodeDescriptorVector(encoded) {
  if (!encoded) return new Float32Array();
  const binary = atob(encoded);
  const values = new Float32Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) values[i] = (binary.charCodeAt(i) - 128) / 127;
  return normalizeVector(values);
}

function deserializeDescriptor(payload) {
  if (!payload || Number(payload.version) !== 3) return null;
  try {
    return { gray: decodeDescriptorVector(payload.gray), gradient: decodeDescriptorVector(payload.gradient), hog: decodeDescriptorVector(payload.hog), hist: decodeDescriptorVector(payload.hist) };
  } catch { return null; }
}

function decodeGray40Base64(encoded) {
  if (!encoded) return null;
  try {
    const binary = atob(encoded);
    if (binary.length !== REF_W * REF_H) return null;
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch { return null; }
}

function rgbFromBase64(encoded) {
  const binary = atob(encoded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function refCanvasFromRgb(rgb) {
  const c = makeCanvas(REF_W, REF_H);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const img = ctx.createImageData(REF_W, REF_H);
  for (let p = 0, i = 0; p < REF_W * REF_H; p += 1, i += 4) {
    img.data[i] = rgb[p * 3]; img.data[i + 1] = rgb[p * 3 + 1]; img.data[i + 2] = rgb[p * 3 + 2]; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function referenceDescriptorFromRgb(rgb) {
  const src = refCanvasFromRgb(rgb);
  const c = makeCanvas(DESC_W, DESC_H);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, DESC_W, DESC_H);
  // The reference pack already contains the portrait crop. Draw it into the
  // same normalized portrait square used for screenshot targets.
  ctx.drawImage(src, 0, 0, REF_W, REF_H, 0, 0, DESC_W, DESC_W);
  return descriptorFromCanvas(c);
}

function gray40FromRgb(rgb) {
  const out = new Uint8Array(REF_W * REF_H);
  for (let p = 0; p < out.length; p += 1) out[p] = Math.round(rgb[p * 3] * 0.299 + rgb[p * 3 + 1] * 0.587 + rgb[p * 3 + 2] * 0.114);
  return out;
}

async function loadReferencePack() {
  if (referencePackPromise) return referencePackPromise;
  referencePackPromise = (async () => {
    const response = await fetch(REF_PACK_URL, { cache: "force-cache" });
    if (!response.ok) throw new Error(`기준 데이터 로드 실패 (${response.status})`);
    const payload = await response.json();
    referenceTeamPriors = Array.isArray(payload.teamPriors)
      ? payload.teamPriors.filter((item) => Array.isArray(item?.heroes) && item.heroes.length === 3)
      : [];
    if (!Array.isArray(payload?.heroes) || payload.heroes.length < 70) throw new Error("기준 데이터가 손상됐습니다.");
    const refs = [];
    for (const item of payload.heroes) {
      const rgb = rgbFromBase64(item.rgb);
      refs.push({ name: item.name, descriptor: referenceDescriptorFromRgb(rgb), gray40: gray40FromRgb(rgb), learned: false, shared: false });
      for (const encoded of Array.isArray(item.screenshotVariants) ? item.screenshotVariants.slice(0, 16) : []) {
        const variantRgb = rgbFromBase64(encoded);
        refs.push({ name: item.name, descriptor: referenceDescriptorFromRgb(variantRgb), gray40: gray40FromRgb(variantRgb), learned: false, shared: false, screenshotVariant: true });
      }
    }
    return refs;
  })().catch((error) => { referencePackPromise = null; throw error; });
  return referencePackPromise;
}

function buildTargetVariants(sourceCanvas, card) {
  const cardCanvas = makeCanvas(CARD_W, CARD_H);
  const cardCtx = cardCanvas.getContext("2d", { willReadFrequently: true });
  cardCtx.drawImage(sourceCanvas, card.x, card.y, card.w, card.h, 0, 0, CARD_W, CARD_H);
  return TARGET_VARIANTS.map(({ scale, dx, dy }) => {
    const c = makeCanvas(DESC_W, DESC_H);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const centerX = DESC_W / 2;
    const centerY = (47 / CARD_H) * DESC_H;
    const dxSmall = (dx / CARD_W) * DESC_W;
    const dySmall = (dy / CARD_H) * DESC_H;
    ctx.save();
    ctx.translate(centerX + dxSmall, centerY + dySmall);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
    // Compare portrait to portrait. Excluding the footer keeps level, stars,
    // equipment and enhancement overlays from dominating the identity score.
    ctx.drawImage(cardCanvas, 2, 2, 94, 94, 0, 0, DESC_W, DESC_W);
    ctx.restore();
    return descriptorFromCanvas(c);
  });
}

function targetGray40(sourceCanvas, card) {
  const c = makeCanvas(REF_W, REF_H);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  // normalize target to the same portrait area as base refs: top 94/106 of card
  ctx.drawImage(sourceCanvas, card.x + card.w * (2 / CARD_W), card.y + card.h * (2 / CARD_H), card.w * (94 / CARD_W), card.h * (94 / CARD_H), 0, 0, REF_W, REF_H);
  const data = ctx.getImageData(0, 0, REF_W, REF_H).data;
  const gray = new Uint8Array(REF_W * REF_H);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) gray[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  return gray;
}

function scaleGray40(src, scale) {
  if (Math.abs(scale - 1) < 1e-6) return src;
  const out = new Uint8Array(REF_W * REF_H);
  const cx = (REF_W - 1) / 2, cy = (REF_H - 1) / 2;
  for (let y = 0; y < REF_H; y += 1) {
    for (let x = 0; x < REF_W; x += 1) {
      const sx = (x - cx) / scale + cx;
      const sy = (y - cy) / scale + cy;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= REF_W - 1 || y0 >= REF_H - 1) continue;
      const fx = sx - x0, fy = sy - y0;
      const i00 = y0 * REF_W + x0, i10 = i00 + 1, i01 = i00 + REF_W, i11 = i01 + 1;
      const v = src[i00] * (1 - fx) * (1 - fy) + src[i10] * fx * (1 - fy) + src[i01] * (1 - fx) * fy + src[i11] * fx * fy;
      out[y * REF_W + x] = Math.round(v);
    }
  }
  return out;
}

function nccShift(a, b, dx, dy) {
  const x0 = Math.max(3, 3 - dx), x1 = Math.min(REF_W - 8, REF_W - 8 - dx);
  const y0 = Math.max(3, 3 - dy), y1 = Math.min(REF_H - 14, REF_H - 14 - dy);
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = y0; y < y1; y += 1) {
    const by = y + dy;
    for (let x = x0; x < x1; x += 1) {
      // Ignore the class/equipment badge at lower-left and the rank badge at
      // upper-right. The remaining upper portrait is stable across level,
      // enhancement, equipment and star overlays.
      if ((x < 10 && y >= 14) || (x >= 27 && y < 12)) continue;
      const av = a[y * REF_W + x];
      const bv = b[by * REF_W + x + dx];
      n += 1; sa += av; sb += bv; saa += av * av; sbb += bv * bv; sab += av * bv;
    }
  }
  if (n < 100) return -1;
  const num = sab - (sa * sb) / n;
  const da = saa - (sa * sa) / n;
  const db = sbb - (sb * sb) / n;
  const den = Math.sqrt(Math.max(1e-9, da * db));
  return num / den;
}

function preciseGrayScore(target, ref) {
  let best = -1;
  for (const scale of NCC_SCALES) {
    const scaled = scaleGray40(ref, scale);
    for (const dy of NCC_SHIFTS) for (const dx of NCC_SHIFTS) best = Math.max(best, nccShift(target, scaled, dx, dy));
  }
  return best;
}

async function learnedReferenceFromDataUrl(item) {
  try {
    const response = await fetch(item.dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const c = makeCanvas(CARD_W, CARD_H);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, CARD_W, CARD_H);
    bitmap.close?.();
    const descCanvas = makeCanvas(DESC_W, DESC_H);
    descCanvas.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0, DESC_W, DESC_H);
    const descriptor = descriptorFromCanvas(descCanvas);
    const gCanvas = makeCanvas(REF_W, REF_H);
    gCanvas.getContext("2d", { willReadFrequently: true }).drawImage(c, 2, 2, 94, 94, 0, 0, REF_W, REF_H);
    const data = gCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, REF_W, REF_H).data;
    const gray40 = new Uint8Array(REF_W * REF_H);
    for (let p = 0, i = 0; p < gray40.length; p += 1, i += 4) gray40[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    return { name: item.name, descriptor, gray40, learned: true, shared: false, localCorrection: true };
  } catch { return null; }
}

async function buildSupplemental(localSamples, sharedReferences) {
  const out = [];
  const local = Array.isArray(localSamples) ? localSamples.slice(0, 50) : [];
  for (let i = 0; i < local.length; i += 1) {
    const ref = await learnedReferenceFromDataUrl(local[i]);
    if (ref) out.push(ref);
    if (i % 8 === 7) await sleepTick();
  }
  for (const item of Array.isArray(sharedReferences) ? sharedReferences : []) {
    const descriptor = item?.descriptor?.gray ? item.descriptor : deserializeDescriptor(item?.descriptor);
    if (!item?.name || !descriptor) continue;
    const adminReference = Boolean(item.adminReference);
    const gray40 = adminReference ? decodeGray40Base64(item.gray40) : null;
    out.push({
      name: item.name,
      descriptor,
      gray40,
      learned: !adminReference,
      shared: !adminReference,
      adminReference,
      referenceType: item.referenceType || "",
      sourceClass: item.sourceClass || "unknown",
      sampleCount: Number(item.sampleCount || 0),
    });
  }
  return out;
}

function coarseRanking(sourceCanvas, card, references) {
  const targets = buildTargetVariants(sourceCanvas, card);
  const scoreByName = new Map();
  for (const ref of references) {
    let best = -1;
    for (const t of targets) best = Math.max(best, compareDescriptor(t, ref.descriptor));
    if (ref.shared) best -= 0.006;
    else if (ref.learned) best -= 0.004;
    const prev = scoreByName.get(ref.name);
    if (prev == null || best > prev) scoreByName.set(ref.name, best);
  }
  return [...scoreByName.entries()].map(([name, score]) => ({ name, score, coarseScore: score })).sort((a, b) => b.score - a.score);
}

function refsByName(references) {
  const map = new Map();
  const baseCounts = new Map();
  for (const r of references) {
    if (!r.gray40) continue;
    const arr = map.get(r.name) || [];
    // Keep the calibrated base shortlist; the full shipped screenshot set
    // already participates in fastLearnedRanking. Administrator costumes must
    // remain available even when that base shortlist is full.
    const baseCount = baseCounts.get(r.name) || 0;
    if (r.adminReference || baseCount < 4) arr.push(r.gray40);
    if (!r.adminReference) baseCounts.set(r.name, baseCount + 1);
    map.set(r.name, arr);
  }
  return map;
}

function fastLearnedRanking(sourceCanvas, card, coarse, learnedReferences) {
  const usable = learnedReferences.filter((ref) => ref?.gray40);
  if (!usable.length) return null;
  const target = targetGray40(sourceCanvas, card);
  const coarseMap = new Map(coarse.map((item) => [item.name, item.coarseScore ?? item.score]));
  const scoreByName = new Map();
  for (const ref of usable) {
    const patchScore = preciseGrayScore(target, ref.gray40);
    const previous = scoreByName.get(ref.name);
    if (!previous || patchScore > previous.patchScore) {
      const coarseScore = coarseMap.get(ref.name) ?? 0;
      scoreByName.set(ref.name, {
        name: ref.name,
        patchScore,
        coarseScore,
        // A screenshot-derived reference is calibrated more strongly than a
        // generic portrait. The offset prevents an unrelated generic coarse
        // match from displacing the remaining learned hero during the global
        // three-unique assignment.
        score: patchScore * 0.58 + coarseScore * 0.12 + 0.30,
        highPrecision: true,
        shippedScreenshot: true,
      });
    }
  }
  const learned = [...scoreByName.values()].sort((a, b) => b.score - a.score);
  const first = learned[0], second = learned[1];
  if (!first) return null;
  const learnedNames = new Set(learned.map((item) => item.name));
  return {
    ranking: [...learned, ...coarse.filter((item) => !learnedNames.has(item.name))]
      .sort((a, b) => b.score - a.score).slice(0, 10),
    matchedName: first.name,
    bestPatch: first.patchScore,
    margin: first.score - (second?.score ?? -1),
  };
}

function fastSharedCorrectionRanking(sourceCanvas, card, coarse, sharedReferences) {
  const usable = sharedReferences.filter((ref) => ref?.descriptor && Number(ref.sampleCount || 0) >= 2);
  if (!usable.length) return null;
  const targets = buildTargetVariants(sourceCanvas, card);
  const coarseMap = new Map(coarse.map((item) => [item.name, item.coarseScore ?? item.score]));
  const scoreByName = new Map();
  for (const ref of usable) {
    let descriptorScore = -1;
    for (const target of targets) descriptorScore = Math.max(descriptorScore, compareDescriptor(target, ref.descriptor));
    const previous = scoreByName.get(ref.name);
    if (!previous || descriptorScore > previous.descriptorScore) {
      const coarseScore = coarseMap.get(ref.name) ?? 0;
      scoreByName.set(ref.name, {
        name: ref.name,
        descriptorScore,
        coarseScore,
        sampleCount: Number(ref.sampleCount || 0),
        score: descriptorScore * 0.76 + coarseScore * 0.10 + 0.14,
        highPrecision: true,
        approvedShared: true,
      });
    }
  }
  const shared = [...scoreByName.values()].sort((a, b) => b.score - a.score);
  const first = shared[0], second = shared[1];
  if (!first) return null;
  const sharedNames = new Set(shared.map((item) => item.name));
  return {
    ranking: [...shared, ...coarse.filter((item) => !sharedNames.has(item.name))]
      .sort((a, b) => b.score - a.score).slice(0, 10),
    matchedName: first.name,
    bestDescriptor: first.descriptorScore,
    margin: first.score - (second?.score ?? -1),
    sampleCount: first.sampleCount,
  };
}

async function preciseRanking(id, sourceCanvas, card, coarse, referenceGrayMap, cardIndex) {
  const target = targetGray40(sourceCanvas, card);
  const run = async (limit) => {
    const candidates = coarse.slice(0, Math.min(limit, coarse.length));
    const out = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const refs = referenceGrayMap.get(candidate.name) || [];
      let p = -1;
      for (const ref of refs) p = Math.max(p, preciseGrayScore(target, ref));
      const has = Number.isFinite(p) && p > -0.5;
      out.push({ ...candidate, score: has ? p * 0.72 + candidate.coarseScore * 0.28 : candidate.coarseScore, patchScore: has ? p : null, highPrecision: has });
      if (i % 4 === 3) {
        postProgress(id, `영웅 ${cardIndex + 1}/3 정밀 비교`, Math.round(((i + 1) / candidates.length) * 100));
        await sleepTick();
      }
    }
    return out.sort((a, b) => b.score - a.score);
  };
  const coarseMargin = (coarse[0]?.score || 0) - (coarse[1]?.score || 0);
  if ((coarse[0]?.score || 0) >= 0.78 && coarseMargin >= 0.075) {
    return coarse.slice(0, 7).map((x) => ({ ...x, highPrecision: false, patchScore: null }));
  }
  let precise = await run(TOP_PRECISE);
  const first = precise[0], second = precise[1];
  const margin = (first?.score || 0) - (second?.score || 0);
  if ((!first || first.score < 0.57 || margin < 0.018) && coarse.length > TOP_PRECISE) precise = await run(EXPANDED_PRECISE);
  return precise.slice(0, 7);
}

function chooseUnique(cardRankings, teamPriors = []) {
  let best = null, secondBest = -Infinity;
  function walk(index, used, picks, score) {
    if (index >= cardRankings.length) {
      if (!best || score > best.score) { if (best) secondBest = Math.max(secondBest, best.score); best = { score, picks: [...picks] }; }
      else secondBest = Math.max(secondBest, score);
      return;
    }
    for (const c of cardRankings[index].slice(0, 7)) {
      if (used.has(c.name)) continue;
      used.add(c.name); picks.push(c); walk(index + 1, used, picks, score + c.score); picks.pop(); used.delete(c.name);
    }
  }
  walk(0, new Set(), [], 0);
  if (!best) {
    const used = new Set();
    return cardRankings.map((r) => {
      const pick = r.find((x) => !used.has(x.name)) || r[0];
      if (pick?.name) used.add(pick.name);
      return pick;
    });
  }
  // Recurring guild-war defence compositions are used only as a tie-breaker.
  // Every member still has to be present in the visual candidate lists, so a
  // clearly recognized new composition is left untouched.
  let priorBest = null;
  for (const prior of teamPriors) {
    const heroes = prior.heroes;
    const assignments = [
      [heroes[0], heroes[1], heroes[2]], [heroes[0], heroes[2], heroes[1]],
      [heroes[1], heroes[0], heroes[2]], [heroes[1], heroes[2], heroes[0]],
      [heroes[2], heroes[0], heroes[1]], [heroes[2], heroes[1], heroes[0]],
    ];
    for (const labels of assignments) {
      const picks = labels.map((name, index) => cardRankings[index].find((item) => item.name === name));
      if (picks.some((item) => !item)) continue;
      const rawScore = picks.reduce((sum, item) => sum + item.score, 0);
      const strongCount = picks.filter((item) => item.score >= 0.70).length;
      const contradictsExactScreenshot = picks.some((item, index) =>
        best.picks[index]?.shippedScreenshot &&
        (best.picks[index]?.patchScore ?? 0) >= 0.88 &&
        item.name !== best.picks[index].name
      );
      if (contradictsExactScreenshot || strongCount < 2 || rawScore < best.score - 0.08) continue;
      // This is a tie-breaker, not a replacement for visible portrait
      // evidence. A formerly generous 0.26 bonus overrode PHONEST's exact
      // 윤건 screenshot match with the more frequent 여포 composition.
      const priorBonus = Math.min(0.08, 0.025 + Math.log1p(Math.max(1, Number(prior.count || 1))) * 0.018);
      const score = rawScore + priorBonus;
      if (!priorBest || score > priorBest.score) priorBest = { score, rawScore, picks };
    }
  }
  if (priorBest && priorBest.score > best.score) best = { score: priorBest.rawScore, picks: priorBest.picks };
  const globalGap = Number.isFinite(secondBest) ? best.score - secondBest : 0.05;
  return best.picks.map((pick, index) => {
    const alt = cardRankings[index].find((x) => x.name !== pick.name);
    const localMargin = pick.score - (alt?.score ?? -1);
    return {
      name: pick.name,
      score: pick.score,
      patchScore: pick.patchScore ?? null,
      coarseScore: pick.coarseScore ?? pick.score,
      highPrecision: Boolean(pick.highPrecision),
      confident: Boolean(pick.score >= 0.56 && localMargin >= 0.018 && (globalGap >= 0.008 || localMargin >= 0.05)),
      candidates: cardRankings[index].slice(0, 3),
    };
  });
}

function isDetectedCardValid(sourceCanvas, card, detection, iw, ih) {
  const metrics = card.portraitMetrics || card.metrics || portraitVisualMetrics(sourceCanvas, card);
  const footer = card.footer || metrics.footer || cardFooterMetrics(sourceCanvas, card);
  const similarity = Number.isFinite(card.heroSimilarity) ? card.heroSimilarity : -1;

  if (detection?.panel) {
    const panel = detection.panel;
    const cx = card.x + card.w / 2, cy = card.y + card.h / 2;
    const inside = cx >= panel.x - panel.w * 0.04 && cx <= panel.x + panel.w * 1.04 &&
      cy >= panel.y + panel.h * 0.12 && cy <= panel.y + panel.h * 0.88;
    return inside && !metrics.emptyLike && metrics.portraitScore >= 34 &&
      (footer.uiLike || similarity >= 0.32);
  }

  if (card.searchMode === "adaptive-anchor") {
    return broadHeroPosition(card, iw, ih) && !metrics.emptyLike && metrics.portraitScore >= 36 &&
      (footer.uiLike || similarity >= 0.38);
  }

  return isPlausibleHeroCard(sourceCanvas, card, iw, ih, 38);
}

function areDetectedCardsDistinct(cards) {
  if (!Array.isArray(cards) || cards.length !== 3) return false;
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const a = cards[i], b = cards[j];
      const centerDistance = Math.hypot(
        (a.x + a.w / 2) - (b.x + b.w / 2),
        (a.y + a.h / 2) - (b.y + b.h / 2),
      );
      const minSide = Math.min(Math.max(a.w, a.h), Math.max(b.w, b.h));
      if (rectIou(a, b) > 0.28 || centerDistance < minSide * 0.42) return false;
    }
  }
  return true;
}

function scaleRectToOriginal(rect, invScale) {
  if (!rect || !Number.isFinite(invScale) || invScale === 1) return rect;
  return { ...rect, x: rect.x * invScale, y: rect.y * invScale, w: rect.w * invScale, h: rect.h * invScale };
}

function translateDetection(detection, offsetX, offsetY) {
  if (!detection) return null;
  const move = (rect) => rect ? { ...rect, x: rect.x + offsetX, y: rect.y + offsetY } : rect;
  return {
    ...detection,
    cards: (detection.cards || []).map(move),
    nicknameCrop: move(detection.nicknameCrop),
    panel: move(detection.panel),
    detector: `${detection.detector || "unknown"}-centered-viewport`,
  };
}

function detectCenteredGameViewport(sourceCanvas, references) {
  const iw = sourceCanvas.width, ih = sourceCanvas.height;
  const aspect = iw / Math.max(1, ih);
  // Some desktop capture tools save a landscape game viewport in the centre
  // of a much taller image. Treat that 16:9 area as another detection view,
  // while leaving narrow panel-only crops on the normal path.
  if (aspect < 0.78 || aspect > 1.16) return null;
  const viewportH = Math.round(iw * 9 / 16);
  if (viewportH >= ih * 0.92 || viewportH < ih * 0.38) return null;
  const offsetY = Math.round((ih - viewportH) / 2);
  const viewport = makeCanvas(iw, viewportH);
  const ctx = viewport.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, offsetY, iw, viewportH, 0, 0, iw, viewportH);
  const detection = detectCardsPure(viewport, iw, viewportH, references);
  return translateDetection(detection, 0, offsetY);
}

async function recognize(id, bitmap, localSamples, sharedReferences) {
  const started = performance.now();
  const timing = {};
  postProgress(id, "기준 데이터 준비 중", 0);
  const base = await loadReferencePack();
  timing.base = performance.now() - started;
  const supplemental = await buildSupplemental(localSamples, sharedReferences);
  timing.supplemental = performance.now() - started - timing.base;
  // Geometry and the primary ranking must be driven only by shipped/admin
  // references. A correction made from an already misaligned crop must never
  // move a future crop or override a clear base portrait match.
  const trustedReferences = [
    ...base,
    ...supplemental.filter((ref) => ref.adminReference),
  ];
  const localCorrectionReferences = supplemental.filter((ref) => ref.localCorrection);
  const sharedCorrectionReferences = supplemental.filter((ref) => ref.shared && Number(ref.sampleCount || 0) >= 2);
  const originalW = bitmap.width, originalH = bitmap.height;
  const fullCanvas = canvasFromBitmap(bitmap);
  bitmap.close?.();

  // ver 3.0.0: 고해상도 폰/PC 캡처도 같은 처리 크기로 정규화합니다.
  // 화면 높이 640px이면 영웅 카드가 약 50px 이상 남아 기준 초상화 비교에는 충분하면서,
  // 3K/4K 스크린샷에서 픽셀 연산이 폭증하는 문제를 크게 줄일 수 있다.
  const processingScale = Math.min(1, 640 / Math.max(1, originalH));
  let sourceCanvas = fullCanvas;
  if (processingScale < 0.999) {
    const scaled = makeCanvas(Math.round(originalW * processingScale), Math.round(originalH * processingScale));
    const sctx = scaled.getContext("2d", { willReadFrequently: true });
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(fullCanvas, 0, 0, scaled.width, scaled.height);
    sourceCanvas = scaled;
  }
  timing.scale = performance.now() - started - timing.base - timing.supplemental;
  const iw = sourceCanvas.width, ih = sourceCanvas.height;
  const invScale = 1 / processingScale;

  postProgress(id, "영웅 카드 찾는 중", 0);
  let detection = detectCenteredGameViewport(sourceCanvas, trustedReferences) ||
    detectCardsPure(sourceCanvas, iw, ih, trustedReferences);
  timing.detection = performance.now() - started - timing.base - timing.supplemental - timing.scale;
  if (detection.cards.length !== 3) throw new Error("상대 영웅 카드 3개를 찾지 못했습니다.");
  const cardValidity = detection.cards.map((card) => isDetectedCardValid(sourceCanvas, card, detection, iw, ih));
  const cardsAreDistinct = areDetectedCardsDistinct(detection.cards);
  if (cardValidity.some((valid) => !valid) || !cardsAreDistinct) {
    // 패널 검출은 되었지만 후검증에서 벗어난 경우 적응형 앵커로 한 번 더 복구를 시도합니다.
    const retry = detection.detector?.startsWith("panel-") ? detectCardsAdaptiveAnchor(sourceCanvas, iw, ih, trustedReferences) : null;
    if (retry?.cards?.length === 3 && areDetectedCardsDistinct(retry.cards) && retry.cards.every((card) => isDetectedCardValid(sourceCanvas, card, retry, iw, ih))) {
      detection = retry;
    } else {
      throw new Error("영웅 카드 위치가 불확실하여 인식을 중단했습니다. 전체 길드전 스크린샷으로 다시 시도해 주세요.");
    }
  }

  postProgress(id, "영웅 후보 추리는 중", 0);
  const coarse = detection.cards.map((card) => coarseRanking(sourceCanvas, card, trustedReferences));
  timing.coarse = performance.now() - started - timing.base - timing.supplemental - timing.scale - timing.detection;
  const cropEvidence = detection.cards.map((card, index) => ({
    footer: card.portraitMetrics?.footer || cardFooterMetrics(sourceCanvas, card),
    topScore: coarse[index]?.[0]?.score || 0,
  }));
  const panelTrusted = String(detection.detector || "").startsWith("panel-");
  const minTopScore = panelTrusted ? 0.34 : 0.40;
  const minNoFooterScore = panelTrusted ? 0.44 : 0.50;
  if (cropEvidence.some((x) => x.topScore < minTopScore || (!x.footer.uiLike && x.topScore < minNoFooterScore))) {
    throw new Error("영웅 카드 위치 검증에 실패했습니다. 빈 슬롯 또는 UI를 영웅으로 오인하지 않도록 결과를 제외했습니다.");
  }
  const rankings = [];
  const grayMap = refsByName(trustedReferences);
  const shippedScreenshotReferences = trustedReferences.filter((ref) => ref.screenshotVariant);
  const learnedByCard = detection.cards.map((card, index) => fastLearnedRanking(sourceCanvas, card, coarse[index], shippedScreenshotReferences));
  const localCorrectionByCard = detection.cards.map((card, index) => fastLearnedRanking(sourceCanvas, card, coarse[index], localCorrectionReferences));
  const sharedCorrectionByCard = detection.cards.map((card, index) => fastSharedCorrectionRanking(sourceCanvas, card, coarse[index], sharedCorrectionReferences));
  const strongLearnedTeam = learnedByCard.filter((item) => item && item.bestPatch >= 0.60 && item.margin >= 0.025).length >= 2;
  for (let i = 0; i < detection.cards.length; i += 1) {
    const learned = learnedByCard[i];
    // A shipped screenshot variant is curated ground truth. Let a near-exact,
    // well-separated single-card match stand on its own; requiring a second
    // team member to have a screenshot variant kept PHONEST's 윤건 classified
    // as 여포 even though the exact 윤건 crop was already in the base pack.
    const exactShippedVariant = Boolean(learned && learned.bestPatch >= 0.88 && learned.margin >= 0.065);
    const useLearned = Boolean(learned && ((strongLearnedTeam && learned.bestPatch >= 0.34) || exactShippedVariant));
    let ranking = useLearned
      ? learned.ranking
      : await preciseRanking(id, sourceCanvas, detection.cards[i], coarse[i], grayMap, i);
    const localCorrection = localCorrectionByCard[i];
    const sharedCorrection = sharedCorrectionByCard[i];
    const trustedTop = ranking?.[0];
    const trustedSecond = ranking?.[1];
    const trustedMargin = (trustedTop?.score || 0) - (trustedSecond?.score || 0);
    const localAgrees = Boolean(localCorrection?.matchedName && localCorrection.matchedName === trustedTop?.name);
    const sharedAgrees = Boolean(sharedCorrection?.matchedName && sharedCorrection.matchedName === trustedTop?.name);
    const trustedIsAmbiguous = (trustedTop?.score || 0) < 0.90 && trustedMargin < 0.035;
    const localIsExact = Boolean(localCorrection && localCorrection.bestPatch >= 0.88 && localCorrection.margin >= 0.065);
    const sharedIsExceptional = Boolean(sharedCorrection && sharedCorrection.sampleCount >= 2 && sharedCorrection.bestDescriptor >= 0.80 && sharedCorrection.margin >= 0.035);
    if (localCorrection && (localAgrees || localIsExact)) {
      // A correction made on this browser can immediately fix the exact same
      // card crop. It is never used for geometry and still needs a near-exact
      // patch match before overriding a confident shipped portrait.
      ranking = localCorrection.ranking.map((item) => item.name === localCorrection.matchedName
        ? { ...item, score: Math.max(item.score || 0, (trustedTop?.score || 0) + 0.045) }
        : item).sort((a, b) => b.score - a.score);
    } else if (sharedCorrection && (sharedAgrees || (trustedIsAmbiguous && sharedIsExceptional) || (sharedIsExceptional && sharedCorrection.bestDescriptor >= 0.90))) {
      // Only administrator-approved references with at least two samples can
      // affect other users. Descriptor matching works without gray40, which
      // makes approved 윤건 corrections available globally without allowing
      // unapproved/browser-local feedback to poison shared recognition.
      ranking = sharedCorrection.ranking.map((item) => item.name === sharedCorrection.matchedName
        ? { ...item, score: Math.max(item.score || 0, (trustedTop?.score || 0) + 0.045) }
        : item).sort((a, b) => b.score - a.score);
    }
    rankings.push(ranking);
  }
  const results = chooseUnique(rankings, referenceTeamPriors).map((result, index) => ({
    ...result,
    cardValid: true,
    cardVisualScore: detection.cards[index]?.portraitScore || detection.cards[index]?.portraitMetrics?.portraitScore || 0,
  }));
  timing.total = performance.now() - started;
  return {
    cards: detection.cards.map((card) => scaleRectToOriginal(card, invScale)),
    results,
    nicknameCrop: scaleRectToOriginal(detection.nicknameCrop, invScale),
    panel: scaleRectToOriginal(detection.panel, invScale),
    quality: detection.quality || 0,
    candidateCount: detection.candidateCount || 0,
    detector: detection.detector,
    engine: "15month-recognition-engine-4.5.11",
    processingScale,
    elapsedMs: Math.round(performance.now() - started),
    workerVersion: WORKER_VERSION,
    timing,
  };
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const id = msg.id;
  try {
    if (msg.type === "warmup") {
      postProgress(id, "기준 데이터 준비 중", 0);
      const refs = await loadReferencePack();
      self.postMessage({ type: "result", id, result: { ready: true, references: refs.length, workerVersion: WORKER_VERSION } });
      return;
    }
    if (msg.type === "recognize") {
      const result = await recognize(id, msg.bitmap, msg.localSamples || [], msg.sharedReferences || []);
      self.postMessage({ type: "result", id, result });
      return;
    }
    throw new Error("알 수 없는 worker 요청입니다.");
  } catch (error) {
    self.postMessage({ type: "error", id, error: error?.message || String(error) });
  }
};
