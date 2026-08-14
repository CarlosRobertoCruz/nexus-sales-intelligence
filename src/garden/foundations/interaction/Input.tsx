/**
 * Foundation — campo de input/textarea com slot de icone e modo `chat`.
 *
 * Polimorfico via discriminated union: `multiline: false` -> `<input>`, `multiline: true`
 * -> `<textarea>`, com tipagem nativa correta em cada caso. O `mode="chat"` ativa o
 * layout vertical (input + actions empilhados) e altera a variant do `Highlight` para
 * `input-chat` (raio maior, sem fundo opaco). Hover/focus delegados ao `Highlight`.
 */

import { forwardRef, useState } from "react";
import type {
  ReactNode,
  Ref,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { TOKENS } from "@/garden/tokens";
import Highlight from "@/garden/foundations/interaction/Highlight";

type InputSize = "sm" | "md" | "lg";
type InputMode = "default" | "chat";

const INPUT_SIZE_MAP: Record<InputSize, { height: string; fontSize: string; paddingLeft: string; iconBox: string }> = {
  sm: {
    height: TOKENS.size[28],
    fontSize: TOKENS.typography.size[12],
    paddingLeft: TOKENS.spacing[28],
    iconBox: TOKENS.size[14],
  },
  md: {
    height: TOKENS.size[32],
    fontSize: TOKENS.typography.size[14],
    paddingLeft: TOKENS.spacing[32],
    iconBox: TOKENS.size[16],
  },
  lg: {
    height: TOKENS.size[40],
    fontSize: TOKENS.typography.size[16],
    paddingLeft: TOKENS.spacing[40],
    iconBox: TOKENS.size[18],
  },
};

type BaseProps = {
  placeholder?: string;
  icon?: ReactNode;
  size?: InputSize;
  mode?: InputMode;
  actions?: ReactNode;
};

type InputProps =
  | (BaseProps &
      Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
        multiline?: false;
      })
  | (BaseProps &
      TextareaHTMLAttributes<HTMLTextAreaElement> & {
      multiline: true;
    });

const Input = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps
>(
  (
    {
      placeholder,
      icon,
      size = "sm",
      multiline = false,
      mode = "default",
      actions,
      style = {},
      ...props
    },
    ref
  ) => {
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);

    const isChat = mode === "chat";
    const hasActions = isChat && !!actions;

    const s = INPUT_SIZE_MAP[size];

    const highlightVariant = isChat ? "input-chat" : "input";

    const baseTextStyle = {
      fontSize: s.fontSize,
      fontFamily: TOKENS.typography.family.sans,
      fontWeight: TOKENS.typography.weight[400],
      color: TOKENS.color.content.primary,
      caretColor: TOKENS.color.brand.primary,
    };

    return (
      <Highlight
        variant={highlightVariant}
        hovered={hovered}
        focused={focused}
        style={{
          position: "relative",
          width: "100%",
          height: hasActions ? "auto" : multiline ? "auto" : s.height,
          display: "flex",
          flexDirection: hasActions ? "column" : "row",
          alignItems: hasActions
            ? "stretch"
            : multiline
            ? "flex-start"
            : "center",
          borderRadius: TOKENS.radius[isChat ? 10 : 6],
          padding: hasActions
            ? `${TOKENS.spacing[10]} ${TOKENS.spacing[12]}`
            : 0,
          gap: hasActions ? TOKENS.spacing[8] : 0,
          ...style,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {icon && (
          <div
            style={{
              position: "absolute",
              left: TOKENS.spacing[10],
              top: multiline ? TOKENS.spacing[10] : "50%",
              transform: multiline ? "none" : "translateY(-50%)",
              width: s.iconBox,
              height: s.iconBox,
              color:
                focused || hovered
                  ? TOKENS.color.brand.primary
                  : TOKENS.color.content.subtle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {icon}
          </div>
        )}

        {multiline ? (
          <textarea
            ref={ref as Ref<HTMLTextAreaElement>}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: "100%",
              minHeight: TOKENS.size[48],
              resize: "none",

              paddingLeft: hasActions
                ? 0
                : icon
                ? s.paddingLeft
                : TOKENS.spacing[12],

              paddingRight: hasActions ? 0 : TOKENS.spacing[12],
              paddingTop: hasActions ? 0 : TOKENS.spacing[10],
              paddingBottom: hasActions ? 0 : TOKENS.spacing[10],

              background: "transparent",
              border: "none",
              outline: "none",

              lineHeight: TOKENS.typography.lineHeight[1.4],

              ...baseTextStyle,
            }}
            {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            ref={ref as Ref<HTMLInputElement>}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: "100%",
              height: "100%",

              paddingLeft: icon
                ? s.paddingLeft
                : TOKENS.spacing[12],

              paddingRight: TOKENS.spacing[12],

              background: "transparent",
              border: "none",
              outline: "none",

              ...baseTextStyle,
            }}
            {...(props as InputHTMLAttributes<HTMLInputElement>)}
          />
        )}

        {hasActions && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: TOKENS.spacing[12],
              width: "100%",
            }}
          >
            {actions}
          </div>
        )}
      </Highlight>
    );
  }
);

export default Input;