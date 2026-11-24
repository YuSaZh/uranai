#!/usr/bin/env node
/**
 * Fetch and optimize all 78 authentic 1909 Rider-Waite-Smith ("Pam-A" edition)
 * public-domain Tarot scans from Wikimedia Commons into `public/decks/rws/*.webp`.
 *
 * Output spec: 420x720 WebP (fit: "cover", quality: 84).
 * Re-running skips already-valid files unless `--force` is passed.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "public", "decks", "rws");

const USER_AGENT =
  "UranaiTarotApp/1.0 (https://github.com/YuSaZh/uranai; public-domain 1909 RWS Tarot fetch)";
const WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php";

const TARGET_WIDTH = 700;
const TARGET_HEIGHT = 1200;
const WEBP_QUALITY = 88;
const MIN_VALID_BYTES = 5 * 1024;
const CONCURRENCY = 2;
const REQUEST_GAP_MS = 250;
const MAX_RETRIES = 6;

const MAJOR_ARCANA = [
  ["00-the-fool.webp", "File:RWS Tarot 00 Fool.jpg"],
  ["01-the-magician.webp", "File:RWS Tarot 01 Magician.jpg"],
  ["02-the-high-priestess.webp", "File:RWS Tarot 02 High Priestess.jpg"],
  ["03-the-empress.webp", "File:RWS Tarot 03 Empress.jpg"],
  ["04-the-emperor.webp", "File:RWS Tarot 04 Emperor.jpg"],
  ["05-the-hierophant.webp", "File:RWS Tarot 05 Hierophant.jpg"],
  ["06-the-lovers.webp", "File:RWS Tarot 06 Lovers.jpg"],
  ["07-the-chariot.webp", "File:RWS Tarot 07 Chariot.jpg"],
  ["08-strength.webp", "File:RWS Tarot 08 Strength.jpg"],
  ["09-the-hermit.webp", "File:RWS Tarot 09 Hermit.jpg"],
  ["10-wheel-of-fortune.webp", "File:RWS Tarot 10 Wheel of Fortune.jpg"],
  ["11-justice.webp", "File:RWS Tarot 11 Justice.jpg"],
  ["12-the-hanged-man.webp", "File:RWS Tarot 12 Hanged Man.jpg"],
  ["13-death.webp", "File:RWS Tarot 13 Death.jpg"],
  ["14-temperance.webp", "File:RWS Tarot 14 Temperance.jpg"],
  ["15-the-devil.webp", "File:RWS Tarot 15 Devil.jpg"],
  ["16-the-tower.webp", "File:RWS Tarot 16 Tower.jpg"],
  ["17-the-star.webp", "File:RWS Tarot 17 Star.jpg"],
  ["18-the-moon.webp", "File:RWS Tarot 18 Moon.jpg"],
  ["19-the-sun.webp", "File:RWS Tarot 19 Sun.jpg"],
  ["20-judgement.webp", "File:RWS Tarot 20 Judgement.jpg"],
  ["21-the-world.webp", "File:RWS Tarot 21 World.jpg"],
];

const MINOR_RANKS = [
  "ace",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "page",
  "knight",
  "queen",
  "king",
];

const MINOR_SUITS = [
  { slug: "wands", wikiPrefix: "Wands", startIndex: 22 },
  { slug: "cups", wikiPrefix: "Cups", startIndex: 36 },
  { slug: "swords", wikiPrefix: "Swords", startIndex: 50 },
  { slug: "pentacles", wikiPrefix: "Pents", startIndex: 64 },
];

const ALL_CARDS = [
  ...MAJOR_ARCANA.map(([filename, wikiTitle]) => ({ filename, wikiTitle })),
  ...MINOR_SUITS.flatMap(({ slug, wikiPrefix, startIndex }) =>
    MINOR_RANKS.map((rank, i) => ({
      filename: `${String(startIndex + i).padStart(2, "0")}-${rank}-of-${slug}.webp`,
      wikiTitle: `File:${wikiPrefix}${String(i + 1).padStart(2, "0")}.jpg`,
    })),
  ),
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, label) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/*,application/json;q=0.9,*/*;q=0.8",
        },
      });

      if (res.ok) {
        return res;
      }

      const retryable = res.status === 429 || res.status >= 500 || res.status === 408;
      if (!retryable || attempt >= MAX_RETRIES) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${label}`);
      }

      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterSec = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : NaN;
      const delayMs = Number.isFinite(retryAfterSec)
        ? Math.ceil(retryAfterSec * 1000) + 250
        : Math.min(30000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 400);

      console.warn(
        `[retry ${attempt}/${MAX_RETRIES}] ${label}: HTTP ${res.status}, waiting ${delayMs}ms...`,
      );
      await sleep(delayMs);
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        throw err;
      }
      const delayMs = Math.min(30000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
      console.warn(
        `[retry ${attempt}/${MAX_RETRIES}] ${label}: ${err.message}, waiting ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }
}

