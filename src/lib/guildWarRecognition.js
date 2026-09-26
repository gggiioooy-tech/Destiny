const HERO_REFERENCE_MANIFEST = [{"name":"하연","src":"/hero-recognition/hayeon.png"},{"name":"겔리두스","src":"/hero-recognition/hero_001.png"},{"name":"관우","src":"/hero-recognition/hero_002.png"},{"name":"나타","src":"/hero-recognition/hero_003.png"},{"name":"녹스","src":"/hero-recognition/hero_004.png"},{"name":"니아","src":"/hero-recognition/hero_005.png"},{"name":"데이지","src":"/hero-recognition/hero_006.png"},{"name":"델론즈","src":"/hero-recognition/hero_007.png"},{"name":"동영","src":"/hero-recognition/hero_008.png"},{"name":"돼오","src":"/hero-recognition/hero_009.png"},{"name":"라드그리드","src":"/hero-recognition/hero_010.png"},{"name":"라이언","src":"/hero-recognition/hero_011.png"},{"name":"란드그리드","src":"/hero-recognition/hero_012.png"},{"name":"레긴레이프","src":"/hero-recognition/hero_013.png"},{"name":"레이첼","src":"/hero-recognition/hero_014.png"},{"name":"로지","src":"/hero-recognition/hero_015.png"},{"name":"루디","src":"/hero-recognition/hero_016.png"},{"name":"루리","src":"/hero-recognition/hero_017.png"},{"name":"룩","src":"/hero-recognition/hero_018.png"},{"name":"리나","src":"/hero-recognition/hero_019.png"},{"name":"린","src":"/hero-recognition/hero_020.png"},{"name":"멜키르","src":"/hero-recognition/hero_021.png"},{"name":"미스트","src":"/hero-recognition/hero_022.png"},{"name":"미호","src":"/hero-recognition/hero_023.png"},{"name":"밀리아","src":"/hero-recognition/hero_024.png"},{"name":"바네사","src":"/hero-recognition/hero_025.png"},{"name":"발리스타","src":"/hero-recognition/hero_026.png"},{"name":"백각","src":"/hero-recognition/hero_027.png"},{"name":"백룡","src":"/hero-recognition/hero_028.png"},{"name":"벨리카","src":"/hero-recognition/hero_029.png"},{"name":"브란즈&브란셀","src":"/hero-recognition/hero_030.png"},{"name":"비담","src":"/hero-recognition/hero_031.png"},{"name":"비스킷","src":"/hero-recognition/hero_032.png"},{"name":"선란","src":"/hero-recognition/hero_033.png"},{"name":"성진우","src":"/hero-recognition/hero_034.png"},{"name":"세인","src":"/hero-recognition/hero_035.png"},{"name":"소교","src":"/hero-recognition/hero_036.png"},{"name":"손오공","src":"/hero-recognition/hero_037.png"},{"name":"스쿨드","src":"/hero-recognition/hero_038.png"},{"name":"스파이크","src":"/hero-recognition/hero_039.png"},{"name":"실베스타","src":"/hero-recognition/hero_040.png"},{"name":"아라곤","src":"/hero-recognition/hero_041.png"},{"name":"아리스","src":"/hero-recognition/hero_042.png"},{"name":"아멜리아","src":"/hero-recognition/hero_043.png"},{"name":"아일린","src":"/hero-recognition/hero_044.png"},{"name":"아킬라","src":"/hero-recognition/hero_045.png"},{"name":"에스파다","src":"/hero-recognition/hero_046.png"},{"name":"에이스","src":"/hero-recognition/hero_047.png"},{"name":"엘리스","src":"/hero-recognition/hero_048.png"},{"name":"엘리시아","src":"/hero-recognition/hero_049.png"},{"name":"여포","src":"/hero-recognition/hero_050.png"},{"name":"연희","src":"/hero-recognition/hero_051.png"},{"name":"오르카","src":"/hero-recognition/hero_052.png"},{"name":"오를리","src":"/hero-recognition/hero_053.png"},{"name":"오목","src":"/hero-recognition/hero_054.png"},{"name":"유신","src":"/hero-recognition/hero_055.png"},{"name":"제이브","src":"/hero-recognition/hero_056.png"},{"name":"쥬리","src":"/hero-recognition/hero_057.png"},{"name":"지크","src":"/hero-recognition/hero_058.png"},{"name":"챈슬러","src":"/hero-recognition/hero_059.png"},{"name":"초선","src":"/hero-recognition/hero_060.png"},{"name":"카구라","src":"/hero-recognition/hero_061.png"},{"name":"카르마","src":"/hero-recognition/hero_062.png"},{"name":"카일","src":"/hero-recognition/hero_063.png"},{"name":"칼 헤론","src":"/hero-recognition/hero_064.png"},{"name":"콜트","src":"/hero-recognition/hero_065.png"},{"name":"크리스","src":"/hero-recognition/hero_066.png"},{"name":"클라한","src":"/hero-recognition/hero_067.png"},{"name":"클레미스","src":"/hero-recognition/hero_068.png"},{"name":"키리엘","src":"/hero-recognition/hero_069.png"},{"name":"타카","src":"/hero-recognition/hero_070.png"},{"name":"태오","src":"/hero-recognition/hero_071.png"},{"name":"트루드","src":"/hero-recognition/hero_072.png"},{"name":"파스칼","src":"/hero-recognition/hero_073.png"},{"name":"파이","src":"/hero-recognition/hero_074.png"},{"name":"팔라누스","src":"/hero-recognition/hero_075.png"},{"name":"프레이야","src":"/hero-recognition/hero_076.png"},{"name":"플라튼","src":"/hero-recognition/hero_077.png"},{"name":"헤브니아","src":"/hero-recognition/hero_078.png"},{"name":"헬레니아","src":"/hero-recognition/hero_079.png"}];


let heroReferenceCachePromise = null;
let learnedHeroReferenceRaw = null;
let learnedHeroReferencePromise = null;
let sharedHeroReferencePromise = null;
let sharedHeroReferenceLoadedAt = 0;
let sharedHeroReferenceCache = [];
let adminHeroReferencePromise = null;
let adminHeroReferenceLoadedAt = 0;
let adminHeroReferenceCache = [];
let tesseractLoaderPromise = null;
let nicknameOcrKorWorkerPromise = null;
let nicknameOcrEngWorkerPromise = null;
let nicknameOcrProgressHandler = null;
let openCvLoaderPromise = null;
let highPrecisionReferenceMapPromise = null;
let guildWarRecognitionWorker = null;
let guildWarRecognitionWorkerRequestId = 0;
const guildWarRecognitionWorkerPending = new Map();

const HERO_CORRECTION_STORAGE_KEY = "destiny_guildwar_hero_corrections_v3";
const HERO_CORRECTION_MAX_PER_HERO = 4;
const HERO_CORRECTION_MAX_TOTAL = 120;
const SHARED_HERO_REFERENCE_TTL_MS = 60 * 1000;
const SHARED_HERO_REFERENCE_MAX_ROWS = 500;
const ADMIN_HERO_REFERENCE_TTL_MS = 20 * 1000;
const ADMIN_HERO_REFERENCE_MAX_ROWS = 300;
const SHARED_LEARNING_VERSION = "v6-hybrid-cv";

function loadRecognitionImage(source, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    let objectUrl = "";
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = "";
      }
    };
    const finish = (value, error = null) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(null, new Error("이미지 로딩 시간이 너무 오래 걸립니다.")), timeoutMs);
    img.onload = () => finish(img);
    img.onerror = () => finish(null, new Error("이미지를 불러오지 못했습니다."));
    if (source instanceof File || source instanceof Blob) {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    } else {
      img.src = source;
    }
  });
}

