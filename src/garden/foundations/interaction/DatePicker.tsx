/**
 * Foundation — seletor de data com calendário brandado.
 * Trigger espelha o visual do Input (Highlight variant="input").
 * Calendário em pt-BR, semana iniciando no domingo.
 * Cabeçalho com `Select` foundation (mês/ano) para saltos largos e hover brand na lista.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { TOKENS } from "@/garden/tokens";
import Highlight from "./Highlight";
import Icon from "../display/Icon";
import { Select } from "./Select";
import {
  CalendarSearchIcon,
  ChevronRightIcon,
} from "@/garden/foundations/assets/icons/icons";

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const DAYS_SHORT = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

const WEEKEND = new Set([0, 6]);

/** Acima do Overlay/Modal (`TOKENS.zIndex[9999]`) para não ser recortado por `overflow: hidden`. */
const DATE_PICKER_POPUP_Z_INDEX = 10050;
/** Listas mês/ano portadas acima do painel do calendário. */
const DATE_PICKER_SUBLIST_Z_INDEX = DATE_PICKER_POPUP_Z_INDEX + 20;
const POPUP_MIN_WIDTH_PX = 300;
/** Anos atrás / à frente do ano corrente quando `minYear`/`maxYear` não são passados. */
const DEFAULT_YEAR_PAST = 80;
const DEFAULT_YEAR_FUTURE = 10;
const VIEWPORT_MARGIN_PX = 8;
/** Até medir o popup no DOM (calendário + header + “Limpar”). */
const ESTIMATED_POPUP_HEIGHT_PX = 380;

type DatePickerSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<DatePickerSize, {
  height: string;
  fontSize: string;
  paddingLeft: string;
  iconBox: string;
}> = {
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

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: DatePickerSize;
  disabled?: boolean;
  /** `id` do botão que abre o calendário — combinar com `Field labelFor`. */
  id?: string;
  /** Rótulo acessível do trigger quando o rótulo visual está noutro elemento (ex.: grupo com legenda). */
  "aria-label"?: string;
  /** Ano mínimo no seletor (inclusivo). Default: ano atual − 80. */
  minYear?: number;
  /** Ano máximo no seletor (inclusivo). Default: ano atual + 10. */
  maxYear?: number;
}

