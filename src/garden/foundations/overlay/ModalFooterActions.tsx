/**
 * Foundation — rodape padrao de modal: cancelar (soft) + acao primaria.
 * Labels como ReactNode para i18n e estados dinamicos (ex.: texto de saving).
 */

import type { ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import Text from "../display/Text";
import Button from "../interaction/Button";
import Row from "../layout/Row";

type FooterButtonSize = "sm" | "md" | "lg" | "xl";

export interface ModalFooterActionsProps {
  onCancel: () => void;
  onPrimary: () => void;
  cancelLabel: ReactNode;
  primaryLabel: ReactNode;
  cancelDisabled?: boolean;
  primaryDisabled?: boolean;
  size?: FooterButtonSize;
}

export function ModalFooterActions({
  onCancel,
  onPrimary,
  cancelLabel,
  primaryLabel,
  cancelDisabled = false,
  primaryDisabled = false,
  size = "md",
}: ModalFooterActionsProps) {
  return (
    <Row gap={TOKENS.spacing[10]}>
      <Button variant="soft" size={size} onPress={onCancel} disabled={cancelDisabled}>
        <Text size="sm" weight={600} tone="brand">
          {cancelLabel}
        </Text>
      </Button>
      <Button variant="primary" size={size} onPress={onPrimary} disabled={primaryDisabled}>
        <Text size="sm" weight={600} tone={null} style={{ color: TOKENS.color.content.inverse }}>
          {primaryLabel}
        </Text>
      </Button>
    </Row>
  );
}
