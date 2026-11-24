#!/usr/bin/env node
/**
 * Generate lightweight proportional WebP thumbnails for Tarot decks to reduce
 * GPU texture decode memory and transfer size on multi-card tabletop spreads.
 *
 * Output specs:
 * - public/decks/rws/*.webp -> public/decks/rws/thumbs/*.webp
 *     350x600 (exact 700:1200 ratio), quality 82, effort 5
 * - public/decks/mucha-hamster/*.webp (78 card faces) -> public/decks/mucha-hamster/thumbs/*.webp
 *     360x536 (exact 848:1264 ratio, zero crop), quality 82, effort 5
 * - public/decks/mucha-hamster/card-back.webp -> public/decks/mucha-hamster/thumbs/card-back.webp
 *     240x358 (exact 848:1264 ratio, zero crop), quality 82, effort 5
 *
 * Idempotent: skips already-valid, up-to-date thumbnails unless `--force` is passed.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DECKS_DIR = path.join(ROOT_DIR, "public", "decks");

const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length || 4));

const DECK_CONFIGS = [
  {
    id: "rws",
    label: "Rider-Waite-Smith (rws)",
    srcDir: path.join(DECKS_DIR, "rws"),
    outDir: path.join(DECKS_DIR, "rws", "thumbs"),
    resolveSpec: () => ({
      group: "rws-faces",
      width: 350,
      height: 600,
      quality: 82,
      effort: 5,
    }),
  },
  {
    id: "mucha-hamster",
    label: "Mucha Hamster (mucha-hamster)",
    srcDir: path.join(DECKS_DIR, "mucha-hamster"),
    outDir: path.join(DECKS_DIR, "mucha-hamster", "thumbs"),
    resolveSpec: (filename) =>
      filename === "card-back.webp"
        ? {
            group: "mucha-back",
            width: 240,
            height: 358,
            quality: 82,
            effort: 5,
          }
        : {
            group: "mucha-faces",
            width: 360,
            height: 536,
            quality: 82,
            effort: 5,
          },
  },
];

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatPctReduction(before, after) {
  if (before <= 0) return "0.0%";
  return `${(((before - after) / before) * 100).toFixed(1)}%`;
}

async function isUpToDateValidThumb(srcPath, destPath, spec) {
  try {
    const [srcStat, destStat] = await Promise.all([
      fs.stat(srcPath),
      fs.stat(destPath),
    ]);
    if (destStat.size <= 0 || destStat.mtimeMs < srcStat.mtimeMs) {
      return false;
    }
    const meta = await sharp(destPath).metadata();
    return (
      meta.format === "webp" &&
      meta.width === spec.width &&
      meta.height === spec.height
    );
  } catch {
    return false;
  }
}

async function processJob(job, force) {
  const { srcPath, destPath, spec } = job;
  const srcStat = await fs.stat(srcPath);
  const srcMeta = await sharp(srcPath).metadata();

  let status = "generated";
  if (!force && (await isUpToDateValidThumb(srcPath, destPath, spec))) {
    status = "skipped";
  } else {
    const tmpPath = `${destPath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await sharp(srcPath)
        .resize(spec.width, spec.height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: spec.quality, effort: spec.effort })
        .toFile(tmpPath);
      await fs.rename(tmpPath, destPath);
    } catch (err) {
      await fs.rm(tmpPath, { force: true }).catch(() => {});
      throw err;
    }
  }

  // Verify output integrity (headers + full pixel decode)
  const destStat = await fs.stat(destPath);
  if (destStat.size <= 0) {
    throw new Error(`Empty thumbnail generated: ${destPath}`);
  }
  const destMeta = await sharp(destPath).metadata();
  if (
    destMeta.format !== "webp" ||
    destMeta.width !== spec.width ||
    destMeta.height !== spec.height
  ) {
    throw new Error(
      `Dimension/format mismatch for ${destPath}: expected webp ${spec.width}x${spec.height}, got ${destMeta.format} ${destMeta.width}x${destMeta.height}`,
    );
  }
  await sharp(destPath).stats();

  return {
    ...job,
    status,
    srcBytes: srcStat.size,
    destBytes: destStat.size,
    srcWidth: srcMeta.width ?? 0,
    srcHeight: srcMeta.height ?? 0,
    destWidth: destMeta.width ?? 0,
    destHeight: destMeta.height ?? 0,
  };
}

async function runPool(items, workerFn, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await workerFn(items[idx]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function main() {
  const force = process.argv.includes("--force");
  const jobs = [];

  for (const deck of DECK_CONFIGS) {
    await fs.mkdir(deck.outDir, { recursive: true });
    const entries = await fs.readdir(deck.srcDir, { withFileTypes: true });
    const webpFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
      .map((entry) => entry.name)
      .sort();

    for (const filename of webpFiles) {
      jobs.push({
        deckId: deck.id,
        filename,
        srcPath: path.join(deck.srcDir, filename),
        destPath: path.join(deck.outDir, filename),
        spec: deck.resolveSpec(filename),
      });
    }
  }

  if (jobs.length === 0) {
    throw new Error("No source .webp files found in deck directories.");
  }

  const startedAt = Date.now();
  const results = await runPool(
    jobs,
    (job) => processJob(job, force),
    CONCURRENCY,
  );
  const elapsedMs = Date.now() - startedAt;

  // Summarize by deck and overall
  let grandSrcBytes = 0;
  let grandDestBytes = 0;
  let grandSrcRgba = 0;
  let grandDestRgba = 0;
  let totalGenerated = 0;
  let totalSkipped = 0;

  console.log("=== Tarot Thumbnail Generation Summary ===");
  for (const deck of DECK_CONFIGS) {
    const deckResults = results.filter((r) => r.deckId === deck.id);
    const generated = deckResults.filter((r) => r.status === "generated").length;
    const skipped = deckResults.filter((r) => r.status === "skipped").length;
    const srcBytes = deckResults.reduce((sum, r) => sum + r.srcBytes, 0);
    const destBytes = deckResults.reduce((sum, r) => sum + r.destBytes, 0);
    const srcRgba = deckResults.reduce(
      (sum, r) => sum + r.srcWidth * r.srcHeight * 4,
      0,
    );
    const destRgba = deckResults.reduce(
      (sum, r) => sum + r.destWidth * r.destHeight * 4,
      0,
    );

    grandSrcBytes += srcBytes;
    grandDestBytes += destBytes;
    grandSrcRgba += srcRgba;
    grandDestRgba += destRgba;
    totalGenerated += generated;
    totalSkipped += skipped;

    const dimSet = Array.from(
      new Set(deckResults.map((r) => `${r.destWidth}x${r.destHeight}`)),
    ).join(", ");

    console.log(
      `\n[${deck.label}] ${deckResults.length} files verified (generated=${generated}, skipped=${skipped})`,
    );
    console.log(`  Dimensions : ${dimSet}`);
    console.log(
      `  File size  : ${formatMB(srcBytes)} -> ${formatMB(destBytes)} (-${formatPctReduction(srcBytes, destBytes)}, avg ${formatKB(srcBytes / deckResults.length)} -> ${formatKB(destBytes / deckResults.length)})`,
    );
    console.log(
      `  RGBA decode: ${formatMB(srcRgba)} -> ${formatMB(destRgba)} (-${formatPctReduction(srcRgba, destRgba)})`,
    );

    const backItem = deckResults.find((r) => r.filename === "card-back.webp");
    if (backItem) {
      console.log(
        `  card-back  : ${backItem.srcWidth}x${backItem.srcHeight} (${formatKB(backItem.srcBytes)}) -> ${backItem.destWidth}x${backItem.destHeight} (${formatKB(backItem.destBytes)}, -${formatPctReduction(backItem.srcBytes, backItem.destBytes)})`,
      );
    }
  }

  console.log("\n[TOTAL]");
  console.log(
    `  Count      : ${results.length} thumbnails verified (generated=${totalGenerated}, skipped=${totalSkipped}) in ${elapsedMs}ms`,
  );
  console.log(
    `  File size  : ${formatMB(grandSrcBytes)} (${grandSrcBytes} B) -> ${formatMB(grandDestBytes)} (${grandDestBytes} B) (-${formatPctReduction(grandSrcBytes, grandDestBytes)})`,
  );
  console.log(
    `  RGBA decode: ${formatMB(grandSrcRgba)} -> ${formatMB(grandDestRgba)} (-${formatPctReduction(grandSrcRgba, grandDestRgba)})`,
  );
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