function promiseWithTimeout(promise, timeoutMs, fallbackValue, label = "작업") {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise).finally(() => { if (timer) clearTimeout(timer); }),
    new Promise((resolve) => {
      timer = setTimeout(() => {
        console.warn(`${label} 시간 초과 - 기본 데이터로 계속 진행`);
        resolve(fallbackValue);
      }, timeoutMs);
    }),
  ]);
}


// v8.4 닉네임 OCR
// 이전 v8.x 코드에는 아래 3개 함수가 실제로 정의되어 있지 않아
// recognizeGuildWarNickname()가 매번 ReferenceError로 끝나는 문제가 있었다.
// Tesseract worker를 한 번만 만들고 재사용하며, 게임의 밝은 글자/어두운 배경에 맞춘
// 단일 행 전처리 버전을 최대 3번 비교한다.
const GUILD_WAR_VIEW_W = 1920;
const GUILD_WAR_VIEW_H = 1080;
const GUILD_WAR_CARD_W = 98;
const GUILD_WAR_CARD_H = 106;
const GUILD_WAR_VIEW_CARD_W = 84;
const GUILD_WAR_VIEW_CARD_H = 91;
const HERO_DESCRIPTOR_W = 32;
const HERO_DESCRIPTOR_H = 35;

// 게임 UI는 16:9 기준 좌표계에 놓이고, 와이드 폰은 좌우가 더 보이는 구조.
// 스크린샷 전체 폭을 그대로 비례 계산하지 않고 16:9 게임 영역을 먼저 맞춘다.
const HERO_SLOT_X = { left: 1205.142857, right: 1296 };
const HERO_SLOT_ROWS = {
  1: [461.142857],
  2: [415.714286, 507.428571],
  3: [369.428571, 461.142857, 552.857143],
  4: [324, 415.714286, 507.428571, 599.142857],
};

// v6: 기기별 고정 좌표에 의존하지 않고 넓게 1차 탐색한 뒤, 가장 좋은 위치 주변을 다시 미세 탐색한다.
const GUILD_WAR_GEOMETRY_COARSE_VARIANTS = [0.96, 1, 1.04].flatMap((scale) =>
  [-48, 0, 48].flatMap((dx) =>
    [-28, 0, 28].map((dy) => ({ scale, dx, dy }))
  )
);

function buildGuildWarGeometryRefineVariants(seed = { scale: 1, dx: 0, dy: 0 }) {
  return [-0.018, 0, 0.018].flatMap((scaleOffset) =>
    [-18, 0, 18].flatMap((dxOffset) =>
      [-12, 0, 12].map((dyOffset) => ({
        scale: Math.max(0.9, Math.min(1.1, (seed.scale || 1) + scaleOffset)),
        dx: (seed.dx || 0) + dxOffset,
        dy: (seed.dy || 0) + dyOffset,
      }))
    )
  );
}

const HERO_TARGET_VARIANTS = [0.94, 1, 1.06].flatMap((scale) =>
  [-3, 0, 3].flatMap((dx) =>
    [-4, 0, 4].map((dy) => ({ scale, dx, dy }))
  )
);

function isHeroDescriptorPixel(x, y) {
  if (x < 2 || x >= 30 || y < 2 || y >= 21) return false;
  if (x >= 23 && y >= 1 && y < 12) return false; // 우상단 강화/각성 아이콘
  if (x < 9 && y >= 16) return false; // 좌하단 타입 아이콘
  if (x >= 13 && y >= 18) return false; // 레벨/강화 문자
  return true;
}

function normalizeVector(values, standardize = false) {
  const out = new Float32Array(values.length);
  if (!values.length) return out;
  let mean = 0;
  if (standardize) {
    for (let i = 0; i < values.length; i += 1) mean += values[i];
    mean /= values.length;
  }
  let variance = 0;
  if (standardize) {
    for (let i = 0; i < values.length; i += 1) {
      const d = values[i] - mean;
      variance += d * d;
    }
    variance = Math.sqrt(variance / values.length) || 1;
  } else {
    variance = 1;
  }
  let norm = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = (values[i] - mean) / variance;
    out[i] = v;
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i += 1) out[i] /= norm;
  return out;
}

function rgbToHsv01(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max <= 1e-6 ? 0 : d / max, max];
}

function buildHeroDescriptorFromCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, HERO_DESCRIPTOR_W, HERO_DESCRIPTOR_H).data;
  const count = HERO_DESCRIPTOR_W * HERO_DESCRIPTOR_H;
  const gray = new Float32Array(count);
  const rgb = new Float32Array(count * 3);
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    rgb[p * 3] = r;
    rgb[p * 3 + 1] = g;
    rgb[p * 3 + 2] = b;
    gray[p] = r * 0.299 + g * 0.587 + b * 0.114;
  }

  const selectedGray = [];
  const gxAll = new Float32Array(count);
  const gyAll = new Float32Array(count);
  for (let y = 1; y < HERO_DESCRIPTOR_H - 1; y += 1) {
    for (let x = 1; x < HERO_DESCRIPTOR_W - 1; x += 1) {
      const idx = y * HERO_DESCRIPTOR_W + x;
      const tl = gray[(y - 1) * HERO_DESCRIPTOR_W + x - 1];
      const tc = gray[(y - 1) * HERO_DESCRIPTOR_W + x];
      const tr = gray[(y - 1) * HERO_DESCRIPTOR_W + x + 1];
      const ml = gray[y * HERO_DESCRIPTOR_W + x - 1];
      const mr = gray[y * HERO_DESCRIPTOR_W + x + 1];
      const bl = gray[(y + 1) * HERO_DESCRIPTOR_W + x - 1];
      const bc = gray[(y + 1) * HERO_DESCRIPTOR_W + x];
      const br = gray[(y + 1) * HERO_DESCRIPTOR_W + x + 1];
      gxAll[idx] = -tl + tr - 2 * ml + 2 * mr - bl + br;
      gyAll[idx] = -tl - 2 * tc - tr + bl + 2 * bc + br;
    }
  }

  const gradientValues = [];
  const hog = new Float32Array(4 * 4 * 9);
  const hist = new Float32Array(24);

  for (let y = 0; y < HERO_DESCRIPTOR_H; y += 1) {
    for (let x = 0; x < HERO_DESCRIPTOR_W; x += 1) {
      if (!isHeroDescriptorPixel(x, y)) continue;
      const idx = y * HERO_DESCRIPTOR_W + x;
      selectedGray.push(gray[idx]);
      gradientValues.push(gxAll[idx], gyAll[idx]);

      const gx = gxAll[idx];
      const gy = gyAll[idx];
      const mag = Math.sqrt(gx * gx + gy * gy);
      let angle = Math.atan2(gy, gx);
      if (angle < 0) angle += Math.PI;
      if (angle >= Math.PI) angle -= Math.PI;
      const bin = Math.min(8, Math.floor((angle / Math.PI) * 9));
      const cellX = Math.min(3, Math.floor((x / HERO_DESCRIPTOR_W) * 4));
      const cellY = Math.min(3, Math.floor((y / HERO_DESCRIPTOR_H) * 4));
      hog[(cellY * 4 + cellX) * 9 + bin] += mag;

      const base = idx * 3;
      const [hh, ss, vv] = rgbToHsv01(rgb[base], rgb[base + 1], rgb[base + 2]);
      hist[Math.min(7, Math.floor(hh * 8))] += 1;
      hist[8 + Math.min(7, Math.floor(ss * 8))] += 1;
      hist[16 + Math.min(7, Math.floor(vv * 8))] += 1;
    }
  }

  return {
    gray: normalizeVector(selectedGray, true),
    gradient: normalizeVector(gradientValues),
    hog: normalizeVector(hog),
    hist: normalizeVector(hist),
  };
}

function descriptorDot(a, b) {
  const n = Math.min(a.length, b.length);
  let value = 0;
  for (let i = 0; i < n; i += 1) value += a[i] * b[i];
  return value;
}

