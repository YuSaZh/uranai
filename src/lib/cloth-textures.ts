import type {
  ClothDetailSettings,
  ClothLightingId,
  ClothMaterialId,
  ClothMotifId,
} from "@/types/tarot";

export const DEFAULT_CLOTH_DETAIL: ClothDetailSettings = {
  material: "velvet",
  textureIntensity: 80,
  foldDepth: 50,
  motif: "astrolabe",
  motifOpacity: 55,
  lighting: "candlelight",
  vignetteStrength: 68,
  goldTrim: true,
  interactiveSheen: true,
  particleDensity: 60,
};

export interface ClothMaterialOption {
  id: ClothMaterialId;
  nameZh: string;
  nameEn: string;
  desc: string;
  tileSize: number;
}

export const CLOTH_MATERIALS: ClothMaterialOption[] = [
  {
    id: "velvet",
    nameZh: "高密丝绒",
    nameEn: "Plush Velvet",
    desc: "细腻绒毛肌理与柔润漫反射，最具神殿仪式感",
    tileSize: 192,
  },
  {
    id: "linen",
    nameZh: "粗织亚麻",
    nameEn: "Woven Linen",
    desc: "经纬交错的自然亚麻布纹，博物复古手作质感",
    tileSize: 160,
  },
  {
    id: "silk",
    nameZh: "提花锦缎",
    nameEn: "Silk Brocade",
    desc: "宫廷暗纹提花与缎面光泽，随光流动显影",
    tileSize: 224,
  },
  {
    id: "suede",
    nameZh: "哑光麂皮",
    nameEn: "Brushed Suede",
    desc: "柔和温润的细微绒粒，低调沉静不反光",
    tileSize: 180,
  },
  {
    id: "constellation",
    nameZh: "织金星纱",
    nameEn: "Gilded Twill",
    desc: "斜纹织布夹织细碎金属丝线，微光星点闪烁",
    tileSize: 192,
  },
];

export interface ClothMotifOption {
  id: ClothMotifId;
  nameZh: string;
  desc: string;
}

export const CLOTH_MOTIFS: ClothMotifOption[] = [
  { id: "astrolabe", nameZh: "星盘六芒", desc: "经典十二宫星盘刻度与八芒法阵" },
  { id: "lunar-phases", nameZh: "月相轮回", desc: "盈亏月相环与星月轨线刺绣" },
  { id: "mucha-botanical", nameZh: "穆夏藤蔓", desc: "新艺术装饰拱门、鸢尾与缠枝花环" },
  { id: "celtic-knot", nameZh: "凯尔特结", desc: "交织神圣几何与四方神殿方位纹" },
  { id: "minimal", nameZh: "纯素无纹", desc: "纯粹展现织物肌理与光影褶皱" },
];

export interface ClothLightingOption {
  id: ClothLightingId;
  nameZh: string;
  desc: string;
}

export const CLOTH_LIGHTINGS: ClothLightingOption[] = [
  { id: "candlelight", nameZh: "暖黄烛光", desc: "模拟桌畔烛火温润微曳与深邃暗角" },
  { id: "moonlight", nameZh: "清冷月光", desc: "斜向银蓝冷光勾勒织物褶皱起伏" },
  { id: "spotlight", nameZh: "神殿顶灯", desc: "高对比聚焦中心牌阵，四周沉入暗夜" },
  { id: "ambient", nameZh: "柔和自然", desc: "均衡温润漫射光，适合浅色与长时阅读" },
];

export interface ClothRealismPreset {
  id: string;
  nameZh: string;
  tagline: string;
  settings: ClothDetailSettings;
}

