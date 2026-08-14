/**
 * Overlay em tela cheia: fundo escuro + blur, conteúdo centrado.
 * Montado em `document.body` via portal para `position:fixed` cobrir o viewport
 * mesmo com ancestrais `transform`/`filter` (ex.: `TableContainer` em hover).
 * Com `onBackdropPress`, o dismiss do fundo usa {@link Pressable} (contrato).
 */

import { forwardRef } from "react";
import type { HTMLAttributes, ReactElement, ReactPortal } from "react";
import { createPortal } from "react-dom";
import { TOKENS } from "@/garden/tokens";

import Pressable from "../interaction/Pressable";

function mountOverlayRoot(node: ReactElement): ReactElement | ReactPortal {
  if (typeof document !== "undefined" && document.body) {
    return createPortal(node, document.body);
  }
  return node;
}

type OverlayAlign = "top" | "center" | "bottom";
type OverlayJustify = "start" | "center" | "end";

interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  align?: OverlayAlign;
  justify?: OverlayJustify;
  /**
   * Fecha ao pressionar a área escurecida (camada por baixo do conteúdo).
   * Preferir a `onClick` com `target === currentTarget` — acessível e alinhado a Pressable.
   */
  onBackdropPress?: () => void;
}

const ALIGN_MAP: Record<OverlayAlign, string> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

const JUSTIFY_MAP: Record<OverlayJustify, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

const Overlay = forwardRef<HTMLDivElement, OverlayProps>(
  (
    {
      children,

      align = "center",
      justify = "center",

      style = {},
      onBackdropPress,
      ...props
    },
    ref
  ) => {

    const shellStyle = {
      position: "fixed" as const,
      inset: 0,

      display: "flex",
      alignItems: ALIGN_MAP[align],
      justifyContent: JUSTIFY_MAP[justify],

      zIndex: TOKENS.zIndex[9999],

      ...style,
    };

    if (onBackdropPress) {
      return mountOverlayRoot(
        <div ref={ref} style={shellStyle} {...props}>
          <Pressable
            as="div"
            onPress={onBackdropPress}
            role="presentation"
            tabIndex={-1}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              background: TOKENS.color.surface.overlay,
              backdropFilter: TOKENS.effects.blur[8],
            }}
            aria-hidden
          >
            {null}
          </Pressable>
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
              width: "100%",
              minHeight: "100%",
              pointerEvents: "none",
            }}
          >
            {children}
          </div>
        </div>
      );
    }

    return mountOverlayRoot(
      <div
        ref={ref}
        style={{
          ...shellStyle,
          background: TOKENS.color.surface.overlay,
          backdropFilter: TOKENS.effects.blur[8],
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Overlay.displayName = "Overlay";

export default Overlay;