function compareHeroDescriptorsV3(a, b) {
  return (
    descriptorDot(a.gray, b.gray) * 0.31 +
    descriptorDot(a.gradient, b.gradient) * 0.21 +
    descriptorDot(a.hog, b.hog) * 0.38 +
    descriptorDot(a.hist, b.hist) * 0.10
  );
}

function makeDescriptorCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = HERO_DESCRIPTOR_W;
  canvas.height = HERO_DESCRIPTOR_H;
  return canvas;
}

function buildReferenceHeroDescriptor(image) {
  const canvas = makeDescriptorCanvas();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 게임 카드의 실제 일러스트 영역(약 94x94 / 98x106)을 그대로 축소한 배치.
  const x = (2 / GUILD_WAR_CARD_W) * HERO_DESCRIPTOR_W;
  const y = (2 / GUILD_WAR_CARD_H) * HERO_DESCRIPTOR_H;
  const w = (94 / GUILD_WAR_CARD_W) * HERO_DESCRIPTOR_W;
  const h = (94 / GUILD_WAR_CARD_H) * HERO_DESCRIPTOR_H;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, x, y, w, h);
  return buildHeroDescriptorFromCanvas(canvas);
}

function buildLearnedCardDescriptor(image) {
  const canvas = makeDescriptorCanvas();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    0,
    0,
    HERO_DESCRIPTOR_W,
    HERO_DESCRIPTOR_H
  );
  return buildHeroDescriptorFromCanvas(canvas);
}

function readHeroCorrectionSamples() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HERO_CORRECTION_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.name && item?.dataUrl) : [];
  } catch {
    return [];
  }
}

function invalidateLearnedHeroReferences() {
  learnedHeroReferenceRaw = null;
  learnedHeroReferencePromise = null;
}

function saveHeroCorrectionSample(name, dataUrl) {
  if (!name || !dataUrl) return false;

  try {
    let samples = readHeroCorrectionSamples();
    // A crop can have only one corrected identity, even after another edit.
    samples = samples.filter((item) => item.dataUrl !== dataUrl);
    samples.push({ name, dataUrl, savedAt: Date.now() });

    const byName = new Map();
    for (const item of samples.sort((a, b) => b.savedAt - a.savedAt)) {
      const list = byName.get(item.name) || [];
      if (list.length < HERO_CORRECTION_MAX_PER_HERO) list.push(item);
      byName.set(item.name, list);
    }

    samples = [...byName.values()]
      .flat()
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, HERO_CORRECTION_MAX_TOTAL);

    localStorage.setItem(HERO_CORRECTION_STORAGE_KEY, JSON.stringify(samples));
    invalidateLearnedHeroReferences();
    return true;
  } catch (error) {
    console.warn("영웅 보정 샘플 저장 실패", error);
    return false;
  }
}

async function getBaseHeroReferenceCache() {
  if (heroReferenceCachePromise) return heroReferenceCachePromise;
  heroReferenceCachePromise = (async () => {
    const settled = await Promise.allSettled(HERO_REFERENCE_MANIFEST.map(async (hero) => {
      const image = await loadRecognitionImage(hero.src, 6000);
      return { ...hero, learned: false, shared: false, image, descriptor: buildReferenceHeroDescriptor(image) };
    }));
    const references = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
    if (references.length < Math.min(40, HERO_REFERENCE_MANIFEST.length)) {
      heroReferenceCachePromise = null;
      throw new Error(`영웅 기준 이미지 준비 실패 (${references.length}/${HERO_REFERENCE_MANIFEST.length})`);
    }
    if (references.length !== HERO_REFERENCE_MANIFEST.length) {
      console.warn(`일부 영웅 기준 이미지 로드 실패: ${references.length}/${HERO_REFERENCE_MANIFEST.length}`);
    }
    return references;
  })();
  return heroReferenceCachePromise;
}

async function getLearnedHeroReferenceCache() {
  let raw = "[]";
  try {
    raw = localStorage.getItem(HERO_CORRECTION_STORAGE_KEY) || "[]";
  } catch {}

  if (raw === learnedHeroReferenceRaw && learnedHeroReferencePromise) return learnedHeroReferencePromise;

  learnedHeroReferenceRaw = raw;
  learnedHeroReferencePromise = (async () => {
    let samples = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) samples = parsed;
    } catch {}

    const references = [];
    for (const sample of samples) {
      try {
        const image = await loadRecognitionImage(sample.dataUrl);
        references.push({
          name: sample.name,
          learned: true,
          descriptor: buildLearnedCardDescriptor(image),
        });
      } catch {}
    }
    return references;
  })();

  return learnedHeroReferencePromise;
}

function encodeDescriptorVector(vector) {
  const bytes = new Uint8Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) {
    const value = Math.max(-1, Math.min(1, Number(vector[i]) || 0));
    bytes[i] = Math.max(0, Math.min(255, Math.round(value * 127) + 128));
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return btoa(binary);
}

function decodeDescriptorVector(encoded) {
  if (!encoded) return new Float32Array();
  const binary = atob(encoded);
  const values = new Float32Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) values[i] = (binary.charCodeAt(i) - 128) / 127;
  return normalizeVector(values);
}

function serializeHeroDescriptor(descriptor) {
  return {
    version: 3,
    gray: encodeDescriptorVector(descriptor.gray),
    gradient: encodeDescriptorVector(descriptor.gradient),
    hog: encodeDescriptorVector(descriptor.hog),
    hist: encodeDescriptorVector(descriptor.hist),
  };
}

function deserializeHeroDescriptor(payload) {
  if (!payload || Number(payload.version) !== 3) return null;
  try {
    return {
      gray: decodeDescriptorVector(payload.gray),
      gradient: decodeDescriptorVector(payload.gradient),
      hog: decodeDescriptorVector(payload.hog),
      hist: decodeDescriptorVector(payload.hist),
    };
  } catch {
    return null;
  }
}

function averageDescriptorList(descriptors) {
  if (!descriptors.length) return null;
  const keys = ["gray", "gradient", "hog", "hist"];
  const out = {};
  for (const key of keys) {
    const length = Math.max(...descriptors.map((item) => item?.[key]?.length || 0));
    if (!length) return null;
    const sum = new Float32Array(length);
    let used = 0;
    for (const descriptor of descriptors) {
      const vector = descriptor?.[key];
      if (!vector?.length) continue;
      used += 1;
      for (let i = 0; i < Math.min(length, vector.length); i += 1) sum[i] += vector[i];
    }
    if (!used) return null;
    for (let i = 0; i < sum.length; i += 1) sum[i] /= used;
    out[key] = normalizeVector(sum);
  }
  return out;
}

function sharedSourceClass(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!w || !h) return "unknown";
  return w / h >= 2.0 ? "wide" : "standard";
}

function invalidateSharedHeroReferences() {
  sharedHeroReferencePromise = null;
  sharedHeroReferenceLoadedAt = 0;
  sharedHeroReferenceCache = [];
}

function buildSharedReferencePrototypes(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    if (!row?.hero_name) continue;
    const descriptor = deserializeHeroDescriptor(row.descriptor);
    if (!descriptor) continue;
    const sourceClass = sharedSourceClass(row.source_width, row.source_height);
    const key = `${row.hero_name}::${sourceClass}`;
    const group = grouped.get(key) || { name: row.hero_name, sourceClass, descriptors: [] };
    // 한 영웅/환경이 과도하게 비대해져 모바일 연산량을 잡아먹지 않도록 최근 12개까지만 평균에 사용.
    if (group.descriptors.length < 12) group.descriptors.push(descriptor);
    grouped.set(key, group);
  }

  const references = [];
  for (const group of grouped.values()) {
    const descriptor = averageDescriptorList(group.descriptors);
    if (!descriptor) continue;
    references.push({
      name: group.name,
      learned: true,
      shared: true,
      sourceClass: group.sourceClass,
      sampleCount: group.descriptors.length,
      descriptor,
    });
  }
  return references;
}

