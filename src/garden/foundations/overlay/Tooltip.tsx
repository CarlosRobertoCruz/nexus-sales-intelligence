/**
 * Foundation — tooltip ancorado ao trigger com `position: fixed` + portal em
 * `document.body` (evita corte por `overflow: hidden` de pais como tabelas).
 *
 * Inverte automaticamente para a esquerda do trigger quando não há espaço
 * visível à direita, e aplica margem mínima à viewport.
 *
 * `FloatingTooltip` reutiliza a mesma "caixa" visual com posicionamento
 * ancorado (ex.: gráficos, preview sob o ponteiro).
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { TOKENS } from "@/garden/tokens";

const OFFSET_X = parseInt(TOKENS.spacing[8], 10);
const MARGIN = 8;

function tooltipBoxStyle(whiteSpace: "nowrap" | "normal"): CSSProperties {
  return {
    position: "fixed",
    background: TOKENS.color.brand.surface,
    color: TOKENS.color.brand.primary,
    border: `1px solid ${TOKENS.color.brand.primary}`,
    paddingTop: TOKENS.spacing[6],
    paddingBottom: TOKENS.spacing[6],
    paddingLeft: TOKENS.spacing[10],
    paddingRight: TOKENS.spacing[10],
    borderRadius: TOKENS.radius[6],
    fontSize: TOKENS.typography.size[12],
    fontWeight: TOKENS.typography.weight[500],
    whiteSpace,
    boxShadow: TOKENS.shadow[3],
    pointerEvents: "none",
    zIndex: TOKENS.zIndex[9999],
  };
}

function computeLeftTop(
  trigger: DOMRect,
  tipWidth: number
): { left: number; top: number } {
  const margin = MARGIN;
  let left = trigger.right + OFFSET_X;
  if (left + tipWidth > window.innerWidth - margin) {
    left = trigger.left - OFFSET_X - tipWidth;
  }
  if (left < margin) {
    left = margin;
  }
  if (left + tipWidth > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - margin - tipWidth);
  }
  const top = trigger.top + trigger.height / 2;
  return { left, top };
}

export function FloatingTooltip({
  open,
  anchorX,
  anchorY,
  children,
  offsetX = OFFSET_X,
  offsetY = 0,
}: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  children: ReactNode;
  offsetX?: number;
  offsetY?: number;
}) {
  if (!open || typeof document === "undefined") {
    return null;
  }
  const tip = (
    <div
      style={{
        ...tooltipBoxStyle("normal"),
        left: anchorX + offsetX,
        top: anchorY + offsetY,
        transform: "translateY(-50%)",
        maxWidth: 280,
      }}
    >
      {children}
    </div>
  );
  const target = document.body;
  return target ? createPortal(tip, target) : null;
}

function Tooltip({ label, children, wrapperStyle }: { label?: string; children?: ReactNode; wrapperStyle?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const labelText = label ?? "";

  const sync = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const measured = tipRef.current?.offsetWidth ?? 0;
    const fallback = Math.min(280, 7 * labelText.length + 28);
    const tipWidth = measured > 0 ? measured : fallback;
    setPos(computeLeftTop(r, tipWidth));
  }, [labelText]);

  useLayoutEffect(() => {
    if (!open) return;
    sync();
    const onReposition = () => sync();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    const el = tipRef.current;
    const ro = el ? new ResizeObserver(() => sync()) : null;
    if (el && ro) {
      ro.observe(el);
    }
    // Reset na limpeza (não no corpo do effect): roda ao fechar ou sempre
    // que uma dependência mudar, antes do próximo `sync()` reposicionar.
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
      ro?.disconnect();
      setPos(null);
    };
  }, [open, label, labelText, sync]);

  return (
    <>
      <div
        ref={triggerRef}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "flex-start",
          width: "fit-content",
          maxWidth: "100%",
          pointerEvents: "auto",
          ...wrapperStyle,
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          setOpen(false);
          setPos(null);
        }}
      >
        {children}
      </div>

      {open && labelText.length > 0
        ? createPortal(
            <div
              ref={tipRef}
              style={{
                ...tooltipBoxStyle("normal"),
                left: pos?.left ?? -9999,
                top: pos?.top ?? 0,
                maxWidth: `min(280px, calc(100vw - ${2 * MARGIN}px))`,
                transform: "translateY(-50%)",
                opacity: pos ? 1 : 0,
                transition: `opacity ${TOKENS.motion.duration[100]} ${TOKENS.motion.easing.standard}`,
              }}
            >
              {label}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export default Tooltip;
