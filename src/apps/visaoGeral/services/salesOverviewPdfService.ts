import { REPORT_EXPORT_STYLE } from "@/garden/utils/export/reportExportStyle";
import type { CommercialDashboardBundle } from "@/core/types/commercialDashboard";
import { mapCommercialLocations } from "@/apps/localidades/data/locationCoordinates";
import type { CommercialLocationMetric, LocationMetricId, MappedCommercialLocation } from "@/apps/localidades/types/locations";
import type { SalesOverviewReportData } from "../types/salesOverview";

type PdfDocument = InstanceType<typeof import("jspdf").jsPDF>;
type Rgb = readonly [number, number, number];

const PAGE = { width: 297, height: 210, margin: 12 } as const;
const COLORS = {
  page: [248, 248, 252] as Rgb,
  card: [255, 255, 255] as Rgb,
  border: [225, 226, 235] as Rgb,
  text: REPORT_EXPORT_STYLE.pdfRgb.contentPrimary,
  muted: REPORT_EXPORT_STYLE.pdfRgb.contentMuted,
  subtle: REPORT_EXPORT_STYLE.pdfRgb.contentSubtle,
  brand: REPORT_EXPORT_STYLE.toneRgb.brand,
  brandSoft: REPORT_EXPORT_STYLE.pdfRgb.brandSurface,
  success: REPORT_EXPORT_STYLE.toneRgb.success,
  warning: REPORT_EXPORT_STYLE.toneRgb.warning,
  info: REPORT_EXPORT_STYLE.toneRgb.info,
  danger: [225, 54, 85] as Rgb,
} as const;

export type CommercialReportData = {
  overview: SalesOverviewReportData;
  dashboard: CommercialDashboardBundle;
  locationMetrics: ReadonlyArray<CommercialLocationMetric>;
};

function fill(doc: PdfDocument, color: Rgb): void {
  doc.setFillColor(color[0], color[1], color[2]);
}

function stroke(doc: PdfDocument, color: Rgb): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function ink(doc: PdfDocument, color: Rgb): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

function card(doc: PdfDocument, x: number, y: number, width: number, height: number): void {
  fill(doc, COLORS.card);
  stroke(doc, COLORS.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 2.4, 2.4, "FD");
}

function text(doc: PdfDocument, value: string, x: number, y: number, size: number, color: Rgb = COLORS.text, weight: "normal" | "bold" = "normal"): void {
  doc.setFont(REPORT_EXPORT_STYLE.pdfFontFamily, weight);
  doc.setFontSize(size);
  ink(doc, color);
  doc.text(value, x, y);
}

function fitText(doc: PdfDocument, value: string, x: number, y: number, maxWidth: number, size: number, color: Rgb = COLORS.text, weight: "normal" | "bold" = "normal"): void {
  doc.setFont(REPORT_EXPORT_STYLE.pdfFontFamily, weight);
  doc.setFontSize(size);
  ink(doc, color);
  const clipped = doc.getTextWidth(value) <= maxWidth ? value : `${value.slice(0, Math.max(1, Math.floor(value.length * maxWidth / doc.getTextWidth(value)) - 3))}...`;
  doc.text(clipped, x, y);
}

function drawKpis(doc: PdfDocument, data: SalesOverviewReportData, y: number): void {
  const gap = 4;
  const width = (PAGE.width - PAGE.margin * 2 - gap * 3) / 4;
  const kpis = [
    { label: "VENDAS NO MÊS", ...data.summary.sales, color: COLORS.brand },
    { label: "RENOVAÇÕES", ...data.summary.renewals, color: COLORS.success },
    { label: "CANCELAMENTOS", ...data.summary.cancellations, color: COLORS.danger },
    { label: "REATIVAÇÕES", ...data.summary.reactivations, color: COLORS.info },
  ];
  kpis.forEach((kpi, index) => {
    const x = PAGE.margin + index * (width + gap);
    card(doc, x, y, width, 24);
    fill(doc, kpi.color);
    doc.roundedRect(x + 4, y + 4, 3, 16, 1.5, 1.5, "F");
    text(doc, kpi.label, x + 11, y + 7, 7.2, COLORS.muted, "bold");
    text(doc, kpi.value, x + 11, y + 15.2, 15, COLORS.text, "bold");
    text(doc, kpi.trend, x + 11, y + 20.5, 7.2, kpi.color, "bold");
  });
}

