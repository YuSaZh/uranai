"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";

type DeviceOrientationPermissionState = "granted" | "denied";

interface SensorEventWithPermission {
  requestPermission?: () => Promise<DeviceOrientationPermissionState>;
}

export type GyroPermissionResult =
  | "granted"
  | "denied"
  | "insecure"
  | "unsupported";

export interface GyroDiagnostics {
  isSecureContext: boolean;
  hasOrientationEvent: boolean;
  needsExplicitPermission: boolean;
}

let sessionPermissionGranted = false;
let sessionAutoPromptAttempted = false;

export function getGyroDiagnostics(): GyroDiagnostics {
  if (typeof window === "undefined") {
    return {
      isSecureContext: true,
      hasOrientationEvent: false,
      needsExplicitPermission: false,
    };
  }

  const isSecure = Boolean(window.isSecureContext);
  const hasEvent =
    typeof window.DeviceOrientationEvent !== "undefined" ||
    "ondeviceorientation" in window;
  const ctor = (
    window as unknown as {
      DeviceOrientationEvent?: SensorEventWithPermission;
    }
  ).DeviceOrientationEvent;
  const needsExplicit = typeof ctor?.requestPermission === "function";

  return {
    isSecureContext: isSecure,
    hasOrientationEvent: hasEvent,
    needsExplicitPermission: needsExplicit,
  };
}

/**
 * Must be invoked directly inside a user tap/click handler on iOS 13+ Safari/PWA
 * (no `await` before calling `requestPermission()`).
 */
export async function requestGyroPermission(): Promise<GyroPermissionResult> {
  if (typeof window === "undefined") {
    return "unsupported";
  }

  // iOS Safari & modern mobile browsers completely hide DeviceOrientationEvent on HTTP
  if (!window.isSecureContext) {
    return "insecure";
  }

  const win = window as unknown as {
    DeviceOrientationEvent?: SensorEventWithPermission;
    DeviceMotionEvent?: SensorEventWithPermission;
  };

  const orientationCtor = win.DeviceOrientationEvent;

  if (!orientationCtor && !("ondeviceorientation" in window)) {
    return "unsupported";
  }

  if (typeof orientationCtor?.requestPermission === "function") {
    try {
      sessionAutoPromptAttempted = true;
      const state = await orientationCtor.requestPermission();
      if (state === "granted") {
        sessionPermissionGranted = true;
        // Best-effort companion motion permission on iOS if available
        const motionCtor = win.DeviceMotionEvent;
        if (typeof motionCtor?.requestPermission === "function") {
          motionCtor.requestPermission().catch(() => {});
        }
        return "granted";
      }
      return "denied";
    } catch {
      return "denied";
    }
  }

  // Android Chrome / Firefox / non-iOS browsers on HTTPS grant orientation events without prompt
  sessionPermissionGranted = true;
  return "granted";
}

export interface UseCardTiltOptions {
  enabled?: boolean;
  maxTilt?: number;
  gyroEnabled?: boolean;
  /**
   * When supplied, tilt & specular values are written directly as CSS custom properties
   * (`--tilt-x`, `--tilt-y`, `--glare-x`, `--glare-y`, `--sheen-x`, `--tilt-active`,
   * `--shadow-x`, `--shadow-y`) on the referenced DOM element with zero React re-renders.
   */
  targetRef?: RefObject<HTMLElement | null>;
  /** Skip pointer tilt when `event.pointerType === "touch"` (prevents tabletop drag interference). */
  ignoreTouch?: boolean;
}

