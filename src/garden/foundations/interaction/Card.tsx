/**
 * Foundation — superficie clicavel (ou nao) com variantes `card`/`smart`/`menu`.
 *
 * Quando `onPress` esta presente, envolve o conteudo em `Pressable` (semantica de
 * botao); quando ausente + `hoverable`, captura hover localmente; quando ausente +
 * `!hoverable`, e' apenas estatico. Children pode ser render-prop `({ hovered }) =>
 * ReactNode` para customizar conteudo conforme o estado.
 *
 * O shape visual e' delegado ao `Highlight` — `Card` so' decide a variant + padding.
 *
 * Hover: sem `children` como função, não envolvemos em `div` extra e deixamos o
 * próprio Highlight seguir hover (prop `hovered` omitida). Com render-prop, estado
 * fica sincronizado no wrapper + prop explícita.
 */

import { forwardRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import Highlight from "@/garden/foundations/interaction/Highlight";
import Pressable from "@/garden/foundations/interaction/Pressable";
import { TOKENS } from "@/garden/tokens";

type CardVariant = "card" | "surface" | "smart" | "menu" | "metric";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  variant?: CardVariant;
  hovered?: boolean;
  active?: boolean;
  onPress?: () => void;
  hoverable?: boolean;
  paddingY?: CSSProperties["paddingTop"];
  paddingX?: CSSProperties["paddingLeft"];
  children?: ReactNode | ((state: { hovered: boolean }) => ReactNode);
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,

      variant = "card",

      hovered: hoveredProp,
      active = false,

      onPress,
      hoverable = false,

      paddingY = TOKENS.spacing[8],
      paddingX = TOKENS.spacing[14],

      style = {},
      ...props
    },
    ref
  ) => {
    const [trackedHover, setTrackedHover] = useState(false);
    const isRenderFnChild = typeof children === "function";

    const hoveredForHighlight =
      hoveredProp !== undefined
        ? hoveredProp
        : onPress
          ? trackedHover
          : !hoverable
            ? false
            : isRenderFnChild
              ? trackedHover
              : undefined;

    const hoveredForRenderPropUi = hoveredProp !== undefined ? hoveredProp : trackedHover;

    const highlightVariant =
      variant === "smart"
        ? "smart"
        : variant === "menu"
          ? "menu"
          : variant === "metric"
            ? "metric"
            : variant === "surface"
              ? "surface"
              : "card";

    const content = (
      <Highlight
        variant={highlightVariant}
        hovered={hoveredForHighlight}
        active={active}
        style={{
          padding: `${paddingY} ${paddingX}`,
          borderRadius:
            variant === "smart" || variant === "menu"
              ? TOKENS.radius[14]
              : variant === "metric" || variant === "surface"
                ? TOKENS.radius[12]
                : TOKENS.radius[8],
          display: "flex",
          flexDirection: "column",
          gap: TOKENS.spacing[4],
          transition: `all ${TOKENS.motion.duration[180]}`,
          ...style,
        }}
        {...props}
      >
        {typeof children === "function" ? children({ hovered: hoveredForRenderPropUi }) : children}
      </Highlight>
    );

    if (!onPress) {
      if (!hoverable) return content;

      if (isRenderFnChild) {
        return (
          <div
            onMouseEnter={() => setTrackedHover(true)}
            onMouseLeave={() => setTrackedHover(false)}
          >
            {content}
          </div>
        );
      }

      return content;
    }

    return (
      <Pressable
        ref={ref}
        as="div"
        onPress={onPress}
        onMouseEnter={() => setTrackedHover(true)}
        onMouseLeave={() => setTrackedHover(false)}
        style={{
          cursor: "pointer",
        }}
      >
        {content}
      </Pressable>
    );
  }
);

export default Card;
