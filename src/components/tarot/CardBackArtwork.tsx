"use client";

import { memo, useId, useState } from "react";
import type { DeckId, SuitType, TarotCard, ThemeId } from "@/types/tarot";
import { getDeckBackImagePath } from "@/data/decks";
import { getThemeById } from "@/data/themes";

export interface CardBackArtworkProps {
  deckId: DeckId;
  themeId?: ThemeId;
  /** Uses a single shared cached bitmap/SVG-img texture for high-count 78-card wash & ribbon animations */
  lightweight?: boolean;
}

const RWS_BACK_URI_CACHE = new Map<string, string>();

function getLightweightRwsBackUri(accentColor: string): string {
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accentColor)
    ? accentColor
    : "#d4af37";
  const cached = RWS_BACK_URI_CACHE.get(safeAccent);
  if (cached) return cached;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 480"><defs><radialGradient id="b" cx="50%" cy="50%" r="72%"><stop offset="0%" stop-color="#171f3b"/><stop offset="56%" stop-color="#0b0f21"/><stop offset="100%" stop-color="#050711"/></radialGradient><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fae7ae"/><stop offset="45%" stop-color="${safeAccent}"/><stop offset="100%" stop-color="#b88d2c"/></linearGradient></defs><rect width="280" height="480" fill="url(#b)"/><rect x="12" y="12" width="256" height="456" rx="12" fill="none" stroke="url(#g)" stroke-width="2"/><rect x="22" y="22" width="236" height="436" rx="8" fill="none" stroke="url(#g)" stroke-width="1" stroke-opacity="0.78"/><circle cx="140" cy="240" r="88" fill="none" stroke="url(#g)" stroke-width="1.5"/><circle cx="140" cy="240" r="76" fill="none" stroke="url(#g)" stroke-width="0.9" stroke-dasharray="4 5"/><circle cx="140" cy="240" r="42" fill="none" stroke="url(#g)" stroke-width="1.1"/><polygon points="140,164 152,226 212,240 152,254 140,316 128,254 68,240 128,226" fill="url(#g)" fill-opacity="0.24" stroke="url(#g)" stroke-width="1.1"/><circle cx="140" cy="240" r="10" fill="url(#g)"/><path d="M140 52 L147 72 L166 79 L147 86 L140 106 L133 86 L114 79 L133 72 Z" fill="url(#g)" fill-opacity="0.82"/><path d="M140 374 L147 394 L166 401 L147 408 L140 428 L133 408 L114 401 L133 394 Z" fill="url(#g)" fill-opacity="0.82"/><circle cx="42" cy="42" r="7" fill="none" stroke="url(#g)" stroke-width="1.1"/><circle cx="238" cy="42" r="7" fill="none" stroke="url(#g)" stroke-width="1.1"/><circle cx="42" cy="438" r="7" fill="none" stroke="url(#g)" stroke-width="1.1"/><circle cx="238" cy="438" r="7" fill="none" stroke="url(#g)" stroke-width="1.1"/></svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  RWS_BACK_URI_CACHE.set(safeAccent, uri);
  return uri;
}

const ASTROLABE_TICKS = Array.from({ length: 24 }, (_, i) => i * 15);
const HALO_PETALS = Array.from({ length: 16 }, (_, i) => i * 22.5);
const STAR_RAYS_8 = Array.from({ length: 8 }, (_, i) => i * 45);
const STAR_RAYS_16 = Array.from({ length: 16 }, (_, i) => i * 22.5);

