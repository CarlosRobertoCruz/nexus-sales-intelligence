import { useId, useState, type CSSProperties, type HTMLAttributes } from "react";
import { TOKENS } from "@/garden/tokens";

export type TimelineRailNodeTone = "brand" | "neutral";

export type TimelineRailNodeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  tone?: TimelineRailNodeTone;
  /** Diametro externo (border-box). */
  size?: CSSProperties["width"];
  /** Destaque vindo do pai (ex.: hover na linha inteira da timeline). */
  emphasized?: boolean;
  /** Halo ao passar o mouse só no próprio nó (use `false` quando o pai controla via `emphasized`). */
  hoverable?: boolean;
};

const VB = 12;
const CX = VB / 2;
const CY = VB / 2;
const R = 5;
const STROKE = 2;

/**
 * Nó circular para trilhos de timeline verticais (semântica visual apenas).
 *
 * Renderização em SVG (fill + stroke vetoriais + máscara) evita o anti-alias
 * em “anel pontilhado” típico de `border`/`clip-path` em círculos muito pequenos.
 */
export function TimelineRailNode({
  tone = "brand",
  size = TOKENS.size[12],
  emphasized = false,
  hoverable = true,
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: TimelineRailNodeProps) {
  const uid = useId().replace(/:/g, "");
  const maskId = `trn-fill-${uid}`;

  const [hovered, setHovered] = useState(false);
  const active = Boolean(emphasized) || (hoverable && hovered);

  const ringColor = tone === "brand" ? TOKENS.color.brand.primary : TOKENS.color.stroke.strong;
  const baseFill = tone === "brand" ? TOKENS.color.brand.surface : TOKENS.color.surface.base;
  const fillPaint =
    tone === "brand" ? TOKENS.color.brand.primary : TOKENS.color.stroke.strong;

  const haloIdle: CSSProperties["boxShadow"] = "none";
  const haloHover: CSSProperties["boxShadow"] =
    tone === "brand"
      ? `0 0 0 ${TOKENS.spacing[3]} ${TOKENS.color.brand.highlightActive}`
      : `0 0 0 ${TOKENS.spacing[2]} ${TOKENS.color.stroke.subtle}`;

  const transitionDuration = TOKENS.motion.duration["220"];
  const easing = TOKENS.motion.easing.premium;
  const transitionOuter = `box-shadow ${transitionDuration} ${easing}`;
  const maskGrowTransition = `transform ${transitionDuration} ${easing}`;

  return (
    <span
      {...rest}
      onMouseEnter={(e) => {
        if (hoverable) setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (hoverable) setHovered(false);
        onMouseLeave?.(e);
      }}
      style={{
        display: "inline-flex",
        borderRadius: TOKENS.radius.full,
        flexShrink: 0,
        position: "relative",
        zIndex: 1,
        lineHeight: TOKENS.spacing[0],
        boxShadow: active ? haloHover : haloIdle,
        transition: transitionOuter,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${VB} ${VB}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        aria-hidden
        focusable="false"
        style={{ display: "block", flexShrink: 0 }}
      >
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={VB}
            height={VB}
          >
            <rect width={VB} height={VB} fill="black" />
            <g
              style={{
                transformOrigin: `${CX}px ${VB}px`,
                transform: active ? "scale(1, 1)" : "scale(1, 0)",
                transition: maskGrowTransition,
              }}
            >
              <rect width={VB} height={VB} fill="white" />
            </g>
          </mask>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill={baseFill} />
        <circle cx={CX} cy={CY} r={R} fill={fillPaint} mask={`url(#${maskId})`} />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={ringColor} strokeWidth={STROKE} />
      </svg>
    </span>
  );
}