export const CLOTH_REALISM_PRESETS: ClothRealismPreset[] = [
  {
    id: "plush-velvet-altar",
    nameZh: "极致拟真丝绒祭坛",
    tagline: "浓密绒毛 · 自然褶皱 · 烛光微曳 · 星盘刺绣",
    settings: {
      material: "velvet",
      textureIntensity: 88,
      foldDepth: 58,
      motif: "astrolabe",
      motifOpacity: 58,
      lighting: "candlelight",
      vignetteStrength: 74,
      goldTrim: true,
      interactiveSheen: true,
      particleDensity: 55,
    },
  },
  {
    id: "royal-silk-brocade",
    nameZh: "皇室暗纹提花锦缎",
    tagline: "宫廷提花 · 丝滑垂坠 · 神殿聚光 · 月相金线",
    settings: {
      material: "silk",
      textureIntensity: 85,
      foldDepth: 66,
      motif: "lunar-phases",
      motifOpacity: 62,
      lighting: "spotlight",
      vignetteStrength: 78,
      goldTrim: true,
      interactiveSheen: true,
      particleDensity: 45,
    },
  },
  {
    id: "artisan-linen-studio",
    nameZh: "古典博物粗织亚麻",
    tagline: "经纬织纹 · 柔皱自然 · 穆夏花卉 · 温和采光",
    settings: {
      material: "linen",
      textureIntensity: 92,
      foldDepth: 42,
      motif: "mucha-botanical",
      motifOpacity: 64,
      lighting: "ambient",
      vignetteStrength: 48,
      goldTrim: true,
      interactiveSheen: true,
      particleDensity: 35,
    },
  },
  {
    id: "gilded-constellation",
    nameZh: "织金星纱秘境",
    tagline: "金丝斜纹 · 清冷月光 · 凯尔特结 · 星尘飘浮",
    settings: {
      material: "constellation",
      textureIntensity: 84,
      foldDepth: 52,
      motif: "celtic-knot",
      motifOpacity: 56,
      lighting: "moonlight",
      vignetteStrength: 70,
      goldTrim: true,
      interactiveSheen: true,
      particleDensity: 80,
    },
  },
  {
    id: "minimal-quiet-suede",
    nameZh: "极简静谧素麂皮",
    tagline: "温润哑光 · 轻柔起伏 · 纯素无纹 · 专注牌面",
    settings: {
      material: "suede",
      textureIntensity: 74,
      foldDepth: 32,
      motif: "minimal",
      motifOpacity: 0,
      lighting: "ambient",
      vignetteStrength: 54,
      goldTrim: false,
      interactiveSheen: true,
      particleDensity: 15,
    },
  },
];

// Deterministic PRNG so generated procedural fabric tiles look consistent across renders
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratedMaterialTiles {
  weaveUrl: string;
  cloudUrl: string;
}

const TILE_CACHE = new Map<string, GeneratedMaterialTiles>();

function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return [canvas, ctx];
}

/**
 * Generates seamless high-detail procedural textile micro-weave + crushed-nap cloud maps
 * once per material and caches them as lightweight data URLs.
 */