function RiderWaiteBackSvg({ accentColor }: { accentColor: string }) {
  const uid = useId().replace(/:/g, "");
  const bgId = `rws-bg-${uid}`;
  const goldId = `rws-gold-${uid}`;
  const goldSoftId = `rws-gold-soft-${uid}`;
  const glowId = `rws-glow-${uid}`;
  const grainId = `rws-grain-${uid}`;

  return (
    <svg
      viewBox="0 0 280 480"
      className="h-full w-full select-none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="72%">
          <stop offset="0%" stopColor="#161d38" />
          <stop offset="52%" stopColor="#0b0f21" />
          <stop offset="100%" stopColor="#050711" />
        </radialGradient>

        <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fae7ae" />
          <stop offset="28%" stopColor="#d4af37" />
          <stop offset="52%" stopColor="#926d22" />
          <stop offset="76%" stopColor="#f3d986" />
          <stop offset="100%" stopColor="#b88d2c" />
        </linearGradient>

        <linearGradient id={goldSoftId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8e3a1" stopOpacity="0.85" />
          <stop offset="50%" stopColor={accentColor || "#d4af37"} stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f8e3a1" stopOpacity="0.85" />
        </linearGradient>

        <radialGradient id={glowId} cx="50%" cy="50%" r="48%">
          <stop offset="0%" stopColor={accentColor || "#d4af37"} stopOpacity="0.22" />
          <stop offset="58%" stopColor="#d4af37" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        <pattern id={grainId} width="12" height="12" patternUnits="userSpaceOnUse">
          <path
            d="M 0 6 H 12 M 6 0 V 12"
            stroke="#f5e6c4"
            strokeWidth="0.35"
            strokeOpacity="0.055"
          />
          <circle cx="3" cy="3" r="0.35" fill="#d4af37" fillOpacity="0.06" />
          <circle cx="9" cy="9" r="0.35" fill="#d4af37" fillOpacity="0.06" />
        </pattern>
      </defs>

      {/* Deep obsidian & midnight-indigo lacquer base */}
      <rect x="0" y="0" width="280" height="480" fill={`url(#${bgId})`} />
      <rect x="0" y="0" width="280" height="480" fill={`url(#${grainId})`} />
      <ellipse cx="140" cy="240" rx="126" ry="188" fill={`url(#${glowId})`} />

      {/* Sacred geometric double gilded frames */}
      <rect
        x="12"
        y="12"
        width="256"
        height="456"
        rx="12"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="1.6"
      />
      <rect
        x="20"
        y="20"
        width="240"
        height="440"
        rx="8"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="0.9"
        strokeOpacity="0.82"
      />
      <rect
        x="26"
        y="26"
        width="228"
        height="428"
        rx="5"
        fill="none"
        stroke={`url(#${goldSoftId})`}
        strokeWidth="0.45"
        strokeDasharray="2.5 3.5"
      />

      {/* Four symmetrical corner botanical filigree ornaments */}
      {[
        { tx: 0, ty: 0, sx: 1, sy: 1 },
        { tx: 280, ty: 0, sx: -1, sy: 1 },
        { tx: 0, ty: 480, sx: 1, sy: -1 },
        { tx: 280, ty: 480, sx: -1, sy: -1 },
      ].map((c, idx) => (
        <g key={idx} transform={`translate(${c.tx}, ${c.ty}) scale(${c.sx}, ${c.sy})`}>
          <path
            d="M 22 68 C 22 40, 40 22, 68 22"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="1.2"
          />
          <path
            d="M 26 84 C 31 54, 54 31, 84 26"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="0.7"
            strokeOpacity="0.78"
          />
          <path
            d="M 30 50 Q 44 48 50 30 Q 48 44 64 42 Q 46 50 42 64 Q 44 48 30 50 Z"
            fill={`url(#${goldId})`}
            fillOpacity="0.75"
          />
          <circle cx="34" cy="34" r="2.2" fill={`url(#${goldId})`} />
          <circle cx="52" cy="34" r="1.1" fill="#fae7ae" fillOpacity="0.7" />
          <circle cx="34" cy="52" r="1.1" fill="#fae7ae" fillOpacity="0.7" />
        </g>
      ))}

      {/* Symmetrical top & bottom celestial lunar phase arcs */}
      {[0, 1].map((mirror) => (
        <g
          key={mirror}
          transform={mirror === 1 ? "translate(280, 480) rotate(180)" : undefined}
        >
          {/* Decorative arch framing moon phases */}
          <path
            d="M 60 112 Q 140 50 220 112"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="0.85"
            strokeOpacity="0.72"
          />
          <path
            d="M 76 122 Q 140 72 204 122"
            fill="none"
            stroke={`url(#${goldSoftId})`}
            strokeWidth="0.5"
            strokeDasharray="2 3"
          />
          {/* Central full moon */}
          <circle
            cx="140"
            cy="64"
            r="9.5"
            fill={`url(#${goldId})`}
            fillOpacity="0.92"
          />
          <circle
            cx="140"
            cy="64"
            r="13.5"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="0.65"
            strokeOpacity="0.7"
          />
          {/* Waxing crescent left */}
          <path
            d="M 103 66 A 8 8 0 1 1 103 82 A 6 6 0 1 0 103 66 Z"
            fill={`url(#${goldId})`}
            fillOpacity="0.85"
          />
          {/* Waning crescent right */}
          <path
            d="M 177 66 A 8 8 0 1 0 177 82 A 6 6 0 1 1 177 66 Z"
            fill={`url(#${goldId})`}
            fillOpacity="0.85"
          />
          {/* Tiny outer crescent dots */}
          <circle cx="80" cy="88" r="2.2" fill={`url(#${goldId})`} fillOpacity="0.75" />
          <circle cx="200" cy="88" r="2.2" fill={`url(#${goldId})`} fillOpacity="0.75" />
          {/* Cardinal vertical meridian line */}
          <line
            x1="140"
            y1="80"
            x2="140"
            y2="140"
            stroke={`url(#${goldId})`}
            strokeWidth="0.75"
            strokeOpacity="0.65"
          />
          {/* Subtle 4-point starlets */}
          {[
            [62, 138],
            [218, 138],
            [110, 108],
            [170, 108],
          ].map(([sx, sy], i) => (
            <path
              key={i}
              d={`M ${sx} ${sy - 4.5} L ${sx + 1.1} ${sy - 1.1} L ${sx + 4.5} ${sy} L ${sx + 1.1} ${sy + 1.1} L ${sx} ${sy + 4.5} L ${sx - 1.1} ${sy + 1.1} L ${sx - 4.5} ${sy} L ${sx - 1.1} ${sy - 1.1} Z`}
              fill="#fae7ae"
              fillOpacity="0.8"
            />
          ))}
        </g>
      ))}

      {/* Vertical gilded diamond lattice connecting top & bottom */}
      <polygon
        points="140,94 236,240 140,386 44,240"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="0.85"
        strokeOpacity="0.58"
      />
      <polygon
        points="140,108 226,240 140,372 54,240"
        fill="none"
        stroke={`url(#${goldSoftId})`}
        strokeWidth="0.5"
        strokeOpacity="0.45"
      />

      {/* Side symmetrical crescent clasps */}
      <circle cx="44" cy="240" r="3" fill={`url(#${goldId})`} />
      <circle cx="236" cy="240" r="3" fill={`url(#${goldId})`} />

      {/* Center Celestial Gold-Foil Astrolabe Medallion */}
      <g transform="translate(140, 240)">
        {/* Outer rings */}
        <circle
          r="90"
          fill="#070a18"
          fillOpacity="0.55"
          stroke={`url(#${goldId})`}
          strokeWidth="1.4"
        />
        <circle
          r="82"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="0.7"
          strokeOpacity="0.75"
        />
        <circle
          r="68"
          fill="none"
          stroke={`url(#${goldSoftId})`}
          strokeWidth="0.6"
          strokeDasharray="1.8 3"
        />
        <circle
          r="54"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="1.05"
        />

        {/* 24 astrolabe degree ticks */}
        {ASTROLABE_TICKS.map((deg) => (
          <line
            key={deg}
            x1="0"
            y1="-82"
            x2="0"
            y2={deg % 30 === 0 ? "-73" : "-77"}
            stroke={`url(#${goldId})`}
            strokeWidth={deg % 30 === 0 ? "1.1" : "0.55"}
            strokeOpacity={deg % 30 === 0 ? "0.9" : "0.55"}
            transform={`rotate(${deg})`}
          />
        ))}

        {/* Sacred interlocking octagram */}
        <rect
          x="-46"
          y="-46"
          width="92"
          height="92"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="0.75"
          strokeOpacity="0.65"
        />
        <rect
          x="-46"
          y="-46"
          width="92"
          height="92"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="0.75"
          strokeOpacity="0.65"
          transform="rotate(45)"
        />

        {/* Secondary 16-ray solar needle burst */}
        {STAR_RAYS_16.map((deg) => (
          <line
            key={deg}
            x1="0"
            y1="-14"
            x2="0"
            y2={deg % 45 === 0 ? "-64" : "-44"}
            stroke={`url(#${goldId})`}
            strokeWidth={deg % 45 === 0 ? "1.0" : "0.5"}
            strokeOpacity={deg % 45 === 0 ? "0.85" : "0.52"}
            transform={`rotate(${deg})`}
          />
        ))}

        {/* Prominent 8-point gilded starburst */}
        {STAR_RAYS_8.map((deg) => {
          const isCardinal = deg % 90 === 0;
          const tip = isCardinal ? -60 : -46;
          const width = isCardinal ? 6.5 : 4.6;
          return (
            <polygon
              key={deg}
              points={`0,${tip} ${width},-10 0,-4 ${-width},-10`}
              fill={`url(#${goldId})`}
              fillOpacity={isCardinal ? "0.94" : "0.72"}
              transform={`rotate(${deg})`}
            />
          );
        })}

        {/* Inner astrolabe sun-core ring */}
        <circle
          r="19"
          fill="#0b1024"
          stroke={`url(#${goldId})`}
          strokeWidth="1.25"
        />
        <circle
          r="13"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="0.65"
          strokeDasharray="1.5 2"
        />
        <circle r="6.5" fill={`url(#${goldId})`} />
        <circle r="2.6" fill="#fff7da" />
      </g>
    </svg>
  );
}

function MuchaBackFallbackSvg() {
  const uid = useId().replace(/:/g, "");
  const tealId = `mh-teal-${uid}`;
  const goldId = `mh-gold-${uid}`;

  return (
    <svg
      viewBox="0 0 280 480"
      className="h-full w-full select-none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={tealId} cx="50%" cy="50%" r="72%">
          <stop offset="0%" stopColor="#163e45" />
          <stop offset="65%" stopColor="#0f2e34" />
          <stop offset="100%" stopColor="#091d22" />
        </radialGradient>
        <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f3dfa5" />
          <stop offset="48%" stopColor="#cfa754" />
          <stop offset="100%" stopColor="#9d7730" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="280" height="480" fill={`url(#${tealId})`} />

      {/* Art Nouveau gilded floral double frame */}
      <rect
        x="12"
        y="12"
        width="256"
        height="456"
        rx="10"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="1.6"
      />
      <rect
        x="20"
        y="20"
        width="240"
        height="440"
        rx="7"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="0.8"
      />

      {/* Symmetrical Art Nouveau corner botanical irises & sage leaves */}
      {[
        { tx: 0, ty: 0, sx: 1, sy: 1 },
        { tx: 280, ty: 0, sx: -1, sy: 1 },
        { tx: 0, ty: 480, sx: 1, sy: -1 },
        { tx: 280, ty: 480, sx: -1, sy: -1 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.tx}, ${c.ty}) scale(${c.sx}, ${c.sy})`}>
          <path
            d="M 24 148 C 24 90, 48 48, 108 26"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="1.2"
          />
          <ellipse
            cx="52"
            cy="52"
            rx="18"
            ry="24"
            transform="rotate(-32 52 52)"
            fill="#a66d68"
            fillOpacity="0.65"
            stroke={`url(#${goldId})`}
            strokeWidth="0.8"
          />
          <ellipse
            cx="38"
            cy="88"
            rx="12"
            ry="22"
            transform="rotate(-14 38 88)"
            fill="#8da385"
            fillOpacity="0.6"
            stroke={`url(#${goldId})`}
            strokeWidth="0.7"
          />
          <path
            d="M 88 122 A 9 9 0 1 1 88 138 A 7 7 0 1 0 88 122 Z"
            fill={`url(#${goldId})`}
            fillOpacity="0.85"
          />
        </g>
      ))}

      {/* Symmetrical wheat stalks framing central medallion */}
      {[0, 1].map((flip) => (
        <g
          key={flip}
          transform={flip === 1 ? "translate(280, 480) rotate(180)" : undefined}
        >
          <path
            d="M 140 156 C 132 122, 114 96, 98 76"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="1.2"
          />
          <path
            d="M 140 156 C 148 122, 166 96, 182 76"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="1.2"
          />
          <circle cx="140" cy="48" r="3" fill={`url(#${goldId})`} />
        </g>
      ))}

      {/* Central Art Nouveau Medallion with symmetrical twin golden hamster crest */}
      <g transform="translate(140, 240)">
        <circle
          r="84"
          fill="#0b2328"
          stroke={`url(#${goldId})`}
          strokeWidth="2.2"
        />
        <circle
          r="76"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="0.9"
          strokeDasharray="3 2.5"
        />
        <circle
          r="64"
          fill="#103239"
          stroke={`url(#${goldId})`}
          strokeWidth="1.2"
        />

        {/* Twin mirrored stylized golden hamster silhouettes */}
        {[0, 180].map((rot) => (
          <g key={rot} transform={`rotate(${rot}) translate(0, -28)`}>
            {/* Subtle halo behind hamster */}
            <circle
              cx="0"
              cy="0"
              r="21"
              fill="none"
              stroke={`url(#${goldId})`}
              strokeWidth="0.7"
              strokeOpacity="0.7"
            />
            {/* Ears */}
            <circle cx="-9" cy="-10" r="4.2" fill={`url(#${goldId})`} />
            <circle cx="9" cy="-10" r="4.2" fill={`url(#${goldId})`} />
            {/* Chubby head & body */}
            <ellipse cx="0" cy="-2" rx="11.5" ry="9.5" fill={`url(#${goldId})`} />
            <ellipse cx="0" cy="11" rx="12" ry="10.5" fill={`url(#${goldId})`} />
            {/* Tiny eyes & nose */}
            <circle cx="-4" cy="-3.5" r="1.2" fill="#0b2328" />
            <circle cx="4" cy="-3.5" r="1.2" fill="#0b2328" />
            <ellipse cx="0" cy="-0.8" rx="1.6" ry="1.1" fill="#6b4423" />
          </g>
        ))}

        {/* Horizontal golden vine divider */}
        <line
          x1="-52"
          y1="0"
          x2="52"
          y2="0"
          stroke={`url(#${goldId})`}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        <circle cx="0" cy="0" r="3.5" fill={`url(#${goldId})`} />
      </g>
    </svg>
  );
}

