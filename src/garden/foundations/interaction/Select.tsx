import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { TOKENS } from "@/garden/tokens";
import type { SelectOption } from "@/garden/types/selectOption";
import Highlight from "./Highlight";
import Icon from "../display/Icon";
import { ChevronDownIcon } from "@/garden/foundations/assets/icons/icons";

export type { SelectOption };

type SelectSize = "sm" | "md" | "lg";
type SelectWeight = keyof typeof TOKENS.typography.weight;

interface SelectProps {
  /** `id` do trigger (combo); usar com `Field labelFor` para associar o rótulo ao controlo. */
  id?: string;
  /** Rótulo acessível do combobox quando não há rótulo visível (ex.: toolbar). */
  "aria-label"?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  size?: SelectSize;
  weight?: SelectWeight;
  startIcon?: ReactNode;
  disabled?: boolean;
  placeholder?: string;
  /** z-index da lista portada (ex.: `DatePicker` usa valor acima do popup do calendário). */
  listboxZIndex?: number;
  /** Marca a lista com `data-anchor-flyout` para popups pais (ex.: DatePicker) não tratarem clique fora como dismiss. */
  markAnchorFlyout?: boolean;
}

/** Acima de overlays comuns; abaixo do `DatePicker` portado (`10050`) para calendário sobrepor selects. */
const SELECT_LISTBOX_Z_INDEX = 10040;

const SIZE_MAP: Record<
  SelectSize,
  {
    height: string;
    fontSize: string;
    paddingX: string;
    gap: string;
    lineHeight: string;
    chevronSize: "xs" | "sm" | "md";
  }
> = {
  /** Compacto (footer de tabela / paginação): menor altura/caixa lateral; texto legível como `md` pequeno. */
  sm: {
    height: TOKENS.size[24],
    fontSize: TOKENS.typography.size[12],
    paddingX: TOKENS.spacing[4],
    gap: TOKENS.spacing[4],
    lineHeight: TOKENS.typography.lineHeight[1],
    chevronSize: "xs",
  },
  md: {
    height: TOKENS.size[32],
    fontSize: TOKENS.typography.size[14],
    paddingX: TOKENS.spacing[10],
    gap: TOKENS.spacing[8],
    lineHeight: TOKENS.typography.lineHeight[1.2],
    chevronSize: "sm",
  },
  lg: {
    height: TOKENS.size[40],
    fontSize: TOKENS.typography.size[16],
    paddingX: TOKENS.spacing[12],
    gap: TOKENS.spacing[8],
    lineHeight: TOKENS.typography.lineHeight[1.2],
    chevronSize: "sm",
  },
};

/** Lista (portal) espelha trigger: `sm` fica compacto (ex.: paginação). */
const OPTION_MENU_PADDING: Record<SelectSize, string> = {
  sm: `${TOKENS.spacing[4]} ${TOKENS.spacing[8]}`,
  md: `${TOKENS.spacing[10]} ${TOKENS.spacing[12]}`,
  lg: `${TOKENS.spacing[10]} ${TOKENS.spacing[14]}`,
};