function drawPlanChart(doc: PdfDocument, data: SalesOverviewReportData, x: number, y: number, width: number, height: number): void {
  card(doc, x, y, width, height);
  text(doc, "Vendas por plano", x + 6, y + 8, 10.5, COLORS.text, "bold");
  text(doc, "Comparativo do período atual com o anterior", x + 6, y + 13, 7.2, COLORS.muted);
  fill(doc, COLORS.brand);
  doc.circle(x + width - 38, y + 8, 1.2, "F");
  text(doc, "Atual", x + width - 35, y + 9, 6.8, COLORS.muted);
  fill(doc, COLORS.subtle);
  doc.circle(x + width - 19, y + 8, 1.2, "F");
  text(doc, "Anterior", x + width - 16, y + 9, 6.8, COLORS.muted);

  const maximum = Math.max(1, ...data.plans.flatMap((plan) => [plan.current, plan.previous]));
  const labelWidth = 43;
  const valueWidth = 11;
  const trackWidth = width - labelWidth - valueWidth - 14;
  const startY = y + 19;
  const rowHeight = (height - 24) / Math.max(data.plans.length, 1);
  data.plans.forEach((plan, index) => {
    const rowY = startY + index * rowHeight;
    fitText(doc, plan.label, x + 6, rowY + 3.3, labelWidth - 3, 7.2, COLORS.text, "bold");
    fill(doc, COLORS.brandSoft);
    doc.roundedRect(x + labelWidth, rowY, trackWidth, 2.5, 1.25, 1.25, "F");
    fill(doc, COLORS.brand);
    doc.roundedRect(x + labelWidth, rowY, Math.max(0.8, trackWidth * plan.current / maximum), 2.5, 1.25, 1.25, "F");
    fill(doc, [238, 239, 244]);
    doc.roundedRect(x + labelWidth, rowY + 3.5, trackWidth, 1.5, 0.75, 0.75, "F");
    fill(doc, COLORS.subtle);
    doc.roundedRect(x + labelWidth, rowY + 3.5, Math.max(0.7, trackWidth * plan.previous / maximum), 1.5, 0.75, 0.75, "F");
    text(doc, String(plan.current), x + width - 7, rowY + 3.1, 7.2, COLORS.text, "bold");
  });
}

function drawConcentration(doc: PdfDocument, data: SalesOverviewReportData, x: number, y: number, width: number, height: number): void {
  card(doc, x, y, width, height);
  text(doc, "Concentração das vendas", x + 6, y + 8, 10.5, COLORS.text, "bold");
  text(doc, "Participação do plano líder", x + 6, y + 13, 7.2, COLORS.muted);
  text(doc, `${Math.round(data.leadingPlan.percentage)}%`, x + 6, y + 31, 23, COLORS.brand, "bold");
  fill(doc, COLORS.brandSoft);
  doc.roundedRect(x + 6, y + 36, width - 12, 5, 2.5, 2.5, "F");
  fill(doc, COLORS.brand);
  doc.roundedRect(x + 6, y + 36, Math.max(1.5, (width - 12) * Math.min(100, data.leadingPlan.percentage) / 100), 5, 2.5, 2.5, "F");
  text(doc, "PLANO LÍDER", x + 6, y + 49, 7, COLORS.brand, "bold");
  fitText(doc, data.leadingPlan.label, x + 6, y + 56, width - 12, 9.2, COLORS.text, "bold");
  text(doc, `${data.leadingPlan.value} vendas no período`, x + 6, y + 62, 7.2, COLORS.muted);
}