async function getSharedHeroReferenceCache() { return []; }

function invalidateAdminHeroReferences() {
  adminHeroReferencePromise = null;
  adminHeroReferenceLoadedAt = 0;
  adminHeroReferenceCache = [];
}

function encodeUint8ArrayBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return btoa(binary);
}

function buildReferenceGray40(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 40;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, image.naturalWidth || image.width, image.naturalHeight || image.height, 0, 0, 40, 40);
  const data = ctx.getImageData(0, 0, 40, 40).data;
  const gray = new Uint8Array(40 * 40);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    gray[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  return gray;
}

function makeNormalizedHeroReferenceCanvas(image, size = 192) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  const side = Math.min(sw, sh);
  const sx = Math.max(0, (sw - side) / 2);
  const sy = Math.max(0, (sh - side) / 2);
  ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

async function prepareAdminHeroReferenceFile(file) {
  if (!file) throw new Error("PNG 파일을 선택해 주세요.");
  if (file.type && file.type !== "image/png") throw new Error("기준 초상화는 PNG 파일만 등록할 수 있습니다.");
  if (file.size > 10 * 1024 * 1024) throw new Error("PNG 파일은 10MB 이하로 등록해 주세요.");
  const image = await loadRecognitionImage(file, 10000);
  const normalized = makeNormalizedHeroReferenceCanvas(image, 192);
  const descriptor = serializeHeroDescriptor(buildReferenceHeroDescriptor(normalized));
  const gray40 = encodeUint8ArrayBase64(buildReferenceGray40(normalized));
  const imageData = normalized.toDataURL("image/png");
  return { descriptor, gray40, imageData };
}

async function getAdminHeroReferenceCache() { return []; }

async function buildSharedDescriptorPayload(sampleData) {
  const image = await loadRecognitionImage(sampleData);
  return serializeHeroDescriptor(buildLearnedCardDescriptor(image));
}



async function getHeroReferenceCache() {
  // 기본 79종 초상화만 필수. 로컬/공동 학습 데이터는 네트워크나 저장소 상태가 느려도
  // 인식 시작 자체를 붙잡지 않도록 짧은 시간 제한 뒤 생략하고 계속 진행한다.
  const basePromise = getBaseHeroReferenceCache();
  const learnedPromise = promiseWithTimeout(getLearnedHeroReferenceCache(), 1800, [], "로컬 학습 데이터");
  const sharedPromise = promiseWithTimeout(getSharedHeroReferenceCache(), 2200, [], "공동 학습 데이터");
  const adminPromise = promiseWithTimeout(getAdminHeroReferenceCache(), 1800, [], "관리자 기준 데이터");
  const base = await basePromise;
  const [learned, shared, adminRefs] = await Promise.all([learnedPromise, sharedPromise, adminPromise]);
  return [...base, ...(adminRefs || []), ...(learned || []), ...(shared || [])];
}

function getGameViewportTransform(image, variant = { scale: 1, dx: 0, dy: 0 }) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const fitScale = Math.min(iw / GUILD_WAR_VIEW_W, ih / GUILD_WAR_VIEW_H);
  const scale = fitScale * (variant.scale || 1);
  const centerX = iw / 2 + (variant.dx || 0) * fitScale;
  const centerY = ih / 2 + (variant.dy || 0) * fitScale;
  return {
    fitScale,
    scale,
    ox: centerX - (GUILD_WAR_VIEW_W * scale) / 2,
    oy: centerY - (GUILD_WAR_VIEW_H * scale) / 2,
    variant,
  };
}

function getSlotRectForImage(image, baseX, baseY, transform = null) {
  const viewport = transform || getGameViewportTransform(image);
  return {
    x: viewport.ox + baseX * viewport.scale,
    y: viewport.oy + baseY * viewport.scale,
    w: GUILD_WAR_VIEW_CARD_W * viewport.scale,
    h: GUILD_WAR_VIEW_CARD_H * viewport.scale,
  };
}

function buildSlotOccupancyScore(image, rect) {
  const canvas = document.createElement('canvas');
  canvas.width = 49;
  canvas.height = 53;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const count = canvas.width * canvas.height;
  const lum = new Float32Array(count);
  let satTotal = 0;
  let mean = 0;
  let bottomSat = 0;
  let bottomCount = 0;
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max > 0 ? ((max - min) / max) * 255 : 0;
    const v = r * 0.299 + g * 0.587 + b * 0.114;
    lum[p] = v;
    satTotal += sat;
    mean += v;
    const y = Math.floor(p / canvas.width);
    if (y >= Math.floor(canvas.height * 0.68)) {
      bottomCount += 1;
      if (sat > 100) bottomSat += 1;
    }
  }
  mean /= count;
  let variance = 0;
  let edges = 0;
  let edgeCount = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const idx = y * canvas.width + x;
      const d = lum[idx] - mean;
      variance += d * d;
      if (x + 1 < canvas.width) {
        edgeCount += 1;
        if (Math.abs(lum[idx] - lum[idx + 1]) > 38) edges += 1;
      }
      if (y + 1 < canvas.height) {
        edgeCount += 1;
        if (Math.abs(lum[idx] - lum[idx + canvas.width]) > 38) edges += 1;
      }
    }
  }
  const std = Math.sqrt(variance / count);
  const satMean = satTotal / count;
  const bottomRatio = bottomCount ? bottomSat / bottomCount : 0;
  const edgeRatio = edgeCount ? edges / edgeCount : 0;
  return satMean * 0.45 + std * 0.25 + bottomRatio * 35 + edgeRatio * 30;
}

function evaluateGuildWarGeometryVariants(image, variants) {
  let bestLayout = null;

  for (const variant of variants) {
    const transform = getGameViewportTransform(image, variant);

    for (let leftCount = 1; leftCount <= 4; leftCount += 1) {
      const rightCount = 5 - leftCount;
      const slotDefs = [
        ...HERO_SLOT_ROWS[leftCount].map((y) => ({ x: HERO_SLOT_X.left, y })),
        ...HERO_SLOT_ROWS[rightCount].map((y) => ({ x: HERO_SLOT_X.right, y })),
      ];

      const slots = slotDefs.map((slot) => {
        const rect = getSlotRectForImage(image, slot.x, slot.y, transform);
        return {
          ...rect,
          score: buildSlotOccupancyScore(image, rect),
          baseX: slot.x,
          baseY: slot.y,
        };
      });

      const sorted = [...slots].sort((a, b) => b.score - a.score);
      const gap = (sorted[2]?.score || 0) - (sorted[3]?.score || 0);
      const minTop = sorted[2]?.score || 0;
      const topSum = sorted.slice(0, 3).reduce((sum, item) => sum + item.score, 0);
      const restSum = sorted.slice(3).reduce((sum, item) => sum + item.score, 0);
      const priorPenalty =
        Math.abs((variant.scale || 1) - 1) * 52 +
        Math.abs(variant.dx || 0) * 0.018 +
        Math.abs(variant.dy || 0) * 0.022;

      const objective =
        topSum -
        restSum * 0.50 +
        gap * 2.45 +
        minTop * 0.30 -
        priorPenalty;

      if (!bestLayout || objective > bestLayout.objective) {
        bestLayout = {
          objective,
          slots: sorted.slice(0, 3),
          allSlots: sorted,
          leftCount,
          transform,
        };
      }
    }
  }

  return bestLayout;
}

