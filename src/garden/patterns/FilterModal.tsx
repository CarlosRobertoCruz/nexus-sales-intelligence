import type { ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import { Button, Modal, Stack, Text } from "@/garden/foundations";

interface FilterModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  clearLabel?: string;
  applyLabel?: string;
  width?: number;
}

export function FilterModal({
  open,
  title,
  children,
  onClose,
  onClear,
  onApply,
  clearLabel = "Limpar",
  applyLabel = "Aplicar",
  width = 520,
}: FilterModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={width}
      maxHeight="92vh"
      ariaLabel={title}
      bodyStyle={{ maxHeight: "65vh", overflowY: "auto" }}
      footer={
        <>
          <Button variant="soft" size="md" onPress={onClear}>
            <Text size="sm" weight={600} tone="brand">{clearLabel}</Text>
          </Button>
          <Button variant="primary" size="md" onPress={onApply}>
            <Text size="sm" weight={600} tone={null} style={{ color: TOKENS.color.content.inverse }}>
              {applyLabel}
            </Text>
          </Button>
        </>
      }
    >
      <Stack style={{ gap: TOKENS.spacing[16], minWidth: 0 }}>
        {children}
      </Stack>
    </Modal>
  );
}
