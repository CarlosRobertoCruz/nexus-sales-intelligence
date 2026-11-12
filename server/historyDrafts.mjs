const text=value=>String(value??'').trim();

function isAffirmative(value) {
  return value===true||value===1||['sim','true','1','yes'].includes(text(value).toLowerCase());
}

function typeText(value) {
  if(value&&typeof value==='object') return text(value.descricao??value.nome??value.prefixo);
  return text(value);
}

// A Hubsoft draft with no business content and no linked OS is an abandoned
// screen, not an operational attendance. The rule is intentionally narrow.
export function isAbandonedAttendanceDraft(row) {
  const quantity=text(row?.ordem_servico_count??row?.quantidade_os);
  return isAffirmative(row?.rascunho)
    && !text(row?.descricao_abertura)
    && !text(row?.descricao_fechamento)
    && !typeText(row?.tipo_atendimento)
    && (!Array.isArray(row?.ordens_servico)||row.ordens_servico.length===0)
    && (!Array.isArray(row?.atendimento_mensagem)||!row.atendimento_mensagem.some(message=>text(message?.mensagem)||text(message?.descricao)))
    && /^0+(?:\.0+)?$/.test(quantity);
}

export async function capturedDraftAttendanceIds(db,jobId,month) {
  const start=`${month}-01`;
  const pages=(await db.query(`SELECT records FROM history_pages
    WHERE job_id=$1 AND stream='attendance' AND day >= $2::date AND day < ($2::date + interval '1 month')`,[jobId,start])).rows;
  const ids=new Set();
  for(const page of pages) for(const row of Array.isArray(page.records)?page.records:[]) {
    if(isAbandonedAttendanceDraft(row)&&row.id_atendimento!==undefined&&row.id_atendimento!==null) ids.add(String(row.id_atendimento));
  }
  return [...ids].sort();
}

// Used only inside the approval transaction. It reuses the already captured
// page and never calls Hubsoft or modifies the original page snapshot.
export async function markCapturedDrafts(db,jobId,month) {
  const ids=await capturedDraftAttendanceIds(db,jobId,month);
  for(const id of ids) await db.query(`UPDATE history_records SET payload=(payload-'quality_missing_fields')||
      jsonb_build_object('classification_status','discarded_draft','classification_reason','abandoned_draft','rascunho','sim')
    WHERE job_id=$1 AND month=$2 AND kind='attendance' AND upstream_id=$3`,[jobId,month,id]);
  return ids;
}
