"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Coins,
  Compass,
  Crosshair,
  FlipHorizontal2,
  Heart,
  Layers,
  Orbit,
  Quote,
  Rotate3d,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { DeckId, SuitType, TarotCard, ThemeId } from "@/types/tarot";
import { getThemeById } from "@/data/themes";
import { soundEngine } from "@/lib/sound";
import { TarotCard3D } from "./TarotCard3D";

export interface CardInspectorModalProps {
  card: TarotCard | null;
  reversed?: boolean;
  deckId: DeckId;
  themeId: ThemeId;
  gyroEnabled: boolean;
  soundEnabled: boolean;
  onDeckChange?: (d: DeckId) => void;
  onClose: () => void;
}

type DomainTab = "love" | "career" | "wealth";

interface OrbitTween {
  startYaw: number;
  targetYaw: number;
  startPitch: number;
  targetPitch: number;
  startTime: number;
  duration: number;
}

interface OrbitPhysicsState {
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  isDragging: boolean;
  pointerId: number | null;
  lastX: number;
  lastY: number;
  lastMoveTime: number;
  totalDistance: number;
  autoSpin: boolean;
  tween: OrbitTween | null;
  gyroX: number;
  gyroY: number;
  gyroTargetX: number;
  gyroTargetY: number;
  baselineBeta: number | null;
  baselineGamma: number | null;
}

interface OrbitViewState {
  rotateX: number;
  rotateY: number;
  baseYaw: number;
  basePitch: number;
  isDragging: boolean;
}

const INITIAL_FRONT_YAW = 180;
const MAX_PITCH_DEG = 62;
const YAW_SENSITIVITY = 0.65; // deg per px — right-drag spins front rightward toward edge/back
const PITCH_SENSITIVITY = 0.54; // deg per px
const TAP_MOVE_THRESHOLD_PX = 7;
const INERTIA_FRICTION_PER_16MS = 0.935;
const AUTO_SPIN_DEG_PER_SEC = 18;
const GYRO_MAX_OFFSET_DEG = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createInitialOrbitPhysics(): OrbitPhysicsState {
  return {
    yaw: INITIAL_FRONT_YAW,
    pitch: 0,
    vx: 0,
    vy: 0,
    isDragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    lastMoveTime: 0,
    totalDistance: 0,
    autoSpin: false,
    tween: null,
    gyroX: 0,
    gyroY: 0,
    gyroTargetX: 0,
    gyroTargetY: 0,
    baselineBeta: null,
    baselineGamma: null,
  };
}

const INITIAL_ORBIT_VIEW: OrbitViewState = {
  rotateX: 0,
  rotateY: INITIAL_FRONT_YAW,
  baseYaw: INITIAL_FRONT_YAW,
  basePitch: 0,
  isDragging: false,
};

const SUIT_LABELS: Record<SuitType, string> = {
  major: "大阿卡纳",
  wands: "权杖 · 小阿卡纳",
  cups: "圣杯 · 小阿卡纳",
  swords: "宝剑 · 小阿卡纳",
  pentacles: "星币 · 小阿卡纳",
};

const DOMAIN_TABS: Array<{
  id: DomainTab;
  label: string;
  Icon: typeof Heart;
}> = [
  { id: "love", label: "情感关系", Icon: Heart },
  { id: "career", label: "事业学业", Icon: Briefcase },
  { id: "wealth", label: "财富机遇", Icon: Coins },
];