export interface CardTiltHandlers {
  onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onTouchMove: (event: ReactTouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
}

export interface UseCardTiltResult {
  ref: RefObject<HTMLDivElement | null>;
  tiltX: number;
  tiltY: number;
  glareX: number;
  glareY: number;
  isInteracting: boolean;
  handlers: CardTiltHandlers;
}

interface TiltValues {
  tiltX: number;
  tiltY: number;
  glareX: number;
  glareY: number;
  active: number;
}

interface LegacyTiltState {
  tiltX: number;
  tiltY: number;
  glareX: number;
  glareY: number;
}

interface TiltSubscriber {
  enabled: boolean;
  gyroEnabled: boolean;
  maxTilt: number;
  pointerActive: boolean;
  isDirectCss: boolean;
  current: TiltValues;
  target: TiltValues;
  lastWritten: TiltValues | null;
  getElement: () => HTMLElement | null;
  onLegacyUpdate: ((next: LegacyTiltState) => void) | null;
}

const REST_TILT: Readonly<TiltValues> = {
  tiltX: 0,
  tiltY: 0,
  glareX: 50,
  glareY: 50,
  active: 0,
};

const REST_LEGACY: Readonly<LegacyTiltState> = {
  tiltX: 0,
  tiltY: 0,
  glareX: 50,
  glareY: 50,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isAtRest(v: TiltValues): boolean {
  return (
    Math.abs(v.tiltX) < 0.01 &&
    Math.abs(v.tiltY) < 0.01 &&
    Math.abs(v.glareX - 50) < 0.05 &&
    Math.abs(v.glareY - 50) < 0.05 &&
    v.active < 0.005
  );
}

function isSubSettled(sub: TiltSubscriber): boolean {
  const cur = sub.current;
  const tgt = sub.target;
  return (
    Math.abs(tgt.tiltX - cur.tiltX) < 0.03 &&
    Math.abs(tgt.tiltY - cur.tiltY) < 0.03 &&
    Math.abs(tgt.glareX - cur.glareX) < 0.08 &&
    Math.abs(tgt.glareY - cur.glareY) < 0.08 &&
    Math.abs(tgt.active - cur.active) < 0.015
  );
}

function writeCssTiltVars(el: HTMLElement, state: TiltValues): void {
  const sheenX = (((state.glareX + state.glareY) * 0.5 - 50) / 50) * 34;
  const shadowX = -state.tiltY * 1.35;
  const shadowY = state.tiltX * 1.05;

  el.style.setProperty(
    "--tilt-x",
    Math.abs(state.tiltX) < 0.01 ? "0deg" : `${state.tiltX.toFixed(2)}deg`
  );
  el.style.setProperty(
    "--tilt-y",
    Math.abs(state.tiltY) < 0.01 ? "0deg" : `${state.tiltY.toFixed(2)}deg`
  );
  el.style.setProperty(
    "--glare-x",
    Math.abs(state.glareX - 50) < 0.05 ? "50%" : `${state.glareX.toFixed(2)}%`
  );
  el.style.setProperty(
    "--glare-y",
    Math.abs(state.glareY - 50) < 0.05 ? "50%" : `${state.glareY.toFixed(2)}%`
  );
  el.style.setProperty(
    "--sheen-x",
    Math.abs(sheenX) < 0.05 ? "0%" : `${sheenX.toFixed(2)}%`
  );
  el.style.setProperty(
    "--tilt-active",
    state.active <= 0.002 ? "0" : state.active.toFixed(3)
  );
  el.style.setProperty(
    "--shadow-x",
    Math.abs(shadowX) < 0.05 ? "0px" : `${shadowX.toFixed(1)}px`
  );
  el.style.setProperty(
    "--shadow-y",
    Math.abs(shadowY) < 0.05 ? "0px" : `${shadowY.toFixed(1)}px`
  );
}

function applySubscriberOutput(sub: TiltSubscriber, force: boolean): void {
  const cur = sub.current;
  const prev = sub.lastWritten;

  if (sub.isDirectCss) {
    if (
      !force &&
      prev &&
      Math.abs(cur.tiltX - prev.tiltX) < 0.015 &&
      Math.abs(cur.tiltY - prev.tiltY) < 0.015 &&
      Math.abs(cur.glareX - prev.glareX) < 0.06 &&
      Math.abs(cur.glareY - prev.glareY) < 0.06 &&
      Math.abs(cur.active - prev.active) < 0.006
    ) {
      return;
    }

    const el = sub.getElement();
    if (!el) return;

    writeCssTiltVars(el, cur);
    if (!sub.lastWritten) {
      sub.lastWritten = { ...cur };
    } else {
      sub.lastWritten.tiltX = cur.tiltX;
      sub.lastWritten.tiltY = cur.tiltY;
      sub.lastWritten.glareX = cur.glareX;
      sub.lastWritten.glareY = cur.glareY;
      sub.lastWritten.active = cur.active;
    }
    return;
  }

  // Legacy React-state mode with threshold throttling
  if (!sub.onLegacyUpdate) return;
  if (
    !force &&
    prev &&
    Math.abs(cur.tiltX - prev.tiltX) < 0.08 &&
    Math.abs(cur.tiltY - prev.tiltY) < 0.08 &&
    Math.abs(cur.glareX - prev.glareX) < 0.25 &&
    Math.abs(cur.glareY - prev.glareY) < 0.25
  ) {
    return;
  }

  const nextLegacy: LegacyTiltState = {
    tiltX: Math.round(cur.tiltX * 100) / 100,
    tiltY: Math.round(cur.tiltY * 100) / 100,
    glareX: Math.round(cur.glareX * 100) / 100,
    glareY: Math.round(cur.glareY * 100) / 100,
  };
  if (!sub.lastWritten) {
    sub.lastWritten = { ...cur };
  } else {
    sub.lastWritten.tiltX = nextLegacy.tiltX;
    sub.lastWritten.tiltY = nextLegacy.tiltY;
    sub.lastWritten.glareX = nextLegacy.glareX;
    sub.lastWritten.glareY = nextLegacy.glareY;
    sub.lastWritten.active = cur.active;
  }
  sub.onLegacyUpdate(nextLegacy);
}

// ============================================================================
// Module-level Singleton Bus (at most 1 deviceorientation + 1 rAF globally)
// ============================================================================

const allSubs = new Set<TiltSubscriber>();
const gyroSubs = new Set<TiltSubscriber>();
const animatingSubs = new Set<TiltSubscriber>();

let globalRafId: number | null = null;
let gyroListenerAttached = false;
let touchPromptAttached = false;
let envListenersAttached = false;
let reducedMotionMql: MediaQueryList | null = null;
let globalReducedMotion = false;

let globalBaselineBeta: number | null = null;
let globalBaselineGamma: number | null = null;
let lastGyroRelBeta: number | null = null;
let lastGyroRelGamma: number | null = null;

function cancelGlobalRaf(): void {
  if (globalRafId !== null && typeof window !== "undefined") {
    window.cancelAnimationFrame(globalRafId);
    globalRafId = null;
  }
}

function globalTick(): void {
  globalRafId = null;

  if (
    typeof window === "undefined" ||
    (typeof document !== "undefined" && document.hidden) ||
    globalReducedMotion ||
    animatingSubs.size === 0
  ) {
    return;
  }

  for (const sub of animatingSubs) {
    if (!sub.enabled) {
      animatingSubs.delete(sub);
      continue;
    }

    const cur = sub.current;
    const tgt = sub.target;
    const lerp = sub.pointerActive ? 0.18 : 0.12;

    cur.tiltX += (tgt.tiltX - cur.tiltX) * lerp;
    cur.tiltY += (tgt.tiltY - cur.tiltY) * lerp;
    cur.glareX += (tgt.glareX - cur.glareX) * lerp;
    cur.glareY += (tgt.glareY - cur.glareY) * lerp;
    cur.active += (tgt.active - cur.active) * lerp;

    const settled = isSubSettled(sub);
    if (settled) {
      cur.tiltX = tgt.tiltX;
      cur.tiltY = tgt.tiltY;
      cur.glareX = tgt.glareX;
      cur.glareY = tgt.glareY;
      cur.active = tgt.active;
      animatingSubs.delete(sub);
    }

    applySubscriberOutput(sub, settled);
  }

  if (animatingSubs.size > 0) {
    globalRafId = window.requestAnimationFrame(globalTick);
  }
}

function scheduleGlobalRaf(): void {
  if (
    globalRafId !== null ||
    typeof window === "undefined" ||
    (typeof document !== "undefined" && document.hidden) ||
    globalReducedMotion ||
    animatingSubs.size === 0
  ) {
    return;
  }
  globalRafId = window.requestAnimationFrame(globalTick);
}

function wakeSubscriber(sub: TiltSubscriber): void {
  if (!sub.enabled || globalReducedMotion) return;
  animatingSubs.add(sub);
  scheduleGlobalRaf();
}

function handleFirstTapPermission(): void {
  touchPromptAttached = false;
  const diag = getGyroDiagnostics();
  if (
    diag.isSecureContext &&
    diag.needsExplicitPermission &&
    !sessionPermissionGranted &&
    !sessionAutoPromptAttempted
  ) {
    requestGyroPermission().catch(() => {});
  }
}

function handleGlobalOrientation(event: DeviceOrientationEvent): void {
  if (
    globalReducedMotion ||
    (typeof document !== "undefined" && document.hidden) ||
    gyroSubs.size === 0
  ) {
    return;
  }
  if (event.gamma === null || event.beta === null) return;

  const angle =
    typeof window.screen?.orientation?.angle === "number"
      ? window.screen.orientation.angle
      : 0;

  // Normalize axes for portrait vs landscape holding
  let rawBeta = event.beta;
  let rawGamma = event.gamma;
  if (angle === 90) {
    rawBeta = event.gamma;
    rawGamma = -event.beta;
  } else if (angle === 270 || angle === -90) {
    rawBeta = -event.gamma;
    rawGamma = event.beta;
  }

  const clampedBeta = clamp(rawBeta, 10, 80);
  const clampedGamma = clamp(rawGamma, -25, 25);

  if (globalBaselineBeta === null) {
    globalBaselineBeta = clampedBeta;
  } else {
    // Gentle auto-recenter so changing posture stays natural
    globalBaselineBeta += (clampedBeta - globalBaselineBeta) * 0.008;
  }

  if (globalBaselineGamma === null) {
    globalBaselineGamma = clampedGamma;
  } else {
    globalBaselineGamma += (clampedGamma - globalBaselineGamma) * 0.008;
  }

  const relGamma = clamp((rawGamma - globalBaselineGamma) / 24, -1, 1);
  const relBeta = clamp((rawBeta - globalBaselineBeta) / 24, -1, 1);

  // Skip sensor micro-jitter when the device is resting still and no rAF is running
  if (
    lastGyroRelBeta !== null &&
    lastGyroRelGamma !== null &&
    animatingSubs.size === 0 &&
    Math.abs(relBeta - lastGyroRelBeta) < 0.004 &&
    Math.abs(relGamma - lastGyroRelGamma) < 0.004
  ) {
    return;
  }

  lastGyroRelBeta = relBeta;
  lastGyroRelGamma = relGamma;

  const gyroActive = clamp(Math.hypot(relBeta, relGamma) * 0.8, 0, 0.85);
  const glareX = clamp((relGamma + 1) * 50, 5, 95);
  const glareY = clamp((relBeta + 1) * 50, 5, 95);

  for (const sub of gyroSubs) {
    if (!sub.enabled || sub.pointerActive) continue;
    const gyroTiltScale = sub.maxTilt * 0.9;
    sub.target.tiltX = -relBeta * gyroTiltScale;
    sub.target.tiltY = relGamma * gyroTiltScale;
    sub.target.glareX = glareX;
    sub.target.glareY = glareY;
    sub.target.active = gyroActive;

    if (!isSubSettled(sub)) {
      wakeSubscriber(sub);
    }
  }
}

function handleVisibilityChange(): void {
  if (typeof document === "undefined") return;
  if (document.hidden) {
    cancelGlobalRaf();
  } else if (animatingSubs.size > 0 && !globalReducedMotion) {
    scheduleGlobalRaf();
  }
}

function handleReducedMotionChange(event: MediaQueryListEvent): void {
  globalReducedMotion = event.matches;
  if (globalReducedMotion) {
    for (const sub of allSubs) {
      sub.pointerActive = false;
      sub.current = { ...REST_TILT };
      sub.target = { ...REST_TILT };
      applySubscriberOutput(sub, true);
    }
    animatingSubs.clear();
    cancelGlobalRaf();
  }
}

function syncGlobalBus(): void {
  if (typeof window === "undefined") return;

  // Environment listeners (visibilitychange + prefers-reduced-motion)
  if (allSubs.size > 0 && !envListenersAttached) {
    envListenersAttached = true;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    reducedMotionMql = window.matchMedia("(prefers-reduced-motion: reduce)");
    globalReducedMotion = reducedMotionMql.matches;
    reducedMotionMql.addEventListener("change", handleReducedMotionChange);
  } else if (allSubs.size === 0 && envListenersAttached) {
    envListenersAttached = false;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    if (reducedMotionMql) {
      reducedMotionMql.removeEventListener("change", handleReducedMotionChange);
      reducedMotionMql = null;
    }
  }

  // Single global deviceorientation listener
  if (gyroSubs.size > 0 && !gyroListenerAttached) {
    gyroListenerAttached = true;
    const diag = getGyroDiagnostics();
    if (
      diag.isSecureContext &&
      diag.needsExplicitPermission &&
      !sessionPermissionGranted &&
      !sessionAutoPromptAttempted &&
      !touchPromptAttached
    ) {
      touchPromptAttached = true;
      window.addEventListener("touchend", handleFirstTapPermission, {
        once: true,
        passive: true,
      });
    }
    window.addEventListener("deviceorientation", handleGlobalOrientation, {
      passive: true,
    });
  } else if (gyroSubs.size === 0 && gyroListenerAttached) {
    gyroListenerAttached = false;
    window.removeEventListener("deviceorientation", handleGlobalOrientation);
    if (touchPromptAttached) {
      touchPromptAttached = false;
      window.removeEventListener("touchend", handleFirstTapPermission);
    }
    globalBaselineBeta = null;
    globalBaselineGamma = null;
    lastGyroRelBeta = null;
    lastGyroRelGamma = null;
  }

  // Stop rAF immediately when no active animations remain
  if (animatingSubs.size === 0) {
    cancelGlobalRaf();
  }
}

function resetSubscriberImmediate(sub: TiltSubscriber): void {
  sub.pointerActive = false;
  sub.current.tiltX = REST_TILT.tiltX;
  sub.current.tiltY = REST_TILT.tiltY;
  sub.current.glareX = REST_TILT.glareX;
  sub.current.glareY = REST_TILT.glareY;
  sub.current.active = REST_TILT.active;
  sub.target.tiltX = REST_TILT.tiltX;
  sub.target.tiltY = REST_TILT.tiltY;
  sub.target.glareX = REST_TILT.glareX;
  sub.target.glareY = REST_TILT.glareY;
  sub.target.active = REST_TILT.active;
  animatingSubs.delete(sub);

  if (sub.isDirectCss) {
    if (sub.lastWritten && !isAtRest(sub.lastWritten)) {
      const el = sub.getElement();
      if (el) {
        writeCssTiltVars(el, REST_TILT);
      }
      sub.lastWritten = { ...REST_TILT };
    }
  } else if (sub.onLegacyUpdate) {
    if (sub.lastWritten && !isAtRest(sub.lastWritten)) {
      sub.lastWritten = { ...REST_TILT };
      sub.onLegacyUpdate({ ...REST_LEGACY });
    }
  }
}

export function useCardTilt({
  enabled = true,
  maxTilt = 14,
  gyroEnabled = false,
  targetRef,
  ignoreTouch = false,
}: UseCardTiltOptions = {}): UseCardTiltResult {
  const ref = useRef<HTMLDivElement | null>(null);

  const [tiltState, setTiltState] = useState<LegacyTiltState>({
    tiltX: 0,
    tiltY: 0,
    glareX: 50,
    glareY: 50,
  });
  const [isInteracting, setIsInteracting] = useState(false);

  const cachedRectRef = useRef<DOMRect | null>(null);
  const subRef = useRef<TiltSubscriber | null>(null);
  const optionsRef = useRef({
    enabled,
    maxTilt,
    gyroEnabled,
    targetRef,
    ignoreTouch,
  });

  const getSubscriber = useCallback((): TiltSubscriber => {
    if (!subRef.current) {
      const opts = optionsRef.current;
      subRef.current = {
        enabled: opts.enabled,
        gyroEnabled: opts.gyroEnabled,
        maxTilt: opts.maxTilt,
        pointerActive: false,
        isDirectCss: Boolean(opts.targetRef),
        current: { ...REST_TILT },
        target: { ...REST_TILT },
        lastWritten: null,
        getElement: () => optionsRef.current.targetRef?.current ?? ref.current,
        onLegacyUpdate: opts.targetRef ? null : setTiltState,
      };
    }
    return subRef.current;
  }, []);

  // Synchronize options & singleton bus subscriptions
  useEffect(() => {
    optionsRef.current = {
      enabled,
      maxTilt,
      gyroEnabled,
      targetRef,
      ignoreTouch,
    };

    const sub = getSubscriber();
    const wasGyro = sub.gyroEnabled;
    sub.enabled = enabled;
    sub.gyroEnabled = gyroEnabled;
    sub.maxTilt = maxTilt;
    sub.isDirectCss = Boolean(targetRef);
    sub.onLegacyUpdate = targetRef ? null : setTiltState;

    if (!enabled) {
      cachedRectRef.current = null;
      gyroSubs.delete(sub);
      allSubs.delete(sub);
      resetSubscriberImmediate(sub);
      if (!targetRef) {
        setIsInteracting(false);
      }
      syncGlobalBus();
      return;
    }

    allSubs.add(sub);
    if (gyroEnabled) {
      gyroSubs.add(sub);
    } else {
      gyroSubs.delete(sub);
      if (wasGyro && !sub.pointerActive) {
        sub.target.tiltX = 0;
        sub.target.tiltY = 0;
        sub.target.glareX = 50;
        sub.target.glareY = 50;
        sub.target.active = 0;
        if (!isSubSettled(sub)) {
          wakeSubscriber(sub);
        }
      }
    }

    syncGlobalBus();
  }, [enabled, gyroEnabled, maxTilt, ignoreTouch, targetRef, getSubscriber]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      cachedRectRef.current = null;
      const sub = subRef.current;
      if (!sub) return;
      sub.enabled = false;
      sub.pointerActive = false;
      animatingSubs.delete(sub);
      gyroSubs.delete(sub);
      allSubs.delete(sub);
      syncGlobalBus();
    };
  }, []);

