/**
 * Foundation — primitiva interativa universal.
 *
 * Renderiza qualquer elemento (`as` default `div`) com semantica de botao acessivel:
 * `role="button"` + `tabIndex={0}` + handler de Enter/Space quando o tag nao e' nativo
 * de botao. Quando `as="button"`, aplica reset visual transparente por defeito
 * (`appearance="bare"` e explicito mas redundante).
 *
 * Children pode ser um render-prop `({ hovered, disabled }) => ReactNode` para
 * permitir variar o conteudo conforme o estado sem propagar setState ao consumer.
 */

import { forwardRef, useState } from "react";
import type {
  CSSProperties,
  ElementType,
  HTMLAttributes,
  ReactNode,
} from "react";
import Tooltip from "../overlay/Tooltip";

type PressableChildren =
  | ReactNode
  | ((state: { hovered: boolean; disabled: boolean }) => ReactNode);

export interface PressableProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  children?: PressableChildren;
  onPress?: (e: React.MouseEvent | React.KeyboardEvent) => void;
  disabled?: boolean;
  /** Reset nativo de `<button>` (util para gatilhos so com icone/avatar). So aplica com `as="button"`. */
  appearance?: "default" | "bare";
  as?: ElementType;
  /** Repassado ao DOM quando `as="button"` (evita submit acidental em formulários). */
  type?: "button" | "submit" | "reset";
  href?: string;
  target?: string;
  rel?: string;
}

const Pressable = forwardRef<HTMLElement, PressableProps>(
  (
    {
      children,
      onPress,
      disabled = false,
      appearance = "default",
      as = "div",
      type,
      style = {},
      title,
      ...props
    },
    ref
  ) => {
    const [hovered, setHovered] = useState(false);
    const tip = typeof title === "string" && title.trim() ? title : undefined;

    const Component = as as ElementType;
    const isButton = as === "button";
    const bareButtonReset: CSSProperties = isButton && appearance === "bare"
      ? {
          appearance: "none",
          WebkitAppearance: "none",
          margin: 0,
          padding: 0,
          border: "none",
          background: "transparent",
          font: "inherit",
          color: "inherit",
        }
      : {};

    const handleClick = (e: React.MouseEvent) => {
      if (disabled) return;
      onPress?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPress?.(e);
      }
    };

    const node = (
      <Component
        ref={ref}
        role={!isButton ? "button" : undefined}
        tabIndex={!isButton && !disabled ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={!isButton ? handleKeyDown : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isButton ? disabled : undefined}
        type={isButton ? (type ?? "button") : undefined}
        style={{
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          ...bareButtonReset,
          ...style,
        }}
        {...props}
      >
        {typeof children === "function"
          ? children({ hovered, disabled })
          : children}
      </Component>
    );

    // `title` nativo vira o Tooltip do Garden — nunca o amarelinho do browser.
    if (!tip) return node;
    return <Tooltip label={tip}>{node}</Tooltip>;
  }
);

Pressable.displayName = "Pressable";

export default Pressable;