function detectGuildWarHeroCards(image) {
  // 1차는 넓게 훑고, 2차는 실제로 가장 카드답게 잡힌 위치 주변만 다시 세밀하게 찾는다.
  const coarse = evaluateGuildWarGeometryVariants(image, GUILD_WAR_GEOMETRY_COARSE_VARIANTS);
  const refineVariants = buildGuildWarGeometryRefineVariants(coarse?.transform?.variant || { scale: 1, dx: 0, dy: 0 });
  const refined = evaluateGuildWarGeometryVariants(image, refineVariants);
  const bestLayout = refined && (!coarse || refined.objective >= coarse.objective - 0.5) ? refined : coarse;

  const cards = (bestLayout?.slots || []).sort((a, b) => a.y - b.y || a.x - b.x);
  cards.transform = bestLayout?.transform || getGameViewportTransform(image);
  cards.leftCount = bestLayout?.leftCount || 0;
  cards.quality = bestLayout
    ? Math.max(0, (bestLayout.allSlots[2]?.score || 0) - (bestLayout.allSlots[3]?.score || 0))
    : 0;
  cards.objective = bestLayout?.objective || 0;
  return cards;
}


function guildWarRectIou(a, b) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  if (!inter) return 0;
  const union = Math.max(1, a.w * a.h + b.w * b.h - inter);
  return inter / union;
}

function clampGuildWarRect(rect, iw, ih) {
  const x = Math.max(0, Math.min(iw - 1, rect.x));
  const y = Math.max(0, Math.min(ih - 1, rect.y));
  const w = Math.max(1, Math.min(iw - x, rect.w));
  const h = Math.max(1, Math.min(ih - y, rect.h));
  return { ...rect, x, y, w, h };
}

function normalizeDetectedGuildWarCard(rect, iw, ih) {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  // 기기별 카드 테두리 검출 폭이 조금 달라도 같은 얼굴 범위가 들어오도록 아주 약하게 패딩한다.
  const side = Math.max(rect.w, rect.h) * 1.035;
  return clampGuildWarRect({
    x: centerX - side / 2,
    y: centerY - side / 2,
    w: side,
    h: side,
    rawRect: rect,
  }, iw, ih);
}

function buildNicknameCropFromDetectedCards(cards, iw, ih) {
  if (!cards?.length) return null;
  const sizes = cards.map((card) => Math.max(card.w, card.h)).sort((a, b) => a - b);
  const side = sizes[Math.floor(sizes.length / 2)] || ih * 0.07;
  const minX = Math.min(...cards.map((card) => card.x));
  const minY = Math.min(...cards.map((card) => card.y));
  // 닉네임 바는 영웅 카드 군집 바로 위에 있고, PC/폰 모두 이 상대적 위치가 훨씬 안정적이다.
  return clampGuildWarRect({
    x: minX - side * 0.18,
    y: minY - side * 1.72,
    w: side * 3.18,
    h: side * 0.82,
  }, iw, ih);
}

function chooseContourGuildWarCards(image, rawCandidates) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const scored = [];

  for (const raw of rawCandidates) {
    const rect = normalizeDetectedGuildWarCard(raw, iw, ih);
    const centerXRatio = (rect.x + rect.w / 2) / iw;
    // 펫은 상대 영웅 열보다 더 오른쪽에 고정되어 있다. 카드처럼 검출되어도 후보에서 제거한다.
    if (centerXRatio > 0.7215) continue;
    const occupancy = buildSlotOccupancyScore(image, rect);
    const aspect = Math.min(raw.w, raw.h) / Math.max(raw.w, raw.h);
    const squareness = Math.max(0, Math.min(1, (aspect - 0.64) / 0.36));
    scored.push({ ...rect, occupancy, score: occupancy + squareness * 9.5 });
  }

  scored.sort((a, b) => b.score - a.score);
  const deduped = [];
  for (const candidate of scored) {
    const duplicate = deduped.some((kept) => {
      const dx = (candidate.x + candidate.w / 2) - (kept.x + kept.w / 2);
      const dy = (candidate.y + candidate.h / 2) - (kept.y + kept.h / 2);
      const dist = Math.hypot(dx, dy);
      return guildWarRectIou(candidate, kept) > 0.38 || dist < Math.min(candidate.w, kept.w) * 0.28;
    });
    if (!duplicate) deduped.push(candidate);
    if (deduped.length >= 12) break;
  }

  // 카드 크기가 크게 다른 UI 조각이 섞이는 걸 막는다. 실제 영웅 카드 3장은 같은 화면에서 거의 같은 크기다.
  let bestCombo = null;
  const pool = deduped.slice(0, 9);
  for (let a = 0; a < pool.length; a += 1) {
    for (let b = a + 1; b < pool.length; b += 1) {
      for (let c = b + 1; c < pool.length; c += 1) {
        const combo = [pool[a], pool[b], pool[c]];
        const sides = combo.map((item) => Math.max(item.w, item.h));
        const maxSide = Math.max(...sides);
        const minSide = Math.min(...sides);
        if (maxSide > minSide * 1.38) continue;

        const centersX = combo.map((item) => item.x + item.w / 2).sort((x, y) => x - y);
        const centersY = combo.map((item) => item.y + item.h / 2).sort((x, y) => x - y);
        const side = sides.reduce((sum, value) => sum + value, 0) / sides.length;

        // 실제 진형은 최대 2열이다. 세 점이 가로로 완전히 흩어진 UI 조각 조합에 패널티를 준다.
        const xGap1 = centersX[1] - centersX[0];
        const xGap2 = centersX[2] - centersX[1];
        const twoColumnPenalty = Math.min(xGap1, xGap2) > side * 0.72 ? 26 : 0;
        const tooFlatPenalty = (centersY[2] - centersY[0]) < side * 0.34 ? 18 : 0;
        const sizePenalty = ((maxSide - minSide) / Math.max(1, side)) * 32;
        const objective = combo.reduce((sum, item) => sum + item.score, 0) - twoColumnPenalty - tooFlatPenalty - sizePenalty;

        if (!bestCombo || objective > bestCombo.objective) bestCombo = { objective, combo };
      }
    }
  }

  const chosen = (bestCombo?.combo || deduped.slice(0, 3)).sort((a, b) => a.y - b.y || a.x - b.x);
  const fourth = deduped.find((item) => !chosen.includes(item));
  const quality = chosen.length === 3
    ? Math.max(0, Math.min(...chosen.map((item) => item.score)) - (fourth?.score || 0))
    : 0;
  return { cards: chosen, quality, candidates: deduped };
}

