import type { CSSProperties, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import { EyebrowSectionTitle, Row, Stack, Text } from "@/garden/foundations";

interface SectionHeaderProps {
  title: string;
  /** `id` do título (ex.: `aria-labelledby` de gráfico). */
  titleId?: string;
  description?: string;
  trailing?: ReactNode;
  style?: CSSProperties;
}

export function SectionHeader({ title, titleId, description, trailing, style }: SectionHeaderProps) {
  return (
    <Row align="flex-start" justify="space-between" style={{ gap: TOKENS.spacing[12], ...style }}>
      <Stack style={{ gap: TOKENS.spacing[2], minWidth: 0 }}>
        <EyebrowSectionTitle id={titleId}>{title}</EyebrowSectionTitle>
        {description ? (
          <Text size="xs" tone="muted">{description}</Text>
        ) : null}
      </Stack>
      {trailing ? (
        <div style={{ flexShrink: 0 }}>{trailing}</div>
      ) : null}
    </Row>
  );
}