  const updateFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const opts = optionsRef.current;
      if (!opts.enabled || globalReducedMotion) return;

      const sub = getSubscriber();
      let rect = cachedRectRef.current;
      if (!rect) {
        const el = sub.getElement();
        if (!el) return;
        rect = el.getBoundingClientRect();
        cachedRectRef.current = rect;
      }
      if (rect.width <= 0 || rect.height <= 0) return;

      const nx = clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      const ny = clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1);

      sub.target.tiltX = -ny * opts.maxTilt;
      sub.target.tiltY = nx * opts.maxTilt;
      sub.target.glareX = clamp((nx + 1) * 50, 0, 100);
      sub.target.glareY = clamp((ny + 1) * 50, 0, 100);
      sub.target.active = 1;
      wakeSubscriber(sub);
    },
    [getSubscriber]
  );

  const resetTilt = useCallback(() => {
    cachedRectRef.current = null;
    const sub = subRef.current;
    if (!sub) return;
    sub.pointerActive = false;
    if (!sub.isDirectCss) {
      setIsInteracting(false);
    }
    if (!sub.enabled) return;

    sub.target.tiltX = 0;
    sub.target.tiltY = 0;
    sub.target.glareX = 50;
    sub.target.glareY = 50;
    sub.target.active = 0;
    if (!isSubSettled(sub)) {
      wakeSubscriber(sub);
    }
  }, []);

  const onPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const opts = optionsRef.current;
      if (!opts.enabled || globalReducedMotion) return;
      if (opts.ignoreTouch && event.pointerType === "touch") return;

      const sub = getSubscriber();
      const el = sub.getElement();
      if (el) {
        cachedRectRef.current = el.getBoundingClientRect();
      }
      sub.pointerActive = true;
      if (!sub.isDirectCss) {
        setIsInteracting(true);
      }
      updateFromClientPoint(event.clientX, event.clientY);
    },
    [getSubscriber, updateFromClientPoint]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const opts = optionsRef.current;
      if (!opts.enabled || globalReducedMotion) return;
      if (opts.ignoreTouch && event.pointerType === "touch") return;

      const sub = getSubscriber();
      if (!sub.pointerActive) {
        sub.pointerActive = true;
        if (!sub.isDirectCss) {
          setIsInteracting(true);
        }
      }
      updateFromClientPoint(event.clientX, event.clientY);
    },
    [getSubscriber, updateFromClientPoint]
  );

  const onPointerLeave = useCallback(() => {
    resetTilt();
  }, [resetTilt]);

  const onPointerCancel = useCallback(() => {
    resetTilt();
  }, [resetTilt]);

  const onTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      const opts = optionsRef.current;
      if (!opts.enabled || opts.ignoreTouch || globalReducedMotion) return;
      const touch = event.touches[0];
      if (!touch) return;

      const sub = getSubscriber();
      if (!sub.pointerActive) {
        sub.pointerActive = true;
        if (!sub.isDirectCss) {
          setIsInteracting(true);
        }
      }
      updateFromClientPoint(touch.clientX, touch.clientY);
    },
    [getSubscriber, updateFromClientPoint]
  );

  const onTouchEnd = useCallback(() => {
    resetTilt();
  }, [resetTilt]);

  return {
    ref,
    tiltX: tiltState.tiltX,
    tiltY: tiltState.tiltY,
    glareX: tiltState.glareX,
    glareY: tiltState.glareY,
    isInteracting,
    handlers: {
      onPointerEnter,
      onPointerMove,
      onPointerLeave,
      onPointerCancel,
      onTouchMove,
      onTouchEnd,
    },
  };
}
