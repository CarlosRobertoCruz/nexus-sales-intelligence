import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import Highlight from "../interaction/Highlight";
import Pressable from "../interaction/Pressable";
import Text from "./Text";

export type ColumnSize = "icon" | "sm" | "md" | "lg" | "xl";

const COLUMN_SIZE_MAP: Record<ColumnSize, string> = {
  icon: TOKENS.size[40],
  // minmax(0, …) — em HD as colunas encolhem sem forçar scroll horizontal.
  sm: `minmax(0, 0.8fr)`,
  md: `minmax(0, 1fr)`,
  lg: `minmax(0, 1.5fr)`,
  xl: `minmax(0, 1fr)`,
};

interface GridTableProps {
  templateColumns?: string;
  columnSizes?: ColumnSize[];
  columns: ReactNode[];
  rows: ReactNode[][];
  minWidth?: CSSProperties["minWidth"];
  emptyMessage?: ReactNode;
  rowStyles?: (CSSProperties | undefined)[];
  /** Por coluna: sobrescreve o `minWidth: 0` padrão das células (ex.: `"max-content"` pra nunca truncar). */
  cellMinWidths?: Array<CSSProperties["minWidth"] | undefined>;
  /** Linhas com células multilinha (ex.: comentário); cabeçalho usa o mesmo alinhamento. */
  rowAlignItems?: "center" | "start";
  /** Altura máxima só do corpo (linhas); cabeçalho permanece visível. Ignorado com lista vazia. */
  maxBodyHeight?: number;
  /** Linhas fixas abaixo do corpo rolável (mesmas colunas que `rows`). Só faz efeito com `maxBodyHeight` e `rows.length > 0`. */
  footerRows?: ReactNode[][];
  footerRowStyles?: (CSSProperties | undefined)[];
  /** Corpo opcionalmente clicável; exige os dois para ativar (`Pressable` + `aria-label`). */
  onRowPress?: (rowIndex: number) => void;
  getRowAriaLabel?: (rowIndex: number) => string;
  /** Quando `false`, linhas não mudam fundo ao passar o rato (listagens densas / estilo plano). Default `true`. */
  rowHoverBackground?: boolean;
}

function resolveGridTemplateColumns({
  templateColumns,
  columnSizes,
  columnCount,
}: {
  templateColumns?: string;
  columnSizes?: ColumnSize[];
  columnCount: number;
}) {
  if (templateColumns) return templateColumns;
  if (columnSizes?.length) return columnSizes.map((s) => COLUMN_SIZE_MAP[s]).join(" ");
  return `repeat(${columnCount}, minmax(0, 1fr))`;
}

function GridRow({
  children,
  templateColumns,
  borderBottom,
  style,
  alignItems = "center",
  onPress,
  ariaLabel,
  rowHoverBackground = true,
}: {
  children: ReactNode;
  templateColumns: string;
  borderBottom: string;
  style?: CSSProperties;
  alignItems?: "center" | "start";
  onPress?: () => void;
  ariaLabel?: string;
  rowHoverBackground?: boolean;
}) {
  const rowExtra = style ?? {};
  const { transition: rowTransition, ...rowRest } = rowExtra as CSSProperties & {
    transition?: string;
  };

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: templateColumns,
    gap: TOKENS.spacing[8],
    padding: `${TOKENS.spacing[12]} ${TOKENS.spacing[16]}`,
    borderBottom,
    alignItems,
    transition: [
      `background ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.premium}`,
      rowTransition,
    ]
      .filter(Boolean)
      .join(", "),
    ...rowRest,
  };

  if (onPress !== undefined) {
    return (
      <Pressable onPress={onPress} aria-label={ariaLabel} style={{ width: "100%" }}>
        {({ hovered: pressedHover }) => (
          <Highlight
            variant="row"
            hovered={rowHoverBackground && pressedHover}
            style={gridStyle}
          >
            {children}
          </Highlight>
        )}
      </Pressable>
    );
  }

  if (!rowHoverBackground) {
    return (
      <div style={{ ...gridStyle, background: "transparent" }}>
        {children}
      </div>
    );
  }

  return (
    <Highlight variant="row" style={gridStyle}>
      {children}
    </Highlight>
  );
}