function detectGuildWarHeroCardsCv(cv, image) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return null;

  let src = null;
  let roi = null;
  let gray = null;
  let blurred = null;
  let edges = null;
  let dilated = null;
  let contours = null;
  let hierarchy = null;
  let kernel = null;

  try {
    src = cv.imread(image);
    // 상대팀 패널의 넓은 영역만 본다. 이 범위는 해상도/화면비가 달라도 실제 데이터에서 유지되는 상대적 영역이다.
    const rx = Math.max(0, Math.floor(iw * 0.585));
    const ry = Math.max(0, Math.floor(ih * 0.165));
    const rw = Math.max(2, Math.min(iw - rx, Math.ceil(iw * 0.155)));
    const rh = Math.max(2, Math.min(ih - ry, Math.ceil(ih * 0.535)));
    roi = src.roi(new cv.Rect(rx, ry, rw, rh));
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    dilated = new cv.Mat();
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, edges, 55, 125);
    kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, dilated, kernel);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const minSide = ih * 0.042;
    const maxSide = ih * 0.158;
    const rawCandidates = [];
    const pushBox = (x, y, w, h, source = "contour") => {
      if (w < minSide * 0.72 || h < minSide * 0.72) return;
      rawCandidates.push(clampGuildWarRect({ x: rx + x, y: ry + y, w, h, source }, iw, ih));
    };

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      try {
        const r = cv.boundingRect(contour);
        const aspect = r.w / Math.max(1, r.h);
        const squareish = r.w >= minSide && r.w <= maxSide && r.h >= minSide && r.h <= maxSide && aspect >= 0.64 && aspect <= 1.45;
        if (squareish) {
          pushBox(r.x, r.y, r.w, r.h);
          continue;
        }

        // PC에서는 세로로 붙어 있는 카드 2~3장이 Canny에서 하나의 긴 사각형으로 합쳐질 수 있다.
        if (r.w >= minSide && r.w <= maxSide && r.h > r.w * 1.42 && r.h <= r.w * 4.35) {
          const count = Math.max(2, Math.min(4, Math.round(r.h / Math.max(1, r.w))));
          const segH = r.h / count;
          for (let k = 0; k < count; k += 1) pushBox(r.x, r.y + segH * k, r.w, segH, "split-v");
          continue;
        }

        // 일부 UI 스케일에서는 좌우 카드가 한 덩어리로 붙을 수 있어 가로 병합도 분리한다.
        if (r.h >= minSide && r.h <= maxSide && r.w > r.h * 1.42 && r.w <= r.h * 2.75) {
          const count = Math.max(2, Math.min(3, Math.round(r.w / Math.max(1, r.h))));
          const segW = r.w / count;
          for (let k = 0; k < count; k += 1) pushBox(r.x + segW * k, r.y, segW, r.h, "split-h");
        }
      } finally {
        contour.delete();
      }
    }

    const selected = chooseContourGuildWarCards(image, rawCandidates);
    if (selected.cards.length !== 3) return null;

    const nicknameCrop = buildNicknameCropFromDetectedCards(selected.cards, iw, ih);
    const cards = selected.cards;
    cards.transform = { ...getGameViewportTransform(image), nicknameCrop };
    cards.nicknameCrop = nicknameCrop;
    cards.leftCount = 0;
    cards.quality = selected.quality;
    cards.objective = bestFinite(selected.cards.map((item) => item.score));
    cards.detector = "contour-v6";
    cards.candidateCount = selected.candidates.length;
    return cards;
  } catch (error) {
    console.warn("상대 영웅 카드 자동 검출 실패", error);
    return null;
  } finally {
    if (kernel) kernel.delete();
    if (hierarchy) hierarchy.delete();
    if (contours) contours.delete();
    if (dilated) dilated.delete();
    if (edges) edges.delete();
    if (blurred) blurred.delete();
    if (gray) gray.delete();
    if (roi) roi.delete();
    if (src) src.delete();
  }
}

function bestFinite(values) {
  const finite = (values || []).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : 0;
}

function makeTargetDescriptorVariants(image, card) {
  const cardCanvas = document.createElement("canvas");
  cardCanvas.width = GUILD_WAR_CARD_W;
  cardCanvas.height = GUILD_WAR_CARD_H;
  const cardCtx = cardCanvas.getContext("2d", { willReadFrequently: true });
  cardCtx.imageSmoothingEnabled = true;
  cardCtx.imageSmoothingQuality = "high";
  cardCtx.drawImage(image, card.x, card.y, card.w, card.h, 0, 0, GUILD_WAR_CARD_W, GUILD_WAR_CARD_H);

  return HERO_TARGET_VARIANTS.map(({ scale, dx, dy }) => {
    const canvas = makeDescriptorCanvas();
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const centerX = HERO_DESCRIPTOR_W / 2;
    const centerY = (47 / GUILD_WAR_CARD_H) * HERO_DESCRIPTOR_H;
    const dxSmall = (dx / GUILD_WAR_CARD_W) * HERO_DESCRIPTOR_W;
    const dySmall = (dy / GUILD_WAR_CARD_H) * HERO_DESCRIPTOR_H;

    ctx.save();
    ctx.translate(centerX + dxSmall, centerY + dySmall);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(cardCanvas, 0, 0, GUILD_WAR_CARD_W, GUILD_WAR_CARD_H, 0, 0, HERO_DESCRIPTOR_W, HERO_DESCRIPTOR_H);
    ctx.restore();

    return buildHeroDescriptorFromCanvas(canvas);
  });
}

function makeCardSampleDataUrl(image, card) {
  const canvas = document.createElement("canvas");
  canvas.width = GUILD_WAR_CARD_W;
  canvas.height = GUILD_WAR_CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, card.x, card.y, card.w, card.h, 0, 0, GUILD_WAR_CARD_W, GUILD_WAR_CARD_H);
  try {
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return "";
  }
}


const HIGH_PRECISION_CV_URL = "https://docs.opencv.org/4.x/opencv.js";
const HIGH_PRECISION_TOP_CANDIDATES = 18;
const HIGH_PRECISION_EXPANDED_CANDIDATES = 32;
const HIGH_PRECISION_PATCH_POINTS = [
  [0.28, 0.26], [0.50, 0.26], [0.72, 0.26],
  [0.28, 0.48], [0.50, 0.48], [0.72, 0.48],
  [0.35, 0.68], [0.62, 0.68],
];
const HIGH_PRECISION_PATCH_SCALES = [0.88, 0.96, 1.04, 1.12];
const HIGH_PRECISION_PATCH_BASE = 21;

function waitForNextPaint() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

const GUILD_WAR_WORKER_VERSION = "4.5.11";
const GUILD_WAR_ENGINE_LABEL = `15월의 인식엔진 ver ${GUILD_WAR_WORKER_VERSION}`;

function resetGuildWarRecognitionWorker(error = new Error("백그라운드 인식 작업이 초기화됐습니다."), worker = guildWarRecognitionWorker) {
  if (!worker) return;
  if (guildWarRecognitionWorker === worker) guildWarRecognitionWorker = null;
  for (const [id, pending] of guildWarRecognitionWorkerPending) {
    if (pending.worker !== worker) continue;
    if (pending.timer) clearTimeout(pending.timer);
    guildWarRecognitionWorkerPending.delete(id);
    pending.reject(error);
  }
  if (worker) {
    try { worker.terminate(); } catch {}
  }
}

function ensureGuildWarRecognitionWorker() {
  if (guildWarRecognitionWorker) return guildWarRecognitionWorker;
  if (typeof Worker === "undefined") throw new Error("이 브라우저는 백그라운드 인식 작업을 지원하지 않습니다.");

  // 버전 쿼리로 브라우저/CDN이 예전 worker 파일을 계속 쓰는 문제를 막는다.
  const worker = new Worker(`/guildwar-recognition.worker.js?v=${encodeURIComponent(GUILD_WAR_WORKER_VERSION)}`);
  worker.onmessage = (event) => {
    const message = event.data || {};
    const pending = guildWarRecognitionWorkerPending.get(message.id);
    if (!pending) return;
    if (message.type === "progress") {
      pending.onProgress?.(message.stage || "인식 중", Number(message.progress) || 0);
      return;
    }
    guildWarRecognitionWorkerPending.delete(message.id);
    if (pending.timer) clearTimeout(pending.timer);
    if (message.type === "error") pending.reject(new Error(message.error || "백그라운드 인식에 실패했습니다."));
    else pending.resolve(message.result);
  };
  worker.onerror = (event) => {
    const error = new Error(event?.message || "백그라운드 인식 작업이 중단됐습니다.");
    resetGuildWarRecognitionWorker(error, worker);
  };
  guildWarRecognitionWorker = worker;
  return worker;
}

function callGuildWarRecognitionWorker(type, payload = {}, transfer = [], onProgress = null, timeoutMs = 30000) {
  const worker = ensureGuildWarRecognitionWorker();
  const id = ++guildWarRecognitionWorkerRequestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const pending = guildWarRecognitionWorkerPending.get(id);
      if (!pending) return;
      // 한번 멈춘 worker를 재사용하면 이후 detect/rerank도 연달아 실패하므로 폐기한다.
      resetGuildWarRecognitionWorker(new Error(`백그라운드 인식 시간 초과 (${type})`), worker);
    }, timeoutMs);
    guildWarRecognitionWorkerPending.set(id, { resolve, reject, onProgress, timer, worker });
    try {
      worker.postMessage({ id, type, ...payload }, transfer);
    } catch (error) {
      guildWarRecognitionWorkerPending.delete(id);
      clearTimeout(timer);
      reject(error);
    }
  });
}

