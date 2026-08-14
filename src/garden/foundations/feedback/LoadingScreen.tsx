/**
 * Foundation - splash screen generica de boot.
 *
 * Quando `visible` muda para false executa fade-out e chama `onExitComplete`
 * para que o parent possa desmontar o componente.
 */

import { useRef } from "react";
import type { TransitionEvent } from "react";
import { TOKENS } from "@/garden/tokens";

interface LoadingScreenProps {
  visible: boolean;
  onExitComplete: () => void;
  logoSrc?: string;
  logoAlt?: string;
  label?: string;
}

function LoadingScreen({
  visible,
  onExitComplete,
  logoSrc,
  logoAlt = "",
  label = "Carregando aplicacao",
}: LoadingScreenProps) {
  const exitHandled = useRef(false);

  function handleTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "opacity" || visible || exitHandled.current) return;
    exitHandled.current = true;
    onExitComplete();
  }

  return (
    <div
      role="status"
      aria-label={label}
      onTransitionEnd={handleTransitionEnd}
      style={{
        position: "fixed",
        inset: TOKENS.spacing[0],
        zIndex: TOKENS.zIndex[9999],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: TOKENS.spacing[40],
        background: TOKENS.color.surface.inverse,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: `opacity ${TOKENS.motion.duration[420]} ${TOKENS.motion.easing.premium}`,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: TOKENS.size[128],
          height: TOKENS.size[128],
          borderRadius: TOKENS.radius.full,
          background: TOKENS.color.brand.soft,
          opacity: TOKENS.effects.opacity[32],
          pointerEvents: "none",
        }}
      />

      {logoSrc ? (
        <img
          src={logoSrc}
          alt={logoAlt}
          draggable={false}
          style={{
            width: TOKENS.size[128],
            height: "auto",
            userSelect: "none",
            position: "relative",
            animation: TOKENS.motion.animation.logoEnter,
          }}
        />
      ) : null}

      <div
        aria-hidden="true"
        style={{
          width: TOKENS.size[160],
          height: TOKENS.spacing[2],
          background: TOKENS.color.surface.elevated,
          borderRadius: TOKENS.radius.full,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: TOKENS.spacing[0],
            left: TOKENS.spacing[0],
            width: TOKENS.size[60],
            height: "100%",
            borderRadius: TOKENS.radius.full,
            background: TOKENS.color.brand.primary,
            animation: TOKENS.motion.animation.loadingBar,
          }}
        />
      </div>
    </div>
  );
}

export default LoadingScreen;