export function GridTable({
  templateColumns,
  columnSizes,
  columns,
  rows,
  minWidth = 0,
  emptyMessage = "Nenhum resultado encontrado.",
  rowStyles,
  cellMinWidths,
  rowAlignItems = "center",
  maxBodyHeight,
  footerRows,
  footerRowStyles,
  onRowPress,
  getRowAriaLabel,
  rowHoverBackground = true,
}: GridTableProps) {
  const resolvedRowPress =
    onRowPress !== undefined && getRowAriaLabel !== undefined ? onRowPress : undefined;
  const resolvedGetRowAriaLabel =
    onRowPress !== undefined && getRowAriaLabel !== undefined ? getRowAriaLabel : undefined;

  const resolvedTemplateColumns = resolveGridTemplateColumns({
    templateColumns,
    columnSizes,
    columnCount: columns.length,
  });

  const cellBoxStyle = (cellIndex: number): CSSProperties => ({
    minWidth: cellMinWidths?.[cellIndex] ?? 0,
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    justifyContent: rowAlignItems === "start" ? "flex-start" : "center",
  });

  const scrollBody =
    maxBodyHeight != null && maxBodyHeight > 0 && rows.length > 0;

  const rowNodes = rows.map((row, rowIndex) => (
    <GridRow
      key={rowIndex}
      templateColumns={resolvedTemplateColumns}
      borderBottom={
        rowIndex < rows.length - 1
          ? `1px solid ${TOKENS.color.stroke.subtle}`
          : "none"
      }
      style={rowStyles?.[rowIndex]}
      alignItems={rowAlignItems}
      onPress={resolvedRowPress !== undefined ? () => resolvedRowPress(rowIndex) : undefined}
      ariaLabel={resolvedGetRowAriaLabel !== undefined ? resolvedGetRowAriaLabel(rowIndex) : undefined}
      rowHoverBackground={rowHoverBackground}
    >
      {row.map((cell, cellIndex) => (
        <div key={cellIndex} style={cellBoxStyle(cellIndex)}>
          {cell}
        </div>
      ))}
    </GridRow>
  ));

  const footerRowsSafe = footerRows ?? [];
  const footerNodes = footerRowsSafe.map((row, rowIndex) => (
    <GridRow
      key={`footer-${rowIndex}`}
      templateColumns={resolvedTemplateColumns}
      borderBottom={
        rowIndex < footerRowsSafe.length - 1
          ? `1px solid ${TOKENS.color.stroke.subtle}`
          : "none"
      }
      style={footerRowStyles?.[rowIndex]}
      alignItems={rowAlignItems}
      rowHoverBackground={rowHoverBackground}
    >
      {row.map((cell, cellIndex) => (
        <div key={cellIndex} style={cellBoxStyle(cellIndex)}>
          {cell}
        </div>
      ))}
    </GridRow>
  ));

  const bodyWithOptionalFooter =
    scrollBody && footerNodes.length > 0 ? (
      <Fragment>
        <div
          style={{
            maxHeight: maxBodyHeight,
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
          }}
        >
          {rowNodes}
        </div>
        {footerNodes}
      </Fragment>
    ) : scrollBody ? (
      <div
        style={{
          maxHeight: maxBodyHeight,
          overflowY: "auto",
          overflowX: "hidden",
          minHeight: 0,
        }}
      >
        {rowNodes}
      </div>
    ) : (
      <Fragment>
        {rowNodes}
        {footerNodes}
      </Fragment>
    );

  return (
    <div
      style={{
        overflowX: minWidth && minWidth !== 0 ? "auto" : "hidden",
        minWidth: 0,
        width: "100%",
      }}
    >
      <div style={{ minWidth: minWidth || undefined, width: "100%" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: resolvedTemplateColumns,
            gap: TOKENS.spacing[8],
            padding: `${TOKENS.spacing[12]} ${TOKENS.spacing[16]}`,
            background: TOKENS.color.surface.subtle,
            borderBottom: `1px solid ${TOKENS.color.stroke.subtle}`,
            alignItems: rowAlignItems,
          }}
        >
          {columns.map((col, i) => (
            typeof col === "string" || typeof col === "number" ? (
              <Text
                key={i}
                size="xs"
                weight={600}
                tone="muted"
                style={{
                  textTransform: "uppercase",
                  letterSpacing: TOKENS.typography.letterSpacing.eyebrow,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {col}
              </Text>
            ) : (
              <div key={i}>{col}</div>
            )
          ))}
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: TOKENS.spacing[32],
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Text size="sm" tone="muted">
              {emptyMessage}
            </Text>
          </div>
        ) : (
          bodyWithOptionalFooter
        )}
      </div>
    </div>
  );
}
