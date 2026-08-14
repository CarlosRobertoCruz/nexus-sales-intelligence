/**
 * Foundation — cartão de métrica interativo com indicador de estado (dot).
 *
 * Três estados:
 * - Default: flat, dot apagado.
 * - Hover: levanta levemente (translateY + sombra).
 * - Active: dot acende em brand.primary — apenas quando `onPress` está presente.
 *
 * Sem `onPress`, o cartão é hoverable mas não clicável (dot permanece apagado).
 */

import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import Card from "@/garden/foundations/interaction/Card";
import Text from "@/garden/foundations/display/Text";
import { TOKENS } from "@/garden/tokens";

export interface SummaryCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: string;
  value: string | number;
  description: string;
  active?: boolean;
  onPress?: () => void;
}

const SummaryCard = forwardRef<HTMLDivElement, SummaryCardProps>(
  ({ label, value, description, active = false, onPress, style = {}, ...props }, ref) => {
    const isDotLit = active && !!onPress;

    return (
      <Card
        ref={ref}
        variant="metric"
        active={active}
        onPress={onPress}
        hoverable={!onPress}
        paddingY={TOKENS.spacing[16]}
        paddingX={TOKENS.spacing[16]}
        style={{ gap: TOKENS.spacing[6], ...style }}
        {...props}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Text
            size="xs"
            weight={700}
            style={{
              textTransform: "uppercase",
              letterSpacing: TOKENS.typography.letterSpacing.eyebrow,
              color: isDotLit ? TOKENS.color.brand.primary : TOKENS.color.content.muted,
              transition: `color ${TOKENS.motion.duration[180]}`,
            }}
          >
            {label}
          </Text>
          <span
            style={{
              width: TOKENS.size[8],
              height: TOKENS.size[8],
              borderRadius: TOKENS.radius.full,
              background: isDotLit ? TOKENS.color.brand.primary : TOKENS.color.stroke.strong,
              flexShrink: 0,
              marginTop: TOKENS.spacing[2],
              transition: `background ${TOKENS.motion.duration[180]}`,
            }}
          />
        </div>
        <Text size="value-lg" weight={700} tone="primary" lineHeight={1.1}>
          {value}
        </Text>
        <Text size="xs" weight={500} tone="muted" lineHeight={1.3}>
          {description}
        </Text>
      </Card>
    );
  }
);

export default SummaryCard;
