// Shell visual compartilhado; compõe navegação e conteúdo sem conhecer regras comerciais.
import type { ReactNode } from "react";
import { Badge, Icon, Pressable, Row, Stack, Text } from "@/garden/foundations";
import { CheckCheckIcon, ChevronRightIcon, GaugeIcon, MapPinnedIcon, RefreshIcon, SalesChartIcon, UsersIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";
import { APP_SHELL_COPY, type AppPage } from "../copy/appShellCopy";

type AppShellProps = {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  importControl: ReactNode;
  children: ReactNode;
};

const navIcons: ReadonlyArray<ReactNode> = [
  <GaugeIcon key="overview" />, <SalesChartIcon key="sales" />, <CheckCheckIcon key="renewals" />, <RefreshIcon key="cancellations" />, <MapPinnedIcon key="locations" />, <UsersIcon key="team" />,
];

export function AppShell({ activePage, onNavigate, importControl, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" style={{ background: TOKENS.color.surface.sunken, borderRight: `1px solid ${TOKENS.color.stroke.subtle}` }}>
        <Stack gap={TOKENS.spacing[32]} style={{ minHeight: "100%" }}>
          <Row align="center" gap={TOKENS.spacing[12]}>
            <img
              src="/nexus-sales-intelligence-app-icon-512.png"
              alt="Nexus Sales Intelligence"
              width={48}
              height={48}
              style={{ width: 48, height: 48, objectFit: "contain" }}
            />
            <Stack gap={TOKENS.spacing[2]}>
              <Text size="lg" weight={800}>{APP_SHELL_COPY.product}</Text>
              <Text size="xs" tone="muted">{APP_SHELL_COPY.subtitle}</Text>
            </Stack>
          </Row>

          <nav aria-label="Navegação principal">
            <Stack gap={TOKENS.spacing[6]}>
              {APP_SHELL_COPY.nav.map((item, index) => {
                const isActive = item.id === activePage;
                return (
                  <Pressable
                    key={item.id}
                    as="button"
                    appearance="bare"
                    disabled={!item.available}
                    aria-current={isActive ? "page" : undefined}
                    onPress={() => item.available && onNavigate(item.id as AppPage)}
                  >
                    <Row align="center" gap={TOKENS.spacing[12]} style={{ padding: `${TOKENS.spacing[10]} ${TOKENS.spacing[12]}`, borderRadius: TOKENS.radius[10], color: isActive ? TOKENS.color.content.primary : TOKENS.color.content.muted, opacity: item.available ? 1 : TOKENS.effects.opacity[32], background: isActive ? TOKENS.color.brand.railItemActive : TOKENS.color.transparent, border: `1px solid ${isActive ? TOKENS.color.brand.borderMuted : TOKENS.color.transparent}` }}>
                      <Icon size="sm" color="currentColor">{navIcons[index]}</Icon>
                      <Text size="md" weight={isActive ? 700 : 500} tone={null} style={{ color: "inherit", flex: 1 }}>{item.label}</Text>
                      {!item.available && <Badge size="xs" variant="neutral">em breve</Badge>}
                      {isActive && <Icon size="xs" color={TOKENS.color.brand.primary}><ChevronRightIcon /></Icon>}
                    </Row>
                  </Pressable>
                );
              })}
            </Stack>
          </nav>

          {importControl}
        </Stack>
      </aside>
      {children}
    </div>
  );
}