export function getProceduralFabricTiles(
  material: ClothMaterialId,
  isLight: boolean
): GeneratedMaterialTiles | null {
  if (typeof document === "undefined") return null;
  const key = `${material}:${isLight ? "L" : "D"}`;
  const cached = TILE_CACHE.get(key);
  if (cached) return cached;

  const size = 256;
  const weavePair = createCanvas(size);
  const cloudPair = createCanvas(size);
  if (!weavePair || !cloudPair) return null;

  const [weaveCanvas, wCtx] = weavePair;
  const [cloudCanvas, cCtx] = cloudPair;
  const rand = mulberry32(
    material === "velvet"
      ? 1019
      : material === "linen"
        ? 2029
        : material === "silk"
          ? 3037
          : material === "suede"
            ? 4049
            : 5059
  );

  // Neutral gray base (128) for clean overlay/soft-light compositing
  wCtx.fillStyle = "rgb(128,128,128)";
  wCtx.fillRect(0, 0, size, size);

  if (material === "velvet") {
    // 1) Dense microscopic velvet nap pixel grain
    const img = wCtx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * 44;
      const v = Math.max(0, Math.min(255, 128 + n));
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    wCtx.putImageData(img, 0, 0);

    // 2) Anisotropic short brushed velvet pile hairs (wrapped seamlessly)
    wCtx.lineWidth = 0.85;
    for (let i = 0; i < 4200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 3 + rand() * 5.5;
      const angle = -0.58 + (rand() - 0.5) * 0.42;
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      const bright = rand() > 0.46;
      wCtx.strokeStyle = bright
        ? `rgba(255,255,255,${0.08 + rand() * 0.14})`
        : `rgba(0,0,0,${0.12 + rand() * 0.18})`;

      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          if (
            x + ox + dx < -8 ||
            x + ox > size + 8 ||
            y + oy + dy < -8 ||
            y + oy > size + 8
          ) {
            continue;
          }
          wCtx.beginPath();
          wCtx.moveTo(x + ox, y + oy);
          wCtx.lineTo(x + ox + dx, y + oy + dy);
          wCtx.stroke();
        }
      }
    }

    // 3) Crushed-velvet organic directional nap shading clouds
    cCtx.fillStyle = "rgb(128,128,128)";
    cCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 48; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const r = 34 + rand() * 68;
      const isHighlight = rand() > 0.48;
      const color = isHighlight ? "255,255,255" : "0,0,0";
      const alpha = isHighlight ? 0.1 + rand() * 0.12 : 0.12 + rand() * 0.15;

      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const px = cx + ox;
          const py = cy + oy;
          if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
          const grad = cCtx.createRadialGradient(px, py, 0, px, py, r);
          grad.addColorStop(0, `rgba(${color},${alpha})`);
          grad.addColorStop(1, `rgba(${color},0)`);
          cCtx.fillStyle = grad;
          cCtx.beginPath();
          cCtx.arc(px, py, r, 0, Math.PI * 2);
          cCtx.fill();
        }
      }
    }
  } else if (material === "linen") {
    // Real orthogonal warp & weft threads with organic slub irregularity
    const pitch = 4;
    for (let y = 0; y < size; y += pitch) {
      const rowJitter = (rand() - 0.5) * 16;
      const slub = rand() > 0.85 ? 1.45 : 1;
      for (let x = 0; x < size; x += pitch) {
        const isWarpTop = ((x / pitch + y / pitch) & 1) === 0;
        const micro = (rand() - 0.5) * 20 + rowJitter;
        const crown = Math.max(0, Math.min(255, 146 + micro));
        const shadow = Math.max(0, Math.min(255, 88 + micro * 0.6));

        if (isWarpTop) {
          // Horizontal weft shadow crevice + vertical warp thread crown
          wCtx.fillStyle = `rgb(${shadow},${shadow},${shadow})`;
          wCtx.fillRect(x, y, pitch, pitch);
          wCtx.fillStyle = `rgb(${crown},${crown},${crown})`;
          wCtx.fillRect(x + 0.5, y, Math.min(pitch - 0.8, 2.5 * slub), pitch);
          wCtx.fillStyle = "rgba(255,255,255,0.22)";
          wCtx.fillRect(x + 1, y, 0.9, pitch);
        } else {
          wCtx.fillStyle = `rgb(${shadow},${shadow},${shadow})`;
          wCtx.fillRect(x, y, pitch, pitch);
          wCtx.fillStyle = `rgb(${crown},${crown},${crown})`;
          wCtx.fillRect(x, y + 0.5, pitch, Math.min(pitch - 0.8, 2.5 * slub));
          wCtx.fillStyle = "rgba(255,255,255,0.22)";
          wCtx.fillRect(x, y + 1, pitch, 0.9);
        }
      }
    }

    // Subtle organic fiber slub streaks
    for (let i = 0; i < 60; i++) {
      const horizontal = rand() > 0.5;
      const pos = Math.floor(rand() * (size / pitch)) * pitch;
      const start = rand() * size;
      const len = 18 + rand() * 52;
      wCtx.fillStyle =
        rand() > 0.5 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.16)";
      if (horizontal) {
        wCtx.fillRect(start, pos + 1, len, 1.4);
      } else {
        wCtx.fillRect(pos + 1, start, 1.4, len);
      }
    }

    // Gentle matte cloth tonal mottling
    cCtx.fillStyle = "rgb(128,128,128)";
    cCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 24; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const r = 44 + rand() * 64;
      const color = rand() > 0.5 ? "255,255,255" : "0,0,0";
      const grad = cCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${color},0.07)`);
      grad.addColorStop(1, `rgba(${color},0)`);
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.arc(cx, cy, r, 0, Math.PI * 2);
      cCtx.fill();
    }
  } else if (material === "silk") {
    // Fine horizontal satin sheen lines
    for (let y = 0; y < size; y += 2) {
      const lum = 122 + Math.round((rand() - 0.5) * 18);
      wCtx.fillStyle = `rgb(${lum},${lum},${lum})`;
      wCtx.fillRect(0, y, size, 1.2);
      wCtx.fillStyle = "rgba(255,255,255,0.08)";
      wCtx.fillRect(0, y + 1, size, 0.8);
    }

    // Repeating embossed royal damask jacquard motif (seamless 2x2 diamond lattice)
    const drawDamaskMedallion = (cx: number, cy: number) => {
      wCtx.save();
      wCtx.translate(cx, cy);

      // Subtle embossed shadow pass + highlight pass
      for (const pass of [
        { ox: 1.2, oy: 1.5, stroke: "rgba(0,0,0,0.34)", fill: "rgba(0,0,0,0.16)" },
        { ox: -0.8, oy: -0.8, stroke: "rgba(255,255,255,0.36)", fill: "rgba(255,255,255,0.14)" },
      ]) {
        wCtx.save();
        wCtx.translate(pass.ox, pass.oy);
        wCtx.strokeStyle = pass.stroke;
        wCtx.fillStyle = pass.fill;
        wCtx.lineWidth = 1.6;

        // Outer ogee diamond scroll
        wCtx.beginPath();
        wCtx.moveTo(0, -52);
        wCtx.bezierCurveTo(26, -30, 44, -20, 52, 0);
        wCtx.bezierCurveTo(44, 20, 26, 30, 0, 52);
        wCtx.bezierCurveTo(-26, 30, -44, 20, -52, 0);
        wCtx.bezierCurveTo(-44, -20, -26, -30, 0, -52);
        wCtx.stroke();

        // Inner lotus petals (8-fold)
        for (let k = 0; k < 8; k++) {
          wCtx.save();
          wCtx.rotate((k * Math.PI) / 4);
          wCtx.beginPath();
          wCtx.moveTo(0, -8);
          wCtx.quadraticCurveTo(10, -22, 0, -34);
          wCtx.quadraticCurveTo(-10, -22, 0, -8);
          wCtx.fill();
          wCtx.stroke();
          wCtx.restore();
        }

        // Central star dot
        wCtx.beginPath();
        wCtx.arc(0, 0, 5, 0, Math.PI * 2);
        wCtx.fill();
        wCtx.restore();
      }
      wCtx.restore();
    };

    const centers = [
      [0, 0],
      [size, 0],
      [0, size],
      [size, size],
      [size / 2, size / 2],
      [size / 2, 0],
      [size / 2, size],
      [0, size / 2],
      [size, size / 2],
    ];
    for (const [cx, cy] of centers) {
      drawDamaskMedallion(cx, cy);
    }

    // Silk flowing sheen bands
    cCtx.fillStyle = "rgb(128,128,128)";
    cCtx.fillRect(0, 0, size, size);
    const sheenGrad = cCtx.createLinearGradient(0, 0, size, size);
    sheenGrad.addColorStop(0, "rgba(255,255,255,0.16)");
    sheenGrad.addColorStop(0.28, "rgba(0,0,0,0.14)");
    sheenGrad.addColorStop(0.55, "rgba(255,255,255,0.18)");
    sheenGrad.addColorStop(0.82, "rgba(0,0,0,0.12)");
    sheenGrad.addColorStop(1, "rgba(255,255,255,0.16)");
    cCtx.fillStyle = sheenGrad;
    cCtx.fillRect(0, 0, size, size);
  } else if (material === "suede") {
    // Organic velvety microfiber stipple
    const img = wCtx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() + rand() - 1) * 38;
      const v = Math.max(0, Math.min(255, 128 + n));
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    wCtx.putImageData(img, 0, 0);

    // Subtle organic suede pebble mottling
    for (let i = 0; i < 900; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 1.2 + rand() * 2.8;
      wCtx.fillStyle =
        rand() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
      wCtx.beginPath();
      wCtx.arc(x, y, r, 0, Math.PI * 2);
      wCtx.fill();
    }

    cCtx.fillStyle = "rgb(128,128,128)";
    cCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 36; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const r = 36 + rand() * 58;
      const color = rand() > 0.5 ? "255,255,255" : "0,0,0";
      const grad = cCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${color},0.09)`);
      grad.addColorStop(1, `rgba(${color},0)`);
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.arc(cx, cy, r, 0, Math.PI * 2);
      cCtx.fill();
    }
  } else {
    // Constellation: diagonal twill weave + fine glinting metallic thread flecks
    const img = wCtx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const twill = ((x + y) % 6 < 3 ? 12 : -12) + ((x - y + size) % 8 === 0 ? 7 : 0);
        const grain = (rand() - 0.5) * 26;
        const v = Math.max(0, Math.min(255, 128 + twill + grain));
        d[idx] = v;
        d[idx + 1] = v;
        d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    wCtx.putImageData(img, 0, 0);

    // Metallic interwoven shimmer threads & micro stitched stars
    for (let i = 0; i < 240; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const glint = 0.25 + rand() * 0.55;
      wCtx.fillStyle = isLight
        ? `rgba(176,125,40,${glint * 0.55})`
        : `rgba(255,228,148,${glint})`;
      if (i % 9 === 0) {
        wCtx.fillRect(x - 1.5, y, 3.5, 0.8);
        wCtx.fillRect(x, y - 1.5, 0.8, 3.5);
      } else {
        wCtx.fillRect(x, y, 2.2, 0.8);
      }
    }

    cCtx.fillStyle = "rgb(128,128,128)";
    cCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 26; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const r = 38 + rand() * 62;
      const color = rand() > 0.45 ? "255,235,175" : "0,0,0";
      const grad = cCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${color},0.1)`);
      grad.addColorStop(1, `rgba(${color},0)`);
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.arc(cx, cy, r, 0, Math.PI * 2);
      cCtx.fill();
    }
  }

  const result: GeneratedMaterialTiles = {
    weaveUrl: weaveCanvas.toDataURL("image/png"),
    cloudUrl: cloudCanvas.toDataURL("image/png"),
  };
  TILE_CACHE.set(key, result);
  return result;
}
