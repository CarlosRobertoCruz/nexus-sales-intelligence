import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {monthsFor,exactId} from './historyPolicy.mjs';
import {followupReport} from './historyFollowup.mjs';
import {historyReconciliation} from './historyReconciliation.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const fields=['descricao_abertura','tipo_atendimento'];

// A consistent, read-only view of the existing staging. Never calls Hubsoft.
export async function pilotReview(pool,id) {
  const db=await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const job=(await db.query('SELECT phase,state,month_index,manifest FROM history_jobs WHERE id=$1',[id])).rows[0];
    if(!job) return fail('CARGA_NAO_ENCONTRADA');
    if(job.phase!=='day'||!job.manifest.followupCutoff) return fail('REVISAO_EXIGE_PILOTO_DIARIO_COM_ACOMPANHAMENTO');
    const month=monthsFor(job.manifest)[Math.min(job.month_index,monthsFor(job.manifest).length-1)];
    const rows=(await db.query("SELECT upstream_id,payload FROM history_records WHERE job_id=$1 AND month=$2 AND kind='attendance' ORDER BY upstream_id",[id,month])).rows;
    const protocols=new Map(rows.map(row=>[exactId(row.upstream_id),exactId(row.payload.protocolo)]));
    const incomplete=rows.filter(row=>row.payload.classification_status==='incomplete').map(row=>({
      attendanceId:exactId(row.upstream_id),protocol:exactId(row.payload.protocolo),openedOn:String(row.payload.data_cadastro),
      missingFields:fields.filter(field=>String(row.payload.quality_missing_fields??'').split(',').includes(field)),
      independentReview:'pending',
    }));
    const followup=await followupReport(db,id);
    const parents=followup.attendances.map(row=>({attendanceId:exactId(row.id),protocol:protocols.get(String(row.id))??null,
      openedOn:row.openedOn,observedAt:row.observedAt,reportedOrders:row.reportedOrders,receivedOrders:row.receivedOrders}));
    const orders=followup.orders.map(row=>({attendanceId:exactId(row.id_atendimento),protocol:protocols.get(String(row.id_atendimento))??null,
      orderId:exactId(row.id_ordem_servico),orderNumber:row.numero_ordem_servico?exactId(row.numero_ordem_servico):null,
      createdAt:row.data_cadastro,scheduledAt:row.data_inicio_programado,executionStartedAt:row.data_inicio_executado,
      executionFinishedAt:row.data_termino_executado,commercialKind:row.commercial_kind??null,observedAt:row.observedAt,outcome:row.outcome,existenceAtCutoff:row.existenceAtCutoff,
      independentReview:'pending'}));
    const reconciliation=await historyReconciliation(db,id);
    const review={jobId:id,month,state:job.state,openingDay:job.manifest.peakDay,followupCutoff:job.manifest.followupCutoff,
      source:'local_staging_not_independent_evidence',publicationApproved:false,
      statusBasis:'observed_at_extraction_not_historical_snapshot',
      counts:{attendances:rows.length,incompleteAttendances:incomplete.length,followupAttendances:parents.length,linkedOrders:orders.length,
        commercialLinkedOrders:followup.commercialOrderCount,operationalLinkedOrders:followup.operationalOrderCount,
        unclassifiedLinkedOrders:followup.unclassifiedOrderCount,attendancesWithoutOrders:followup.attendancesWithoutOrders},
      scopeReview:reconciliation.reports.serviceOrders.scopeReview??null,
      incompleteAttendances:incomplete,attendances:parents,linkedOrders:orders,
      commercialLinkedOrders:orders.filter(row=>row.commercialKind),
      operationalLinkedOrderCount:followup.operationalOrderCount,
      unclassifiedLinkedOrderCount:followup.unclassifiedOrderCount,
      pending:{commercialFollowupReview:false,incompleteDataReview:incomplete.length>0,
        sourceScopePublicationReview:reconciliation.reports.serviceOrders.status!=='matched'},
      requiredChecks:[
        'Localizar cada protocolo incompleto na Hubsoft e registrar campos presentes ou realmente vazios; não substituir autor, descrição ou tipo.',
        'Conferir somente OS vinculadas de instalação, retirada/cancelamento ou reativação. Renovação é conferida no próprio atendimento.',
        'Usar corte de acompanhamento e identidade do atendimento para OS comerciais; respeitar conclusão posterior, pendência, cancelamento e ausência de data.',
        'OS de suporte, recall, manutenção, migração e checklist ficam na auditoria operacional e não bloqueiam a publicação comercial.',
      ]};
    await db.query('COMMIT');
    return review;
  } catch(error) {await db.query('ROLLBACK');throw error;}
  finally {db.release();}
}

