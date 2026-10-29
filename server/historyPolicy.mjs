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
// Opt-in permission is bound to the existing daily pilot, never inherited by another job.
export function usesProtocolPilot(m,jobId=m?.protocolException?.jobId) {
  const strategy=m?.enrichmentStrategy??'client';
  if(strategy==='client') return false;
  if(strategy!=='protocol') return fail('ESTRATEGIA_ENRIQUECIMENTO_INVALIDA');
  const permission=m.protocolException;
  if(m.year!==2026||m.phase!=='day'||m.peakDay!=='2026-10-01'||!Number.isInteger(m.maxCalls)||m.maxCalls<1||m.maxCalls>500||
      permission?.enabled!==true||permission.day!==m.peakDay||permission.jobId!==jobId||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(permission.jobId??'')) return fail('EXCECAO_PROTOCOLO_FORA_DO_PILOTO');
  return true;
}
export function validateManifest(m,today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})) {
  if(!m||m.year!==2026||!['day','october','history'].includes(m.phase)) return fail('MANIFESTO_INVALIDO');
  usesProtocolPilot(m);
  if(!/^2026-\d{2}-\d{2}$/.test(m.cutoff??'') || m.cutoff>=today) return fail('CORTE_EXIGE_DIA_COMPLETO');
  if(new Date(m.cutoff+'T12:00:00Z').toISOString().slice(0,10)!==m.cutoff) return fail('CORTE_INVALIDO');
  if(!['data_cadastro','data_inicio_programado','data_termino_executado'].includes(m.osDateField)) return fail('FILTRO_OS_INVALIDO');
  for(const reports of m.phase==='history'?monthsFor(m).map(month=>m.monthReports?.[month]):[m.reports]) for(const kind of ['attendance','serviceOrders',...(m.followupCutoff ? ['followup'] : [])]) {
    const report=reports?.[kind];
    const pending=kind==='followup'&&m.phase==='day'&&report?.pending===true&&!m.autoPublish;
    if(report?.pending===true&&!pending) return fail('REFERENCIA_PENDENTE_NAO_PERMITIDA');
    if(!pending && (!report || typeof report.fileSha256!=='string'||!/^[a-f0-9]{64}$/.test(report.fileSha256)||!report.filters||typeof report.filters!=='object'||!report.exportedAt)) return fail('RELATORIOS_OBRIGATORIOS');
    if(!report?.filters) return fail('RELATORIOS_OBRIGATORIOS');
    const identities=kind==='attendance'?['id_atendimento','protocolo']:['id_ordem_servico','numero_ordem_servico'];
    if(report.keyField!==undefined&&!identities.includes(report.keyField)) return fail('CAMPO_IDENTIDADE_INVALIDO');
    if(report.keys!==undefined&&(!Array.isArray(report.keys)||report.keys.length>50000||new Set(report.keys.map(exactId)).size!==report.keys.length)) return fail('CHAVES_RELATORIO_DUPLICADAS');
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
  if(m.phase==='history' && m.cutoff<'2026-10-31') return fail('OUTUBRO_AINDA_ABERTO');
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
export function monthsFor(m) { return m.phase==='history' ? Array.from({length:9},(_,i)=>`2026-${String(i+1).padStart(2,'0')}`) : ['2026-10']; }
export function daysFor(m,month) {
  if(m.phase==='day') return [m.peakDay];
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
