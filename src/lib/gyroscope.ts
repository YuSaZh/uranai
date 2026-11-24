"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react";

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
}

export interface CardTiltHandlers {
  onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onTouchMove: (event: ReactTouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
}

export interface UseCardTiltResult {
  ref: React.RefObject<HTMLDivElement | null>;
  tiltX: number;
  tiltY: number;
  glareX: number;
  glareY: number;
  isInteracting: boolean;
  handlers: CardTiltHandlers;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function useCardTilt({
  enabled = true,
  maxTilt = 14,
  gyroEnabled = false,
}: UseCardTiltOptions = {}): UseCardTiltResult {
  const ref = useRef<HTMLDivElement | null>(null);

  const [tiltState, setTiltState] = useState({
    tiltX: 0,
    tiltY: 0,
    glareX: 50,
    glareY: 50,
  });
  const [isInteracting, setIsInteracting] = useState(false);

  const currentRef = useRef({ tiltX: 0, tiltY: 0, glareX: 50, glareY: 50 });
  const targetRef = useRef({ tiltX: 0, tiltY: 0, glareX: 50, glareY: 50 });
  const pointerActiveRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const baselineBetaRef = useRef<number | null>(null);
  const baselineGammaRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current !== null || typeof window === "undefined") return;

    const tick = () => {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      const lerp = pointerActiveRef.current ? 0.18 : 0.12;

      cur.tiltX += (tgt.tiltX - cur.tiltX) * lerp;
      cur.tiltY += (tgt.tiltY - cur.tiltY) * lerp;
      cur.glareX += (tgt.glareX - cur.glareX) * lerp;
      cur.glareY += (tgt.glareY - cur.glareY) * lerp;

      const settled =
        Math.abs(tgt.tiltX - cur.tiltX) < 0.025 &&
        Math.abs(tgt.tiltY - cur.tiltY) < 0.025 &&
        Math.abs(tgt.glareX - cur.glareX) < 0.06 &&
        Math.abs(tgt.glareY - cur.glareY) < 0.06;

      if (settled) {
        cur.tiltX = tgt.tiltX;
        cur.tiltY = tgt.tiltY;
        cur.glareX = tgt.glareX;
        cur.glareY = tgt.glareY;
      }

      setTiltState({
        tiltX: Math.round(cur.tiltX * 100) / 100,
        tiltY: Math.round(cur.tiltY * 100) / 100,
        glareX: Math.round(cur.glareX * 100) / 100,
        glareY: Math.round(cur.glareY * 100) / 100,
      });

      if (settled) {
        rafRef.current = null;
      } else {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Reset gracefully when disabled
  useEffect(() => {
    if (!enabled) {
      pointerActiveRef.current = false;
      setIsInteracting(false);
      targetRef.current = { tiltX: 0, tiltY: 0, glareX: 50, glareY: 50 };
      startLoop();
    }
  }, [enabled, startLoop]);

  // Smooth mobile gyroscope blending when pointer isn't actively dragging
  useEffect(() => {
    if (!enabled || !gyroEnabled || typeof window === "undefined") {
      baselineBetaRef.current = null;
      baselineGammaRef.current = null;
      return;
    }

    // Re-request iOS session permission seamlessly on first tap if user already opted in
    const diag = getGyroDiagnostics();
    const onFirstTap = () => {
      if (
        diag.isSecureContext &&
        diag.needsExplicitPermission &&
        !sessionPermissionGranted &&
        !sessionAutoPromptAttempted
      ) {
        requestGyroPermission().catch(() => {});
      }
    };

    if (
      diag.isSecureContext &&
      diag.needsExplicitPermission &&
      !sessionPermissionGranted &&
      !sessionAutoPromptAttempted
    ) {
      window.addEventListener("touchend", onFirstTap, { once: true, passive: true });
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (pointerActiveRef.current || reducedMotionRef.current) return;
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

      if (baselineBetaRef.current === null) {
        baselineBetaRef.current = clamp(rawBeta, 10, 80);
      } else {
        // Gentle auto-recenter so changing posture stays natural
        baselineBetaRef.current += (clamp(rawBeta, 10, 80) - baselineBetaRef.current) * 0.008;
      }

      if (baselineGammaRef.current === null) {
        baselineGammaRef.current = clamp(rawGamma, -25, 25);
      } else {
        baselineGammaRef.current += (clamp(rawGamma, -25, 25) - baselineGammaRef.current) * 0.008;
      }

      const relGamma = clamp((rawGamma - baselineGammaRef.current) / 24, -1, 1);
      const relBeta = clamp((rawBeta - baselineBetaRef.current) / 24, -1, 1);

      const gyroTiltScale = maxTilt * 0.9;
      targetRef.current = {
        tiltX: -relBeta * gyroTiltScale,
        tiltY: relGamma * gyroTiltScale,
        glareX: clamp((relGamma + 1) * 50, 5, 95),
        glareY: clamp((relBeta + 1) * 50, 5, 95),
      };
      startLoop();
    };

    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("touchend", onFirstTap);
    };
  }, [enabled, gyroEnabled, maxTilt, startLoop]);

  const updateFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled || reducedMotionRef.current) return;
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const nx = clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      const ny = clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1);

      targetRef.current = {
        tiltX: -ny * maxTilt,
        tiltY: nx * maxTilt,
        glareX: clamp((nx + 1) * 50, 0, 100),
        glareY: clamp((ny + 1) * 50, 0, 100),
      };
      startLoop();
    },
    [enabled, maxTilt, startLoop]
  );

  const resetTilt = useCallback(() => {
    pointerActiveRef.current = false;
    setIsInteracting(false);
    targetRef.current = { tiltX: 0, tiltY: 0, glareX: 50, glareY: 50 };
    startLoop();
  }, [startLoop]);

  const onPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || reducedMotionRef.current) return;
      pointerActiveRef.current = true;
      setIsInteracting(true);
      updateFromClientPoint(event.clientX, event.clientY);
    },
    [enabled, updateFromClientPoint]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || reducedMotionRef.current) return;
      if (!pointerActiveRef.current) {
        pointerActiveRef.current = true;
        setIsInteracting(true);
      }
      updateFromClientPoint(event.clientX, event.clientY);
    },
    [enabled, updateFromClientPoint]
  );

  const onPointerLeave = useCallback(() => {
    resetTilt();
  }, [resetTilt]);

  const onTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      if (!enabled || reducedMotionRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      if (!pointerActiveRef.current) {
        pointerActiveRef.current = true;
        setIsInteracting(true);
      }
      updateFromClientPoint(touch.clientX, touch.clientY);
    },
    [enabled, updateFromClientPoint]
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
      onTouchMove,
      onTouchEnd,
    },
  };
}
