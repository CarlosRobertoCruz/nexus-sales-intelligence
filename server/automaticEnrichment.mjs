import {exactId,localDay} from './historyPolicy.mjs';
import {normalized,normalizedAttendanceDetail,clientCode,normalizeDate} from './historyNormalization.mjs';
import {orderDate} from './historyFollowup.mjs';
import {projectHistoryRecord} from './historyProjection.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
async function stage(db,jobId,month,kind,row,origin) {
  const id=exactId(row[kind==='attendance'?'id_atendimento':'id_ordem_servico']);
  await db.query(`INSERT INTO history_records(job_id,month,kind,upstream_id,payload,origin) VALUES($1,$2,$3,$4,$5::jsonb,$6)
    ON CONFLICT(job_id,kind,upstream_id) DO UPDATE SET payload=excluded.payload
      WHERE history_records.origin='context' AND excluded.origin='context'`,[jobId,month,kind,id,JSON.stringify(row),origin]);
}
export function checkedOrders(detail) {
  const count=detail.ordem_servico_count??detail.quantidade_os;
  const orders=detail.ordens_servico??(String(count)==='0'?[]:undefined);
  if(!Array.isArray(orders)||orders.length>50000||
    (count!==undefined&&(!/^\d+$/.test(String(count))||Number(count)!==orders.length))) fail('VINCULOS_OS_INCOMPLETOS');
  const ids=orders.map(row=>exactId(row.id_ordem_servico));
  if(new Set(ids).size!==ids.length) fail('VINCULOS_OS_DUPLICADOS');
  return orders;
}
async function detailCached(db,client,jobId,raw) {
  const id=exactId(raw.id_atendimento),key=`hubsoft_history_protocol:${jobId}:${id}`;
  const saved=(await db.query('SELECT value FROM application_settings WHERE key=$1',[key])).rows[0]?.value;
  if(saved) return saved.record;
  const response=await client.attendanceDetail(exactId(raw.protocolo));
  normalizedAttendanceDetail(raw,response,exactId(clientCode(raw)),localDay(normalizeDate(raw.data_cadastro_br??raw.data_cadastro)));
  const value={record:projectHistoryRecord(response),observedAt:new Date().toISOString()};
  await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',[key,JSON.stringify(value)]);
  return value.record;
}

