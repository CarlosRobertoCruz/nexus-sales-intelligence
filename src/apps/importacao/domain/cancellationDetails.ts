import type { CancellationOrderDetail } from "../../../core/types/commercialDashboard";
import type { SpreadsheetCell } from "../types/spreadsheetImport";

type Row = Readonly<Record<string, SpreadsheetCell>>;
const value = (row: Row, key: string) => String(row[key] ?? "").trim();

export function readableReport(value: string): string {
  return value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, " ")
    .split(/\r?\n/).map(line => /(?:senha|password|token|chave\s+de\s+acesso)\s*(?:(?:do|da|de)\s+)?(?:wi[ -]?fi|rede|acesso|pppoe)?\s*[:=]/i.test(line) ? "[Credencial omitida]" : line)
    .join("\n").trim().slice(0, 12000);
}

function date(value: SpreadsheetCell): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  const parts = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!parts) return null;
  const result = new Date(+parts[3], +parts[2] - 1, +parts[1], +(parts[4] ?? 0), +(parts[5] ?? 0), +(parts[6] ?? 0));
  return Number.isNaN(result.getTime()) ? null : result;
}

export function buildCancellationDetail(attendance: Row, orders: ReadonlyArray<Row>) {
  const code = value(attendance, "codigo_cliente");
  const attendanceId = value(attendance, "id_atendimento");
  const chosenReport = value(attendance, "descricao_fechamento") || value(attendance, "descricao_abertura");
  const referencedOrder = chosenReport.match(/ordem de servi[cç]o(?: de)?\s*(?:n[ºo°.]*\s*)?(\d+)/i)?.[1];
  const closedAt = date(attendance.data_fechamento);
  const cutoffValue = closedAt ? attendance.data_fechamento : attendance.data_cadastro;
  const cutoff = closedAt ?? date(attendance.data_cadastro);
  if (cutoff && /^\d{2}\/\d{2}\/\d{4}$/.test(String(cutoffValue ?? "").trim())) cutoff.setHours(23, 59, 59, 999);
  const matches = orders.flatMap(row => {
    const orderCode = value(row, "codigo_cliente");
    if (code && orderCode && code !== orderCode) return [];
    const parent = value(row, "id_atendimento");
    const number = value(row, "numero_ordem_servico");
    const linked = Boolean((attendanceId && parent === attendanceId) || (referencedOrder && referencedOrder === number && (!parent || !attendanceId || parent === attendanceId)));
    // Names alone cannot prove customer identity.
    if (!(code && orderCode === code) && !linked) return [];
    const openedAt = date(row.data_cadastro);
    const startedAt = date(row.data_inicio_executado);
    const finishedAt = date(row.data_termino_executado);
    const observed = openedAt ?? startedAt ?? finishedAt;
    if (!linked && (!cutoff || !observed || observed > cutoff)) return [];
    const item: CancellationOrderDetail = {
      id: value(row, "id_ordem_servico") ? `hubsoft:${value(row, "id_ordem_servico")}` : number,
      number, type: value(row, "tipo_ordem_servico"), status: value(row, "status"),
      openedAt: openedAt?.toISOString() ?? null, startedAt: startedAt?.toISOString() ?? null, finishedAt: finishedAt?.toISOString() ?? null,
      openingReport: readableReport(value(row, "descricao_abertura")),
      serviceReport: readableReport(value(row, "descricao_servico")),
      closingReport: readableReport(value(row, "descricao_fechamento")), linkedToCancellation: linked,
    };
    return [{ item, at: (finishedAt ?? startedAt ?? openedAt)?.getTime() ?? 0 }];
  }).sort((a, b) => b.at - a.at || a.item.id.localeCompare(b.item.id));
  return {
    openingReport: readableReport(value(attendance, "descricao_abertura")),
    closingReport: readableReport(value(attendance, "descricao_fechamento")),
    availableOrders: matches.length,
    orders: matches.slice(0, 5).map(record => record.item),
  };
}


// Select the same candidate superset as the detail rules without scanning all OS per cancellation.
export function createCancellationDetailBuilder(orders: ReadonlyArray<Row>) {
  const byCode=new Map<string,number[]>(),byParent=new Map<string,number[]>(),byNumber=new Map<string,number[]>();
  const append=(map:Map<string,number[]>,key:string,index:number)=>{
    if(!key)return;
    const group=map.get(key);if(group)group.push(index);else map.set(key,[index]);
  };
  orders.forEach((row,index)=>{
    append(byCode,value(row,"codigo_cliente"),index);
    append(byParent,value(row,"id_atendimento"),index);
    append(byNumber,value(row,"numero_ordem_servico"),index);
  });
  return (attendance:Row)=>{
    const report=value(attendance,"descricao_fechamento")||value(attendance,"descricao_abertura");
    const reference=report.match(/ordem de servi[cç]o(?: de)?\s*(?:n[ºo°.]*\s*)?(\d+)/i)?.[1]??"";
    const indices=new Set([
      ...byCode.get(value(attendance,"codigo_cliente"))??[],
      ...byParent.get(value(attendance,"id_atendimento"))??[],
      ...byNumber.get(reference)??[],
    ]);
    return buildCancellationDetail(attendance,[...indices].sort((a,b)=>a-b).map(index=>orders[index]));
  };
}