export const CardBackArtwork = memo(function CardBackArtwork({
  deckId,
  themeId,
  lightweight = false,
}: CardBackArtworkProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const backImagePath = getDeckBackImagePath(deckId);
  const theme = getThemeById(themeId ?? "celestial-velvet");
  const accentColor = theme.cssVars["--accent"] ?? "#d4af37";

  if (deckId === "mucha-hamster") {
    if (backImagePath && !imgFailed) {
      return (
        <div className="relative h-full w-full overflow-hidden bg-[#0f2e34]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backImagePath}
            alt="穆夏仓鼠塔罗牌背"
            draggable={false}
            decoding="async"
            onError={() => setImgFailed(true)}
            className="h-full w-full select-none object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow:
                "inset 0 0 0 1px rgba(212,175,95,0.45), inset 0 1px 0 rgba(255,244,210,0.3)",
            }}
          />
        </div>
      );
    }
    return <MuchaBackFallbackSvg />;
  }

  if (lightweight) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-[#0b0f21]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getLightweightRwsBackUri(accentColor)}
          alt="经典韦特塔罗牌背"
          draggable={false}
          decoding="async"
          className="h-full w-full select-none object-cover"
        />
      </div>
    );
  }

  return <RiderWaiteBackSvg accentColor={accentColor} />;
});

