import type { CancellationReasonId, RenewalBenefitId, SalesPlanId, SellerId } from "@/core/types/commercialDashboard";
import type { ClassifiedCancellation, ClassifiedCommercialImport, ClassifiedReactivation, ClassifiedRenewal, ClassifiedSale, ImportedWorksheet, ProcessedAttendance, SpreadsheetCell } from "../types/spreadsheetImport";

type RowRecord = Readonly<Record<string, SpreadsheetCell>>;
type ServiceOrder = {
  id: string;
  customerCode: string;
  customerName: string;
  ticketIds: ReadonlyArray<string>;
  type: string;
  status: string;
  location: string;
};

type ServiceOrderIndex = {
  byId: ReadonlyMap<string, ServiceOrder>;
  byCustomerCode: ReadonlyMap<string, ReadonlyArray<ServiceOrder>>;
  byCustomerName: ReadonlyMap<string, ReadonlyArray<ServiceOrder>>;
};

const REQUIRED_ATTENDANCE_HEADERS = ["protocolo", "nome_razaosocial", "descricao_abertura", "data_cadastro", "usuario_abertura", "status"] as const;
const REQUIRED_OS_HEADERS = ["numero_ordem_servico", "tipo_ordem_servico", "status", "data_inicio_programado"] as const;

const SELLERS: ReadonlyArray<{ id: SellerId; name: string; pattern: RegExp }> = [
  { id: "beatriz", name: "Beatriz", pattern: /\bbeatriz\b/ },
  { id: "karini", name: "Karini", pattern: /\bkarini\b/ },
  { id: "giovanna", name: "Giovanna", pattern: /\bgiovanna\b/ },
  { id: "sara", name: "Sara", pattern: /\bsara\b/ },
];

const PLANS: ReadonlyArray<{ id: SalesPlanId; label: string; pattern: RegExp }> = [
  { id: "combo-total-plus", label: "600 Mega Combo Total Plus", pattern: /600\s*mega\s*combo\s*total\s*plus/ },
  { id: "combo-view", label: "600 Mega Combo View", pattern: /600\s*mega\s*combo\s*view/ },
  { id: "combo-plus", label: "600 Mega Combo Plus", pattern: /600\s*mega(?:\s*combo)?\s*plus/ },
  { id: "combo-ultra", label: "720 Mega Combo Ultra", pattern: /720\s*mega(?:\s*combo)?(?:\s*ultra|\s*plus)?/ },
  { id: "power-plus", label: "900 Mega Power Plus", pattern: /900\s*mega(?:\s*power)?\s*plus/ },
  { id: "ultra-power", label: "1 Giga Ultra Power", pattern: /1\s*giga\s*ultra\s*power/ },
];

function normalize(value: SpreadsheetCell | string): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function text(row: RowRecord, key: string): string {
  return String(row[key] ?? "").trim();
}

function rowsFromWorksheet(worksheet: ImportedWorksheet, requiredHeaders: ReadonlyArray<string>, label: string): ReadonlyArray<RowRecord> {
  const [headerRow, ...dataRows] = worksheet.rows;
  if (!headerRow) throw new Error(`A planilha de ${label} está vazia.`);
  const headers = headerRow.map((value) => normalize(value));
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`A planilha de ${label} não possui as colunas obrigatórias: ${missing.join(", ")}.`);
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
}

function deduplicateRows(rows: ReadonlyArray<RowRecord>, key: string): ReadonlyArray<RowRecord> {
  const uniqueRows = new Map<string, RowRecord>();
  for (const row of rows) uniqueRows.set(text(row, key), row);
  return [...uniqueRows.values()];
}