function OptionItem({
  label,
  selected,
  onSelect,
  fontSize,
  padding,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  fontSize: string;
  padding: string;
}) {
  const [hovered, setHovered] = useState(false);

  let background: string = "transparent";
  let color = TOKENS.color.content.primary;
  let fontWeight = TOKENS.typography.weight[400];

  if (hovered) {
    background = TOKENS.color.brand.soft;
    color = TOKENS.color.brand.primary;
    fontWeight = TOKENS.typography.weight[500];
  } else if (selected) {
    background = TOKENS.color.brand.soft;
    color = TOKENS.color.brand.primary;
    fontWeight = TOKENS.typography.weight[600];
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding,
        cursor: "pointer",
        background,
        color,
        fontWeight,
        fontSize,
        fontFamily: TOKENS.typography.family.sans,
        transition: `background ${TOKENS.motion.duration[100]} ${TOKENS.motion.easing.standard}, color ${TOKENS.motion.duration[100]} ${TOKENS.motion.easing.standard}`,
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
  size = "md",
  weight = 400,
  startIcon,
  disabled,
  placeholder = "Selecionar...",
  listboxZIndex,
  markAnchorFlyout = false,
  "aria-label": ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [listboxPlacement, setListboxPlacement] = useState({ top: 0, left: 0, width: 0 });
  const s = SIZE_MAP[size];
  const fontWeight = TOKENS.typography.weight[weight];

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const updateListboxPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let width = rect.width;
    let left = rect.left;
    if (left + width > vw - margin) {
      left = Math.max(margin, vw - width - margin);
    }
    if (width > vw - 2 * margin) {
      width = Math.max(margin * 4, vw - 2 * margin);
      left = margin;
    }

    const maxListCss = Math.min(vh * 0.6, 320);
    const rowApprox = size === "sm" ? 34 : size === "md" ? 42 : 48;
    let listHeight = Math.min(options.length * rowApprox + 4, maxListCss);
    if (listboxRef.current) {
      listHeight = listboxRef.current.getBoundingClientRect().height;
    }

    const gap = 2;
    const topBelow = rect.bottom + gap;
    const roomBelow = vh - margin - topBelow;
    const roomAbove = rect.top - margin - gap;

    let top = topBelow;
    if (listHeight <= roomBelow) {
      top = topBelow;
    } else if (listHeight <= roomAbove) {
      top = rect.top - listHeight - gap;
    } else if (roomAbove > roomBelow) {
      top = Math.max(margin, rect.top - listHeight - gap);
    } else {
      top = topBelow;
    }

    top = Math.max(margin, Math.min(top, vh - margin - listHeight));

    setListboxPlacement({ top, left, width });
  }, [options.length, size]);

  useLayoutEffect(() => {
    if (!open) return;
    updateListboxPosition();
    const raf = requestAnimationFrame(() => {
      updateListboxPosition();
    });
    window.addEventListener("scroll", updateListboxPosition, true);
    window.addEventListener("resize", updateListboxPosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateListboxPosition, true);
      window.removeEventListener("resize", updateListboxPosition);
    };
  }, [open, updateListboxPosition]);

  useEffect(() => {
    if (!open) return;
    function onOutsideDown(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (listboxRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideDown);
    return () => document.removeEventListener("mousedown", onOutsideDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      e.preventDefault();
      e.stopPropagation();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((p) => !p); }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <Highlight
        variant="input"
        hovered={hovered}
        focused={open}
        style={{
          height: s.height,
          borderRadius: TOKENS.radius[6],
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          onMouseEnter={() => {
            if (!disabled) setHovered(true);
          }}
          onMouseLeave={() => {
            setHovered(false);
          }}
          onClick={() => !disabled && setOpen((p) => !p)}
          onKeyDown={handleKeyDown}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: s.gap,
            width: "100%",
            height: "100%",
            minHeight: 0,
            padding: `0 ${s.paddingX}`,
            margin: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            fontFamily: TOKENS.typography.family.sans,
            fontWeight,
            color: selectedLabel ? TOKENS.color.content.primary : TOKENS.color.content.subtle,
          }}
        >
          {startIcon ? (
            <Icon
              size={s.chevronSize}
              color={open || hovered ? TOKENS.color.brand.primary : TOKENS.color.brand.primary}
              style={{ flexShrink: 0 }}
            >
              {startIcon}
            </Icon>
          ) : null}
          <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedLabel ?? placeholder}
          </span>
          <Icon
            size={s.chevronSize}
            color={open || hovered ? TOKENS.color.brand.primary : TOKENS.color.content.muted}
            style={{ flexShrink: 0 }}
          >
            <ChevronDownIcon />
          </Icon>
        </button>
      </Highlight>

      {open
        && typeof document !== "undefined"
        && createPortal(
          <div
            ref={listboxRef}
            role="listbox"
            data-anchor-flyout={markAnchorFlyout ? "true" : undefined}
            style={{
              position: "fixed",
              top: listboxPlacement.top,
              left: listboxPlacement.left,
              width: listboxPlacement.width,
              minWidth: listboxPlacement.width > 0 ? undefined : 120,
              maxHeight: "min(60vh, 320px)",
              overflowY: "auto",
              background: TOKENS.color.surface.base,
              border: `1px solid ${TOKENS.color.brand.primary}`,
              borderRadius: TOKENS.radius[8],
              boxShadow: TOKENS.shadow[2],
              zIndex: listboxZIndex ?? SELECT_LISTBOX_Z_INDEX,
            }}
          >
            {options.map((opt) => (
              <OptionItem
                key={opt.value}
                label={opt.label}
                selected={opt.value === value}
                onSelect={() => { onChange(opt.value); setOpen(false); }}
                fontSize={s.fontSize}
                padding={OPTION_MENU_PADDING[size]}
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