function drawOperationalTable(doc: PdfDocument, data: SalesOverviewReportData, x: number, y: number, width: number): void {
  const rowHeight = 5.2;
  const headerHeight = 8;
  const height = 18 + headerHeight + data.plans.length * rowHeight;
  card(doc, x, y, width, height);
  text(doc, "Pulso operacional", x + 6, y + 8, 10.5, COLORS.text, "bold");
  text(doc, "Movimentos que ajudam a explicar a saúde da carteira", x + 6, y + 13, 7.2, COLORS.muted);
  const columns = [x + 6, x + width * 0.57, x + width * 0.70, x + width * 0.84];
  const headerY = y + 21;
  fill(doc, COLORS.brandSoft);
  doc.rect(x + 1, y + 16, width - 2, headerHeight, "F");
  ["PLANO", "VENDAS", "PARTICIPAÇÃO", "EVOLUÇÃO"].forEach((label, index) => text(doc, label, columns[index], headerY, 6.8, COLORS.muted, "bold"));
  data.plans.forEach((plan, index) => {
    const rowY = y + 24 + index * rowHeight;
    if (index % 2 === 1) {
      fill(doc, COLORS.page);
      doc.rect(x + 1, rowY, width - 2, rowHeight, "F");
    }
    fitText(doc, plan.fullLabel, columns[0], rowY + 3.5, width * 0.52, 7.1, COLORS.text, "bold");
    text(doc, String(plan.current), columns[1], rowY + 3.5, 7.1, COLORS.text, "bold");
    text(doc, `${plan.share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, columns[2], rowY + 3.5, 7.1, COLORS.muted);
    text(doc, plan.growth, columns[3], rowY + 3.5, 7.1, plan.growth.startsWith("+") ? COLORS.success : COLORS.warning, "bold");
  });
}

function beginPage(doc: PdfDocument, title: string, description: string, referenceMonth: string): void {
  fill(doc, COLORS.page);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  fill(doc, COLORS.brand);
  doc.roundedRect(PAGE.margin, PAGE.margin, 7, 7, 1.7, 1.7, "F");
  text(doc, "N", PAGE.margin + 1.85, PAGE.margin + 5.25, 9.5, REPORT_EXPORT_STYLE.pdfRgb.inverse, "bold");
  text(doc, title, PAGE.margin + 11, PAGE.margin + 3.5, 13, COLORS.text, "bold");
  text(doc, description, PAGE.margin + 11, PAGE.margin + 8.5, 7.4, COLORS.muted);
  doc.setFont(REPORT_EXPORT_STYLE.pdfFontFamily, "bold");
  doc.setFontSize(10);
  ink(doc, COLORS.text);
  doc.text(referenceMonth, PAGE.width - PAGE.margin, PAGE.margin + 5, { align: "right" });
  stroke(doc, COLORS.border);
  doc.line(PAGE.margin, 25, PAGE.width - PAGE.margin, 25);
}

function finishPage(doc: PdfDocument, updatedAt: string, page: number, pages: number): void {
  text(doc, `Atualizado em ${updatedAt}`, PAGE.margin, PAGE.height - 5, 6.8, COLORS.muted);
  doc.text(`Nexus Sales Intelligence - página ${page} de ${pages}`, PAGE.width - PAGE.margin, PAGE.height - 5, { align: "right" });
}

function drawSummaryCards(doc: PdfDocument, items: ReadonlyArray<{ label: string; value: string; detail: string; color: Rgb }>, y = 31): void {
  const gap = 4;
  const width = (PAGE.width - PAGE.margin * 2 - gap * 3) / 4;
  items.forEach((item, index) => {
    const x = PAGE.margin + index * (width + gap);
    card(doc, x, y, width, 23);
    fill(doc, item.color);
    doc.roundedRect(x + 4, y + 4, 3, 15, 1.5, 1.5, "F");
    text(doc, item.label, x + 11, y + 7, 6.9, COLORS.muted, "bold");
    fitText(doc, item.value, x + 11, y + 14.8, width - 16, 12.5, COLORS.text, "bold");
    fitText(doc, item.detail, x + 11, y + 20, width - 16, 6.8, item.color, "bold");
  });
}

function drawBars(doc: PdfDocument, title: string, subtitle: string, rows: ReadonlyArray<{ label: string; value: number; secondary?: number }>, x: number, y: number, width: number, height: number, color: Rgb): void {
  card(doc, x, y, width, height);
  text(doc, title, x + 6, y + 8, 10.2, COLORS.text, "bold");
  text(doc, subtitle, x + 6, y + 13, 7, COLORS.muted);
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.value, row.secondary ?? 0]));
  const labelWidth = Math.min(52, width * 0.35);
  const trackWidth = width - labelWidth - 18;
  const rowHeight = (height - 21) / Math.max(rows.length, 1);
  rows.forEach((row, index) => {
    const rowY = y + 18 + index * rowHeight;
    fitText(doc, row.label, x + 6, rowY + 3, labelWidth - 8, 7, COLORS.text, "bold");
    fill(doc, COLORS.brandSoft);
    doc.roundedRect(x + labelWidth, rowY, trackWidth, 3, 1.5, 1.5, "F");
    fill(doc, color);
    doc.roundedRect(x + labelWidth, rowY, Math.max(0.8, trackWidth * row.value / maximum), 3, 1.5, 1.5, "F");
    if (row.secondary != null) {
      fill(doc, [235, 236, 242]);
      doc.roundedRect(x + labelWidth, rowY + 4, trackWidth, 1.4, .7, .7, "F");
      fill(doc, COLORS.subtle);
      doc.roundedRect(x + labelWidth, rowY + 4, Math.max(.6, trackWidth * row.secondary / maximum), 1.4, .7, .7, "F");
    }
    text(doc, String(row.value), x + width - 7, rowY + 3, 7, COLORS.text, "bold");
  });
}

function drawTable(doc: PdfDocument, title: string, subtitle: string, headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>, x: number, y: number, width: number, height: number, columns: ReadonlyArray<number>): void {
  card(doc, x, y, width, height);
  text(doc, title, x + 6, y + 8, 10.2, COLORS.text, "bold");
  text(doc, subtitle, x + 6, y + 13, 7, COLORS.muted);
  fill(doc, COLORS.brandSoft);
  doc.rect(x + 1, y + 17, width - 2, 7, "F");
  headers.forEach((header, index) => text(doc, header, x + 6 + width * columns[index], y + 21.6, 6.6, COLORS.muted, "bold"));
  const rowHeight = Math.min(7, (height - 25) / Math.max(rows.length, 1));
  rows.forEach((row, rowIndex) => {
    const rowY = y + 24 + rowIndex * rowHeight;
    if (rowIndex % 2 === 1) { fill(doc, COLORS.page); doc.rect(x + 1, rowY, width - 2, rowHeight, "F"); }
    row.forEach((value, columnIndex) => {
      const next = columns[columnIndex + 1] ?? .98;
      fitText(doc, value, x + 6 + width * columns[columnIndex], rowY + rowHeight * .68, width * (next - columns[columnIndex]) - 7, 6.9, columnIndex === 0 ? COLORS.text : COLORS.muted, columnIndex === 0 ? "bold" : "normal");
    });
  });
}

function sum(values: ReadonlyArray<number>): number { return values.reduce((total, value) => total + value, 0); }

function drawSalesPage(doc: PdfDocument, dashboard: CommercialDashboardBundle, page: number, pages: number): void {
  const data = dashboard.sales;
  const total = sum(data.plans.map((plan) => plan.current));
  const leader = [...data.sellers].sort((a, b) => b.current - a.current)[0];
  const topPlan = [...data.plans].sort((a, b) => b.current - a.current)[0];
  beginPage(doc, "Vendas", "Ritmo, composição e desempenho comercial", data.referenceMonth);
  drawSummaryCards(doc, [
    { label: "VENDAS NO MÊS", value: String(total), detail: `${sum(data.plans.map((plan) => plan.previous))} no período anterior`, color: COLORS.brand },
    { label: "LÍDER COMERCIAL", value: leader?.name ?? "Sem dados", detail: `${leader?.current ?? 0} vendas`, color: COLORS.warning },
    { label: "PLANO MAIS VENDIDO", value: topPlan?.label ?? "Sem dados", detail: `${topPlan?.current ?? 0} vendas`, color: COLORS.info },
    { label: "MÉDIA POR VENDEDOR", value: (total / Math.max(data.sellers.length, 1)).toLocaleString("pt-BR", { maximumFractionDigits: 1 }), detail: "vendas por pessoa", color: COLORS.success },
  ]);
  drawBars(doc, "Comparativo por plano", "Atual em destaque; período anterior em cinza", data.plans.map((plan) => ({ label: plan.label, value: plan.current, secondary: plan.previous })), PAGE.margin, 60, 172, 67, COLORS.brand);
  drawBars(doc, "Ranking comercial", "Vendas por pessoa", [...data.sellers].sort((a, b) => b.current - a.current).map((seller) => ({ label: seller.name, value: seller.current, secondary: seller.previous })), 188, 60, 97, 67, COLORS.warning);
  drawTable(doc, "Vendas recentes", "Últimos registros do período importado", ["CLIENTE", "PLANO", "VENDEDOR", "LOCALIDADE", "STATUS"], data.recentSales.map((sale) => [sale.customer, sale.plan, sale.seller, sale.location, sale.status]), PAGE.margin, 133, 273, 57, [0, .28, .55, .69, .84]);
  finishPage(doc, data.updatedAt, page, pages);
}

function drawRenewalsPage(doc: PdfDocument, dashboard: CommercialDashboardBundle, page: number, pages: number): void {
  const data = dashboard.renewals;
  const total = sum(data.benefits.map((item) => item.count));
  const mainBenefit = [...data.benefits].sort((a, b) => b.count - a.count)[0];
  const withoutBenefit = data.benefits.find((item) => item.id === "none")?.count ?? 0;
  const topPlan = [...data.plans].sort((a, b) => b.count - a.count)[0];
  beginPage(doc, "Renovações", "Benefícios, planos e registros concluídos", data.referenceMonth);
  drawSummaryCards(doc, [
    { label: "RENOVAÇÕES NO MÊS", value: String(total), detail: `${data.monthly.at(-1)?.previousYear ?? 0} no período anterior`, color: COLORS.success },
    { label: "PRINCIPAL BENEFÍCIO", value: mainBenefit?.label ?? "Sem dados", detail: `${mainBenefit?.count ?? 0} registros`, color: COLORS.warning },
    { label: "SEM BENEFÍCIO", value: String(withoutBenefit), detail: `${total ? Math.round(withoutBenefit / total * 100) : 0}% do total`, color: COLORS.info },
    { label: "PLANO MAIS RENOVADO", value: topPlan?.label ?? "Sem dados", detail: `${topPlan?.count ?? 0} renovações`, color: COLORS.brand },
  ]);
  drawBars(doc, "Benefícios concedidos", "Distribuição das renovações", data.benefits.map((item) => ({ label: item.label, value: item.count })), PAGE.margin, 60, 135, 67, COLORS.success);
  drawBars(doc, "Planos renovados", "Volume por plano", data.plans.map((item) => ({ label: item.label, value: item.count })), 151, 60, 134, 67, COLORS.brand);
  drawTable(doc, "Renovações recentes", "Últimos registros do período importado", ["CLIENTE", "PLANO", "BENEFÍCIO", "VENDEDOR", "STATUS"], data.recentRenewals.map((item) => [item.customer, item.plan, item.benefit, item.seller, item.status]), PAGE.margin, 133, 273, 57, [0, .28, .53, .72, .86]);
  finishPage(doc, data.updatedAt, page, pages);
}

function drawCancellationsPage(doc: PdfDocument, dashboard: CommercialDashboardBundle, page: number, pages: number): void {
  const data = dashboard.cancellations;
  const total = sum(data.reasons.map((item) => item.count));
  const previous = data.monthly.at(-1)?.previousYear ?? 0;
  const mainReason = [...data.reasons].sort((a, b) => b.count - a.count)[0];
  const location = [...data.locations].sort((a, b) => b.current - a.current)[0];
  beginPage(doc, "Cancelamentos", "Motivos, localidades e registros concluídos", data.referenceMonth);
  drawSummaryCards(doc, [
    { label: "CANCELAMENTOS NO MÊS", value: String(total), detail: `${previous} no período anterior`, color: COLORS.danger },
    { label: "VARIAÇÃO ABSOLUTA", value: String(total - previous), detail: "em relação ao anterior", color: total <= previous ? COLORS.success : COLORS.warning },
    { label: "PRINCIPAL MOTIVO", value: mainReason?.label ?? "Sem dados", detail: `${mainReason?.count ?? 0} registros`, color: COLORS.warning },
    { label: "LOCALIDADE EM ATENÇÃO", value: location?.location ?? "Sem dados", detail: `${location?.current ?? 0} cancelamentos`, color: COLORS.info },
  ]);
  drawBars(doc, "Motivos de cancelamento", "Distribuição dos casos concluídos", data.reasons.map((item) => ({ label: item.label, value: item.count })), PAGE.margin, 60, 172, 67, COLORS.danger);
  drawBars(doc, "Localidades", "Concentração territorial", data.locations.map((item) => ({ label: item.location, value: item.current, secondary: item.previous })), 188, 60, 97, 67, COLORS.warning);
  drawTable(doc, "Cancelamentos recentes", "Últimos registros do período importado", ["CLIENTE", "MOTIVO", "PLANO", "LOCALIDADE", "STATUS"], data.recentCancellations.map((item) => [item.customer, item.reason, item.plan, item.location, item.status]), PAGE.margin, 133, 273, 57, [0, .25, .51, .70, .85]);
  finishPage(doc, data.updatedAt, page, pages);
}

function drawTeamPage(doc: PdfDocument, dashboard: CommercialDashboardBundle, page: number, pages: number): void {
  const data = dashboard.team;
  const total = sum(data.members.map((member) => member.sales + member.renewals));
  const leader = [...data.members].sort((a, b) => (b.sales + b.renewals) - (a.sales + a.renewals))[0];
  beginPage(doc, "Equipe comercial", "Produção, composição e evolução individual", data.referenceMonth);
  drawSummaryCards(doc, [
    { label: "PRODUÇÃO TOTAL", value: String(total), detail: "vendas e renovações", color: COLORS.brand },
    { label: "VENDAS", value: String(sum(data.members.map((item) => item.sales))), detail: "realizadas pela equipe", color: COLORS.info },
    { label: "RENOVAÇÕES", value: String(sum(data.members.map((item) => item.renewals))), detail: "realizadas pela equipe", color: COLORS.success },
    { label: "LÍDER DO PERÍODO", value: leader?.name ?? "Sem dados", detail: `${(leader?.sales ?? 0) + (leader?.renewals ?? 0)} movimentos`, color: COLORS.warning },
  ]);
  drawBars(doc, "Produção por pessoa", "Vendas e renovações combinadas", data.members.map((member) => ({ label: member.name, value: member.sales + member.renewals, secondary: member.previousSales + member.previousRenewals })), PAGE.margin, 60, 172, 67, COLORS.brand);
  drawBars(doc, "Composição da equipe", "Vendas em azul; renovações em cinza", data.members.map((member) => ({ label: member.name, value: member.sales, secondary: member.renewals })), 188, 60, 97, 67, COLORS.info);
  drawTable(doc, "Desempenho detalhado", "Resultado individual do período", ["PROFISSIONAL", "VENDAS", "RENOVAÇÕES", "PRODUÇÃO", "PARTICIPAÇÃO"], data.members.map((member) => { const memberTotal = member.sales + member.renewals; return [member.name, String(member.sales), String(member.renewals), String(memberTotal), `${total ? (memberTotal / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}%`]; }), PAGE.margin, 133, 273, 57, [0, .34, .49, .66, .82]);
  finishPage(doc, data.updatedAt, page, pages);
}

function mapPoint(location: MappedCommercialLocation, locations: ReadonlyArray<MappedCommercialLocation>, x: number, y: number, width: number, height: number): { x: number; y: number } {
  const longitudes = locations.map((item) => item.longitude);
  const latitudes = locations.map((item) => item.latitude);
  const minLongitude = Math.min(...longitudes, -44.18);
  const maxLongitude = Math.max(...longitudes, -43.88);
  const minLatitude = Math.min(...latitudes, -23.05);
  const maxLatitude = Math.max(...latitudes, -22.88);
  const longitudeRange = Math.max(.01, maxLongitude - minLongitude);
  const latitudeRange = Math.max(.01, maxLatitude - minLatitude);
  return {
    x: x + 8 + (location.longitude - minLongitude) / longitudeRange * (width - 16),
    y: y + 8 + (maxLatitude - location.latitude) / latitudeRange * (height - 16),
  };
}

type MapViewport = {
  zoom: number;
  topLeftX: number;
  topLeftY: number;
  width: number;
  height: number;
};

const MAP_CANVAS = { width: 1600, height: 960, padding: 110, tileSize: 256 } as const;

function longitudeToWorldX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * MAP_CANVAS.tileSize * 2 ** zoom;
}

function latitudeToWorldY(latitude: number, zoom: number): number {
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = boundedLatitude * Math.PI / 180;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * MAP_CANVAS.tileSize * 2 ** zoom;
}

function createMapViewport(locations: ReadonlyArray<MappedCommercialLocation>): MapViewport {
  const relevantLocations = locations.length ? locations : [{ latitude: -22.959, longitude: -44.041 }];
  let selectedZoom = 11;
  let bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  for (let zoom = 15; zoom >= 8; zoom -= 1) {
    const xs = relevantLocations.map((item) => longitudeToWorldX(item.longitude, zoom));
    const ys = relevantLocations.map((item) => latitudeToWorldY(item.latitude, zoom));
    const candidate = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    if (candidate.maxX - candidate.minX <= MAP_CANVAS.width - MAP_CANVAS.padding * 2 && candidate.maxY - candidate.minY <= MAP_CANVAS.height - MAP_CANVAS.padding * 2) {
      selectedZoom = zoom;
      bounds = candidate;
      break;
    }
  }
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom: selectedZoom,
    topLeftX: centerX - MAP_CANVAS.width / 2,
    topLeftY: centerY - MAP_CANVAS.height / 2,
    width: MAP_CANVAS.width,
    height: MAP_CANVAS.height,
  };
}

function mapCanvasPoint(location: MappedCommercialLocation, viewport: MapViewport): { x: number; y: number } {
  return {
    x: longitudeToWorldX(location.longitude, viewport.zoom) - viewport.topLeftX,
    y: latitudeToWorldY(location.latitude, viewport.zoom) - viewport.topLeftY,
  };
}

async function fetchMapTile(zoom: number, tileX: number, tileY: number): Promise<ImageBitmap> {
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
  if (window.nexusDesktop) {
    const tile = await window.nexusDesktop.fetchMapTile(tileUrl);
    return await createImageBitmap(new Blob([tile.data], { type: tile.contentType }));
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(tileUrl, {
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenStreetMap respondeu com ${response.status}`);
    return await createImageBitmap(await response.blob());
  } finally {
    window.clearTimeout(timeout);
  }
}

function mapTileFingerprint(image: ImageBitmap): string {
  const sample = document.createElement("canvas");
  sample.width = 32;
  sample.height = 32;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return `${image.width}x${image.height}`;
  context.drawImage(image, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  let hash = 2166136261;
  for (let index = 0; index < pixels.length; index += 4) {
    hash ^= pixels[index];
    hash = Math.imul(hash, 16777619);
    hash ^= pixels[index + 1];
    hash = Math.imul(hash, 16777619);
    hash ^= pixels[index + 2];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function renderOpenStreetMapBase(locations: ReadonlyArray<MappedCommercialLocation>): Promise<{ canvas: HTMLCanvasElement; viewport: MapViewport }> {
  const viewport = createMapViewport(locations);
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível para renderizar o mapa");
  context.fillStyle = "#e6ece8";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const firstTileX = Math.floor(viewport.topLeftX / MAP_CANVAS.tileSize);
  const lastTileX = Math.floor((viewport.topLeftX + viewport.width) / MAP_CANVAS.tileSize);
  const firstTileY = Math.floor(viewport.topLeftY / MAP_CANVAS.tileSize);
  const lastTileY = Math.floor((viewport.topLeftY + viewport.height) / MAP_CANVAS.tileSize);
  const tileCount = 2 ** viewport.zoom;
  const tiles: Array<Promise<{ image: ImageBitmap; x: number; y: number } | null>> = [];

  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      const normalizedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push(fetchMapTile(viewport.zoom, normalizedTileX, tileY)
        .then((image) => ({ image, x: tileX * MAP_CANVAS.tileSize - viewport.topLeftX, y: tileY * MAP_CANVAS.tileSize - viewport.topLeftY }))
        .catch(() => null));
    }
  }

  const loadedTiles = (await Promise.all(tiles)).filter((tile): tile is { image: ImageBitmap; x: number; y: number } => tile !== null);
  if (!loadedTiles.length) throw new Error("Não foi possível carregar a base do OpenStreetMap");
  const fingerprintFrequency = new Map<string, number>();
  loadedTiles.forEach(({ image }) => {
    const fingerprint = mapTileFingerprint(image);
    fingerprintFrequency.set(fingerprint, (fingerprintFrequency.get(fingerprint) ?? 0) + 1);
  });
  const repeatedTiles = Math.max(0, ...fingerprintFrequency.values());
  if (loadedTiles.length >= 4 && repeatedTiles / loadedTiles.length >= .7) {
    loadedTiles.forEach(({ image }) => image.close());
    throw new Error("O provedor devolveu blocos de mapa repetidos ou bloqueados.");
  }
  loadedTiles.forEach(({ image, x, y }) => {
    context.drawImage(image, Math.round(x), Math.round(y), MAP_CANVAS.tileSize + 1, MAP_CANVAS.tileSize + 1);
    image.close();
  });

  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, viewport };
}

function rgbCss(color: Rgb): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function renderMapImage(base: HTMLCanvasElement, viewport: MapViewport, locations: ReadonlyArray<MappedCommercialLocation>, metric: LocationMetricId, color: Rgb): string {
  const canvas = document.createElement("canvas");
  canvas.width = base.width;
  canvas.height = base.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível para finalizar o mapa");
  context.drawImage(base, 0, 0);

  const visible = locations.filter((location) => location[metric] > 0);
  const maximum = Math.max(1, ...visible.map((location) => location[metric]));
  const placed: Array<{ x: number; y: number; radius: number }> = [];
  [...visible].sort((left, right) => right[metric] - left[metric]).forEach((location) => {
    const origin = mapCanvasPoint(location, viewport);
    const radius = 25 + Math.sqrt(location[metric] / maximum) * 34;
    let point = origin;
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const ring = Math.ceil(attempt / 8);
      const angle = attempt * Math.PI / 4;
      const candidate = attempt === 0 ? origin : { x: origin.x + Math.cos(angle) * ring * 78, y: origin.y + Math.sin(angle) * ring * 68 };
      const inside = candidate.x - radius > 18 && candidate.x + radius < canvas.width - 18 && candidate.y - radius > 18 && candidate.y + radius < canvas.height - 48;
      const free = placed.every((item) => Math.hypot(candidate.x - item.x, candidate.y - item.y) > radius + item.radius + 18);
      if (inside && free) { point = candidate; break; }
    }
    if (Math.hypot(point.x - origin.x, point.y - origin.y) > 2) {
      context.strokeStyle = "rgba(55, 65, 81, 0.72)";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    }
    placed.push({ ...point, radius });
    context.fillStyle = rgbCss(color);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 9;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#ffffff";
    context.font = `700 ${Math.max(25, radius * .72)}px Inter, Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(location[metric]), point.x, point.y + 1);

    const labelOnLeft = point.x > canvas.width * .68;
    const labelX = point.x + (labelOnLeft ? -radius - 14 : radius + 14);
    context.font = "700 22px Inter, Arial, sans-serif";
    context.textAlign = labelOnLeft ? "right" : "left";
    context.textBaseline = "middle";
    context.lineWidth = 7;
    context.strokeStyle = "rgba(255, 255, 255, 0.95)";
    context.strokeText(location.location, labelX, point.y);
    context.fillStyle = "#111827";
    context.fillText(location.location, labelX, point.y);
  });

  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.fillRect(12, canvas.height - 35, 255, 25);
  context.fillStyle = "#4b5563";
  context.font = "16px Inter, Arial, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("© OpenStreetMap contributors", 20, canvas.height - 22);
  return canvas.toDataURL("image/jpeg", .92);
}

function drawVectorMap(doc: PdfDocument, locations: ReadonlyArray<MappedCommercialLocation>, metric: LocationMetricId, color: Rgb, x: number, y: number, width: number, height: number): void {
  fill(doc, [226, 235, 230]);
  doc.rect(x, y, width, height, "F");
  fill(doc, [211, 225, 232]);
  doc.rect(x, y + height * .62, width, height * .38, "F");
  stroke(doc, [194, 207, 201]);
  doc.setLineWidth(.18);
  for (let index = 1; index < 6; index += 1) {
    doc.line(x + width * index / 6, y, x + width * index / 6, y + height);
    doc.line(x, y + height * index / 6, x + width, y + height * index / 6);
  }
  const route = [...locations].sort((left, right) => left.longitude - right.longitude);
  stroke(doc, [151, 158, 164]);
  doc.setLineWidth(.8);
  for (let index = 1; index < route.length; index += 1) {
    const previous = mapPoint(route[index - 1], locations, x, y, width, height);
    const current = mapPoint(route[index], locations, x, y, width, height);
    doc.line(previous.x, previous.y, current.x, current.y);
  }
  const visible = locations.filter((location) => location[metric] > 0);
  const maximum = Math.max(1, ...visible.map((location) => location[metric]));
  const placed: Array<{ x: number; y: number; radius: number }> = [];
  [...visible].sort((left, right) => right[metric] - left[metric]).forEach((location) => {
    const origin = mapPoint(location, locations, x, y, width, height);
    const radius = 3.2 + Math.sqrt(location[metric] / maximum) * 4.8;
    let point = origin;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const ring = Math.ceil(attempt / 6);
      const angle = attempt * Math.PI / 3;
      const candidate = attempt === 0 ? origin : { x: origin.x + Math.cos(angle) * ring * 9, y: origin.y + Math.sin(angle) * ring * 9 };
      const inside = candidate.x - radius > x + 2 && candidate.x + radius < x + width - 2 && candidate.y - radius > y + 2 && candidate.y + radius + 5 < y + height - 2;
      const free = placed.every((item) => Math.hypot(candidate.x - item.x, candidate.y - item.y) > radius + item.radius + 2.5);
      if (inside && free) { point = candidate; break; }
    }
    if (Math.hypot(point.x - origin.x, point.y - origin.y) > 1) {
      stroke(doc, [125, 132, 140]);
      doc.setLineWidth(.45);
      doc.line(origin.x, origin.y, point.x, point.y);
      fill(doc, [125, 132, 140]);
      doc.circle(origin.x, origin.y, .8, "F");
    }
    placed.push({ ...point, radius });
    fill(doc, color);
    stroke(doc, [255, 255, 255]);
    doc.setLineWidth(1.2);
    doc.circle(point.x, point.y, radius, "FD");
    doc.setFont(REPORT_EXPORT_STYLE.pdfFontFamily, "bold");
    doc.setFontSize(Math.max(6, radius + 1));
    ink(doc, REPORT_EXPORT_STYLE.pdfRgb.inverse);
    doc.text(String(location[metric]), point.x, point.y + 1.1, { align: "center" });
    doc.setFontSize(6.2);
    ink(doc, COLORS.text);
    const labelOnLeft = point.x <= x + width / 2;
    doc.text(location.location, point.x + (labelOnLeft ? -radius - 2 : radius + 2), point.y + 1.5, { align: labelOnLeft ? "right" : "left" });
  });
  text(doc, "Posições proporcionais às coordenadas cadastradas", x + 3, y + height - 3, 5.8, COLORS.muted);
}

function drawMapPage(doc: PdfDocument, locations: ReadonlyArray<MappedCommercialLocation>, metric: LocationMetricId, label: string, color: Rgb, updatedAt: string, referenceMonth: string, page: number, pages: number, mapImage?: string): void {
  beginPage(doc, `Mapa de ${label.toLowerCase()}`, `Distribuição territorial por ${label.toLowerCase()}`, referenceMonth);
  card(doc, PAGE.margin, 31, 213, 157);
  if (mapImage) doc.addImage(mapImage, "JPEG", PAGE.margin + 2, 33, 209, 153, undefined, "FAST");
  else drawVectorMap(doc, locations, metric, color, PAGE.margin + 2, 33, 209, 153);
  card(doc, 229, 31, 56, 157);
  text(doc, "Ranking", 235, 40, 11, COLORS.text, "bold");
  text(doc, `${label} por localidade`, 235, 46, 7, COLORS.muted);
  const ranked = [...locations].filter((item) => item[metric] > 0).sort((a, b) => b[metric] - a[metric]).slice(0, 10);
  ranked.forEach((item, index) => {
    const rowY = 56 + index * 12.2;
    fill(doc, index === 0 ? COLORS.brandSoft : COLORS.page);
    doc.roundedRect(234, rowY - 5, 46, 10, 1.8, 1.8, "F");
    text(doc, String(index + 1), 237, rowY + 1, 7.2, index === 0 ? color : COLORS.muted, "bold");
    fitText(doc, item.location, 242, rowY, 29, 7, COLORS.text, "bold");
    doc.setFontSize(8);
    ink(doc, color);
    doc.text(String(item[metric]), 277, rowY, { align: "right" });
  });
  if (!ranked.length) text(doc, "Sem registros no período", 235, 58, 7.2, COLORS.muted);
  finishPage(doc, updatedAt, page, pages);
}

function safeFilename(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function generateCommercialReportPdf(report: CommercialReportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const data = report.overview;
  const pages = 8;
  doc.setProperties({
    title: `Nexus Sales Intelligence - ${data.referenceMonth}`,
    subject: "Relatório comercial completo",
    author: "Nexus Sales Intelligence",
    creator: "Nexus Sales Intelligence",
  });

  fill(doc, COLORS.page);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  fill(doc, COLORS.brand);
  doc.roundedRect(PAGE.margin, PAGE.margin, 9, 9, 2, 2, "F");
  text(doc, "N", PAGE.margin + 2.45, PAGE.margin + 6.6, 12, REPORT_EXPORT_STYLE.pdfRgb.inverse, "bold");
  text(doc, "Nexus Sales Intelligence", PAGE.margin + 13, PAGE.margin + 4.3, 14, COLORS.text, "bold");
  text(doc, "Visão geral comercial", PAGE.margin + 13, PAGE.margin + 9.3, 8, COLORS.muted);
  doc.setFont(REPORT_EXPORT_STYLE.pdfFontFamily, "bold");
  doc.setFontSize(11);
  ink(doc, COLORS.text);
  doc.text(data.referenceMonth, PAGE.width - PAGE.margin, PAGE.margin + 4.2, { align: "right" });
  doc.setFont(REPORT_EXPORT_STYLE.pdfFontFamily, "normal");
  doc.setFontSize(7.2);
  ink(doc, COLORS.info);
  doc.text(data.sourceLabel, PAGE.width - PAGE.margin, PAGE.margin + 9.2, { align: "right" });
  stroke(doc, COLORS.border);
  doc.line(PAGE.margin, 25, PAGE.width - PAGE.margin, 25);

  drawKpis(doc, data, 31);
  drawPlanChart(doc, data, PAGE.margin, 61, 181, 73);
  drawConcentration(doc, data, 197, 61, 88, 73);
  drawOperationalTable(doc, data, PAGE.margin, 140, PAGE.width - PAGE.margin * 2);

  text(doc, `Atualizado em ${data.updatedAt}`, PAGE.margin, PAGE.height - 5, 6.8, COLORS.muted);
  doc.text(`Nexus Sales Intelligence - página 1 de ${pages}`, PAGE.width - PAGE.margin, PAGE.height - 5, { align: "right" });

  doc.addPage("a4", "landscape");
  drawSalesPage(doc, report.dashboard, 2, pages);
  doc.addPage("a4", "landscape");
  drawRenewalsPage(doc, report.dashboard, 3, pages);
  doc.addPage("a4", "landscape");
  drawCancellationsPage(doc, report.dashboard, 4, pages);
  doc.addPage("a4", "landscape");
  drawTeamPage(doc, report.dashboard, 5, pages);

  const mappedLocations = mapCommercialLocations(report.locationMetrics);
  const mapSpecs: ReadonlyArray<{ metric: LocationMetricId; label: string; color: Rgb }> = [
    { metric: "sales", label: "Vendas", color: COLORS.brand },
    { metric: "renewals", label: "Renovações", color: COLORS.success },
    { metric: "cancellations", label: "Cancelamentos", color: COLORS.danger },
  ];
  let mapImages: Partial<Record<LocationMetricId, string>> = {};
  try {
    const { canvas, viewport } = await renderOpenStreetMapBase(mappedLocations);
    mapImages = Object.fromEntries(mapSpecs.map((spec) => [spec.metric, renderMapImage(canvas, viewport, mappedLocations, spec.metric, spec.color)]));
  } catch (error) {
    console.warn("OpenStreetMap indisponível; usando o mapa local simplificado.", error);
  }
  mapSpecs.forEach((spec, index) => {
    doc.addPage("a4", "landscape");
    drawMapPage(doc, mappedLocations, spec.metric, spec.label, spec.color, data.updatedAt, data.referenceMonth, 6 + index, pages, mapImages[spec.metric]);
  });

  const filename = `nexus-sales-intelligence-relatorio-completo-${safeFilename(data.referenceMonth || "relatorio")}.pdf`;
  await doc.save(filename, { returnPromise: true });
}
