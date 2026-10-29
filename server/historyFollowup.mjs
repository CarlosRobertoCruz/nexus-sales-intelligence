import {exactId, localDay} from './historyPolicy.mjs';
import {compareHistoryReport} from './historyReconciliation.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const dates=['data_cadastro','data_inicio_programado','data_inicio_executado','data_termino_executado'];
const statusText=value=>typeof value==='object'&&value!==null ? String(value.descricao??value.nome??value.prefixo??'') : String(value??'');

// OS timestamps must contain a time. Offset-bearing ISO values are converted to
// São Paulo before selecting a day; a date-only timestamp is never padded to 00:00.
export function orderDate(value) {
  if(value===null||value===undefined||value==='') return '';
  const text=String(value).trim();
  if(/^\d{2}\/\d{2}\/\d{4} /.test(text)) {localDay(text,true);return text;}
  const match=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
  if(!match) return fail('HUBSOFT_DATA_NAO_RECONHECIDA');
  const [,y,m,d,h,mi,s='00',offset]=match;
  localDay(`${d}/${m}/${y} ${h}:${mi}:${s}`,true);
  if(!offset) return `${d}/${m}/${y} ${h}:${mi}:${s}`;
  const instant=new Date(text.replace(' ','T'));
  if(Number.isNaN(instant.getTime())) return fail('HUBSOFT_DATA_NAO_RECONHECIDA');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(p=>[p.type,p.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
export function orderDates(row) {
  const normalized={...row};
  for(const key of dates) if(row[key]!==undefined) normalized[key]=orderDate(row[key]);
  return normalized;
}
export function followupOrder(raw,parent,cutoff) {
  const row=orderDates(raw),id=exactId(row.id_ordem_servico);
  const attendanceId=exactId(parent.id_atendimento);
  const reportedParent=row.id_atendimento??row.atendimento?.id_atendimento;
  if(reportedParent!==undefined&&reportedParent!==null&&exactId(reportedParent)!==attendanceId) return fail('VINCULO_OS_DIVERGENTE');
  if(row.deleted_at) return fail('EXCLUSAO_EXIGE_RECONCILIACAO');
  const createdOn=row.data_cadastro ? localDay(row.data_cadastro,true) : null;
  // This order did not exist at the requested observation boundary.
  if(createdOn&&createdOn>cutoff) return null;
  const concludedOn=row.data_termino_executado ? localDay(row.data_termino_executado,true) : null;
  const openedOn=localDay(parent.data_cadastro),observedStatus=statusText(row.status);
  const normalizedStatus=observedStatus.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const outcome=concludedOn ? (concludedOn<openedOn ? 'concluded_before_attendance' : concludedOn<=cutoff ? 'concluded_by_cutoff' : 'concluded_after_cutoff')
    : /cancelad[oa]|cancelled|canceled/.test(normalizedStatus) ? 'cancelled_observed'
    : /finalizad[oa]|concluid[oa]/.test(normalizedStatus) ? 'conclusion_missing'
    : /pendent|abert[oa]|aguard|programad[oa]|agendad[oa]|em execucao|em andamento/.test(normalizedStatus) ? 'pending_observed' : 'unknown_observed';
  // No customer PII or descriptions are needed to review the temporal link.
  return {id_ordem_servico:id,id_atendimento:attendanceId,numero_ordem_servico:String(row.numero_ordem_servico??''),
    data_cadastro:row.data_cadastro??'',data_inicio_programado:row.data_inicio_programado??'',
    data_inicio_executado:row.data_inicio_executado??'',data_termino_executado:row.data_termino_executado??'',
    concludedOn,createdOn,openedOn,observedStatus,outcome,
    existenceAtCutoff:(createdOn || (concludedOn && concludedOn<=cutoff)) ? 'confirmed' : 'unknown'};
}

export async function stageFollowups(db,jobId,month,items,cutoff) {
  for(const item of items) {
    const parent=item.parent,id=exactId(parent.id_atendimento),opened=localDay(parent.data_cadastro);
    if(!Array.isArray(item.orders)) return fail('VINCULOS_OS_NAO_FORNECIDOS');
    const ids=item.orders.map(order=>exactId(order.id_ordem_servico));
    if(new Set(ids).size!==ids.length) return fail('VINCULOS_OS_DUPLICADOS');
    const expected=item.reportedOrders;
    if(expected!==null && (!Number.isSafeInteger(expected)||expected<0||expected!==ids.length)) return fail('VINCULOS_OS_INCOMPLETOS');
    await db.query(`INSERT INTO history_followup_attendances(job_id,month,attendance_id,opened_on,observed_at,reported_orders,received_orders)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(job_id,attendance_id) DO UPDATE SET
      observed_at=excluded.observed_at,reported_orders=excluded.reported_orders,received_orders=excluded.received_orders`,
      [jobId,month,id,opened,item.observedAt,expected,ids.length]);
    // Reprocessing the page replaces its complete parent snapshot, including removals.
    await db.query('DELETE FROM history_followup_orders WHERE job_id=$1 AND attendance_id=$2',[jobId,id]);
    for(const raw of item.orders) {
      const payload=followupOrder(raw,parent,cutoff);
      if(!payload) continue;
      const result=await db.query(`INSERT INTO history_followup_orders(job_id,attendance_id,order_id,payload) VALUES($1,$2,$3,$4::jsonb)
        ON CONFLICT(job_id,order_id) DO UPDATE SET payload=excluded.payload WHERE history_followup_orders.attendance_id=excluded.attendance_id RETURNING order_id`,
        [jobId,id,payload.id_ordem_servico,JSON.stringify(payload)]);
      if(!result.rows.length) return fail('VINCULO_OS_DIVERGENTE');
    }
  }
  const total=(await db.query(`SELECT count(*) AS n FROM (
    SELECT kind,upstream_id AS id FROM history_records WHERE job_id=$1 UNION
    SELECT 'attendance',attendance_id FROM history_followup_attendances WHERE job_id=$1 UNION
    SELECT 'serviceOrders',order_id FROM history_followup_orders WHERE job_id=$1) entities`,[jobId])).rows[0].n;
  if(Number(total)>50000) return fail('LIMITE_REGISTROS');
}

export async function followupReport(db,jobId,{publishedOnly=false}={}) {
  const job=(await db.query('SELECT manifest FROM history_jobs WHERE id=$1',[jobId])).rows[0];
  if(!job?.manifest.followupCutoff) return fail('ACOMPANHAMENTO_NAO_CONFIGURADO');
  const parents=(await db.query(`SELECT a.attendance_id AS id,a.opened_on::text AS "openedOn",a.observed_at AS "observedAt",
      a.reported_orders AS "reportedOrders",a.received_orders AS "receivedOrders",m.state AS "publicationState"
    FROM history_followup_attendances a JOIN history_months m ON m.job_id=a.job_id AND m.month=a.month
    WHERE a.job_id=$1 AND ($2::boolean=false OR m.state='published') ORDER BY a.attendance_id`,[jobId,publishedOnly])).rows;
  const orders=(await db.query(`SELECT o.payload,a.observed_at AS "observedAt" FROM history_followup_orders o
    JOIN history_followup_attendances a ON a.job_id=o.job_id AND a.attendance_id=o.attendance_id
    JOIN history_months m ON m.job_id=a.job_id AND m.month=a.month
    WHERE o.job_id=$1 AND ($2::boolean=false OR m.state='published') ORDER BY o.order_id`,[jobId,publishedOnly])).rows;
  const outcomes={},completionsByDay={};
  for(const {payload} of orders) {
    outcomes[payload.outcome]=(outcomes[payload.outcome]??0)+1;
    if(payload.outcome==='concluded_by_cutoff') completionsByDay[payload.concludedOn]=(completionsByDay[payload.concludedOn]??0)+1;
  }
  const withOrders=new Set(orders.map(r=>r.payload.id_atendimento));
  return {jobId,scope:'attendance_cohort_not_production',cutoff:job.manifest.followupCutoff,
    statusBasis:'observed_at_extraction_not_historical_snapshot',attendanceCount:parents.length,orderCount:orders.length,
    attendancesWithoutOrders:parents.filter(p=>!withOrders.has(p.id)).length,outcomes,completionsByDay,
    attendances:parents,orders:orders.map(({payload,observedAt})=>({...payload,observedAt}))};
}

export async function publishFollowups(db,jobId,month,cutoff,evidence,report) {
  if(report?.pending) return fail('REFERENCIA_ACOMPANHAMENTO_PENDENTE');
  if(!evidence||evidence.reportSha256!==report?.fileSha256) return fail('EVIDENCIA_ACOMPANHAMENTO_INVALIDA');
  const parents=(await db.query('SELECT attendance_id FROM history_followup_attendances WHERE job_id=$1 AND month=$2',[jobId,month])).rows;
  const selected=(await db.query("SELECT upstream_id FROM history_records WHERE job_id=$1 AND month=$2 AND kind='attendance'",[jobId,month])).rows;
  const selectedIds=new Set(selected.map(r=>r.upstream_id));
  if(parents.length!==selectedIds.size||parents.some(r=>!selectedIds.has(r.attendance_id))) return fail('ACOMPANHAMENTO_INCOMPLETO');
  const actual=(await db.query(`SELECT o.order_id AS upstream_id,o.payload FROM history_followup_orders o JOIN history_followup_attendances a
    ON a.job_id=o.job_id AND a.attendance_id=o.attendance_id WHERE o.job_id=$1 AND a.month=$2`,[jobId,month])).rows;
  const comparison=compareHistoryReport('serviceOrders',actual,evidence,report);
  if(comparison.status!=='matched') return fail('RECONCILIACAO_ACOMPANHAMENTO_DIVERGENTE');
  await db.query(`INSERT INTO attendance_followup_snapshots(attendance_id,cutoff,opened_on,observed_at,job_id)
    SELECT attendance_id,$3::date,opened_on,observed_at,job_id FROM history_followup_attendances WHERE job_id=$1 AND month=$2
    ON CONFLICT(attendance_id,cutoff) DO UPDATE SET observed_at=excluded.observed_at,job_id=excluded.job_id`,[jobId,month,cutoff]);
  await db.query(`DELETE FROM attendance_order_followups WHERE cutoff=$3::date AND attendance_id IN
    (SELECT attendance_id FROM history_followup_attendances WHERE job_id=$1 AND month=$2)`,[jobId,month,cutoff]);
  // A different parent for the same native OS ID is a conflict, never a second OS.
  await db.query(`INSERT INTO attendance_order_followups(attendance_id,cutoff,order_id,payload)
    SELECT o.attendance_id,$3::date,o.order_id,o.payload FROM history_followup_orders o JOIN history_followup_attendances a
    ON a.job_id=o.job_id AND a.attendance_id=o.attendance_id WHERE o.job_id=$1 AND a.month=$2`,[jobId,month,cutoff]);
  return {attendanceCount:(await db.query('SELECT count(*)::int AS n FROM history_followup_attendances WHERE job_id=$1 AND month=$2',[jobId,month])).rows[0].n,orderCount:actual.length};
}
