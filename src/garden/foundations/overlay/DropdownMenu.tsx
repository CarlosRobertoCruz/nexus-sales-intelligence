import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TOKENS } from "@/garden/tokens";
import Pressable from "@/garden/foundations/interaction/Pressable";

export interface DropdownMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

interface DropdownMenuProps {
  /** Elemento que abre o menu ao ser clicado. */
  trigger: ReactNode;
  items: DropdownMenuItem[];
  disabled?: boolean;
  /** Alinha o menu pela borda direita do trigger (padrão: esquerda). */
  align?: "left" | "right";
}

export function DropdownMenu({ trigger, items, disabled = false, align = "left" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; minWidth: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (disabled) return;
    if (!open) {
      const r = wrapperRef.current?.getBoundingClientRect();
      if (r) {
        setPos({
          top: r.bottom + 4,
          minWidth: Math.max(r.width, 200),
          ...(align === "right" ? { right: window.innerWidth - r.right } : { left: r.left }),
        });
      }
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div ref={wrapperRef} onClick={toggle} style={{ display: "inline-flex" }}>
        {trigger}
      </div>

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: pos.top,
                ...(pos.left !== undefined ? { left: pos.left } : { right: pos.right }),
                minWidth: pos.minWidth,
                background: TOKENS.color.surface.base,
                border: `1px solid ${TOKENS.color.brand.primary}`,
                borderRadius: TOKENS.radius[10],
                boxShadow: `${TOKENS.shadow[2]}, ${TOKENS.shadow.brandSoft}`,
                zIndex: TOKENS.zIndex[9999],
                overflow: "hidden",
                padding: `${TOKENS.spacing[4]} 0`,
              }}
            >
              {items.map((item, i) => (
                <Pressable
                  key={i}
                  as="button"
                  appearance="bare"
                  disabled={item.disabled}
                  onPress={() => {
                    item.onSelect();
                    setOpen(false);
                  }}
                  style={{ width: "100%", textAlign: "left" }}
                >
                  {({ hovered }) => (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: TOKENS.spacing[8],
                        padding: `${TOKENS.spacing[10]} ${TOKENS.spacing[14]}`,
                        background: hovered && !item.disabled ? TOKENS.color.brand.soft : "transparent",
                        transition: `background ${TOKENS.motion.duration[100]} ${TOKENS.motion.easing.standard}`,
                        fontSize: TOKENS.typography.size[13],
                        fontWeight: TOKENS.typography.weight[500],
                        color: item.disabled ? TOKENS.color.content.muted : hovered ? TOKENS.color.brand.primary : TOKENS.color.content.primary,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </div>
                  )}
                </Pressable>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