interface SuitTheme {
  tint: string;
  accent: string;
  labelZh: string;
}

const SUIT_THEMES: Record<SuitType, SuitTheme> = {
  major: { tint: "#e6d2a2", accent: "#c5973b", labelZh: "大阿卡纳" },
  wands: { tint: "#e6c3a4", accent: "#b9673c", labelZh: "火 · 权杖" },
  cups: { tint: "#bfd4d8", accent: "#4e8390", labelZh: "水 · 圣杯" },
  swords: { tint: "#ccd2df", accent: "#606e8c", labelZh: "风 · 宝剑" },
  pentacles: { tint: "#ccd8bd", accent: "#6d8855", labelZh: "土 · 星币" },
};

function getDisplayNumeral(card: TarotCard): string {
  if (card.romanNumeral) return card.romanNumeral;
  if (card.arcana === "major") {
    return String(card.number);
  }
  const minorMap: Record<number, string> = {
    1: "ACE",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
    11: "PAGE",
    12: "KNIGHT",
    13: "QUEEN",
    14: "KING",
  };
  return minorMap[card.number] ?? String(card.number);
}

function SuitArtNouveauEmblem({ suit, goldId }: { suit: SuitType; goldId: string }) {
  switch (suit) {
    case "wands":
      return (
        <g stroke="#3e2f20" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 0 -50 C -5 -36, -6 -22, 0 -10 C 6 -22, 5 -36, 0 -50 Z" fill={`url(#${goldId})`} />
          <path d="M 0 -42 C -3 -32, -3 -22, 0 -15 C 3 -22, 3 -32, 0 -42 Z" fill="#f7e7ba" stroke="none" />
          <line x1="0" y1="-16" x2="0" y2="48" strokeWidth="3.2" stroke="#6c4d2c" />
          <line x1="0" y1="-16" x2="0" y2="48" strokeWidth="1.2" stroke={`url(#${goldId})`} />
          <path d="M 0 6 C -16 2, -24 -8, -26 -20 C -14 -16, -5 -6, 0 6 Z" fill="#8da385" />
          <path d="M 0 18 C 16 14, 24 4, 26 -8 C 14 -4, 5 6, 0 18 Z" fill="#8da385" />
          <path d="M 0 32 C -14 29, -20 21, -22 12 C -12 15, -4 23, 0 32 Z" fill="#a2b495" />
          <circle cx="0" cy="-16" r="5" fill={`url(#${goldId})`} />
        </g>
      );
    case "cups":
      return (
        <g stroke="#3e2f20" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M -28 -20 C -28 8, -14 18, 0 18 C 14 18, 28 8, 28 -20 Z"
            fill={`url(#${goldId})`}
          />
          <ellipse cx="0" cy="-20" rx="28" ry="6.5" fill="#f5e6bf" />
          <path d="M -22 -20 C -12 -14, 12 -14, 22 -20" fill="none" stroke="#5b8b96" strokeWidth="1.4" />
          <path d="M -5 18 L -3 38 L -18 44 L 18 44 L 3 38 L 5 18 Z" fill={`url(#${goldId})`} />
          <circle cx="0" cy="27" r="4.5" fill="#f5e6bf" />
          {/* Lotus blossom rising above chalice */}
          <path d="M 0 -48 C -7 -38, -7 -28, 0 -23 C 7 -28, 7 -38, 0 -48 Z" fill="#c78b83" />
          <path d="M -16 -38 C -14 -28, -8 -24, -1 -23 C -4 -31, -9 -37, -16 -38 Z" fill="#d8a8a0" />
          <path d="M 16 -38 C 14 -28, 8 -24, 1 -23 C 4 -31, 9 -37, 16 -38 Z" fill="#d8a8a0" />
        </g>
      );
    case "swords":
      return (
        <g stroke="#3e2f20" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
          {/* Crowned wreath */}
          <path d="M -26 -24 C -24 -42, 24 -42, 26 -24" fill="none" stroke={`url(#${goldId})`} strokeWidth="2.2" />
          {/* Blade */}
          <polygon points="0,-52 6,16 0,22 -6,16" fill="#e8edf5" />
          <line x1="0" y1="-50" x2="0" y2="18" stroke="#8592aa" strokeWidth="1" />
          {/* Art Nouveau winged crossguard */}
          <path
            d="M -26 16 C -16 10, -8 12, 0 18 C 8 12, 16 10, 26 16 C 18 22, 8 24, 0 22 C -8 24, -18 22, -26 16 Z"
            fill={`url(#${goldId})`}
          />
          <rect x="-3.2" y="21" width="6.4" height="20" rx="2" fill="#6f5334" />
          <circle cx="0" cy="44" r="5" fill={`url(#${goldId})`} />
          {/* Swirl ribbons */}
          <path d="M -30 -8 C -16 -14, -8 -4, 0 -6 C 8 -8, 18 -14, 30 -8" fill="none" stroke="#8092b0" strokeWidth="1.1" />
        </g>
      );
    case "pentacles":
      return (
        <g stroke="#3e2f20" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
          {/* Wheat ears framing coin (subtle hamster motif) */}
          <path d="M -36 28 C -44 6, -40 -18, -24 -36" fill="none" stroke="#967432" strokeWidth="1.3" />
          <path d="M 36 28 C 44 6, 40 -18, 24 -36" fill="none" stroke="#967432" strokeWidth="1.3" />
          {/* Engraved gold coin */}
          <circle cx="0" cy="0" r="34" fill={`url(#${goldId})`} />
          <circle cx="0" cy="0" r="28" fill="#f5e6be" stroke="#3e2f20" strokeWidth="1" />
          <polygon
            points="0,-24 6.8,-7.8 23.8,-7.4 10.2,3 15.2,19.4 0,9.6 -15.2,19.4 -10.2,3 -23.8,-7.4 -6.8,-7.8"
            fill={`url(#${goldId})`}
            stroke="#3e2f20"
            strokeWidth="1.15"
          />
          <circle cx="0" cy="0" r="4.5" fill="#f5e6be" />
        </g>
      );
    case "major":
    default:
      return (
        <g stroke="#3e2f20" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          {/* Celestial sunburst + crescent + tiny hamster silhouette tribute */}
          {STAR_RAYS_8.map((deg) => (
            <polygon
              key={deg}
              points="0,-42 4,-16 -4,-16"
              fill={`url(#${goldId})`}
              stroke="#3e2f20"
              strokeWidth="0.8"
              transform={`rotate(${deg})`}
            />
          ))}
          <circle cx="0" cy="0" r="22" fill="#f7ebd0" stroke="#3e2f20" strokeWidth="1.35" />
          <circle cx="0" cy="0" r="17.5" fill="none" stroke={`url(#${goldId})`} strokeWidth="1.2" />
          {/* Delicate Art Nouveau crescent moon + star */}
          <path
            d="M 4 -11 A 11 11 0 1 0 4 11 A 8.5 8.5 0 1 1 4 -11 Z"
            fill={`url(#${goldId})`}
          />
          <polygon
            points="7,-5 8.6,-1.6 12,0 8.6,1.6 7,5 5.4,1.6 2,0 5.4,-1.6"
            fill="#a66d68"
            stroke="none"
          />
        </g>
      );
  }
}

