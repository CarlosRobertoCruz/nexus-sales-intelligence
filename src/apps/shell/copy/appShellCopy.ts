// Navegação global do produto; os destinos ainda não construídos ficam sinalizados.
export type AppPage = "overview" | "sales" | "renewals" | "cancellations" | "locations" | "team";

export const APP_SHELL_COPY = {
  product: "Nexus Sales Intelligence",
  subtitle: "Comercial & performance",
  nav: [
    { id: "overview", label: "Visão geral", available: true },
    { id: "sales", label: "Vendas", available: true },
    { id: "renewals", label: "Renovações", available: true },
    { id: "cancellations", label: "Cancelamentos", available: true },
    { id: "locations", label: "Localidades", available: true },
    { id: "team", label: "Equipe comercial", available: true },
  ],
} as const;