function parseDateStr(v: string): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toValueStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDisplayStr(v: string): string {
  const d = parseDateStr(v);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function NavButton({
  onClick,
  children,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  children: ReactNode;
  "aria-label": string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: TOKENS.size[28],
        height: TOKENS.size[28],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? TOKENS.color.brand.soft : "transparent",
        border: "none",
        borderRadius: TOKENS.radius[6],
        color: hovered ? TOKENS.color.brand.primary : TOKENS.color.content.muted,
        cursor: "pointer",
        outline: "none",
        transition: `all ${TOKENS.motion.duration[100]} ease`,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function DayCell({
  day,
  isToday,
  isSelected,
  isWeekend,
  onClick,
}: {
  day: number;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  let bg = "transparent";
  let color = isWeekend ? TOKENS.color.feedback.danger : TOKENS.color.content.primary;
  let border = "2px solid transparent";
  let fontWeight: number = TOKENS.typography.weight[400];

  if (isSelected) {
    bg = TOKENS.color.brand.primary;
    color = TOKENS.color.content.inverse;
    fontWeight = TOKENS.typography.weight[600];
    border = `2px solid ${TOKENS.color.brand.primary}`;
  } else if (hovered) {
    bg = TOKENS.color.brand.soft;
    color = TOKENS.color.brand.primary;
  } else if (isToday) {
    border = `2px solid ${TOKENS.color.brand.primary}`;
    color = TOKENS.color.brand.primary;
    fontWeight = TOKENS.typography.weight[600];
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        aspectRatio: "1 / 1",
        background: bg,
        border,
        borderRadius: "50%",
        color,
        fontWeight,
        fontSize: TOKENS.typography.size[13],
        fontFamily: TOKENS.typography.family.sans,
        cursor: "pointer",
        outline: "none",
        transition: `background ${TOKENS.motion.duration[100]} ease, color ${TOKENS.motion.duration[100]} ease`,
      }}
    >
      {day}
    </button>
  );
}

function MonthYearSelects({
  viewMonth,
  viewYear,
  minYear,
  maxYear,
  onMonthChange,
  onYearChange,
}: {
  viewMonth: number;
  viewYear: number;
  minYear: number;
  maxYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}) {
  const yearCount = maxYear - minYear + 1;
  const yearsDesc = Array.from({ length: yearCount }, (_, i) => maxYear - i);

  const monthOptions = MONTHS_PT.map((label, i) => ({ value: String(i), label }));
  const yearOptions = yearsDesc.map((y) => ({ value: String(y), label: String(y) }));
  const yearValue = String(clamp(viewYear, minYear, maxYear));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: TOKENS.spacing[6],
        flex: 1,
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      <div style={{ flex: "1 1 62%", minWidth: 0 }}>
        <Select
          value={String(viewMonth)}
          onChange={(v) => {
            onMonthChange(Number(v));
          }}
          options={monthOptions}
          size="md"
          listboxZIndex={DATE_PICKER_SUBLIST_Z_INDEX}
          markAnchorFlyout
        />
      </div>
      <div style={{ flex: "1 1 38%", minWidth: TOKENS.size[72] }}>
        <Select
          value={yearValue}
          onChange={(v) => {
            onYearChange(Number(v));
          }}
          options={yearOptions}
          size="md"
          listboxZIndex={DATE_PICKER_SUBLIST_Z_INDEX}
          markAnchorFlyout
        />
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  size = "md",
  disabled = false,
  id,
  "aria-label": ariaLabel,
  minYear: minYearProp,
  maxYear: maxYearProp,
}: DatePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentCalendarYear = today.getFullYear();
  const minYear = minYearProp ?? currentCalendarYear - DEFAULT_YEAR_PAST;
  const maxYear = maxYearProp ?? currentCalendarYear + DEFAULT_YEAR_FUTURE;

  const initialDate = parseDateStr(value);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [viewYear, setViewYear] = useState(() =>
    clamp(initialDate?.getFullYear() ?? currentCalendarYear, minYear, maxYear),
  );
  const [viewMonth, setViewMonth] = useState(initialDate?.getMonth() ?? today.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const s = SIZE_MAP[size];

  const updatePopupPosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left;
    if (left + POPUP_MIN_WIDTH_PX > vw - VIEWPORT_MARGIN_PX) {
      left = Math.max(
        VIEWPORT_MARGIN_PX,
        vw - POPUP_MIN_WIDTH_PX - VIEWPORT_MARGIN_PX,
      );
    }

    const measuredH = popupRef.current?.offsetHeight ?? ESTIMATED_POPUP_HEIGHT_PX;
    const gap = 4;
    let top = rect.bottom + gap;
    if (top + measuredH > vh - VIEWPORT_MARGIN_PX) {
      const topIfAbove = rect.top - measuredH - gap;
      if (topIfAbove >= VIEWPORT_MARGIN_PX) {
        top = topIfAbove;
      } else {
        top = Math.max(VIEWPORT_MARGIN_PX, vh - VIEWPORT_MARGIN_PX - measuredH);
      }
    }

    setPopupPos({ top, left });
  }, []);

  // Ajuste de estado durante o render (não em effect): sempre que `value`
  // externo mudar, salta o calendário pro mês/ano dessa data.
  const [trackedValue, setTrackedValue] = useState(value);
  if (value !== trackedValue) {
    setTrackedValue(value);
    const d = parseDateStr(value);
    if (d) {
      setViewYear(clamp(d.getFullYear(), minYear, maxYear));
      setViewMonth(d.getMonth());
    }
  }

  // Mesmo padrão: sempre que os limites de ano mudarem, reclampar o ano em
  // visualização, sem tocar no mês (navegação manual do usuário não deve
  // ser descartada só porque os limites mudaram).
  const [trackedMinYear, setTrackedMinYear] = useState(minYear);
  const [trackedMaxYear, setTrackedMaxYear] = useState(maxYear);
  if (minYear !== trackedMinYear || maxYear !== trackedMaxYear) {
    setTrackedMinYear(minYear);
    setTrackedMaxYear(maxYear);
    setViewYear((y) => clamp(y, minYear, maxYear));
  }

  useLayoutEffect(() => {
    if (!open) return;
    const run = () => {
      updatePopupPosition();
    };
    run();
    const raf = requestAnimationFrame(() => {
      run();
    });
    window.addEventListener("scroll", run, true);
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", run, true);
      window.removeEventListener("resize", run);
    };
  }, [open, updatePopupPosition, viewMonth, viewYear]);

  useEffect(() => {
    if (!open) return;
    function onOutsideDown(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Element)) {
        setOpen(false);
        return;
      }
      if (containerRef.current?.contains(t)) return;
      if (popupRef.current?.contains(t)) return;
      if (t.closest("[data-anchor-flyout]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideDown);
    return () => document.removeEventListener("mousedown", onOutsideDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const prevMonth = useCallback(() => {
    if (viewMonth > 0) {
      setViewMonth(viewMonth - 1);
    } else if (viewYear > minYear) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    }
  }, [viewMonth, viewYear, minYear]);

  const nextMonth = useCallback(() => {
    if (viewMonth < 11) {
      setViewMonth(viewMonth + 1);
    } else if (viewYear < maxYear) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    }
  }, [viewMonth, viewYear, maxYear]);
  function selectDay(day: number) {
    onChange(toValueStr(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }

  const selectedDate = parseDateStr(value);
  const cells = buildGrid(viewYear, viewMonth);
  const displayValue = toDisplayStr(value);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <Highlight
        variant="input"
        hovered={hovered}
        focused={open}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          height: s.height,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Calendar icon */}
        <div
          style={{
            position: "absolute",
            left: TOKENS.spacing[10],
            top: "50%",
            transform: "translateY(-50%)",
            width: s.iconBox,
            height: s.iconBox,
            color: open ? TOKENS.color.brand.primary : TOKENS.color.content.subtle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Icon size="sm" color="inherit">
            <CalendarSearchIcon />
          </Icon>
        </div>

        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => !disabled && setOpen((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            height: "100%",
            paddingLeft: s.paddingLeft,
            paddingRight: TOKENS.spacing[12],
            background: "transparent",
            border: "none",
            outline: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: s.fontSize,
            fontFamily: TOKENS.typography.family.sans,
            color: displayValue ? TOKENS.color.content.primary : TOKENS.color.content.subtle,
            textAlign: "left",
          }}
        >
          {displayValue || placeholder}
        </button>
      </Highlight>

      {open
        && typeof document !== "undefined"
        && createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label="Seleção de data"
            style={{
              position: "fixed",
              top: popupPos.top,
              left: popupPos.left,
              zIndex: DATE_PICKER_POPUP_Z_INDEX,
              background: TOKENS.color.surface.base,
              border: `1px solid ${TOKENS.color.brand.primary}`,
              borderRadius: TOKENS.radius[8],
              boxShadow: TOKENS.shadow[3],
              padding: `${TOKENS.spacing[12]} ${TOKENS.spacing[12]} ${TOKENS.spacing[8]}`,
              minWidth: `${POPUP_MIN_WIDTH_PX}px`,
              maxHeight: `calc(100vh - ${VIEWPORT_MARGIN_PX * 2}px)`,
              overflowY: "auto",
              boxSizing: "border-box",
              userSelect: "none",
            }}
          >
            {/* Month navigation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: TOKENS.spacing[4],
                marginBottom: TOKENS.spacing[10],
              }}
            >
              <NavButton onClick={prevMonth} aria-label="Mês anterior">
                <Icon size="sm" color="inherit" style={{ transform: "rotate(180deg)" }}>
                  <ChevronRightIcon />
                </Icon>
              </NavButton>

              <MonthYearSelects
                viewMonth={viewMonth}
                viewYear={viewYear}
                minYear={minYear}
                maxYear={maxYear}
                onMonthChange={setViewMonth}
                onYearChange={setViewYear}
              />

              <NavButton onClick={nextMonth} aria-label="Próximo mês">
                <Icon size="sm" color="inherit">
                  <ChevronRightIcon />
                </Icon>
              </NavButton>
            </div>

            {/* Day of week headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                marginBottom: TOKENS.spacing[4],
              }}
            >
              {DAYS_SHORT.map((label, i) => (
                <div
                  key={label}
                  style={{
                    textAlign: "center",
                    fontSize: TOKENS.typography.size[11],
                    fontFamily: TOKENS.typography.family.sans,
                    fontWeight: TOKENS.typography.weight[600],
                    color: WEEKEND.has(i)
                      ? TOKENS.color.feedback.danger
                      : TOKENS.color.content.muted,
                    padding: `${TOKENS.spacing[4]} 0`,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: TOKENS.spacing[2],
              }}
            >
              {cells.map((day, idx) => {
                if (day === null) return <div key={idx} />;
                const colIdx = idx % 7;
                const cellDate = new Date(viewYear, viewMonth, day);
                cellDate.setHours(0, 0, 0, 0);
                return (
                  <DayCell
                    key={idx}
                    day={day}
                    isToday={cellDate.getTime() === today.getTime()}
                    isSelected={
                      selectedDate !== null &&
                      cellDate.getTime() === selectedDate.getTime()
                    }
                    isWeekend={WEEKEND.has(colIdx)}
                    onClick={() => selectDay(day)}
                  />
                );
              })}
            </div>

            {/* Clear */}
            <div
              style={{
                marginTop: TOKENS.spacing[8],
                paddingTop: TOKENS.spacing[8],
                borderTop: `1px solid ${TOKENS.color.stroke.subtle}`,
              }}
            >
              <ClearButton
                disabled={!value}
                onClick={() => { onChange(""); setOpen(false); }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ClearButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        width: "100%",
        padding: `${TOKENS.spacing[6]} 0`,
        background: "transparent",
        border: `1px solid ${
          disabled
            ? TOKENS.color.stroke.subtle
            : hovered
            ? TOKENS.color.brand.primary
            : TOKENS.color.stroke.default
        }`,
        borderRadius: TOKENS.radius[6],
        color: disabled
          ? TOKENS.color.content.subtle
          : hovered
          ? TOKENS.color.brand.primary
          : TOKENS.color.content.secondary,
        fontSize: TOKENS.typography.size[12],
        fontFamily: TOKENS.typography.family.sans,
        fontWeight: TOKENS.typography.weight[500],
        cursor: disabled ? "not-allowed" : "pointer",
        outline: "none",
        transition: `all ${TOKENS.motion.duration[100]} ease`,
      }}
    >
      Limpar
    </button>
  );
}
