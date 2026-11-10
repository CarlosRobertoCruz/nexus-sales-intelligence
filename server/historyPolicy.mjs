import {automaticMonths,validateAutomaticManifest} from './automaticPolicy.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function exactId(value) {
  if(typeof value==='number' && (!Number.isSafeInteger(value)||value<0)) return fail('IDENTIFICADOR_INVALIDO');
  const id=String(value??'');
  if(!/^\d{1,40}$/.test(id)) return fail('IDENTIFICADOR_INVALIDO');
  return id;
}
export function localDay(value,requiredTime=false) {
  const match=/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(value??''));
  if(!match || (requiredTime && !match[4])) return fail('HUBSOFT_DATA_NAO_RECONHECIDA');
  const [,d,m,y,h='00',mi='00',s='00']=match,day=`${y}-${m}-${d}`;
  if(new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day || +h>23 || +mi>59 || +s>59) return fail('HUBSOFT_DATA_NAO_RECONHECIDA');
  return day;
}
export const OCTOBER_PROTOCOL_JOB_ID='65a3be4d-9fe8-4ded-82c9-7497260b90bf';
// Each opt-in is bound to its authorized job and period. A historical batch
// receives a separate permission; it never inherits the October exception.
export function usesProtocolPilot(m,jobId=m?.protocolException?.jobId) {
  if(m?.phase==='automatic') { validateAutomaticManifest(m); return true; }
  const strategy=m?.enrichmentStrategy??'client';
  if(strategy==='client') return false;
  if(strategy!=='protocol') return fail('ESTRATEGIA_ENRIQUECIMENTO_INVALIDA');
  const permission=m.protocolException;
  if(m.phase==='october') {
    if(m.year!==2026||jobId!==OCTOBER_PROTOCOL_JOB_ID||m.cutoff!=='2026-10-31'||m.osDateField!=='data_termino_executado'||m.autoPublish||
        !Number.isInteger(m.maxCalls)||m.maxCalls<1||m.maxCalls>5000||permission?.enabled!==true||
        permission.jobId!==jobId||permission.month!=='2026-10') return fail('EXCECAO_PROTOCOLO_FORA_DE_OUTUBRO');
    return true;
  }
  if(m.phase==='history') {
    let months;
    try { months=monthsFor(m); } catch { return fail('EXCECAO_PROTOCOLO_FORA_DO_LOTE'); }
    if(m.year!==2026||m.osDateField!=='data_termino_executado'||m.autoPublish||
      !Number.isInteger(m.maxCalls)||m.maxCalls<1||m.maxCalls>5000||permission?.enabled!==true||permission.jobId!==jobId||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(jobId??'')||
      !Array.isArray(permission.months)||JSON.stringify(permission.months)!==JSON.stringify(months)||permission.cutoff!==m.cutoff)
      return fail('EXCECAO_PROTOCOLO_FORA_DO_LOTE');
    return true;
  }
  if(m.year!==2026||m.phase!=='day'||m.peakDay!=='2026-10-01'||!Number.isInteger(m.maxCalls)||m.maxCalls<1||m.maxCalls>500||
      permission?.enabled!==true||permission.day!==m.peakDay||permission.jobId!==jobId||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(permission.jobId??'')) return fail('EXCECAO_PROTOCOLO_FORA_DO_PILOTO');
  return true;
}
export function validateManifest(m,today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})) {
  if(m?.phase==='automatic') return validateAutomaticManifest(m,today);
  if(!m||m.year!==2026||!['day','october','history'].includes(m.phase)) return fail('MANIFESTO_INVALIDO');
  usesProtocolPilot(m);
  if(m.phase==='history') {
    const months=monthsFor(m),last=months.at(-1);
    const end=`${last}-${String(new Date(Date.UTC(2026,Number(last.slice(5)),0)).getUTCDate()).padStart(2,'0')}`;
    if(m.cutoff!==end) return fail('CORTE_LOTE_EXIGE_MES_FECHADO');
    if(m.osDateField!=='data_termino_executado') return fail('LOTE_EXIGE_OS_POR_CONCLUSAO');
    if(m.autoPublish) return fail('LOTE_EXIGE_APROVACAO_MENSAL');
    if(!Number.isInteger(m.maxCalls)||m.maxCalls<1||m.maxCalls>5000) return fail('ORCAMENTO_LOTE_INVALIDO');
    if(Object.keys(m.monthReports??{}).some(month=>!months.includes(month))) return fail('RELATORIO_FORA_DO_LOTE');
    for(const month of months) for(const kind of ['attendance','serviceOrders']) {
      const report=m.monthReports?.[month]?.[kind];
      const keys=report?.keys??report?.ids;
      if(!Array.isArray(keys)||keys.length>50000||new Set(keys.map(exactId)).size!==keys.length) return fail('CHAVES_MENSAIS_OBRIGATORIAS');
      const start=`${month}-01`,end=`${month}-${String(new Date(Date.UTC(2026,Number(month.slice(5)),0)).getUTCDate()).padStart(2,'0')}`;
      const dateField=kind==='attendance'?'data_cadastro':'data_termino_executado';
      if(report.exportFilters?.start!==start||report.exportFilters?.end!==end||report.exportFilters?.dateField!==dateField||report.exportFilters?.otherFilters!=='none') return fail('FILTROS_RELATORIO_FORA_DO_MES');
    }
  }
  if(!/^2026-\d{2}-\d{2}$/.test(m.cutoff??'') || m.cutoff>=today) return fail('CORTE_EXIGE_DIA_COMPLETO');
  if(new Date(m.cutoff+'T12:00:00Z').toISOString().slice(0,10)!==m.cutoff) return fail('CORTE_INVALIDO');
  if(!['data_cadastro','data_inicio_programado','data_termino_executado'].includes(m.osDateField)) return fail('FILTRO_OS_INVALIDO');
  for(const reports of m.phase==='history'?monthsFor(m).map(month=>m.monthReports?.[month]):[m.reports]) for(const kind of ['attendance','serviceOrders',...(m.followupCutoff ? ['followup'] : [])]) {
    const report=reports?.[kind];
    // A monthly run may collect the follow-up cohort before its independent
    // reference is ready. It can never auto-publish in that state: approval
    // still requires a complete reference and matching evidence.
    const pending=kind==='followup'&&report?.pending===true&&!m.autoPublish;
    if(report?.pending===true&&!pending) return fail('REFERENCIA_PENDENTE_NAO_PERMITIDA');
    if(!pending && (!report || typeof report.fileSha256!=='string'||!/^[a-f0-9]{64}$/.test(report.fileSha256)||!report.filters||typeof report.filters!=='object'||!report.exportedAt)) return fail('RELATORIOS_OBRIGATORIOS');
    if(!report?.filters) return fail('RELATORIOS_OBRIGATORIOS');
    const identities=kind==='attendance'?['id_atendimento','protocolo']:['id_ordem_servico','numero_ordem_servico'];
    if(report.keyField!==undefined&&!identities.includes(report.keyField)) return fail('CAMPO_IDENTIDADE_INVALIDO');
    if(report.keys!==undefined&&(!Array.isArray(report.keys)||report.keys.length>50000||new Set(report.keys.map(exactId)).size!==report.keys.length)) return fail('CHAVES_RELATORIO_DUPLICADAS');
    checklistExclusions(kind,report);
    reviewedScopeExclusions(kind,report);
    reportTypeExclusions(kind,report);
    if(report.filters.addressType!==undefined&&report.filters.addressType!=='instalacao') return fail('TIPO_ENDERECO_NAO_MAPEADO');
    if(report.exportFilters?.dateField!==undefined&&!['data_cadastro','data_fechamento','data_inicio_programado','data_termino_executado'].includes(report.exportFilters.dateField)) return fail('CAMPO_DATA_EXPORTACAO_INVALIDO');
    if(report.filters.otherFilters!=='none') return fail('FILTROS_ADICIONAIS_EXIGEM_MAPEAMENTO');
    const expected=kind==='serviceOrders'?m.osDateField:'data_cadastro';
    if(kind==='followup' && (report.filters.followupCutoff!==m.followupCutoff||report.filters.relationship!=='id_atendimento')) return fail('FILTRO_ACOMPANHAMENTO_INVALIDO');
    if(report.filters.dateField!==expected) return fail('CAMPO_DATA_DIVERGENTE');
  }
  if(!Number.isInteger(m.maxCalls)||m.maxCalls<1||m.maxCalls>100000) return fail('ORCAMENTO_OBRIGATORIO');
  if(m.window && (!/^\d{2}:\d{2}$/.test(m.window.start??'')||!/^\d{2}:\d{2}$/.test(m.window.end??'')||m.window.start===m.window.end||[m.window.start,m.window.end].some(v=>+v.slice(0,2)>23||+v.slice(3)>59))) return fail('JANELA_INVALIDA');
  if(m.autoPublish && (m.phase!=='history'||!m.reviewer||monthsFor(m).some(month=>['attendance','serviceOrders',...(m.followupCutoff ? ['followup'] : [])].some(kind=>(!Array.isArray(m.monthReports?.[month]?.[kind]?.ids)&&!Array.isArray(m.monthReports?.[month]?.[kind]?.keys)))))) return fail('EVIDENCIAS_MENSAIS_OBRIGATORIAS');
  if(m.phase==='day' && (!/^2026-10-\d{2}$/.test(m.peakDay??'')||m.peakDay>m.cutoff)) return fail('DIA_PILOTO_INVALIDO');
  if(m.phase==='day' && new Date(m.peakDay+'T12:00:00Z').toISOString().slice(0,10)!==m.peakDay) return fail('DIA_PILOTO_INVALIDO');
  if(m.phase==='october' && (m.cutoff<'2026-10-31'||today<='2026-10-31')) return fail('OUTUBRO_AINDA_ABERTO');
  if(m.phase==='history' && !m.approvedOctoberJob) return fail('PILOTO_OUTUBRO_OBRIGATORIO');
  if(m.followupCutoff!==undefined) {
    if(m.osDateField!=='data_termino_executado') return fail('ACOMPANHAMENTO_EXIGE_CONCLUSAO');
    if(!/^2026-\d{2}-\d{2}$/.test(m.followupCutoff)||m.followupCutoff>=today) return fail('CORTE_ACOMPANHAMENTO_INVALIDO');
    const [y,mo,d]=m.followupCutoff.split('-');
    localDay(`${d}/${mo}/${y}`);
    const lastDay=daysFor(m,monthsFor(m).at(-1)).at(-1);
    if(m.followupCutoff<lastDay) return fail('CORTE_ACOMPANHAMENTO_ANTERIOR_AO_PERIODO');
  }
  return m;
}
export function monthsFor(m) {
  if(m.phase==='automatic') return automaticMonths(m);
  if(m.phase!=='history') return ['2026-10'];
  const months=m.months;
  if(!Array.isArray(months)||months.length<1||months.length>2||months.some(month=>!/^2026-0[1-9]$/.test(month))||
    (months.length===2&&Number(months[1].slice(5))!==Number(months[0].slice(5))+1)) return fail('MESES_LOTE_INVALIDOS');
  return [...months];
}
export function daysFor(m,month) {
  if(m.phase==='automatic') {
    if(!monthsFor(m).includes(month)) return fail('MES_FORA_DO_LOTE');
    const count=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
    return Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`).filter(day=>day>=m.from&&day<=m.cutoff);
  }
  if(m.phase==='day') return [m.peakDay];
  if(m.phase==='history'&&!monthsFor(m).includes(month)) return fail('MES_FORA_DO_LOTE');
  const count=new Date(Date.UTC(2026,Number(month.slice(5)),0)).getUTCDate();
  return Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`).filter(day=>day<=m.cutoff);
}
export function nextWindowAt(window,now=Date.now()) {
  if(!window) return now;
  const allowed=time=>{
    const hm=new Date(time).toLocaleTimeString('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    return window.start<window.end ? hm>=window.start&&hm<window.end : hm>=window.start||hm<window.end;
  };
  let next=now;
  for(let i=0;i<=1440;i++,next+=60000) if(allowed(next))return next;
  return fail('JANELA_INVALIDA');
}
export function assertContractRecord(kind,record) {
  exactId(record[kind==='attendance'?'id_atendimento':'id_ordem_servico']);
  if(kind==='attendance') localDay(record.data_cadastro);
  else { for(const name of ['data_cadastro','data_inicio_programado','data_inicio_executado','data_termino_executado']) if(record[name]) localDay(record[name],true); }
}

// A commercial exclusion is not permission to omit an item from source reconciliation.
export function checklistExclusions(kind,reference) {
  const value=reference?.commercialExclusions;
  if(value===undefined) return new Set();
  const fail=()=>{throw Object.assign(new Error('EXCLUSOES_COMERCIAIS_INVALIDAS'),{code:'EXCLUSOES_COMERCIAIS_INVALIDAS'});};
  if(kind!=='serviceOrders'||value?.reason!=='checklist'||!Array.isArray(value.keys)||value.keys.length>50000||!Array.isArray(reference.keys)) return fail();
  const keys=value.keys.map(exactId),source=new Set(reference.keys.map(exactId));
  if(new Set(keys).size!==keys.length||keys.some(key=>!source.has(key))) return fail();
  return new Set(keys);
}

// Per-record evidence only. Never infer an exclusion from an absent customer.
export function reviewedScopeExclusions(kind,reference) {
  const decisions=reference?.scopeReview?.reviewedOrders;
  if(decisions===undefined) return new Set();
  const invalid=()=>fail('REVISAO_ESCOPO_INVALIDA');
  if(kind!=='serviceOrders'||reference.keyField!=='numero_ordem_servico'||!Array.isArray(reference.keys)||!Array.isArray(decisions)||decisions.length>50000) return invalid();
  const source=new Set(reference.keys.map(exactId)),checklists=checklistExclusions(kind,reference),keys=new Set();
  for(const item of decisions) {
    const key=exactId(item?.key);
    if(!source.has(key)||keys.has(key)||checklists.has(key)||item.reason!=='non_commercial_support'||
      typeof item.orderType!=='string'||!/suporte/i.test(item.orderType)||
      typeof item.destination!=='string'||!item.destination.trim()||item.destination.length>150||
      ['cliente_servico','cliente','servico'].includes(item.destination.toLowerCase().trim())||
      item.evidence?.kind!=='user_provided_hubsoft_screenshots'||!/^2026-\d{2}-\d{2}$/.test(item.evidence?.reviewedOn??'')) return invalid();
    try {
      const [year,month,day]=item.evidence.reviewedOn.split('-');localDay(`${day}/${month}/${year}`);
      const completion=localDay(item.completedAt,true);localDay(item.openedAt,true);
      if(reference.exportFilters?.start&&completion<reference.exportFilters.start||reference.exportFilters?.end&&completion>reference.exportFilters.end) return invalid();
    } catch { return invalid(); }
    keys.add(key);
  }
  if(reference.scopeReview.resolved===true && (reference.scopeReview.unassignedCustomerKeys??[]).some(key=>!keys.has(exactId(key)))) return invalid();
  return keys;
}

// Report-backed business scope, independent of destination. An absent client
// never proves an internal destination. Only these explicitly reviewed types
// may be excluded, with the original report hash, key and completion date.
export function reportTypeExclusions(kind,reference) {
  const review=reference?.reportTypeExclusions;
  if(review===undefined) return new Set();
  const invalid=()=>fail('EXCLUSOES_TIPO_RELATORIO_INVALIDAS');
  if(kind!=='serviceOrders'||reference.keyField!=='numero_ordem_servico'||
    !Array.isArray(reference.keys)||reference.filters?.dateField!=='data_termino_executado'||
    reference.exportFilters?.dateField!=='data_termino_executado'||
    typeof reference.fileSha256!=='string'||!/^[a-f0-9]{64}$/.test(reference.fileSha256)||
    review.reportSha256!==reference.fileSha256||review.reason!=='non_commercial_order_type'||
    !Array.isArray(review.orders)||!review.orders.length||review.orders.length>50000) return invalid();
  const start=reference.exportFilters.start,end=reference.exportFilters.end;
  try {
    for(const day of [start,end]) {
      if(!/^2026-\d{2}-\d{2}$/.test(day??'')) return invalid();
      const [y,m,d]=day.split('-');localDay(`${d}/${m}/${y}`);
    }
  } catch {return invalid();}
  if(start>end) return invalid();
  const source=new Set(reference.keys.map(exactId));
  const other=new Set([...checklistExclusions(kind,reference),...reviewedScopeExclusions(kind,reference)]);
  const keys=new Set(),allowed=new Set(['(SFN) SUPORTE','MANUTENCAO','ABERTURA DE CTO']);
  for(const item of review.orders) {
    const key=exactId(item?.key);
    const type=typeof item.orderType==='string'?item.orderType.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase():'';
    if(!source.has(key)||keys.has(key)||other.has(key)||!allowed.has(type)||
      !/^2026-\d{2}-\d{2}$/.test(item.completedOn??'')||item.completedOn<start||item.completedOn>end) return invalid();
    try {const [y,m,d]=item.completedOn.split('-');localDay(`${d}/${m}/${y}`);} catch {return invalid();}
    keys.add(key);
  }
  return keys;
}