async function resolveWikimediaUrls(cards) {
  const urlMap = new Map();
  const batchSize = 40;

  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    const params = new URLSearchParams({
      action: "query",
      prop: "imageinfo",
      iiprop: "url|size|mime",
      titles: batch.map((c) => c.wikiTitle).join("|"),
      format: "json",
    });

    const res = await fetchWithRetry(`${WIKIMEDIA_API}?${params.toString()}`, `API batch ${i}`);
    const data = await res.json();
    const pages = Object.values(data.query?.pages ?? {});

    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info?.url) {
        throw new Error(`Missing Wikimedia imageinfo for ${page.title}`);
      }
      // Strip tracking query params if Wikimedia appends them
      const cleanUrl = info.url.split("?")[0];
      urlMap.set(page.title, {
        url: cleanUrl,
        width: info.width,
        height: info.height,
        mime: info.mime,
      });
    }
  }

  for (const card of cards) {
    if (!urlMap.has(card.wikiTitle)) {
      throw new Error(`Unresolved Wikimedia file: ${card.wikiTitle}`);
    }
  }
  return urlMap;
}

async function isValidOutput(filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size <= MIN_VALID_BYTES) return false;
    const meta = await sharp(filePath).metadata();
    return (
      meta.format === "webp" &&
      meta.width === TARGET_WIDTH &&
      meta.height === TARGET_HEIGHT
    );
  } catch {
    return false;
  }
}

async function processCard(card, imageInfo, force) {
  const outPath = path.join(OUTPUT_DIR, card.filename);

  if (!force && (await isValidOutput(outPath))) {
    return { status: "skipped", filename: card.filename };
  }

  const res = await fetchWithRetry(imageInfo.url, card.filename);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Unexpected content-type "${contentType}" for ${card.filename}`);
  }

  const rawBuffer = Buffer.from(await res.arrayBuffer());
  const tmpPath = `${outPath}.tmp`;

  await sharp(rawBuffer)
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toFile(tmpPath);

  await fs.rename(tmpPath, outPath);
  const stat = await fs.stat(outPath);
  return { status: "downloaded", filename: card.filename, bytes: stat.size };
}

async function validateAll(cards) {
  let totalBytes = 0;
  let minBytes = Infinity;
  let maxBytes = 0;
  const errors = [];

  for (const card of cards) {
    const filePath = path.join(OUTPUT_DIR, card.filename);
    try {
      const stat = await fs.stat(filePath);
      const meta = await sharp(filePath).metadata();
      if (meta.format !== "webp") {
        errors.push(`${card.filename}: expected format webp, got ${meta.format}`);
      }
      if (meta.width !== TARGET_WIDTH || meta.height !== TARGET_HEIGHT) {
        errors.push(
          `${card.filename}: expected ${TARGET_WIDTH}x${TARGET_HEIGHT}, got ${meta.width}x${meta.height}`,
        );
      }
      if (stat.size <= MIN_VALID_BYTES) {
        errors.push(`${card.filename}: size ${stat.size}B <= ${MIN_VALID_BYTES}B`);
      }
      totalBytes += stat.size;
      if (stat.size < minBytes) minBytes = stat.size;
      if (stat.size > maxBytes) maxBytes = stat.size;
    } catch (err) {
      errors.push(`${card.filename}: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed (${errors.length} issues):\n- ${errors.join("\n- ")}`);
  }

  const extraFiles = (await fs.readdir(OUTPUT_DIR)).filter(
    (f) => !cards.some((c) => c.filename === f),
  );
  if (extraFiles.length > 0) {
    console.warn(`Warning: unexpected extra files in ${OUTPUT_DIR}: ${extraFiles.join(", ")}`);
  }

  return {
    count: cards.length,
    totalBytes,
    totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    minKB: (minBytes / 1024).toFixed(1),
    maxKB: (maxBytes / 1024).toFixed(1),
  };
}

async function main() {
  const force = process.argv.includes("--force");
  if (ALL_CARDS.length !== 78) {
    throw new Error(`Expected 78 card definitions, got ${ALL_CARDS.length}`);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Resolving 78 Rider-Waite-Smith (1909 Pam-A) scans via Wikimedia Commons API...`);
  const urlMap = await resolveWikimediaUrls(ALL_CARDS);
  console.log(`Resolved ${urlMap.size}/78 image URLs. Downloading with concurrency=${CONCURRENCY}...`);

  let cursor = 0;
  let done = 0;
  let downloaded = 0;
  let skipped = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= ALL_CARDS.length) break;
      const card = ALL_CARDS[idx];
      const info = urlMap.get(card.wikiTitle);
      const result = await processCard(card, info, force);
      done++;
      if (result.status === "downloaded") {
        downloaded++;
        console.log(
          `[${String(done).padStart(2, "0")}/78] OK ${card.filename} (${(result.bytes / 1024).toFixed(1)} KB)`,
        );
        await sleep(REQUEST_GAP_MS);
      } else {
        skipped++;
        console.log(`[${String(done).padStart(2, "0")}/78] SKIP ${card.filename} (already valid)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`\nValidating all 78 WebP files with sharp...`);
  const summary = await validateAll(ALL_CARDS);
  console.log(
    `VERIFIED ${summary.count}/78 cards | downloaded=${downloaded}, skipped=${skipped} | total=${summary.totalMB} MB (${summary.totalBytes} B) | range=${summary.minKB}..${summary.maxKB} KB`,
  );
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
