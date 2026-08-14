import { useState, type ChangeEvent, type ReactNode } from "react";
import { Badge, Button, Icon, Modal, Row, Stack, Surface, Text } from "@/garden/foundations";
import { CheckCheckIcon, DatabaseIcon, FileXlsIcon, Trash2Icon, TriangleAlertIcon } from "@/garden/foundations/assets/icons/icons";
import { DeleteConfirmModal } from "@/garden/patterns";
import { TOKENS } from "@/garden/tokens";
import { SPREADSHEET_IMPORT_COPY } from "../copy/spreadsheetImportCopy";
import type { SpreadsheetImportController } from "../controller/useSpreadsheetImportController";

type FilePickerProps = {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
};

function readableSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function FilePicker({ id, label, hint, file, disabled, onChange }: FilePickerProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.files?.[0] ?? null);
  }

  return (
    <label htmlFor={id} style={{ display: "block", cursor: disabled ? "not-allowed" : "pointer" }}>
      <Surface tone="subtle" padding={TOKENS.spacing[16]} style={{ border: `1px solid ${file ? TOKENS.color.brand.borderMuted : TOKENS.color.stroke.default}`, opacity: disabled ? 0.6 : 1 }}>
        <Row align="center" gap={TOKENS.spacing[14]}>
          <span style={{ width: TOKENS.size[40], height: TOKENS.size[40], borderRadius: TOKENS.radius[10], display: "grid", placeItems: "center", color: file ? TOKENS.color.feedback.success : TOKENS.color.brand.primary, background: file ? TOKENS.color.feedback.successSoft : TOKENS.color.brand.soft }}>
            <Icon size="md">{file ? <CheckCheckIcon /> : <FileXlsIcon />}</Icon>
          </span>
          <Stack gap={TOKENS.spacing[3]} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" weight={800}>{label}</Text>
            {file ? <Text size="xs" tone="secondary" truncate title={file.name}>{file.name} · {readableSize(file.size)}</Text> : <Text size="xs" tone="muted">{hint}</Text>}
          </Stack>
          <Badge variant={file ? "success" : "neutral"}>{file ? "Selecionada" : "Escolher .xlsx"}</Badge>
        </Row>
      </Surface>
      <input id={id} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={disabled} onChange={handleChange} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }} />
    </label>
  );
}

function FeedbackPanel({ icon, children, tone }: { icon: ReactNode; children: ReactNode; tone: "success" | "danger" | "warning" }) {
  const color = tone === "success" ? TOKENS.color.feedback.success : tone === "danger" ? TOKENS.color.feedback.danger : TOKENS.color.feedback.warning;
  const background = tone === "success" ? TOKENS.color.feedback.successSoft : tone === "danger" ? TOKENS.color.feedback.dangerSoft : TOKENS.color.feedback.warningSoft;
  return <Row align="flex-start" gap={TOKENS.spacing[10]} style={{ padding: TOKENS.spacing[12], borderRadius: TOKENS.radius[10], color, background }}><Icon size="sm" color="currentColor">{icon}</Icon><Text size="sm" tone={null} style={{ color, flex: 1 }} lineHeight={1.5}>{children}</Text></Row>;
}

