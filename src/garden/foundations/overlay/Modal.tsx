/**
 * Foundation — modal padrao com header brand-colored, body branco e footer opcional.
 *
 * Renderizado em cima de `Overlay` (zIndex 9999), com `aria-modal` + `aria-label`
 * (deriva do `title` se nao explicito). `closeOnOverlay` deixa o usuario fechar
 * clicando no backdrop; `showClose` controla o `IconAction` no canto superior direito.
 *
 * Width default `624` (com `min(100%, ...)`); maxHeight `80vh`. `headerStyle`/`footerStyle`
 * sobrescrevem padding do header/footer. Sem `open`, devolve
 * `null` (nao monta nada — comportamento controlado pelo consumer).
 */

import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import Overlay from "./Overlay";
import Row from "../layout/Row";
import Text from "../display/Text";
import IconAction from "@/garden/foundations/display/IconAction";
import { CloseIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";

interface ModalProps {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  width?: number | string;
  maxHeight?: string;
  ariaLabel?: string;
  closeOnOverlay?: boolean;
  showClose?: boolean;
  bodyPadding?: string;
  style?: CSSProperties;
  headerStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  footerStyle?: CSSProperties;
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open = false,
      onClose,

      title,
      subtitle = null,
      footer = null,
      children,

      width = 624,
      maxHeight = "80vh",
      ariaLabel,
      closeOnOverlay = true,
      showClose = true,

      bodyPadding = `${TOKENS.spacing[16]} ${TOKENS.spacing[24]}`,
      style = {},
      headerStyle = {},
      bodyStyle = {},
      footerStyle = {},
    },
    ref
  ) => {
    if (!open) return null;

    const resolvedWidth =
      typeof width === "number" ? `${width}px` : width;

    return (
      <Overlay
        onBackdropPress={
          closeOnOverlay ? () => onClose?.() : undefined
        }
        style={{
          zIndex: TOKENS.zIndex[9999],
        }}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={typeof ariaLabel === "string" ? ariaLabel : typeof title === "string" ? title : "Modal"}
          onClick={(event) => event.stopPropagation()}
          style={{
            pointerEvents: "auto",
            width: `min(100%, ${resolvedWidth})`,
            maxHeight,
            background: TOKENS.color.brand.primary,
            borderRadius: TOKENS.radius[18],
            boxShadow: TOKENS.shadow[4],
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            ...style,
          }}
        >
          {(title || showClose) && (
            <Row
              align="center"
              justify="space-between"
              style={{
                padding: `${TOKENS.spacing[18]} ${TOKENS.spacing[24]}`,
                background: TOKENS.color.brand.primary,
                flexShrink: 0,
                ...headerStyle,
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: TOKENS.spacing[4],
                }}
              >
                {title && (
                  <Text
                    size="md"
                    weight={600}
                    tone={null}
                    style={{
                      color: TOKENS.color.content.inverse,
                    }}
                  >
                    {title}
                  </Text>
                )}

                {subtitle && (
                  <Text
                    size="sm"
                    tone={null}
                    style={{
                      color: TOKENS.color.content.inverse,
                      opacity: 0.8,
                    }}
                  >
                    {subtitle}
                  </Text>
                )}
              </div>

              {showClose && (
                <IconAction
                  variant="plain"
                  size="xs"
                  onPress={onClose}
                  style={{
                    color: TOKENS.color.content.inverse,
                    flexShrink: 0,
                  }}
                >
                  <CloseIcon />
                </IconAction>
              )}
            </Row>
          )}

          <div
            style={{
              background: TOKENS.color.surface.base,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                padding: bodyPadding,
                minHeight: 0,
                minWidth: 0,
                ...bodyStyle,
              }}
            >
              {children}
            </div>

            {footer && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                  gap: TOKENS.spacing[10],
                  width: "100%",
                  minWidth: 0,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  padding: `${TOKENS.spacing[16]} ${TOKENS.spacing[24]}`,
                  borderTop: `1px solid ${TOKENS.color.stroke.subtle}`,
                  flexShrink: 0,
                  ...footerStyle,
                }}
              >
                {footer}
              </div>
            )}
          </div>
        </div>
      </Overlay>
    );
  }
);

export default Modal;