// At most one pending attendance or one exact installation parent per step.
// No search by name/client and no unbounded scan of an earlier month/year.
export async function automaticEnrichmentStep(db,client,job,month) {
  if(job.manifest.mode==='daily') {
    const pending=(await db.query(`SELECT payload FROM source_records WHERE kind='attendance'
      AND COALESCE(payload->>'publication_scope','published')='published'
      AND id LIKE 'hubsoft:%' AND payload->>'id_atendimento' IS NOT NULL
      AND lower(payload->>'status') IN ('pendente','aguardando','em andamento','aberto')
      AND substring(payload->>'data_cadastro',7,4)||'-'||substring(payload->>'data_cadastro',4,2)||'-'||substring(payload->>'data_cadastro',1,2)>=$1
      ORDER BY COALESCE(payload->>'sync_observed_at',''),id LIMIT 50`,[job.manifest.startDate])).rows;
    for(const {payload:raw} of pending) {
      const exists=(await db.query("SELECT 1 FROM history_records WHERE job_id=$1 AND kind='attendance' AND upstream_id=$2",[job.id,exactId(raw.id_atendimento)])).rows.length;
      if(exists) continue;
      const opened=localDay(raw.data_cadastro);if(opened>job.manifest.cutoff) continue;
      const detail=await detailCached(db,client,job.id,raw);
      const row=normalizedAttendanceDetail(detail,raw,exactId(clientCode(raw)),opened);
      const orders=checkedOrders(detail);
      await db.query('BEGIN');
      try {
        await stage(db,job.id,month,'attendance',row,'pending');
        for(const order of orders) {
          if(exactId(order.id_atendimento??order.atendimento?.id_atendimento??row.id_atendimento)!==exactId(row.id_atendimento)) fail('VINCULO_OS_DIVERGENTE');
          if(!order.data_termino_executado) continue;
          const finished=localDay(orderDate(order.data_termino_executado),true);
          if(finished<job.manifest.startDate||finished>job.manifest.cutoff) continue;
          await stage(db,job.id,month,'serviceOrders',{...normalized('serviceOrders',{...order,id_atendimento:row.id_atendimento,
            cliente:order.cliente??{codigo_cliente:row.codigo_cliente,nome_razaosocial:row.nome_razaosocial}}),data_referencia_bi:'data_termino_executado'},'embedded');
        }
        await db.query('COMMIT');
      } catch(error){await db.query('ROLLBACK');throw error;}
      return true;
    }
  }
  const orders=(await db.query("SELECT payload FROM history_records WHERE job_id=$1 AND month=$2 AND kind='serviceOrders'",[job.id,month])).rows;
  for(const {payload:order} of orders) {
    if(norm(order.tipo_ordem_servico)!=='instalacao'||norm(order.status)!=='finalizado'||order.context_status==='before_scope') continue;
    const parent=exactId(order.id_atendimento);
    const existing=(await db.query(`SELECT payload FROM history_records WHERE job_id=$1 AND kind='attendance' AND upstream_id=$2
      UNION ALL SELECT payload FROM source_records WHERE kind='attendance' AND id=$3
      AND COALESCE(payload->>'publication_scope','published')<>'manual_staging'`,[job.id,parent,`hubsoft:${parent}`])).rows;
    if(existing.length) {
      if(existing.some(row=>exactId(row.payload.codigo_cliente)!==exactId(order.codigo_cliente))) fail('CONTEXTO_CLIENTE_DIVERGENTE');
      if(existing.every(row=>row.payload.publication_scope==='installation_context')) {
        const row=existing[0].payload;
        const bindings=new Set(existing.flatMap(r=>String(r.payload.installation_context_order_ids??'').split(',').filter(Boolean)));
        bindings.add(exactId(order.id_ordem_servico));
        await stage(db,job.id,month,'attendance',{...row,installation_context_order_ids:[...bindings].sort().join(',')},'context');
      }
      continue;
    }
    const snapshots=(await db.query(`SELECT r.item FROM history_pages p CROSS JOIN LATERAL jsonb_array_elements(p.records) AS r(item)
      WHERE p.job_id=$1 AND p.processed AND r.item->>'id_ordem_servico'=$2`,[job.id,order.id_ordem_servico])).rows;
    const protocols=new Set(snapshots.map(({item})=>item.atendimento?.protocolo).filter(Boolean).map(exactId));
    if(snapshots.some(({item})=>exactId(item.id_atendimento??item.atendimento?.id_atendimento)!==parent||
      exactId(item.numero_ordem_servico??item.numero)!==exactId(order.numero_ordem_servico))) fail('CONTEXTO_SNAPSHOT_DIVERGENTE');
    if(protocols.size!==1) fail('CONTEXTO_PROTOCOLO_AUSENTE_OU_AMBIGUO');
    const protocol=[...protocols][0];
    const detail=await client.attendanceDetail(protocol);
    if(detail.deleted_at||exactId(detail.id_atendimento)!==parent||exactId(detail.protocolo)!==protocol||exactId(clientCode(detail))!==exactId(order.codigo_cliente)) fail('CONTEXTO_ATENDIMENTO_DIVERGENTE');
    const opened=localDay(normalizeDate(detail.data_cadastro_br??detail.data_cadastro));
    if(opened>localDay(order.data_inicio_executado,true)) fail('CONTEXTO_EXECUCAO_INVALIDA');
    if(opened<job.manifest.startDate) {
      // Keep only the in-scope OS and the reason its parent is unavailable.
      // Do not persist the out-of-scope attendance, nor invent a salesperson.
      await db.query("UPDATE history_records SET payload=payload||'{\"context_status\":\"before_scope\"}'::jsonb WHERE job_id=$1 AND kind='serviceOrders' AND upstream_id=$2",[job.id,order.id_ordem_servico]);
      return true;
    }
    const row=normalized('attendance',detail);
    await stage(db,job.id,month,'attendance',{...row,publication_scope:'installation_context',installation_context_order_ids:exactId(order.id_ordem_servico),context_job_id:job.id},'context');
    return true;
  }
  return false;
}
