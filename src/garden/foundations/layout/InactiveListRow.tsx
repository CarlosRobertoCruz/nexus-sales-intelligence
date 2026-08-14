/**
 * Foundation — padrao de linha “inativa” em listas de configuracao (ex.: toggle desligado).
 *
 * Combina esmaecimento global da linha com variantes neutras para leading (letra ou placa).
 * Usar sempre que estado ativo/inativo deva ler como uma linha operacional.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import Text from "@/garden/foundations/display/Text";
import { TOKENS } from "@/garden/tokens";

export const LIST_ROW_INACTIVE_DIM_OPACITY = 0.5;

export type ListRowLeadingAccentTone = "successSoft" | "warningSoft" | "dangerSoft" | "infoSoft";

function accentBackgroundForTone(tone: ListRowLeadingAccentTone): string {
  switch (tone) {
    case "warningSoft":
      return TOKENS.color.feedback.warningPastelSoft;
    case "dangerSoft":
      return TOKENS.color.feedback.dangerPastelSoft;
    case "infoSoft":
      return TOKENS.color.feedback.infoPastelSoft;
    case "successSoft":
    default:
      return TOKENS.color.feedback.successPastelSoft;
  }
}

export interface InactiveListRowDimProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  inactive: boolean;
  children: ReactNode;
}

/** Envolve uma linha; quando `inactive`, reduz contraste da linha inteira (icone, texto, acoes). */
export function InactiveListRowDim({ inactive, children, style, ...rest }: InactiveListRowDimProps) {
  return (
    <div
      data-list-row-inactive={inactive ? "true" : undefined}
      style={{
        opacity: inactive ? LIST_ROW_INACTIVE_DIM_OPACITY : 1,
        transition: `opacity ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.standard}`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ListRowLeadingSymbol({
  inactive,
  tone = "successSoft",
  symbol,
  size = TOKENS.size[32],
  accent = "tone",
}: {
  inactive: boolean;
  /** Pastéis semânticos; ignorado quando `accent` é `brand`. */
  tone?: ListRowLeadingAccentTone;
  symbol: ReactNode;
  size?: string;
  /**
   * `brand` — `brand.soft` + glifo em `brand.primary`.
   * `tone` — pastéis por `tone`.
   */
  accent?: "tone" | "brand";
}) {
  const activeBackground =
    accent === "brand" ? TOKENS.color.brand.soft : accentBackgroundForTone(tone);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: TOKENS.radius.full,
        background: inactive ? TOKENS.color.stroke.subtle : activeBackground,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <Text
        size="xs"
        weight={700}
        tone={inactive ? "muted" : accent === "brand" ? "brand" : "primary"}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {symbol}
      </Text>
    </div>
  );
}

export interface ListRowLeadingPlateActiveSkin {
  background: string;
  borderColor?: string;
  /** Cor do glyph (ex. hex da categoria); fallback = `borderColor` quando so ha borda. */
  contentColor?: string;
}

export interface ListRowLeadingPlateProps {
  inactive: boolean;
  activePlate: ListRowLeadingPlateActiveSkin;
  children: ReactNode;
  size?: string;
  borderRadius?: string;
  style?: CSSProperties;
}

/**
 * Placa leading com cor de acento quando ativa; quando inativa usa fundo/borda neutros
 * para o mesmo efeito do restante da linha (complementar a `InactiveListRowDim`).
 */
export function ListRowLeadingPlate({
  inactive,
  activePlate,
  children,
  size = TOKENS.size[28],
  borderRadius = TOKENS.radius[8],
  style,
}: ListRowLeadingPlateProps) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius,
        ...(inactive
          ? {
              background: TOKENS.color.stroke.subtle,
              border: `1px solid ${TOKENS.color.stroke.default}`,
              color: TOKENS.color.content.muted,
            }
          : {
              background: activePlate.background,
              ...(activePlate.borderColor ? { border: `1px solid ${activePlate.borderColor}` } : { border: "none" }),
              color:
                activePlate.contentColor ??
                activePlate.borderColor ??
                TOKENS.color.content.secondary,
            }),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
