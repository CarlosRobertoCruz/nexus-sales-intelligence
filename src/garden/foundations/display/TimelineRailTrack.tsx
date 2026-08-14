import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import {
  TIMELINE_RAIL_TRACK_DEFAULT_DOT_PX,
  TIMELINE_RAIL_TRACK_DEFAULT_STROKE_PX,
  TIMELINE_RAIL_TRACK_DEFAULT_WIDTH_PX,
} from "./timelineRailTrackDefaults";

export type TimelineRailLineExtent = "stretch" | "toDot";

export type TimelineRailTrackProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children?: ReactNode;
  /** Largura da coluna em px. */
  railWidth?: CSSProperties["width"];
  /** Espessura da linha vertical em px. */
  strokeWidth?: CSSProperties["width"];
  /** Cor da linha (token). */
  lineColor?: string;
  /** Espaço acima do nó (alinha com a primeira linha do conteúdo da row). */
  paddingTop?: CSSProperties["paddingTop"];
  /** Usado com `lineExtent="toDot"`: altura da linha = `paddingTop` + `dotSize` em px. */
  dotSize?: CSSProperties["height"];
  /** `stretch`: linha até ao fundo da célula; `toDot`: linha só até cobrir a zona do nó (último item). */
  lineExtent?: TimelineRailLineExtent;
};

/**
 * Coluna de trilho vertical: linha cinza centrada + slot para o nó (`TimelineRailNode`).
 * Domain-blind; o conteúdo à esquerda/direita fica no layout pai.
 */
export const TimelineRailTrack = forwardRef<HTMLDivElement, TimelineRailTrackProps>(
  function TimelineRailTrack(
    {
      railWidth = TIMELINE_RAIL_TRACK_DEFAULT_WIDTH_PX,
      strokeWidth = TIMELINE_RAIL_TRACK_DEFAULT_STROKE_PX,
      lineColor = TOKENS.color.stroke.subtle,
      paddingTop = TOKENS.spacing[10],
      dotSize = TIMELINE_RAIL_TRACK_DEFAULT_DOT_PX,
      lineExtent = "stretch",
      style,
      children,
      ...rest
    },
    ref,
  ) {
    const padExpr =
      typeof paddingTop === "number" ? `${paddingTop}px` : String(paddingTop ?? TOKENS.spacing[0]);
    const dotExpr = typeof dotSize === "number" ? `${dotSize}px` : String(dotSize);
    const strokeExpr = typeof strokeWidth === "number" ? `${strokeWidth}px` : String(strokeWidth);
    const lineHeightWhenToDot = `calc(${padExpr} + ${dotExpr})`;

    return (
      <div
        ref={ref}
        {...rest}
        style={{
          position: "relative",
          width: railWidth,
          minWidth: railWidth,
          flexShrink: 0,
          alignSelf: "stretch",
          paddingTop,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          ...style,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            width: strokeWidth,
            marginLeft: `calc(${strokeExpr} / -2)`,
            top: TOKENS.spacing[0],
            ...(lineExtent === "stretch" ? { bottom: TOKENS.spacing[0] } : { height: lineHeightWhenToDot }),
            background: lineColor,
            borderRadius: TOKENS.radius.full,
          }}
        />
        {children}
      </div>
    );
  },
);

TimelineRailTrack.displayName = "TimelineRailTrack";