function warmGuildWarRecognitionWorker() {
  try {
    return callGuildWarRecognitionWorker("warmup", {}, [], null, 15000).catch((error) => {
      console.warn("길드전 인식 worker 준비 실패", error);
      return null;
    });
  } catch (error) {
    console.warn("길드전 인식 worker 사용 불가", error);
    return Promise.resolve(null);
  }
}

function makeTargetPortraitGrayBytes(image, card) {
  const canvas = makeStandardHeroCardCanvas(image, card);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, 94, 94).data;
  const gray = new Uint8Array(94 * 94);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    gray[p] = Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
  }
  return gray;
}

async function recognizeGuildWarInWorker(file, onProgress) {
  if (typeof createImageBitmap !== "function") throw new Error("이 브라우저는 백그라운드 이미지 처리를 지원하지 않습니다.");

  // v8은 OpenCV/CDN을 전혀 사용하지 않는다. 기준 데이터도 public의 단일 JSON 팩으로 읽어서
  // 79장 PNG를 메인 스레드에서 매번 준비하던 병목을 없앴다.
  const localSamples = readHeroCorrectionSamples().slice(0, 50);
  const [shared, adminRefs] = await Promise.all([
    promiseWithTimeout(getSharedHeroReferenceCache(), 1200, [], "공동 학습 데이터"),
    promiseWithTimeout(getAdminHeroReferenceCache(), 1200, [], "관리자 기준 데이터"),
  ]);
  const sharedReferences = [
    ...(shared || []).map((item) => ({
      name: item.name,
      descriptor: item.descriptor,
      sourceClass: item.sourceClass || "unknown",
      sampleCount: item.sampleCount || 0,
    })),
    ...(adminRefs || []).map((item) => ({
      name: item.name,
      descriptor: item.descriptor,
      gray40: item.gray40 || "",
      adminReference: true,
      referenceType: item.referenceType || "costume",
    })),
  ];

  const bitmap = await createImageBitmap(file);
  try {
    const result = await callGuildWarRecognitionWorker(
      "recognize",
      { bitmap, localSamples, sharedReferences },
      [bitmap],
      onProgress,
      40000
    );
    if (result?.workerVersion !== GUILD_WAR_WORKER_VERSION) {
      resetGuildWarRecognitionWorker();
      throw new Error(`인식 엔진 버전이 일치하지 않습니다. (현재 ${result?.workerVersion || "알 수 없음"}, 필요 ${GUILD_WAR_WORKER_VERSION}) public/guildwar-recognition.worker.js도 함께 교체해 주세요.`);
    }
    return result;
  } catch (error) {
    try { bitmap.close?.(); } catch {}
    throw error;
  }
}

function ensureOpenCvLoaded() {
  const hasCv = (candidate) => Boolean(candidate?.Mat && typeof candidate.matchTemplate === "function" && typeof candidate.minMaxLoc === "function");
  if (hasCv(window.cv)) return Promise.resolve(window.cv);
  if (openCvLoaderPromise) return openCvLoaderPromise;

  openCvLoaderPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value, error = null) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };

    const startedAt = Date.now();
    const poll = async () => {
      try {
        let candidate = window.cv;
        if (candidate && typeof candidate.then === "function") {
          candidate = await candidate;
          if (candidate) window.cv = candidate;
        }
        if (hasCv(candidate)) {
          finish(candidate);
          return;
        }
      } catch {}

      if (Date.now() - startedAt > 22000) {
        finish(null, new Error("고정밀 이미지 엔진을 불러오지 못했습니다."));
        return;
      }
      setTimeout(poll, 80);
    };

    const existing = document.querySelector('script[data-seori-opencv="1"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = HIGH_PRECISION_CV_URL;
      script.async = true;
      script.dataset.seoriOpencv = "1";
      script.onerror = () => finish(null, new Error("고정밀 이미지 엔진 다운로드에 실패했습니다."));
      document.head.appendChild(script);
    }
    poll();
  }).catch((error) => {
    openCvLoaderPromise = null;
    throw error;
  });

  return openCvLoaderPromise;
}

function makeStandardHeroCardCanvas(image, card) {
  const canvas = document.createElement("canvas");
  canvas.width = GUILD_WAR_CARD_W;
  canvas.height = GUILD_WAR_CARD_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, card.x, card.y, card.w, card.h, 0, 0, GUILD_WAR_CARD_W, GUILD_WAR_CARD_H);
  return canvas;
}

function getHighPrecisionBaseReferenceMap(baseReferences) {
  if (highPrecisionReferenceMapPromise) return highPrecisionReferenceMapPromise;
  highPrecisionReferenceMapPromise = Promise.resolve(new Map(
    (baseReferences || []).filter((item) => item?.image && !item.learned && !item.shared).map((item) => [item.name, item])
  ));
  return highPrecisionReferenceMapPromise;
}

function buildTargetPortraitGrayMat(cv, image, card) {
  const canvas = makeStandardHeroCardCanvas(image, card);
  const rgba = cv.imread(canvas);
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();
  // 실제 일러스트는 표준 98x106 카드의 상단 약 94px. 하단 별/레벨 UI를 아예 고정밀 비교에서 제외한다.
  const roi = gray.roi(new cv.Rect(0, 0, 94, 94));
  return { gray, roi };
}

function buildReferencePortraitGrayMat(cv, image) {
  const rgba = cv.imread(image);
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();
  const resized = new cv.Mat();
  cv.resize(gray, resized, new cv.Size(94, 94), 0, 0, cv.INTER_AREA);
  gray.delete();
  return resized;
}

function highPrecisionPatchScore(cv, targetGray, referenceImage) {
  let ref94 = null;
  try {
    ref94 = buildReferencePortraitGrayMat(cv, referenceImage);
    let bestScaleScore = -1;

    for (const scale of HIGH_PRECISION_PATCH_SCALES) {
      const scaledSize = Math.max(76, Math.round(94 * scale));
      const scaled = new cv.Mat();
      cv.resize(ref94, scaled, new cv.Size(scaledSize, scaledSize), 0, 0, cv.INTER_AREA);
      const patchScores = [];

      try {
        const patchSize = Math.max(14, Math.round(HIGH_PRECISION_PATCH_BASE * scale));
        for (const [fx, fy] of HIGH_PRECISION_PATCH_POINTS) {
          const cx = Math.round(fx * scaledSize);
          const cy = Math.round(fy * scaledSize);
          const x = Math.max(0, Math.min(scaledSize - patchSize, Math.round(cx - patchSize / 2)));
          const y = Math.max(0, Math.min(scaledSize - patchSize, Math.round(cy - patchSize / 2)));
          if (patchSize >= targetGray.cols || patchSize >= targetGray.rows) continue;

          const patch = scaled.roi(new cv.Rect(x, y, patchSize, patchSize));
          const result = new cv.Mat();
          try {
            cv.matchTemplate(targetGray, patch, result, cv.TM_CCOEFF_NORMED);
            const mm = cv.minMaxLoc(result);
            if (Number.isFinite(mm.maxVal)) patchScores.push(mm.maxVal);
          } finally {
            patch.delete();
            result.delete();
          }
        }
      } finally {
        scaled.delete();
      }

      if (patchScores.length) {
        patchScores.sort((a, b) => b - a);
        // LV/강화/별 등에 가려진 패치는 버리고, 실제 일러스트가 잘 맞는 패치 5개만 집계한다.
        const keep = patchScores.slice(0, Math.min(5, patchScores.length));
        const scaleScore = keep.reduce((sum, value) => sum + value, 0) / keep.length;
        bestScaleScore = Math.max(bestScaleScore, scaleScore);
      }
    }

    return bestScaleScore;
  } catch (error) {
    console.warn("고정밀 패치 비교 실패", error);
    return -1;
  } finally {
    if (ref94) ref94.delete();
  }
}