export function MuchaFallbackFront({ card }: { card: TarotCard }) {
  const uid = useId().replace(/:/g, "");
  const paperId = `mucha-paper-${uid}`;
  const goldId = `mucha-gold-${uid}`;
  const washId = `mucha-wash-${uid}`;
  const suitTheme = SUIT_THEMES[card.suit] ?? SUIT_THEMES.major;
  const displayNumeral = getDisplayNumeral(card);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f5edd9]">
      <svg
        viewBox="0 0 280 480"
        className="h-full w-full select-none"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`${card.nameZh} ${card.nameEn} 穆夏仓鼠原画排期绘制中`}
      >
        <defs>
          <linearGradient id={paperId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#faf3e2" />
            <stop offset="52%" stopColor="#f5edd9" />
            <stop offset="100%" stopColor="#e8dac0" />
          </linearGradient>

          <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3dfa4" />
            <stop offset="46%" stopColor="#cfa34c" />
            <stop offset="100%" stopColor="#9f762b" />
          </linearGradient>

          <radialGradient id={washId} cx="50%" cy="40%" r="52%">
            <stop offset="0%" stopColor={suitTheme.tint} stopOpacity="0.62" />
            <stop offset="68%" stopColor={suitTheme.tint} stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f5edd9" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Warm ivory parchment lithograph ground */}
        <rect x="0" y="0" width="280" height="480" fill={`url(#${paperId})`} />
        <ellipse cx="140" cy="196" rx="122" ry="150" fill={`url(#${washId})`} />

        {/* Outer sepia & antique gold Art Nouveau border */}
        <rect
          x="10"
          y="10"
          width="260"
          height="460"
          rx="10"
          fill="none"
          stroke="#3e2f20"
          strokeWidth="1.5"
        />
        <rect
          x="15"
          y="15"
          width="250"
          height="450"
          rx="7"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="2"
        />

        {/* Classic Alphonse Mucha sweeping gothic-organic inner arch */}
        <path
          d="M 24 380 L 24 146 C 24 62, 74 28, 140 28 C 206 28, 256 62, 256 146 L 256 380"
          fill="none"
          stroke="#3e2f20"
          strokeWidth="1.4"
        />
        <path
          d="M 30 376 L 30 148 C 30 70, 78 36, 140 36 C 202 36, 250 70, 250 148 L 250 376"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="1.6"
        />

        {/* Top corner iris & lily botanical accents */}
        {[
          { tx: 0, sx: 1 },
          { tx: 280, sx: -1 },
        ].map((corner, i) => (
          <g key={i} transform={`translate(${corner.tx}, 0) scale(${corner.sx}, 1)`}>
            <path
              d="M 18 86 C 22 50, 42 26, 76 20 C 56 38, 42 58, 30 88 Z"
              fill="#8da385"
              fillOpacity="0.72"
              stroke="#3e2f20"
              strokeWidth="0.9"
            />
            <ellipse
              cx="36"
              cy="40"
              rx="12"
              ry="17"
              transform="rotate(-35 36 40)"
              fill="#a8736c"
              fillOpacity="0.72"
              stroke="#3e2f20"
              strokeWidth="0.9"
            />
            <circle cx="48" cy="30" r="3.2" fill={`url(#${goldId})`} stroke="#3e2f20" strokeWidth="0.7" />
          </g>
        ))}

        {/* Upper Numeral Arch Medallion */}
        <g transform="translate(140, 56)">
          <rect
            x="-44"
            y="-14"
            width="88"
            height="26"
            rx="13"
            fill="#faf3e2"
            stroke="#3e2f20"
            strokeWidth="1.2"
          />
          <rect
            x="-40"
            y="-10.5"
            width="80"
            height="19"
            rx="9.5"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="1"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fill="#3e2f20"
            fontSize="12"
            fontWeight="700"
            letterSpacing="2.2"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            {displayNumeral}
          </text>
        </g>

        {/* Iconic Concentric Alphonse Mucha Mosaic Halo */}
        <g transform="translate(140, 198)">
          <circle
            r="84"
            fill="#f7edd3"
            fillOpacity="0.78"
            stroke="#3e2f20"
            strokeWidth="1.35"
          />
          <circle
            r="79"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="7.5"
            strokeOpacity="0.88"
          />
          <circle
            r="74"
            fill="none"
            stroke="#3e2f20"
            strokeWidth="0.9"
          />
          <circle
            r="60"
            fill="#fbf5e6"
            stroke="#3e2f20"
            strokeWidth="1.15"
          />
          <circle
            r="56"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="0.85"
            strokeDasharray="2 3"
          />

          {/* 16 Mucha mosaic floral scallops inside halo ring */}
          {HALO_PETALS.map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <circle
                cx="0"
                cy="-67"
                r="5.2"
                fill="#faf2dd"
                stroke="#3e2f20"
                strokeWidth="0.85"
              />
              <circle cx="0" cy="-67" r="2.2" fill={`url(#${goldId})`} />
            </g>
          ))}

          {/* Custom Art Nouveau suit emblem inside the halo */}
          <SuitArtNouveauEmblem suit={card.suit} goldId={goldId} />
        </g>

        {/* Botanical scroll divider */}
        <g transform="translate(140, 304)">
          <path
            d="M -88 0 C -58 -10, -28 10, 0 0 C 28 -10, 58 10, 88 0"
            fill="none"
            stroke="#3e2f20"
            strokeWidth="1.1"
          />
          <circle cx="0" cy="0" r="4" fill={`url(#${goldId})`} stroke="#3e2f20" strokeWidth="0.9" />
          <circle cx="-54" cy="0" r="2" fill="#8da385" />
          <circle cx="54" cy="0" r="2" fill="#8da385" />
        </g>

        {/* Lower Ornate Title Cartouche */}
        <g transform="translate(140, 358)">
          <path
            d="M -104 -32 C -78 -42, 78 -42, 104 -32 L 104 30 C 78 40, -78 40, -104 30 Z"
            fill="#fbf5e7"
            fillOpacity="0.95"
            stroke="#3e2f20"
            strokeWidth="1.35"
          />
          <path
            d="M -98 -27 C -74 -36, 74 -36, 98 -27 L 98 25 C 74 34, -74 34, -98 25 Z"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="1.15"
          />

          <text
            x="0"
            y="-4"
            textAnchor="middle"
            fill="#2d2116"
            fontSize="21"
            fontWeight="700"
            letterSpacing="2"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            {card.nameZh}
          </text>

          <text
            x="0"
            y="14"
            textAnchor="middle"
            fill="#6e5739"
            fontSize="9.5"
            fontWeight="600"
            letterSpacing="1.8"
          >
            {card.nameEn.toUpperCase()}
          </text>

          {/* Element & suit micro-badge */}
          <text
            x="0"
            y="29"
            textAnchor="middle"
            fill={suitTheme.accent}
            fontSize="8.5"
            fontWeight="600"
            letterSpacing="1.1"
          >
            {`${card.element} · ${suitTheme.labelZh}`}
          </text>
        </g>

        {/* Subtle intentional collector's edition status ribbon */}
        <g transform="translate(140, 434)">
          <rect
            x="-92"
            y="-12"
            width="184"
            height="24"
            rx="12"
            fill="#ede0c3"
            fillOpacity="0.92"
            stroke={`url(#${goldId})`}
            strokeWidth="1"
          />
          <circle cx="-78" cy="0" r="2.2" fill={`url(#${goldId})`} />
          <circle cx="78" cy="0" r="2.2" fill={`url(#${goldId})`} />
          <text
            x="0"
            y="3.5"
            textAnchor="middle"
            fill="#5e4727"
            fontSize="9.2"
            fontWeight="600"
            letterSpacing="0.8"
          >
            穆夏仓鼠原画排期绘制中
          </text>
        </g>
      </svg>
    </div>
  );
}
