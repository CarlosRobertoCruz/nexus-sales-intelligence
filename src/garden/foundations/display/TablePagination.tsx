import { useMemo } from "react";
import type { ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import Icon from "./Icon";
import Text from "./Text";
import Row from "../layout/Row";
import Spacer from "../layout/Spacer";
import Highlight from "../interaction/Highlight";
import Pressable from "../interaction/Pressable";
import { ArrowLeftIcon, ArrowRightIcon } from "@/garden/foundations/assets/icons/icons";
import { getPaginationVisiblePages } from "./paginationVisiblePages";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  start: number;
  end: number;
  totalItems: number;
  itemsLabel?: string;
  /** Quando `false`, omite a borda superior (ex.: tabela vazia). Default: `true`. */
  showTopBorder?: boolean;
}

export function PaginationNavButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string | ReactNode;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const canHover = Boolean(!disabled && onPress);

  return (
    <Pressable
      as="button"
      type="button"
      appearance="bare"
      disabled={disabled}
      onPress={onPress}
      style={{
        padding: TOKENS.spacing[0],
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
      }}
    >
      {({ hovered }) => (
        <Highlight
          variant="icon"
          active={active}
          hovered={canHover && hovered}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            minWidth: TOKENS.size[32],
            height: TOKENS.size[32],
            borderRadius: TOKENS.radius[6],
            ...(disabled ? { color: TOKENS.color.content.subtle } : {}),
            fontSize: TOKENS.typography.size[12],
            fontWeight: active ? TOKENS.typography.weight[600] : TOKENS.typography.weight[400],
            padding: `${TOKENS.spacing[0]} ${TOKENS.spacing[6]}`,
          }}
        >
          {label}
        </Highlight>
      )}
    </Pressable>
  );
}

/** Rodapé de tabela: "Mostrando…" à esquerda e páginas à direita. */
export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  start,
  end,
  totalItems,
  itemsLabel = "resultados",
  showTopBorder = true,
}: TablePaginationProps) {
  const visiblePages = useMemo(
    () => getPaginationVisiblePages(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const navDisabled = totalPages < 1;
  const borderTopStyle = showTopBorder ? `1px solid ${TOKENS.color.stroke.subtle}` : "none";

  return (
    <Row
      align="center"
      style={{
        padding: `${TOKENS.spacing[14]} ${TOKENS.spacing[20]}`,
        borderTop: borderTopStyle,
        gap: TOKENS.spacing[12],
        flexWrap: "wrap",
      }}
    >
      <Text size="xs" tone="muted" style={{ flexShrink: 0 }}>
        Mostrando {start} a {end} de {totalItems.toLocaleString("pt-BR")} {itemsLabel}
      </Text>

      <Spacer />

      <Row align="center" style={{ gap: TOKENS.spacing[4] }}>
        <PaginationNavButton
          label={
            <Icon size="sm" color="inherit">
              <ArrowLeftIcon />
            </Icon>
          }
          disabled={navDisabled || currentPage <= 1}
          onPress={() => onPageChange(Math.max(1, currentPage - 1))}
        />
        <Row align="center" style={{ gap: TOKENS.spacing[4] }}>
          {visiblePages.map((item, i) =>
            item === "ellipsis" ? (
              <Text
                key={`ellipsis-${i}`}
                size="xs"
                tone="muted"
                style={{ minWidth: TOKENS.size[24], textAlign: "center" }}
              >
                …
              </Text>
            ) : (
              <PaginationNavButton
                key={item}
                label={String(item)}
                active={item === currentPage}
                onPress={() => onPageChange(item)}
              />
            ),
          )}
        </Row>
        <PaginationNavButton
          label={
            <Icon size="sm" color="inherit">
              <ArrowRightIcon />
            </Icon>
          }
          disabled={navDisabled || currentPage >= totalPages}
          onPress={() => onPageChange(Math.min(Math.max(totalPages, 1), currentPage + 1))}
        />
      </Row>
    </Row>
  );
}
