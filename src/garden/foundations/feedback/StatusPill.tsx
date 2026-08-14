/**
 * Foundation — pill de status com borda + glow inset e StatusDot.
 * Domain-blind: consumer passa `label` e `tone` (sem saber de online/offline).
 */
import { TOKENS } from "@/garden/tokens";
import StatusDot from "./StatusDot";
import Row from "../layout/Row";
import Text from "../display/Text";
import { insetGlowShadow } from "../effects/insetGlow";

export type StatusPillTone = "success" | "danger" | "warning" | "attention" | "info" | "brand";

export interface StatusPillProps {
  label: string;
  tone?: StatusPillTone;
}

const TONE_COLOR: Record<StatusPillTone, string> = {
  success: TOKENS.color.feedback.success,
  danger: TOKENS.color.feedback.danger,
  warning: TOKENS.color.feedback.warning,
  attention: TOKENS.color.feedback.attention,
  info: TOKENS.color.feedback.info,
  brand: TOKENS.color.brand.primary,
};

export function StatusPill({ label, tone = "brand" }: StatusPillProps) {
  const color = TONE_COLOR[tone];

  return (
    <Row
      align="center"
      gap={TOKENS.spacing[4]}
      style={{
        padding: `${TOKENS.spacing[1]} ${TOKENS.spacing[6]}`,
        borderRadius: TOKENS.radius.full,
        border: `1.5px solid ${color}`,
        boxShadow: insetGlowShadow(color, "strong"),
      }}
    >
      <StatusDot size="sm" color={color} />
      <Text
        size="xs"
        weight={600}
        style={{ color, textTransform: "uppercase", fontSize: 10, letterSpacing: "normal" }}
      >
        {label}
      </Text>
    </Row>
  );
}
