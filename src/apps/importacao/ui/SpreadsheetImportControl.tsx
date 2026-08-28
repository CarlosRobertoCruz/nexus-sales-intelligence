import { useState, type ChangeEvent, type ReactNode } from "react";
import { Badge, Button, Icon, LoadingOverlay, Modal, Row, Stack, Surface, Text } from "@/garden/foundations";
import { CheckCheckIcon, DatabaseIcon, FileXlsIcon, Trash2Icon, TriangleAlertIcon } from "@/garden/foundations/assets/icons/icons";
import { DeleteConfirmModal } from "@/garden/patterns";
import { TOKENS } from "@/garden/tokens";
import { SPREADSHEET_IMPORT_COPY } from "../copy/spreadsheetImportCopy";
import type { SpreadsheetImportController } from "../controller/useSpreadsheetImportController";

type FilePickerProps = {
  id: string;
  label: string;
  hint: string;
  files: ReadonlyArray<File>;
  disabled: boolean;
  onChange: (files: ReadonlyArray<File>) => void;
};

function readableSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function FilePicker({ id, label, hint, files, disabled, onChange }: FilePickerProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(Array.from(event.target.files ?? []));
  }

  const hasFiles = files.length > 0;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const selectionSummary = files.length === 1
    ? `${files[0].name} · ${readableSize(totalSize)}`
    : `${files.length} arquivos · ${readableSize(totalSize)}`;
  const selectedNames = files.map((file) => file.name).join("\n");

  return (
    <label htmlFor={id} style={{ display: "block", cursor: disabled ? "not-allowed" : "pointer" }}>
      <Surface tone="subtle" padding={TOKENS.spacing[16]} style={{ border: `1px solid ${hasFiles ? TOKENS.color.brand.borderMuted : TOKENS.color.stroke.default}`, opacity: disabled ? 0.6 : 1 }}>
        <Row align="center" gap={TOKENS.spacing[14]}>
          <span style={{ width: TOKENS.size[40], height: TOKENS.size[40], borderRadius: TOKENS.radius[10], display: "grid", placeItems: "center", color: hasFiles ? TOKENS.color.feedback.success : TOKENS.color.brand.primary, background: hasFiles ? TOKENS.color.feedback.successSoft : TOKENS.color.brand.soft }}>
            <Icon size="md">{hasFiles ? <CheckCheckIcon /> : <FileXlsIcon />}</Icon>
          </span>
          <Stack gap={TOKENS.spacing[3]} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" weight={800}>{label}</Text>
            {hasFiles ? <Text size="xs" tone="secondary" truncate title={selectedNames}>{selectionSummary}</Text> : <Text size="xs" tone="muted">{hint}</Text>}
          </Stack>
          <Badge variant={hasFiles ? "success" : "neutral"}>{hasFiles ? `${files.length} selecionada${files.length === 1 ? "" : "s"}` : "Escolher .xlsx"}</Badge>
        </Row>
      </Surface>
      <input id={id} type="file" multiple accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={disabled} onChange={handleChange} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }} />
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
  const primaryLabel = controller.status === "reading"
    ? "Lendo arquivos…"
    : controller.status === "processing"
      ? SPREADSHEET_IMPORT_COPY.processing
      : controller.status === "saving"
        ? "Salvando histórico…"
        : SPREADSHEET_IMPORT_COPY.confirm;
  const loadingCopy = controller.status === "reading"
    ? {
        title: "Lendo as planilhas",
        subtitle: controller.readProgress
          ? `Arquivo ${controller.readProgress.current} de ${controller.readProgress.total}: ${controller.readProgress.fileName}`
          : "Validando os relatórios de atendimentos e ordens de serviço.",
      }
    : controller.status === "saving"
      ? {
          title: "Salvando o histórico",
          subtitle: "Atualizando a base local e preparando os painéis para consulta.",
        }
      : {
          title: "Processando os dados",
          subtitle: "Classificando registros, tratando duplicidades e calculando os indicadores.",
        };
  const showImportLoading = controller.status === "reading" || controller.status === "processing" || controller.status === "saving";

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
          <FilePicker id="attendance-spreadsheet" label={SPREADSHEET_IMPORT_COPY.attendanceLabel} hint={SPREADSHEET_IMPORT_COPY.attendanceHint} files={controller.files.attendance} disabled={controller.isProcessing} onChange={controller.selectAttendance} />
          <FilePicker id="service-orders-spreadsheet" label={SPREADSHEET_IMPORT_COPY.serviceOrdersLabel} hint={SPREADSHEET_IMPORT_COPY.serviceOrdersHint} files={controller.files.serviceOrders} disabled={controller.isProcessing} onChange={controller.selectServiceOrders} />
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

      <LoadingOverlay
        active={showImportLoading}
        logo={(
          <img
            src="/nexus-sales-intelligence-app-icon-512.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{ width: TOKENS.size[128], height: TOKENS.size[128], objectFit: "cover", borderRadius: TOKENS.radius[20] }}
          />
        )}
        title={<Text size="title-lg" weight={800}>{loadingCopy.title}</Text>}
        subtitle={<Text size="md" tone="secondary" lineHeight={1.6} style={{ maxWidth: 520 }}>{loadingCopy.subtitle}</Text>}
        footer={<Text size="xs" tone="muted">Mantenha esta janela aberta até a conclusão da importação.</Text>}
      />
    </>
  );
}