const cell=value=>String(value??'—').replace(/[|\r\n]/g,' ');
function table(headers,rows) {
  return ['| '+headers.join(' | ')+' |','| '+headers.map(()=>'---').join(' | ')+' |',...rows.map(row=>'| '+row.map(cell).join(' | ')+' |')].join('\n');
}
export function legacyReviewMarkdown(review) {
  return `# Conferência do piloto Sales\n\nJob: ${review.jobId}. Abertura: ${review.openingDay}. Corte dos vínculos: ${review.followupCutoff}.\n\nDados observados na extração local; não constituem uma fonte independente nem aprovação. Nenhuma consulta Hubsoft é feita por esta exportação. Não presume que o estado atual seja um retrato histórico no corte.\n\n## Resumo\n\n${JSON.stringify(review.counts)}\n\n## Diferença de escopo documentada\n\n${review.scopeReview?table(['Número OS','Motivo','Destino','Tipo','Abertura','Conclusão'],review.scopeReview.reviewedOrders.map(row=>[row.key,row.reason,row.destination,row.orderType,row.openedAt,row.completedAt])):'Sem justificativa de suporte anexada às referências.'}\n\n## Atendimentos incompletos\n\n${table(['ID atendimento','Protocolo','Abertura','Campos ausentes','Conferência na Hubsoft'],review.incompleteAttendances.map(row=>[row.attendanceId,row.protocol,row.openedOn,row.missingFields.join(', '),'Pendente']))}\n\n## OS vinculadas — observações a conferir\n\n${table(['Protocolo atendimento','Número OS','ID OS','Cadastro OS','Início executado','Fim executado','Situação no corte','Conferência independente'],review.linkedOrders.map(row=>[row.protocol,row.orderNumber,row.orderId,row.createdAt,row.executionStartedAt,row.executionFinishedAt,row.outcome,'Pendente']))}\n\n## Todos os atendimentos — inclusive sem OS\n\n${table(['ID atendimento','Protocolo','Abertura','OS declaradas','OS recebidas','Observado em'],review.attendances.map(row=>[row.attendanceId,row.protocol,row.openedOn,row.reportedOrders,row.receivedOrders,row.observedAt]))}\n\n## Como conferir\n\n${review.requiredChecks.map((text,i)=>`${i+1}. ${text}`).join('\n')}\n\nNão copiar os números desta lista para criar uma suposta referência independente. Registrar o resultado da conferência em documento separado com origem e data. As confirmações de aprovação permanecem desmarcadas.\n`;
}

// This is deliberately shorter than the legacy audit dump. It makes clear to
// the operator that only commercial OS are candidates for reconciliation;
// every other link stays in review.json for traceability without becoming a
// manual gate.
export function reviewMarkdown(review) {
  const commercial=review.commercialLinkedOrders??[];
  const counts=review.counts??{};
  const unclassified=review.unclassifiedLinkedOrderCount??counts.unclassifiedLinkedOrders??0;
  const operational=review.operationalLinkedOrderCount??counts.operationalLinkedOrders??0;
  const incomplete=review.incompleteAttendances??[];
  const attendances=review.attendances??[];
  return `# Conferencia do piloto Sales

Job: ${review.jobId}. Abertura: ${review.openingDay}. Corte dos vinculos: ${review.followupCutoff}.

Este arquivo usa apenas o staging local e nao consulta a Hubsoft. Ele nao e uma aprovacao automatica nem uma referencia independente.

## Escopo comercial

- Instalacao: OS do tipo instalacao.
- Cancelamento: OS de retirada ou cancelamento.
- Reativacao: OS cujo tipo indique reativacao.
- Renovacao: somente o atendimento; OS tecnica de troca de aparelho nao entra no indicador.

## Resumo

${JSON.stringify(counts)}

## OS comerciais vinculadas

${commercial.length?table(['Protocolo atendimento','Numero OS','ID OS','Tipo','Cadastro OS','Fim executado','Situacao no corte'],commercial.map(row=>[row.protocol,row.orderNumber,row.orderId,row.commercialKind,row.createdAt,row.executionFinishedAt,row.outcome])):'Nenhuma OS comercial foi classificada neste snapshot.'}

## Auditoria operacional

Foram preservadas ${operational} OS operacionais e ${unclassified} OS sem categoria persistida neste snapshot. Elas ficam em review.json para rastreabilidade, mas nao exigem conferencia manual e nao bloqueiam a publicacao comercial.

## Atendimentos incompletos

${table(['ID atendimento','Protocolo','Abertura','Campos ausentes'],incomplete.map(row=>[row.attendanceId,row.protocol,row.openedOn,row.missingFields.join(', ')]))}

## Todos os atendimentos - inclusive sem OS

${table(['ID atendimento','Protocolo','Abertura','OS declaradas','OS recebidas','Observado em'],attendances.map(row=>[row.attendanceId,row.protocol,row.openedOn,row.reportedOrders,row.receivedOrders,row.observedAt]))}

## Como conferir

${(review.requiredChecks??[]).map((text,i)=>`${i+1}. ${text}`).join('\n')}

Nao usar esta lista para fabricar uma referencia independente. Qualquer aprovacao continua exigindo evidencia de relatorio com origem e data registradas.
`;
}

export async function writePilotReview(review,directory) {
  // Exclusive directory creation prevents overwriting an earlier review or accepting a symlink.
  await mkdir(directory,{mode:0o700});
  await writeFile(join(directory,'review.json'),JSON.stringify(review,null,2)+'\n',{encoding:'utf8',mode:0o600,flag:'wx'});
  await writeFile(join(directory,'conferencia.md'),reviewMarkdown(review),{encoding:'utf8',mode:0o600,flag:'wx'});
  return {directory,files:['review.json','conferencia.md'],counts:review.counts,publicationApproved:false};
}
