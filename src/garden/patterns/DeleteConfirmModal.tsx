import { useState, type ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import { Button, Modal, Row, Stack, Text } from "@/garden/foundations";

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  width?: number;
  genericError?: string;
}

export function DeleteConfirmModal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  width = 480,
  genericError = "Não foi possível completar a ação.",
}: DeleteConfirmModalProps) {
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ajuste de estado durante o render: toda vez que `open` vira `true` de
  // novo (reabrindo o modal), começa limpo.
  const [trackedOpen, setTrackedOpen] = useState(open);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setSaving(false);
      setSubmitError(null);
    }
  }

  const handleConfirm = async () => {
    setSubmitError(null);
    setSaving(true);
    try {
      await onConfirm();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : genericError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={width}
      maxHeight="85vh"
      ariaLabel={title}
      bodyStyle={{ overflowY: "auto", overflowX: "hidden", minWidth: 0 }}
      footer={
        <Row gap={TOKENS.spacing[10]}>
          <Button variant="soft" size="md" onPress={onClose} disabled={saving}>
            <Text size="sm" weight={600} tone="brand">
              {cancelLabel}
            </Text>
          </Button>
          <Button variant="danger" size="md" onPress={() => void handleConfirm()} disabled={saving}>
            {confirmLabel}
          </Button>
        </Row>
      }
    >
      <Stack style={{ gap: TOKENS.spacing[12], minWidth: 0 }}>
        {submitError ? (
          <Text size="sm" role="alert" tone="danger">
            {submitError}
          </Text>
        ) : null}
        {children}
      </Stack>
    </Modal>
  );
}