function coarseRankHeroCard(image, card, references) {
  const targetVariants = makeTargetDescriptorVariants(image, card);
  const scoreByName = new Map();

  for (const reference of references) {
    let best = -1;
    for (const target of targetVariants) {
      best = Math.max(best, compareHeroDescriptorsV3(target, reference.descriptor));
    }

    if (reference.shared) best -= 0.006;
    else if (reference.learned) best -= 0.004;

    const prev = scoreByName.get(reference.name);
    if (prev == null || best > prev) scoreByName.set(reference.name, best);
  }

  return [...scoreByName.entries()]
    .map(([name, score]) => ({ name, score, coarseScore: score }))
    .sort((a, b) => b.score - a.score);
}

async function rerankHeroCandidatesHighPrecision(cv, image, card, coarseRanking, baseReferenceMap, limit) {
  const candidates = coarseRanking.slice(0, Math.min(limit, coarseRanking.length));
  const { gray: targetOwner, roi: targetGray } = buildTargetPortraitGrayMat(cv, image, card);
  const output = [];

  try {
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const reference = baseReferenceMap.get(candidate.name);
      const patchScore = reference?.image ? highPrecisionPatchScore(cv, targetGray, reference.image) : -1;
      const hasPatchScore = Number.isFinite(patchScore) && patchScore >= 0;
      const score = hasPatchScore
        ? patchScore * 0.82 + candidate.coarseScore * 0.18
        : candidate.coarseScore;

      output.push({
        ...candidate,
        score,
        patchScore: hasPatchScore ? patchScore : null,
        highPrecision: hasPatchScore,
      });

      if (i > 0 && i % 5 === 0) await waitForNextPaint();
    }
  } finally {
    targetGray.delete();
    targetOwner.delete();
  }

  return output.sort((a, b) => b.score - a.score);
}

async function rankHeroCardV6(image, card, references, cv, baseReferenceMap) {
  const coarse = coarseRankHeroCard(image, card, references);
  if (!cv || !baseReferenceMap?.size) return coarse.slice(0, 6);

  let precise = await rerankHeroCandidatesHighPrecision(
    cv,
    image,
    card,
    coarse,
    baseReferenceMap,
    HIGH_PRECISION_TOP_CANDIDATES
  );

  const first = precise[0];
  const second = precise[1];
  const margin = (first?.score || 0) - (second?.score || 0);
  const weak = !first || first.score < 0.72 || margin < 0.045 || (first.patchScore ?? 0) < 0.66;

  if (weak && coarse.length > HIGH_PRECISION_TOP_CANDIDATES) {
    precise = await rerankHeroCandidatesHighPrecision(
      cv,
      image,
      card,
      coarse,
      baseReferenceMap,
      HIGH_PRECISION_EXPANDED_CANDIDATES
    );
  }

  return precise.slice(0, 6);
}

function rankHeroCard(image, card, references) {
  return coarseRankHeroCard(image, card, references).slice(0, 6);
}

function chooseUniqueHeroResults(cardRankings) {
  if (!cardRankings.length) return [];

  let best = null;
  let secondBestScore = -Infinity;

  function walk(index, used, picks, score) {
    if (index >= cardRankings.length) {
      if (!best || score > best.score) {
        if (best) secondBestScore = Math.max(secondBestScore, best.score);
        best = { score, picks: [...picks] };
      } else {
        secondBestScore = Math.max(secondBestScore, score);
      }
      return;
    }

    const ranking = cardRankings[index].slice(0, 5);
    for (const candidate of ranking) {
      if (used.has(candidate.name)) continue;
      used.add(candidate.name);
      picks.push(candidate);
      walk(index + 1, used, picks, score + candidate.score);
      picks.pop();
      used.delete(candidate.name);
    }
  }

  walk(0, new Set(), [], 0);

  const buildResult = (pick, ranking, globalGap = 0.05) => {
    const alternative = ranking?.find((candidate) => candidate.name !== pick?.name);
    const localMargin = (pick?.score || 0) - (alternative?.score ?? -1);
    const highPrecision = Boolean(pick?.highPrecision);
    const confident = highPrecision
      ? Boolean(
          pick &&
          pick.score >= 0.70 &&
          (pick.patchScore ?? 0) >= 0.65 &&
          localMargin >= 0.035 &&
          (globalGap >= 0.010 || localMargin >= 0.065)
        )
      : Boolean(pick && pick.score >= 0.60 && localMargin >= 0.020);

    return {
      name: pick?.name || "",
      score: pick?.score || 0,
      patchScore: pick?.patchScore ?? null,
      coarseScore: pick?.coarseScore ?? pick?.score ?? 0,
      highPrecision,
      confident,
      candidates: (ranking || []).slice(0, 3),
    };
  };

  if (!best) {
    return cardRankings.map((ranking) => buildResult(ranking[0], ranking));
  }

  const globalGap = Number.isFinite(secondBestScore) ? best.score - secondBestScore : 0.05;
  return best.picks.map((pick, index) => buildResult(pick, cardRankings[index], globalGap));
}

async function recognizeGuildWarHeroes(file, onStage = null) {
  // v8: OpenCV worker를 완전히 제거하고 순수 JS worker 한 번으로
  // 카드 검출 + 후보 추림 + 정밀 비교를 모두 처리한다.
  // 메인 스레드는 이미지 미리보기/OCR용 원본만 준비하므로 사이트 UI가 막히지 않는다.
  onStage?.("스크린샷 불러오는 중", 0);
  const imagePromise = loadRecognitionImage(file, 10000).then(image => ({ image }), error => ({ error }));

  let workerResult = null;
  let engineWarning = "";
  try {
    workerResult = await recognizeGuildWarInWorker(file, onStage);
  } catch (error) {
    console.warn("v8 백그라운드 인식 실패", error);
    engineWarning = `백그라운드 인식 실패: ${error?.message || "알 수 없는 오류"}`;
  }

  const imageResult = await imagePromise;
  if (imageResult.error) throw imageResult.error;
  const image = imageResult.image;

  // v8 worker가 정상 동작하면 메인 스레드에서 79개 기준 초상화나 OpenCV를 준비하지 않는다.
  if (workerResult?.cards?.length === 3 && Array.isArray(workerResult.results) && workerResult.results.length === 3) {
    const cards = workerResult.cards;
    const nicknameCrop = workerResult.nicknameCrop || buildNicknameCropFromDetectedCards(cards, image.naturalWidth || image.width, image.naturalHeight || image.height);
    cards.nicknameCrop = nicknameCrop || null;
    cards.transform = { ...getGameViewportTransform(image), nicknameCrop: nicknameCrop || null };
    const samples = cards.map((card) => makeCardSampleDataUrl(image, card));
    return {
      image,
      cards,
      results: workerResult.results,
      samples,
      transform: cards.transform,
      layout: 0,
      detectionQuality: workerResult.quality || 0,
      engine: workerResult.engine || "v8-pure-js-worker",
      detector: workerResult.detector || "frame-validated-v1",
      engineWarning: "",
      elapsedMs: workerResult.elapsedMs || 0,
    };
  }

  // v8.2: Worker 실패 시 예전 좌표 기반 보조 인식으로 억지 결과를 만들지 않는다.
  // 그 보조 경로가 빨간 빈 슬롯을 영웅으로 오인하는 실제 사례가 있었기 때문에 정확도를 우선한다.
  throw new Error(engineWarning || "백그라운드 인식 엔진을 사용할 수 없습니다. App.jsx와 public/guildwar-recognition.worker.js의 버전이 동일한지 확인해 주세요.");

}

export const PICKER_HERO_NAMES = [...HERO_REFERENCE_MANIFEST.map(hero => hero.name), "윤건"];
export { recognizeGuildWarHeroes, warmGuildWarRecognitionWorker, saveHeroCorrectionSample, GUILD_WAR_ENGINE_LABEL };