export function CardInspectorModal({
  card,
  reversed = false,
  deckId,
  themeId,
  gyroEnabled,
  soundEnabled,
  onDeckChange,
  onClose,
}: CardInspectorModalProps) {
  const [localReversed, setLocalReversed] = useState(reversed);
  const [localDeckId, setLocalDeckId] = useState<DeckId>(deckId);
  const [activeTab, setActiveTab] = useState<DomainTab>("love");
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [orbitView, setOrbitView] = useState<OrbitViewState>(INITIAL_ORBIT_VIEW);

  const orbitRef = useRef<OrbitPhysicsState>(createInitialOrbitPhysics());
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTimeRef.current = 0;
  }, []);

  const commitOrbitView = useCallback(() => {
    const s = orbitRef.current;
    const nextRotateX = Math.round(clamp(s.pitch + s.gyroX, -68, 68) * 100) / 100;
    const nextRotateY = Math.round((s.yaw + s.gyroY) * 100) / 100;
    const nextBaseYaw = Math.round(s.yaw * 100) / 100;
    const nextBasePitch = Math.round(s.pitch * 100) / 100;

    setOrbitView((prev) => {
      if (
        prev.isDragging === s.isDragging &&
        Math.abs(prev.rotateX - nextRotateX) < 0.01 &&
        Math.abs(prev.rotateY - nextRotateY) < 0.01 &&
        Math.abs(prev.baseYaw - nextBaseYaw) < 0.01 &&
        Math.abs(prev.basePitch - nextBasePitch) < 0.01
      ) {
        return prev;
      }
      return {
        rotateX: nextRotateX,
        rotateY: nextRotateY,
        baseYaw: nextBaseYaw,
        basePitch: nextBasePitch,
        isDragging: s.isDragging,
      };
    });
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafRef.current !== null || typeof window === "undefined") return;

    const tick = (now: number) => {
      const dtMs = lastFrameTimeRef.current
        ? Math.min(48, Math.max(1, now - lastFrameTimeRef.current))
        : 16.667;
      lastFrameTimeRef.current = now;
      const frameFactor = dtMs / 16;
      const dtSec = dtMs / 1000;
      const s = orbitRef.current;

      let needsNextFrame = false;

      if (s.tween) {
        const elapsed = now - s.tween.startTime;
        const progress = clamp(elapsed / s.tween.duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3.2);
        s.yaw = s.tween.startYaw + (s.tween.targetYaw - s.tween.startYaw) * eased;
        s.pitch = s.tween.startPitch + (s.tween.targetPitch - s.tween.startPitch) * eased;
        if (progress >= 1) {
          s.yaw = s.tween.targetYaw;
          s.pitch = s.tween.targetPitch;
          s.tween = null;
        } else {
          needsNextFrame = true;
        }
      } else if (!s.isDragging) {
        if (s.autoSpin) {
          s.yaw += AUTO_SPIN_DEG_PER_SEC * dtSec;
          needsNextFrame = true;
        }

        if (Math.abs(s.vx) > 0.015 || Math.abs(s.vy) > 0.015) {
          s.yaw += s.vx * frameFactor;
          const nextPitch = s.pitch + s.vy * frameFactor;
          if (nextPitch > MAX_PITCH_DEG || nextPitch < -MAX_PITCH_DEG) {
            s.pitch = clamp(nextPitch, -MAX_PITCH_DEG, MAX_PITCH_DEG);
            s.vy *= -0.22;
          } else {
            s.pitch = nextPitch;
          }

          const damping = Math.pow(INERTIA_FRICTION_PER_16MS, frameFactor);
          s.vx *= damping;
          s.vy *= damping;

          if (Math.abs(s.vx) <= 0.015) s.vx = 0;
          if (Math.abs(s.vy) <= 0.015) s.vy = 0;

          if (s.vx !== 0 || s.vy !== 0) {
            needsNextFrame = true;
          }
        }
      }

      // Smoothly blend passive gyroscope ±12° micro-tilt on top of resting yaw/pitch
      const gyroLerp = 1 - Math.pow(1 - 0.14, frameFactor);
      const dGyroX = s.gyroTargetX - s.gyroX;
      const dGyroY = s.gyroTargetY - s.gyroY;
      if (Math.abs(dGyroX) > 0.02 || Math.abs(dGyroY) > 0.02) {
        s.gyroX += dGyroX * gyroLerp;
        s.gyroY += dGyroY * gyroLerp;
        needsNextFrame = true;
      } else {
        s.gyroX = s.gyroTargetX;
        s.gyroY = s.gyroTargetY;
      }

      if (s.isDragging) {
        needsNextFrame = true;
      }

      commitOrbitView();

      if (needsNextFrame) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        lastFrameTimeRef.current = 0;
      }
    };

    lastFrameTimeRef.current = 0;
    rafRef.current = window.requestAnimationFrame(tick);
  }, [commitOrbitView]);

  const animateOrbitTo = useCallback(
    (targetYaw: number, targetPitch: number, duration = 620) => {
      const s = orbitRef.current;
      s.vx = 0;
      s.vy = 0;
      s.tween = {
        startYaw: s.yaw,
        targetYaw,
        startPitch: s.pitch,
        targetPitch: clamp(targetPitch, -MAX_PITCH_DEG, MAX_PITCH_DEG),
        startTime: typeof performance !== "undefined" ? performance.now() : Date.now(),
        duration,
      };
      ensureLoop();
    },
    [ensureLoop]
  );

  // Cleanup animation loop on unmount
  useEffect(() => {
    return () => {
      stopLoop();
    };
  }, [stopLoop]);

  // Reset orbit stage & tab cleanly whenever a different card opens (or closes)
  const cardId = card?.id ?? null;
  useEffect(() => {
    stopLoop();
    orbitRef.current = createInitialOrbitPhysics();
    setOrbitView(INITIAL_ORBIT_VIEW);
    setIsAutoSpinning(false);
    if (cardId !== null) {
      setLocalReversed(reversed);
      setActiveTab("love");
    }
  }, [cardId, reversed, stopLoop]);

  // Keep deck selection synced without disturbing current 3D orbit angle
  useEffect(() => {
    setLocalDeckId(deckId);
  }, [deckId]);

  // Passive gyroscope micro-tilt fusion (±12° layered over resting yaw/pitch when not dragging)
  useEffect(() => {
    if (!card || !gyroEnabled || typeof window === "undefined") {
      const s = orbitRef.current;
      s.baselineBeta = null;
      s.baselineGamma = null;
      s.gyroTargetX = 0;
      s.gyroTargetY = 0;
      if (card) {
        ensureLoop();
      }
      return undefined;
    }

    const reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const s = orbitRef.current;
      if (s.isDragging || reducedMotionMq.matches) return;
      if (event.beta === null || event.gamma === null) return;

      const screenAngle =
        typeof window.screen?.orientation?.angle === "number"
          ? window.screen.orientation.angle
          : 0;

      let rawBeta = event.beta;
      let rawGamma = event.gamma;
      if (screenAngle === 90) {
        rawBeta = event.gamma;
        rawGamma = -event.beta;
      } else if (screenAngle === 270 || screenAngle === -90) {
        rawBeta = -event.gamma;
        rawGamma = event.beta;
      }

      if (s.baselineBeta === null) {
        s.baselineBeta = clamp(rawBeta, 10, 80);
      } else {
        s.baselineBeta += (clamp(rawBeta, 10, 80) - s.baselineBeta) * 0.008;
      }

      if (s.baselineGamma === null) {
        s.baselineGamma = clamp(rawGamma, -25, 25);
      } else {
        s.baselineGamma += (clamp(rawGamma, -25, 25) - s.baselineGamma) * 0.008;
      }

      const relBeta = clamp((rawBeta - s.baselineBeta) / 24, -1, 1);
      const relGamma = clamp((rawGamma - s.baselineGamma) / 24, -1, 1);

      s.gyroTargetX = -relBeta * GYRO_MAX_OFFSET_DEG;
      s.gyroTargetY = relGamma * GYRO_MAX_OFFSET_DEG;
      ensureLoop();
    };

    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [card, gyroEnabled, ensureLoop]);

  // Escape key & body scroll lock
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!card || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [card, onClose]);

  const theme = getThemeById(themeId);
  const accentColor = theme.cssVars["--accent"] ?? "#d4af37";

  const handleFlipSmooth = useCallback(() => {
    const s = orbitRef.current;
    if (s.autoSpin) {
      s.autoSpin = false;
      setIsAutoSpinning(false);
    }
    const baseYaw = s.tween ? s.tween.targetYaw : s.yaw;
    const nearestMultiple180 = Math.round(baseYaw / 180) * 180;
    const targetYaw = nearestMultiple180 + 180;
    soundEngine.playCardFlip(soundEnabled);
    animateOrbitTo(targetYaw, s.tween ? s.tween.targetPitch : s.pitch, 640);
  }, [animateOrbitTo, soundEnabled]);

  const handleResetView = useCallback(() => {
    const s = orbitRef.current;
    if (s.autoSpin) {
      s.autoSpin = false;
      setIsAutoSpinning(false);
    }
    // Recalibrate gyro baseline cleanly on reset
    s.baselineBeta = null;
    s.baselineGamma = null;
    s.gyroTargetX = 0;
    s.gyroTargetY = 0;

    const baseYaw = s.tween ? s.tween.targetYaw : s.yaw;
    const nearestFrontK = Math.round((baseYaw - INITIAL_FRONT_YAW) / 360);
    const targetYaw = INITIAL_FRONT_YAW + 360 * nearestFrontK;

    const currentlyFront = Math.cos((s.yaw * Math.PI) / 180) <= 0;
    if (!currentlyFront) {
      soundEngine.playCardFlip(soundEnabled);
    } else {
      soundEngine.playHoverTick(soundEnabled);
    }
    animateOrbitTo(targetYaw, 0, 580);
  }, [animateOrbitTo, soundEnabled]);

  const handleToggleAutoSpin = useCallback(() => {
    const s = orbitRef.current;
    soundEngine.playHoverTick(soundEnabled);
    const next = !s.autoSpin;
    s.autoSpin = next;
    if (next) {
      s.tween = null;
      s.vx = 0;
      s.vy = 0;
      ensureLoop();
    }
    setIsAutoSpinning(next);
  }, [ensureLoop, soundEnabled]);

  const handleToggleOrientation = () => {
    soundEngine.playHoverTick(soundEnabled);
    setLocalReversed((prev) => !prev);
  };

  const handleSwitchDeck = (nextDeck: DeckId) => {
    if (nextDeck === localDeckId) return;
    soundEngine.playHoverTick(soundEnabled);
    setLocalDeckId(nextDeck);
    onDeckChange?.(nextDeck);
  };

  // Pointer & touch handlers for true 360° free-orbit stage
  const handleStagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const s = orbitRef.current;
      if (s.isDragging && s.pointerId !== null) return;

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors on synthetic events
      }

      // Pause museum auto-turntable the moment the user grabs the card
      if (s.autoSpin) {
        s.autoSpin = false;
        setIsAutoSpinning(false);
      }

      // Fold any active gyro micro-tilt seamlessly into base angles so grab has zero snap
      s.yaw += s.gyroY;
      s.pitch = clamp(s.pitch + s.gyroX, -MAX_PITCH_DEG, MAX_PITCH_DEG);
      s.gyroX = 0;
      s.gyroY = 0;
      s.gyroTargetX = 0;
      s.gyroTargetY = 0;
      s.baselineBeta = null;
      s.baselineGamma = null;

      s.tween = null;
      s.vx = 0;
      s.vy = 0;
      s.isDragging = true;
      s.pointerId = event.pointerId;
      s.lastX = event.clientX;
      s.lastY = event.clientY;
      s.lastMoveTime = typeof performance !== "undefined" ? performance.now() : Date.now();
      s.totalDistance = 0;

      commitOrbitView();
      ensureLoop();
    },
    [commitOrbitView, ensureLoop]
  );

  const handleStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const s = orbitRef.current;
      if (!s.isDragging || s.pointerId !== event.pointerId) return;

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const dx = event.clientX - s.lastX;
      const dy = event.clientY - s.lastY;
      const dt = Math.max(1, now - s.lastMoveTime);

      s.lastX = event.clientX;
      s.lastY = event.clientY;
      s.lastMoveTime = now;
      s.totalDistance += Math.hypot(dx, dy);

      const yawDelta = dx * YAW_SENSITIVITY;
      const pitchDelta = -dy * PITCH_SENSITIVITY;

      s.yaw += yawDelta;
      s.pitch = clamp(s.pitch + pitchDelta, -MAX_PITCH_DEG, MAX_PITCH_DEG);

      // Exponentially smoothed velocity normalized to 16ms frame for weighty release inertia
      const frameScale = 16 / dt;
      const instVx = clamp(yawDelta * frameScale, -32, 32);
      const instVy = clamp(pitchDelta * frameScale, -18, 18);
      s.vx = s.vx * 0.42 + instVx * 0.58;
      s.vy = s.vy * 0.42 + instVy * 0.58;

      ensureLoop();
    },
    [ensureLoop]
  );

  const finishStagePointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
      const s = orbitRef.current;
      if (!s.isDragging || s.pointerId !== event.pointerId) return;

      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore release errors
      }

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const idleBeforeReleaseMs = now - s.lastMoveTime;
      const wasQuickTap = !cancelled && s.totalDistance < TAP_MOVE_THRESHOLD_PX;

      s.isDragging = false;
      s.pointerId = null;

      if (wasQuickTap) {
        s.vx = 0;
        s.vy = 0;
        handleFlipSmooth();
      } else {
        // If finger rested still before releasing, settle cleanly instead of launching stale inertia
        if (cancelled || idleBeforeReleaseMs > 90) {
          s.vx = 0;
          s.vy = 0;
        }
        commitOrbitView();
        ensureLoop();
      }
    },
    [commitOrbitView, ensureLoop, handleFlipSmooth]
  );

  const handleStageKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const s = orbitRef.current;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleFlipSmooth();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (s.autoSpin) {
          s.autoSpin = false;
          setIsAutoSpinning(false);
        }
        const baseYaw = s.tween ? s.tween.targetYaw : s.yaw;
        animateOrbitTo(baseYaw + 30, s.tween ? s.tween.targetPitch : s.pitch, 280);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (s.autoSpin) {
          s.autoSpin = false;
          setIsAutoSpinning(false);
        }
        const baseYaw = s.tween ? s.tween.targetYaw : s.yaw;
        animateOrbitTo(baseYaw - 30, s.tween ? s.tween.targetPitch : s.pitch, 280);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const basePitch = s.tween ? s.tween.targetPitch : s.pitch;
        animateOrbitTo(s.tween ? s.tween.targetYaw : s.yaw, basePitch + 15, 280);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const basePitch = s.tween ? s.tween.targetPitch : s.pitch;
        animateOrbitTo(s.tween ? s.tween.targetYaw : s.yaw, basePitch - 15, 280);
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        handleResetView();
      }
    },
    [animateOrbitTo, handleFlipSmooth, handleResetView]
  );

  const getDomainText = (targetCard: TarotCard): string => {
    if (activeTab === "love") {
      return localReversed ? targetCard.loveReversed : targetCard.loveUpright;
    }
    if (activeTab === "career") {
      return localReversed ? targetCard.careerReversed : targetCard.careerUpright;
    }
    return localReversed ? targetCard.wealthReversed : targetCard.wealthUpright;
  };

  // Live HUD orientation metrics (display angle 0° = Front face, 180° = Back face)
  const radY = (orbitView.rotateY * Math.PI) / 180;
  const cosY = Math.cos(radY);
  const isFrontFacing = cosY <= 0;
  const isEdgeOn = Math.abs(cosY) < 0.09;
  const displayYawDeg = ((Math.round(orbitView.rotateY - INITIAL_FRONT_YAW) % 360) + 360) % 360;
  const displayPitchDeg = Math.round(orbitView.rotateX);

  const baseYawOffsetFromFront = Math.abs(
    ((((orbitView.baseYaw - INITIAL_FRONT_YAW) % 360) + 540) % 360) - 180
  );
  const effectiveYawOffsetFromFront = Math.abs(
    ((((orbitView.rotateY - INITIAL_FRONT_YAW) % 360) + 540) % 360) - 180
  );
  const isViewRotated =
    baseYawOffsetFromFront > 2 || Math.abs(orbitView.basePitch) > 2 || isAutoSpinning;
  const isLiveDisplaced =
    orbitView.isDragging ||
    isAutoSpinning ||
    effectiveYawOffsetFromFront >= 2 ||
    Math.abs(displayPitchDeg) >= 3;

  const hudFaceLabel = isEdgeOn ? "镀金牌缘" : isFrontFacing ? "正面" : "牌背";
  const hudPrimaryLabel = isLiveDisplaced
    ? `${hudFaceLabel} · ${displayYawDeg}°`
    : "360° 自由旋转";

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {card ? (
        <motion.div
          key="card-inspector-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${card.nameZh} 卡牌鉴赏与牌义解析`}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#04060d]/88 p-0 backdrop-blur-xl sm:items-center sm:p-5"
        >
          <motion.div
            key={`card-inspector-sheet-${card.id}`}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-[#0a0d18]/98 text-[#f3e7cb] shadow-[0_24px_80px_rgba(0,0,0,0.8)] sm:h-auto sm:max-h-[90dvh] sm:rounded-[28px] sm:border sm:border-[#d4af37]/25"
          >
            {/* Subtle ambient gold glow behind the inspector modal */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[520px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
              style={{
                background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
              }}
            />

            {/* Top Sanctuary Header Bar (safe-area aware for iOS PWA Dynamic Island) */}
            <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0d18]/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md sm:px-6 sm:py-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/40 bg-[#d4af37]/12 text-[#f2d680]">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-serif text-sm font-semibold tracking-wider text-[#f7ebd2] sm:text-base">
                    {card.romanNumeral ? `${card.romanNumeral} · ` : ""}
                    {card.nameZh}
                  </p>
                  <p className="truncate text-[10px] uppercase tracking-[0.18em] text-[#cbbca0]/75">
                    {card.nameEn}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="关闭鉴赏弹窗"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/15 px-3.5 text-xs font-medium text-[#f7ebd2] shadow-sm transition hover:border-[#d4af37]/70 hover:bg-[#d4af37]/25 active:scale-95"
              >
                <X className="h-4 w-4" />
                <span>关闭</span>
              </button>
            </div>

            {/* Main Responsive Body: Mobile Vertical Scroll | Desktop 2-Column Split */}
            <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(350px,436px)_1fr] lg:overflow-hidden">
              {/* LEFT / TOP: True 360° Free-Orbit + Gyroscope Hero 3D Card Stage */}
              <div className="relative flex flex-col items-center justify-center border-b border-white/10 px-4 pb-5 pt-4 lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
                {/* Candlelight stage halo */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
                  style={{
                    background: `radial-gradient(circle, ${accentColor} 0%, transparent 72%)`,
                  }}
                />

                {/* Subtle Live 3D Orientation HUD Chip */}
                <div className="relative z-10 mb-2.5 flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/28 bg-black/45 px-3 py-1 text-[11px] font-medium tracking-[0.12em] text-[#f3e4bd] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${
                        orbitView.isDragging || isAutoSpinning
                          ? "bg-[#f6da84] shadow-[0_0_8px_rgba(246,218,132,0.95)]"
                          : isViewRotated
                            ? "bg-[#d4af37]"
                            : "bg-[#d4af37]/55"
                      } ${isAutoSpinning ? "animate-pulse" : ""}`}
                    />
                    <span className="tabular-nums">{hudPrimaryLabel}</span>
                    {isLiveDisplaced && Math.abs(displayPitchDeg) >= 4 ? (
                      <span className="tabular-nums text-[10px] text-[#cbbca0]/75">
                        · 倾角 {displayPitchDeg > 0 ? `+${displayPitchDeg}` : displayPitchDeg}°
                      </span>
                    ) : null}
                    {gyroEnabled ? (
                      <span className="inline-flex items-center gap-1 border-l border-white/15 pl-2 text-[10px] tracking-wider text-emerald-300/85">
                        <span className="h-1 w-1 rounded-full bg-emerald-400" />
                        陀螺仪
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Dedicated Free-Orbit Gesture Stage (touch-action: none isolated to card zone) */}
                <div
                  role="application"
                  tabIndex={0}
                  aria-label={`${card.nameZh} 360度自由旋转鉴赏舞台，拖动旋转，回车或空格翻面，方向键微调视角，R键重置`}
                  onPointerDown={handleStagePointerDown}
                  onPointerMove={handleStagePointerMove}
                  onPointerUp={(e) => finishStagePointer(e, false)}
                  onPointerCancel={(e) => finishStagePointer(e, true)}
                  onKeyDown={handleStageKeyDown}
                  className={`relative z-10 flex w-full max-w-[356px] select-none items-center justify-center rounded-3xl px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60 ${
                    orbitView.isDragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  style={{
                    touchAction: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                  }}
                >
                  <TarotCard3D
                    card={card}
                    deckId={localDeckId}
                    themeId={themeId}
                    flipped={isFrontFacing}
                    reversed={localReversed}
                    size="hero"
                    interactive={false}
                    tiltEnabled={false}
                    gyroEnabled={false}
                    soundEnabled={soundEnabled}
                    glowActive
                    freeOrbit={{
                      rotateX: orbitView.rotateX,
                      rotateY: orbitView.rotateY,
                      isDragging: orbitView.isDragging,
                    }}
                  />
                </div>

                {/* Crisp Gesture & Gyroscope Hint */}
                <p className="relative z-10 mt-1.5 text-center text-[11px] tracking-[0.12em] text-[#cbbca0]/65">
                  单指拖动 360° 自由旋转 · 轻触翻面 · 支持陀螺仪追光
                </p>

                {/* Tactile Luxury Controls Bar */}
                <div className="relative z-10 mt-3.5 flex w-full max-w-[356px] flex-col gap-2">
                  {/* Row 1: Flip | Auto-Turntable | Reset View | Upright/Reversed */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={handleFlipSmooth}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#d4af37]/30 bg-white/[0.04] px-1.5 py-2 text-[11px] font-medium tracking-wider text-[#f3e7cb] transition hover:border-[#d4af37]/65 hover:bg-[#d4af37]/15 active:scale-[0.97]"
                    >
                      <FlipHorizontal2 className="h-3.5 w-3.5 text-[#e6c465]" />
                      <span>翻转正背</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleAutoSpin}
                      aria-pressed={isAutoSpinning}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[11px] font-medium tracking-wider transition active:scale-[0.97] ${
                        isAutoSpinning
                          ? "border-[#d4af37]/80 bg-[#d4af37]/24 text-[#fbe7a8] shadow-[0_0_20px_rgba(212,175,55,0.28),inset_0_0_0_1px_rgba(248,227,161,0.3)]"
                          : "border-white/14 bg-white/[0.035] text-[#e8dcc2]/85 hover:border-[#d4af37]/50 hover:bg-[#d4af37]/12 hover:text-[#f8e7b8]"
                      }`}
                    >
                      <Rotate3d
                        className={`h-3.5 w-3.5 ${
                          isAutoSpinning
                            ? "animate-[spin_7s_linear_infinite] text-[#f8df8c]"
                            : "text-[#e6c465]"
                        }`}
                      />
                      <span>自动缓转</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetView}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[11px] font-medium tracking-wider transition active:scale-[0.97] ${
                        isViewRotated
                          ? "border-[#d4af37]/55 bg-[#d4af37]/16 text-[#f8e4a8] shadow-[0_0_14px_rgba(212,175,55,0.16)] hover:border-[#d4af37]/80 hover:bg-[#d4af37]/24"
                          : "border-white/10 bg-white/[0.025] text-[#cbbca0]/45 hover:border-white/22 hover:text-[#cbbca0]/80"
                      }`}
                    >
                      <Crosshair
                        className={`h-3.5 w-3.5 ${
                          isViewRotated ? "text-[#f2d680]" : "text-[#cbbca0]/50"
                        }`}
                      />
                      <span>重置视角</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleOrientation}
                      aria-pressed={localReversed}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[11px] font-medium tracking-wider transition active:scale-[0.97] ${
                        localReversed
                          ? "border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/22"
                          : "border-emerald-400/40 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20"
                      }`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{localReversed ? "逆位预览" : "正位预览"}</span>
                    </button>
                  </div>

                  {/* Row 2: Instant Deck Switcher: Rider-Waite ↔ Mucha Hamster */}
                  <div className="flex items-center rounded-xl border border-white/12 bg-black/35 p-1">
                    <button
                      type="button"
                      onClick={() => handleSwitchDeck("rider-waite")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        localDeckId === "rider-waite"
                          ? "bg-[#d4af37]/22 text-[#f8e3a1] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.45)]"
                          : "text-[#cbbca0]/70 hover:text-[#f3e7cb]"
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      经典伟特
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchDeck("mucha-hamster")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        localDeckId === "mucha-hamster"
                          ? "bg-[#d4af37]/22 text-[#f8e3a1] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.45)]"
                          : "text-[#cbbca0]/70 hover:text-[#f3e7cb]"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      穆夏仓鼠
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT / LOWER: Scrollable Deep Tarot Encyclopedia */}
              <div className="space-y-5 px-5 py-6 sm:px-7 lg:overflow-y-auto lg:py-7">
                {/* Title & Arcana Identity */}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#d4af37]/35 bg-[#d4af37]/12 px-2.5 py-0.5 text-[11px] font-medium tracking-wider text-[#f3d98a]">
                      {SUIT_LABELS[card.suit]}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wider ${
                        localReversed
                          ? "border-amber-400/45 bg-amber-500/15 text-amber-200"
                          : "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"
                      }`}
                    >
                      当前解读：{localReversed ? "逆位 Reversed" : "正位 Upright"}
                    </span>
                  </div>

                  <h2 className="mt-3 font-serif text-2xl font-bold tracking-wider text-[#fbf2dc] sm:text-3xl">
                    {card.romanNumeral ? (
                      <span className="mr-2 font-normal text-[#d4af37]/85">
                        {card.romanNumeral}
                      </span>
                    ) : null}
                    {card.nameZh}
                  </h2>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.22em] text-[#cbbca0]/75">
                    {card.nameEn}
                  </p>

                  {/* Element & Astrology Badges */}
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-[#e8dcc2]">
                      <Sparkles className="h-3.5 w-3.5 text-[#d4af37]" />
                      元素：{card.element}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-[#e8dcc2]">
                      <Orbit className="h-3.5 w-3.5 text-[#d4af37]" />
                      占星：{card.astrology}
                    </span>
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#d4af37]/80">
                    核心关键词
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(localReversed ? card.keywordsReversed : card.keywordsUpright).map(
                      (kw) => (
                        <span
                          key={kw}
                          className="rounded-full border border-[#d4af37]/28 bg-[#d4af37]/10 px-3 py-1 text-xs font-medium tracking-wide text-[#f6e4b3]"
                        >
                          {kw}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* General Meaning */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <h3 className="mb-1.5 text-xs font-semibold tracking-[0.16em] text-[#f2d680]">
                    核心牌义解析
                  </h3>
                  <p className="text-sm leading-7 text-[#efe4cc]/92">
                    {localReversed ? card.meaningReversed : card.meaningUpright}
                  </p>
                </div>

                {/* Love / Career / Wealth Domain Tabs */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex gap-1.5 rounded-xl bg-black/35 p-1">
                    {DOMAIN_TABS.map(({ id, label, Icon }) => {
                      const active = activeTab === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            soundEngine.playHoverTick(soundEnabled);
                            setActiveTab(id);
                          }}
                          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                            active
                              ? "text-[#fbf0cf]"
                              : "text-[#cbbca0]/70 hover:text-[#f3e7cb]"
                          }`}
                        >
                          {active ? (
                            <motion.span
                              layoutId="inspector-domain-tab"
                              transition={{ type: "spring", stiffness: 380, damping: 32 }}
                              className="absolute inset-0 rounded-lg border border-[#d4af37]/45 bg-[#d4af37]/20"
                            />
                          ) : null}
                          <Icon className="relative z-10 h-3.5 w-3.5" />
                          <span className="relative z-10">{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <motion.p
                    key={`${activeTab}-${localReversed ? "rev" : "up"}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm leading-7 text-[#efe4cc]/90"
                  >
                    {getDomainText(card)}
                  </motion.p>
                </div>

                {/* Actionable Advice */}
                <div className="rounded-2xl border border-[#d4af37]/25 bg-gradient-to-br from-[#d4af37]/[0.1] to-transparent p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-[0.16em] text-[#f3d98a]">
                    <Compass className="h-3.5 w-3.5" />
                    当下行动指引
                  </div>
                  <p className="text-sm leading-7 text-[#f5ead2]/92">
                    {localReversed ? card.adviceReversed : card.adviceUpright}
                  </p>
                </div>

                {/* Poetic Affirmation */}
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-center">
                  <Quote className="mx-auto mb-1.5 h-4 w-4 text-[#d4af37]/60" />
                  <p className="font-serif text-sm italic leading-7 tracking-wide text-[#f6e6be]">
                    “{card.affirmation}”
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#cbbca0]/55">
                    Daily Oracle Affirmation
                  </p>
                </div>

                {/* Mobile Safe-Area Bottom Spacer */}
                <div className="h-[max(1.5rem,env(safe-area-inset-bottom))] sm:hidden" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
