import { useMemo, useState } from "react";

import { Icon, Pressable, Row, Stack, Text } from "@/garden/foundations";
import { Button } from "@/garden/foundations";
import { ArrowLeftIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";
import {
  buildCalendarMonthGrid,
  parseCalendarIsoDate,
  startOfCalendarMonth,
  toCalendarIsoDate,
} from "@/garden/utils/date/calendarGrid";

const WEEKDAY_LABELS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sab."];

interface CalendarDateRangePickerProps {
  startDate: string;
  endDate: string;
  onDraftChange?: (next: { startDate: string; endDate: string }) => void;
  onApply: (next: { startDate: string; endDate: string }) => void;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBetween(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const t = day.getTime();
  return t > start.getTime() && t < end.getTime();
}

export function CalendarDateRangePicker({
  startDate,
  endDate,
  onDraftChange,
  onApply,
}: CalendarDateRangePickerProps) {
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftEndDate, setDraftEndDate] = useState(endDate);

  // Ajuste de estado durante o render: sempre que o range externo mudar,
  // reseta o draft local pra acompanhar.
  const [trackedStartDate, setTrackedStartDate] = useState(startDate);
  const [trackedEndDate, setTrackedEndDate] = useState(endDate);
  if (startDate !== trackedStartDate || endDate !== trackedEndDate) {
    setTrackedStartDate(startDate);
    setTrackedEndDate(endDate);
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
  }

  function publishDraft(nextStartDate: string, nextEndDate: string) {
    onDraftChange?.({ startDate: nextStartDate, endDate: nextEndDate });
  }

  const start = parseCalendarIsoDate(draftStartDate);
  const end = parseCalendarIsoDate(draftEndDate);
  const [monthCursor, setMonthCursor] = useState(() =>
    startOfCalendarMonth(start ?? new Date())
  );

  const monthGrid = useMemo(() => buildCalendarMonthGrid(monthCursor), [monthCursor]);
  const monthLabel = monthCursor.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth = (day: Date) => day.getMonth() === monthCursor.getMonth();

  function handleDateClick(day: Date) {
    const clicked = toCalendarIsoDate(day);
    if (!start || !end || !isSameDay(start, end)) {
      setDraftStartDate(clicked);
      setDraftEndDate(clicked);
      publishDraft(clicked, clicked);
      return;
    }

    const startTime = start.getTime();
    const clickedTime = day.getTime();
    if (clickedTime < startTime) {
      setDraftStartDate(clicked);
      setDraftEndDate(draftStartDate);
      publishDraft(clicked, draftStartDate);
      return;
    }

    setDraftStartDate(draftStartDate);
    setDraftEndDate(clicked);
    publishDraft(draftStartDate, clicked);
  }

  return (
    <Stack
      gap={TOKENS.spacing[10]}
      style={{
        padding: TOKENS.spacing[12],
        borderRadius: TOKENS.radius[12],
        border: `1px solid ${TOKENS.color.stroke.subtle}`,
        background: TOKENS.color.surface.base,
        boxShadow: TOKENS.shadow[2],
      }}
    >
      <Row align="center" justify="space-between">
        <Pressable
          as="button"
          appearance="bare"
          onPress={() =>
            setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
          }
          style={{
            borderRadius: TOKENS.radius[8],
            padding: TOKENS.spacing[6],
            color: TOKENS.color.content.primary,
          }}
          aria-label="Mês anterior"
        >
          <ArrowLeftIcon style={{ width: 16, height: 16 }} />
        </Pressable>

        <Text size="sm" weight={600} tone="primary" style={{ textTransform: "capitalize" }}>
          {monthLabel}
        </Text>

        <Pressable
          as="button"
          appearance="bare"
          onPress={() =>
            setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
          }
          style={{
            borderRadius: TOKENS.radius[8],
            padding: TOKENS.spacing[6],
            color: TOKENS.color.content.primary,
          }}
          aria-label="Próximo mês"
        >
          <Icon style={{ transform: "rotate(180deg)" }}>
            <ArrowLeftIcon style={{ width: 16, height: 16 }} />
          </Icon>
        </Pressable>
      </Row>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: TOKENS.spacing[6],
        }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <Text
            key={label}
            size="xs"
            tone="subtle"
            style={{ textAlign: "center", textTransform: "lowercase" }}
          >
            {label}
          </Text>
        ))}

        {monthGrid.map((day) => {
          const isStart = isSameDay(start, day);
          const isEnd = isSameDay(end, day);
          const inRange = isBetween(day, start, end);
          const inMonth = isCurrentMonth(day);
          const selectedEdge = isStart || isEnd;

          return (
            <Pressable
              key={toCalendarIsoDate(day)}
              as="button"
              appearance="bare"
              onPress={() => handleDateClick(day)}
              style={{
                height: TOKENS.size[34],
                borderRadius: TOKENS.radius.full,
                border: `1px solid ${
                  selectedEdge
                    ? TOKENS.color.brand.primary
                    : inRange
                      ? TOKENS.color.brand.soft
                      : "transparent"
                }`,
                background: selectedEdge
                  ? TOKENS.color.brand.primary
                  : inRange
                    ? TOKENS.color.brand.soft
                    : "transparent",
                color: selectedEdge
                  ? TOKENS.color.content.inverse
                  : inMonth
                    ? TOKENS.color.content.primary
                    : TOKENS.color.content.subtle,
                display: "grid",
                placeItems: "center",
                fontSize: TOKENS.typography.size[14],
                lineHeight: 1,
                fontWeight: selectedEdge
                  ? TOKENS.typography.weight[600]
                  : TOKENS.typography.weight[500],
              }}
              aria-label={`Selecionar ${day.toLocaleDateString("pt-BR")}`}
            >
              {day.getDate()}
            </Pressable>
          );
        })}
      </div>

      <Row justify="space-between" align="center">
        <Button
          variant="soft"
          size="sm"
          radius="control"
          onPress={() => {
            setDraftStartDate(startDate);
            setDraftEndDate(endDate);
            publishDraft(startDate, endDate);
          }}
          style={{
            background: TOKENS.color.brand.soft,
            color: TOKENS.color.brand.primary,
          }}
        >
          Redefinir
        </Button>

        <Button
          variant="primary"
          size="sm"
          radius="control"
          onPress={() => onApply({ startDate: draftStartDate, endDate: draftEndDate })}
        >
          Aplicar
        </Button>
      </Row>
    </Stack>
  );
}
