import { DropdownMenu, GlowActionButton, Tooltip } from "@/garden/foundations";
import { FileDownIcon, FilePdfIcon, FileXlsIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";

interface ExportDropdownButtonProps {
  onExportPdf: () => void;
  onExportXls: () => void;
  disabled?: boolean;
  label?: string;
  pdfLabel?: string;
  xlsLabel?: string;
}

export function ExportDropdownButton({
  onExportPdf,
  onExportXls,
  disabled = false,
  label = "Exportar",
  pdfLabel = "Exportar PDF",
  xlsLabel = "Exportar Excel (.xlsx)",
}: ExportDropdownButtonProps) {
  return (
    <DropdownMenu
      disabled={disabled}
      align="right"
      items={[
        {
          label: pdfLabel,
          icon: <FilePdfIcon width={18} height={18} style={{ flexShrink: 0 }} />,
          onSelect: onExportPdf,
        },
        {
          label: xlsLabel,
          icon: <FileXlsIcon width={18} height={18} style={{ flexShrink: 0 }} />,
          onSelect: onExportXls,
        },
      ]}
      trigger={
        <Tooltip label={label}>
          <span style={{ display: "inline-flex" }}>
            <GlowActionButton
              label={label}
              iconOnly
              tone="brand"
              disabled={disabled}
              onPress={() => {}}
              icon={<FileDownIcon />}
              style={{
                width: "auto",
                flexShrink: 0,
                padding: `${TOKENS.spacing[6]} ${TOKENS.spacing[10]}`,
              }}
            />
          </span>
        </Tooltip>
      }
    />
  );
}
