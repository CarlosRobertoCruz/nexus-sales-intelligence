import { useMemo, useState } from "react";

import {
  Icon,
  Pressable,
  Row,
  Stack,
  Text,
} from "@/garden/foundations";
import { ArrowLeftIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";
import {
  buildCalendarMonthGrid,
  parseCalendarIsoDate,
  startOfCalendarMonth,
  toCalendarIsoDate,
} from "@/garden/utils/date/calendarGrid";

const WEEKDAY_LABELS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sab."];

interface CalendarDatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  onClear?: () => void;
}

function sameDay(a: Date | null, b: Date) {
  if (!a) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarDatePicker({
  value,
  onChange,
  onClear,
}: CalendarDatePickerProps) {
  const selectedDate = parseCalendarIsoDate(value);
  const [monthCursor, setMonthCursor] = useState(() =>
    startOfCalendarMonth(selectedDate ?? new Date())
  );

  const monthGrid = useMemo(() => buildCalendarMonthGrid(monthCursor), [monthCursor]);
  const monthLabel = monthCursor.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth = (day: Date) => day.getMonth() === monthCursor.getMonth();

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
          const selected = sameDay(selectedDate, day);
          const inMonth = isCurrentMonth(day);
          return (
            <Pressable
              key={toCalendarIsoDate(day)}
              as="button"
              appearance="bare"
              onPress={() => onChange(toCalendarIsoDate(day))}
              style={{
                height: TOKENS.size[34],
                borderRadius: TOKENS.radius.full,
                border: `1px solid ${
                  selected ? TOKENS.color.brand.primary : "transparent"
                }`,
                background: selected ? TOKENS.color.brand.primary : "transparent",
                color: selected
                  ? TOKENS.color.content.inverse
                  : inMonth
                    ? TOKENS.color.content.primary
                    : TOKENS.color.content.subtle,
                display: "grid",
                placeItems: "center",
                fontSize: TOKENS.typography.size[14],
                lineHeight: 1,
              }}
              aria-label={`Selecionar ${day.toLocaleDateString("pt-BR")}`}
            >
              {day.getDate()}
            </Pressable>
          );
        })}
      </div>

      {onClear ? (
        <Row justify="flex-start">
          <Pressable
            as="button"
            appearance="bare"
            onPress={() => onClear()}
            style={{
              border: `1px solid ${TOKENS.color.stroke.default}`,
              borderRadius: TOKENS.radius[8],
              padding: `${TOKENS.spacing[6]} ${TOKENS.spacing[12]}`,
              background: TOKENS.color.surface.base,
            }}
          >
            <Text size="sm" tone="primary">
              Limpar
            </Text>
          </Pressable>
        </Row>
      ) : null}
    </Stack>
  );
}
