import type { CSSProperties, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import { ChevronDownIcon, ChevronUpIcon } from "@/garden/foundations/assets/icons/icons";
import Icon from "./Icon";
import Highlight from "../interaction/Highlight";
import Row from "../layout/Row";
import Stack from "../layout/Stack";
import Text from "./Text";

type KpiCardIconSize = "sm" | "md" | "lg";

const KPI_CARD_ICON_SIZE_MAP: Record<KpiCardIconSize, string> = {
  sm: TOKENS.size[40],
  md: TOKENS.size[48],
  lg: TOKENS.size[56],
};

export interface KpiCardProps {
  leading?: ReactNode;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  label: string;
  value: string | number;
  subLabel?: string;
  subLabelColor?: string;
  labelColor?: string;
  valueColor?: string;
  dividerColor?: string;
  inlineSubLabel?: boolean;
  subLabelTrend?: "up" | "down" | "neutral";
  extra?: ReactNode;
  trailing?: ReactNode;
  labelVariant?: "default" | "eyebrow";
  segmentedLeading?: boolean;
  iconSize?: KpiCardIconSize;
  hoverable?: boolean;
  style?: CSSProperties;
}

export function KpiCard({
  leading,
  icon,
  iconBg,
  iconColor,
  label,
  value,
  subLabel,
  subLabelColor,
  labelColor,
  valueColor,
  dividerColor,
  inlineSubLabel = false,
  subLabelTrend = "neutral",
  extra,
  trailing,
  labelVariant = "eyebrow",
  segmentedLeading = false,
  iconSize = "md",
  hoverable = true,
  style,
}: KpiCardProps) {
  const useLeading = leading != null;
  const hasTrailing = trailing != null;
  const useSegmented = Boolean(segmentedLeading && useLeading);
  const resolvedIconSize = KPI_CARD_ICON_SIZE_MAP[iconSize];
  const eyebrowOneLineWithTrailing =
    labelVariant === "eyebrow" && hasTrailing && !useSegmented;

  const labelNode = (
    <Text
      size="xs"
      weight={labelVariant === "eyebrow" ? 700 : 500}
      tone={labelVariant === "eyebrow" ? null : "muted"}
      block
      truncate={false}
      style={
        labelVariant === "eyebrow"
          ? {
              lineHeight: 1.3,
              color: labelColor ?? TOKENS.color.content.muted,
              textTransform: "uppercase",
              letterSpacing: TOKENS.typography.letterSpacing.eyebrow,
              ...(eyebrowOneLineWithTrailing
                ? { whiteSpace: "nowrap" }
                : {
                    minWidth: 0,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }),
            }
          : { lineHeight: 1.3 }
      }
    >
      {label}
    </Text>
  );

  const deltaColor = subLabelColor ?? TOKENS.color.content.muted;

  const valueAndMeta =
    inlineSubLabel && subLabel !== undefined ? (
      <>
        <Row align="baseline" gap={TOKENS.spacing[8]} style={{ minWidth: 0, flexWrap: "wrap" }}>
          <Text size="value" weight={700} tone={valueColor ? null : "primary"} lineHeight={1.1} style={valueColor ? { color: valueColor } : undefined}>
            {value}
          </Text>
          <Row align="center" gap={TOKENS.spacing[4]}>
            {subLabelTrend === "up" ? (
              <Icon size="xs" color={deltaColor} style={{ flexShrink: 0 }}>
                <ChevronUpIcon />
              </Icon>
            ) : subLabelTrend === "down" ? (
              <Icon size="xs" color={deltaColor} style={{ flexShrink: 0 }}>
                <ChevronDownIcon />
              </Icon>
            ) : (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: TOKENS.size[12],
                  height: TOKENS.spacing[2],
                  borderRadius: TOKENS.radius[2],
                  background: deltaColor,
                  flexShrink: 0,
                }}
              />
            )}
            <Text size="xs" weight={600} tone={null} style={{ color: deltaColor, lineHeight: 1.2 }}>
              ({subLabel})
            </Text>
          </Row>
        </Row>
        {extra}
      </>
    ) : (
      <>
        <Text size="value" weight={700} tone={valueColor ? null : "primary"} block lineHeight={1.1} style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </Text>
        {subLabel !== undefined && (
          <Text
            size="xs"
            weight={500}
            tone={subLabelColor ? null : "muted"}
            block
            style={{ lineHeight: 1.3, ...(subLabelColor ? { color: subLabelColor } : {}) }}
          >
            {subLabel}
          </Text>
        )}
        {extra}
      </>
    );

  const iconBlock = (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: resolvedIconSize,
        height: resolvedIconSize,
        borderRadius: TOKENS.radius[10],
        background: iconBg ?? TOKENS.color.brand.soft,
        flexShrink: 0,
      }}
    >
      <Icon size="xl" color={iconColor ?? TOKENS.color.brand.primary}>
        {icon}
      </Icon>
    </span>
  );

  const textStack = (
    <Stack
      style={{
        gap: hasTrailing && !useSegmented ? TOKENS.spacing[6] : TOKENS.spacing[4],
        ...(eyebrowOneLineWithTrailing
          ? { flex: "1 1 auto" }
          : {
              minWidth: 0,
              flex: hasTrailing && !useSegmented ? "1 1 0" : 1,
            }),
      }}
    >
      {labelNode}
      {valueAndMeta}
    </Stack>
  );

  return (
    <Highlight
      variant="metric"
      hovered={hoverable ? undefined : false}
      style={{
        flex: `1 1 ${TOKENS.size[200]}`,
        minWidth: hasTrailing && !useSegmented ? TOKENS.size[238] : TOKENS.size[200],
        maxWidth: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: TOKENS.spacing[16],
        padding: `${TOKENS.spacing[18]} ${TOKENS.spacing[20]}`,
        ...style,
      }}
    >
      {useSegmented ? (
        <>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{leading}</div>
          <div
            aria-hidden
            style={{
              width: TOKENS.spacing[1],
              alignSelf: "stretch",
              minHeight: TOKENS.size[56],
              background: dividerColor ?? TOKENS.color.stroke.subtle,
              flexShrink: 0,
            }}
          />
          <Stack style={{ gap: TOKENS.spacing[6], minWidth: 0, flex: 1 }}>
            {labelNode}
            {valueAndMeta}
          </Stack>
        </>
      ) : (
        <>
          {useLeading ? (
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{leading}</div>
          ) : (
            iconBlock
          )}
          {textStack}
          {hasTrailing && (
            <Row align="center" justify="flex-end" style={{ flex: "0 0 auto", minHeight: 0 }}>
              {trailing}
            </Row>
          )}
        </>
      )}
    </Highlight>
  );
}