export function SpreadsheetImportControl({ controller }: { controller: SpreadsheetImportController }) {
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] = useState(false);
  const meta = controller.dashboard?.meta;
  const primaryLabel = controller.status === "reading" ? "Lendo arquivos…" : controller.status === "processing" ? SPREADSHEET_IMPORT_COPY.processing : SPREADSHEET_IMPORT_COPY.confirm;

  return (
    <>
      <Surface tone="subtle" padding={TOKENS.spacing[16]} style={{ marginTop: "auto", border: `1px solid ${TOKENS.color.stroke.default}` }}>
        <Stack gap={TOKENS.spacing[10]}>
          <Row align="center" justify="space-between" gap={TOKENS.spacing[8]}>
            <Text size="xs" weight={700} tone="brand">BASE COMERCIAL</Text>
            <Badge size="xs" variant={meta ? "success" : "neutral"} dot>{meta ? "ativa" : "vazia"}</Badge>
          </Row>
          <Stack gap={TOKENS.spacing[3]}>
            <Text size="md" weight={700}>{controller.isHydrating ? "Carregando histórico…" : meta?.referenceMonth ?? SPREADSHEET_IMPORT_COPY.emptyStatus}</Text>
            <Text size="xs" tone="muted" lineHeight={1.5}>{controller.isHydrating ? "Preparando a base armazenada neste navegador." : meta ? `${meta.quality.attendanceRows.toLocaleString("pt-BR")} atendimentos · ${meta.quality.serviceOrderRows.toLocaleString("pt-BR")} OS` : "Importe os dois relatórios para preencher o painel."}</Text>
          </Stack>
          <Button variant="soft" size="md" fullWidth onPress={controller.openImport} disabled={controller.isHydrating}>
            <Row align="center" justify="center" gap={TOKENS.spacing[8]}><Icon size="sm"><DatabaseIcon /></Icon>{SPREADSHEET_IMPORT_COPY.button}</Row>
          </Button>
          {meta && (
            <Button
              variant="soft"
              size="sm"
              fullWidth
              onPress={() => setIsClearConfirmationOpen(true)}
              style={{ color: TOKENS.color.feedback.danger, background: TOKENS.color.feedback.dangerSoft, borderColor: TOKENS.color.feedback.danger }}
            >
              <Row align="center" justify="center" gap={TOKENS.spacing[8]}><Icon size="xs"><Trash2Icon /></Icon>Limpar dados</Row>
            </Button>
          )}
        </Stack>
      </Surface>

      <Modal
        open={controller.isOpen}
        onClose={controller.closeImport}
        title={SPREADSHEET_IMPORT_COPY.title}
        subtitle={SPREADSHEET_IMPORT_COPY.subtitle}
        width={720}
        closeOnOverlay={!controller.isProcessing}
        footer={<><Button variant="soft" size="lg" onPress={controller.closeImport} disabled={controller.isProcessing}>{controller.status === "success" ? "Concluir" : SPREADSHEET_IMPORT_COPY.cancel}</Button>{controller.status !== "success" && <Button size="lg" onPress={() => void controller.importSpreadsheets()} disabled={!controller.canImport}>{primaryLabel}</Button>}</>}
      >
        <Stack gap={TOKENS.spacing[16]}>
          <FilePicker id="attendance-spreadsheet" label={SPREADSHEET_IMPORT_COPY.attendanceLabel} hint={SPREADSHEET_IMPORT_COPY.attendanceHint} file={controller.files.attendance} disabled={controller.isProcessing} onChange={controller.selectAttendance} />
          <FilePicker id="service-orders-spreadsheet" label={SPREADSHEET_IMPORT_COPY.serviceOrdersLabel} hint={SPREADSHEET_IMPORT_COPY.serviceOrdersHint} file={controller.files.serviceOrders} disabled={controller.isProcessing} onChange={controller.selectServiceOrders} />
          <Row align="flex-start" gap={TOKENS.spacing[8]} style={{ color: TOKENS.color.content.muted }}><Icon size="xs" color="currentColor"><DatabaseIcon /></Icon><Text size="xs" tone="muted" lineHeight={1.5}>{SPREADSHEET_IMPORT_COPY.privacy}</Text></Row>
          {controller.error && <FeedbackPanel icon={<TriangleAlertIcon />} tone="danger">{controller.error}</FeedbackPanel>}
          {controller.summary && <FeedbackPanel icon={<CheckCheckIcon />} tone="success">{controller.summary}</FeedbackPanel>}
          {controller.status === "success" && controller.dashboard?.meta.quality.warnings.map((warning) => <FeedbackPanel key={warning} icon={<TriangleAlertIcon />} tone="warning">{warning}</FeedbackPanel>)}
        </Stack>
      </Modal>

      <DeleteConfirmModal
        open={isClearConfirmationOpen}
        title="Limpar todos os dados?"
        confirmLabel="Sim, limpar dados"
        onClose={() => setIsClearConfirmationOpen(false)}
        onConfirm={() => {
          void controller.clearData();
          setIsClearConfirmationOpen(false);
        }}
      >
        <Text size="sm" tone="secondary" lineHeight={1.6}>
          Esta ação removerá o histórico importado de atendimentos e ordens de serviço deste navegador. Os arquivos originais não serão alterados, mas será necessário importá-los novamente para reconstruir os painéis.
        </Text>
      </DeleteConfirmModal>
    </>
  );
}