function parseDate(value: SpreadsheetCell): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] ?? 0), Number(match[5] ?? 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractOrderId(combinedText: string): string | null {
  return combinedText.match(/ordem de servi[cç]o(?: de)?\s*(?:n[ºo°.]*)?\s*(\d{12,})/i)?.[1] ?? null;
}

function extractTicketIds(combinedText: string): ReadonlyArray<string> {
  return [...combinedText.matchAll(/(?:ticket|protocolo\s+blip)\s*:?\s*#\s*(\d+)/gi)].map((match) => match[1]);
}

function appendOrder(index: Map<string, ServiceOrder[]>, key: string, order: ServiceOrder): void {
  if (!key) return;
  index.set(key, [...(index.get(key) ?? []), order]);
}

function matchingTicketOrder(candidates: ReadonlyArray<ServiceOrder>, ticketIds: ReadonlyArray<string>): ServiceOrder | undefined {
  if (!ticketIds.length) return undefined;
  const matches = candidates.filter((order) => order.ticketIds.some((ticketId) => ticketIds.includes(ticketId)));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const locations = new Set(matches.map((order) => normalize(order.location)).filter(Boolean));
    if (locations.size === 1) {
      return {
        ...matches[0],
        id: matches.map((order) => order.id).join("|"),
        type: "VÍNCULO AMBÍGUO",
        status: "",
        location: matches.find((order) => order.location)?.location ?? "",
      };
    }
  }
  return undefined;
}

function resolveServiceOrder(row: RowRecord, combinedText: string, orders: ServiceOrderIndex): ServiceOrder | undefined {
  const explicitOrderId = extractOrderId(combinedText);
  if (explicitOrderId) return orders.byId.get(explicitOrderId);

  const ticketIds = extractTicketIds(combinedText);
  const customerCode = text(row, "codigo_cliente");
  const byCode = customerCode ? orders.byCustomerCode.get(customerCode) ?? [] : [];
  const codeAndTicket = matchingTicketOrder(byCode, ticketIds);
  if (codeAndTicket) return codeAndTicket;

  const customerName = normalize(text(row, "nome_razaosocial"));
  const byName = customerName ? orders.byCustomerName.get(customerName) ?? [] : [];
  const nameAndTicket = matchingTicketOrder(byName, ticketIds);
  if (nameAndTicket) return nameAndTicket;

  const quantityOs = Number(text(row, "quantidade_os"));
  if (quantityOs === 1 && byCode.length === 1) return byCode[0];
  return undefined;
}

function extractPlan(combinedText: string): { id: SalesPlanId; label: string } {
  const normalized = normalize(combinedText);
  return PLANS.find((plan) => plan.pattern.test(normalized)) ?? { id: "other", label: "Outros planos" };
}

function resolveSeller(row: RowRecord, combinedText: string): { id: SellerId; name: string } {
  const normalized = normalize(combinedText);
  const indication = normalized.match(/indica[cç][aã]o\s+(?:da|do)?\s*([a-z]+)/)?.[1] ?? "";
  return SELLERS.find((seller) => seller.pattern.test(indication))
    ?? SELLERS.find((seller) => seller.pattern.test(normalize(text(row, "usuario_abertura"))))
    ?? { id: "sara", name: text(row, "usuario_abertura") || "Não informado" };
}

function extractBenefit(combinedText: string): { id: RenewalBenefitId; label: string } {
  const normalized = normalize(combinedText);
  if (/dobro (?:de|da) velocidade/.test(normalized)) return { id: "double-speed", label: "Dobro de velocidade" };
  if (/\bupgrade\b|altera[cç][aã]o do plano|passando de/.test(normalized)) return { id: "upgrade", label: "Upgrade no plano" };
  if (/\bdesconto\b|redu[cç][aã]o (?:de|do) valor/.test(normalized)) return { id: "discount", label: "Desconto" };
  if (/\bdowngrade\b|redu[cç][aã]o (?:de|da) velocidade/.test(normalized)) return { id: "downgrade", label: "Downgrade no plano" };
  const bonus = normalized.match(/(?:b[oô]nus|bonifica[cç][aã]o)[^\d+]*(?:de\s*)?\+?(\d{2,4})\s*(?:mega|mb)?/);
  if (bonus) return { id: "bonus-speed", label: `Bônus de ${bonus[1]} Mega` };
  return { id: "none", label: "Sem benefício adicional" };
}

function extractCancellationReason(combinedText: string): { id: CancellationReasonId; label: string } {
  const normalized = normalize(combinedText);
  if (/sem cobertura|fora da area de cobertura|sem viabilidade/.test(normalized)) return { id: "no-coverage", label: "Mudança para local sem cobertura" };
  if (/insatisfa[cç][aã]o|quedas|oscila[cç][aã]o|problema.*conex[aã]o/.test(normalized)) return { id: "dissatisfaction", label: "Insatisfação com o serviço" };
  if (/outro provedor|outra operadora|ja (?:havia|possui|tinha) internet/.test(normalized)) return { id: "existing-provider", label: "Outro provedor no endereço" };
  if (/financeir|sem condi[cç][oõ]es|valor.*alto|inadimpl/.test(normalized)) return { id: "financial", label: "Motivo financeiro" };
  if (/fechamento do com[eé]rcio|encerrou.*atividades/.test(normalized)) return { id: "closed-business", label: "Fechamento do comércio" };
  if (/pouco uso|n[aã]o utiliza|n[aã]o necessita/.test(normalized)) return { id: "low-usage", label: "Pouco uso" };
  if (/mudan[cç]a|se mudou|novo endere[cç]o|entregou o im[oó]vel/.test(normalized)) return { id: "moving", label: "Mudança de endereço" };
  return { id: "other", label: "Outros motivos" };
}

function locationFromOrder(order: ServiceOrder | undefined, combinedText: string): string {
  if (order?.location) return order.location;
  const normalized = normalize(combinedText);
  const known = ["Praia Grande", "Praia Pequena", "Vila Muriqui", "Muriqui", "Sahy", "Ibicuí", "Mangaratiba"];
  return known.find((location) => normalized.includes(normalize(location))) ?? "Não informada";
}

function isNegativeOutcome(combinedText: string): boolean {
  const normalized = normalize(combinedText);
  return /n[aã]o foi realizad|sem prosseguimento|n[aã]o foi poss[ií]vel|n[aã]o deseja|n[aã]o possui interesse|n[aã]o retornou|j[aá] havia sido realizada anteriormente/.test(normalized);
}

function isCompletedCancellation(combinedText: string, order: ServiceOrder | undefined): boolean {
  const normalized = normalize(combinedText);
  if (order && /retirada|desist[eê]ncia/.test(normalize(order.type))) return true;
  if (/n[aã]o deseja mais realizar o cancelamento|desistiu do cancelamento|n[aã]o foi poss[ií]vel.*(?:concluir|prosseguir).*cancelamento/.test(normalized)) return false;
  return /cancelamento (?:foi )?(?:realizado|conclu[ií]do|efetivado)|(?:contrato|servi[cç]o) (?:foi )?cancelad[oa]|retirada (?:foi|ser[aá]) agendada/.test(normalized);
}

function orderIndex(rows: ReadonlyArray<RowRecord>): ServiceOrderIndex {
  const byId = new Map<string, ServiceOrder>();
  const byCustomerCode = new Map<string, ServiceOrder[]>();
  const byCustomerName = new Map<string, ServiceOrder[]>();
  for (const row of rows) {
    const id = text(row, "numero_ordem_servico");
    if (!/^\d{12,}$/.test(id)) continue;
    const order: ServiceOrder = {
      id,
      customerCode: text(row, "codigo_cliente"),
      customerName: text(row, "nome_razaosocial"),
      ticketIds: extractTicketIds(`${text(row, "descricao_abertura")} ${text(row, "descricao_servico")} ${text(row, "descricao_fechamento")}`),
      type: text(row, "tipo_ordem_servico"),
      status: text(row, "status"),
      location: text(row, "bairro") || text(row, "cidade"),
    };
    byId.set(id, order);
    appendOrder(byCustomerCode, order.customerCode, order);
    appendOrder(byCustomerName, normalize(order.customerName), order);
  }
  return { byId, byCustomerCode, byCustomerName };
}

function importPeriodKey(start: Date, end: Date): string {
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${dateKey(start)}__${dateKey(end)}`;
}

export function classifyCommercialRows(attendance: ImportedWorksheet, serviceOrders: ImportedWorksheet): ClassifiedCommercialImport {
  const attendanceRows = deduplicateRows(rowsFromWorksheet(attendance, REQUIRED_ATTENDANCE_HEADERS, "atendimentos").filter((row) => /^\d{12,}$/.test(text(row, "protocolo"))), "protocolo");
  const osRows = deduplicateRows(rowsFromWorksheet(serviceOrders, REQUIRED_OS_HEADERS, "ordens de serviço").filter((row) => /^\d{12,}$/.test(text(row, "numero_ordem_servico"))), "numero_ordem_servico");
  if (!attendanceRows.length) throw new Error("Nenhum atendimento válido foi encontrado no arquivo selecionado.");
  if (!osRows.length) throw new Error("Nenhuma ordem de serviço válida foi encontrada no arquivo selecionado.");

  const orders = orderIndex(osRows);
  const sales: ClassifiedSale[] = [];
  const renewals: ClassifiedRenewal[] = [];
  const cancellations: ClassifiedCancellation[] = [];
  const reactivations: ClassifiedReactivation[] = [];
  const processedAttendance: ProcessedAttendance[] = [];
  const dates: Date[] = [];
  let linkedServiceOrders = 0;
  const classifiedProtocols = new Set<string>();

  for (const row of attendanceRows) {
    const date = parseDate(row.data_cadastro);
    if (!date) continue;
    dates.push(date);
    const combined = `${text(row, "descricao_abertura")} ${text(row, "descricao_fechamento")}`;
    const protocol = text(row, "protocolo");
    const normalized = normalize(combined);
    const linkedOrder = resolveServiceOrder(row, combined, orders);
    if (linkedOrder) linkedServiceOrders += 1;
    processedAttendance.push({ id: protocol, date, linkedServiceOrder: Boolean(linkedOrder) });
    const plan = extractPlan(combined);
    const seller = resolveSeller(row, combined);

    const isSale = /instalacao fibra optica plano\s*:/.test(normalized) && !isNegativeOutcome(combined);
    if (isSale) {
      sales.push({
        id: protocol,
        date,
        customer: text(row, "nome_razaosocial") || "Cliente não informado",
        planId: plan.id,
        planLabel: plan.label,
        sellerId: seller.id,
        sellerName: seller.name,
        location: locationFromOrder(linkedOrder, combined),
        installed: /instala[cç][aã]o/.test(normalize(linkedOrder?.type ?? "")) && normalize(linkedOrder?.status ?? "") === "finalizado",
        withdrawn: /retirada|desist[eê]ncia/.test(normalize(linkedOrder?.type ?? "")),
      });
      classifiedProtocols.add(protocol);
    }

    const hasRenewal = /\brenova(cao|r|do|da)|renovad[oa]\b/.test(normalized);
    const positiveRenewal = /foi realizad|foi aplicad|foi efetuad|bonifica[cç][aã]o|b[oô]nus promocional|passando de/.test(normalized);
    if (hasRenewal && positiveRenewal && !isNegativeOutcome(combined)) {
      const benefit = extractBenefit(combined);
      renewals.push({
        id: protocol,
        date,
        customer: text(row, "nome_razaosocial") || "Cliente não informado",
        planLabel: plan.label,
        benefitId: benefit.id,
        benefitLabel: benefit.label,
        sellerName: seller.name,
        location: locationFromOrder(linkedOrder, combined),
        completed: normalize(text(row, "status")) === "resolvido",
      });
      classifiedProtocols.add(protocol);
    }

    const hasCancellation = /\bcancela(mento|r|do|da)|cancelou\b|\bdesist(e|iu|encia|ência)\b/.test(normalized)
      || /retirada|desist[eê]ncia/.test(normalize(linkedOrder?.type ?? ""));
    if (hasCancellation) {
      const reason = extractCancellationReason(combined);
      cancellations.push({
        id: protocol,
        date,
        customer: text(row, "nome_razaosocial") || "Cliente não informado",
        planLabel: plan.label,
        reasonId: reason.id,
        reasonLabel: reason.label,
        location: locationFromOrder(linkedOrder, combined),
        completed: isCompletedCancellation(combined, linkedOrder),
      });
      classifiedProtocols.add(protocol);
    }

    const hasReactivation = /\breativa(cao|r|do|da)|reativad[oa]\b/.test(normalized);
    const positiveReactivation = /reativad[oa]|reativa[cç][aã]o (?:foi )?realizada/.test(normalized) || /reativa[cç][aã]o/.test(normalize(linkedOrder?.type ?? ""));
    if (hasReactivation && positiveReactivation && !isNegativeOutcome(combined)) {
      reactivations.push({ id: protocol, date });
      classifiedProtocols.add(protocol);
    }
  }

  if (!dates.length) throw new Error("Não foi possível identificar o período dos atendimentos.");
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const periodStart = sortedDates[0];
  const periodEnd = sortedDates.at(-1) ?? periodStart;
  const periodKey = importPeriodKey(periodStart, periodEnd);
  const commercialNames = attendanceRows.filter((row) => SELLERS.some((seller) => seller.pattern.test(normalize(text(row, "usuario_abertura"))))).length;
  const warnings: string[] = [];
  if (commercialNames / attendanceRows.length < 0.7) warnings.push("A maior parte dos atendimentos não pertence à equipe comercial conhecida. Confirme o filtro do relatório.");
  if (!sales.length) warnings.push("Nenhuma venda foi identificada pelo padrão de instalação comercial.");
  if (!renewals.length) warnings.push("Nenhuma renovação concluída foi identificada.");
  warnings.push("Renovações e cancelamentos são classificados pelo texto do atendimento; revise registros excepcionais.");

  return {
    attendanceFileName: attendance.fileName,
    serviceOrderFileName: serviceOrders.fileName,
    attendanceRows: attendanceRows.length,
    serviceOrderRows: osRows.length,
    linkedServiceOrders,
    ignoredAttendanceRows: Math.max(0, attendanceRows.length - classifiedProtocols.size),
    periodStart,
    periodEnd,
    periodKey,
    attendance: processedAttendance,
    serviceOrders: osRows.map((row) => ({ id: text(row, "numero_ordem_servico"), date: parseDate(row.data_inicio_programado) ?? periodStart, periodKey })),
    sales,
    renewals,
    cancellations,
    reactivations,
    warnings,
  };
}
