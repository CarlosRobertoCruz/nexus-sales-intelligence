// This is an API snapshot policy, not an approval of an external report.
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const saoPauloDay=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const shiftDay=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const endOfMonth=month=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
export const monthIndex=month=>Number(month.slice(0,4))*12+Number(month.slice(5))-1;
export const monthAt=index=>`${Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`;
export function checkedDay(day) {
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z'))||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day) fail('DATA_AUTOMATICA_INVALIDA');
  return day;
}
export function automaticMonths(m) {
  const months=m.months;
  if(!Array.isArray(months)||months.length<1||months.length>2||months.some(month=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'2025-01')||
    (months.length===2&&monthIndex(months[1])!==monthIndex(months[0])+1)) fail('MESES_AUTOMATICOS_INVALIDOS');
  return [...months];
}
export function validateAutomaticManifest(m,today=saoPauloDay()) {
  const months=automaticMonths(m);
  checkedDay(m.from);checkedDay(m.cutoff);checkedDay(m.cycleCutoff);
  if(m.phase!=='automatic'||m.startDate!=='2025-01-01'||!['backfill','daily'].includes(m.mode)||m.from>m.cutoff||m.from.slice(0,7)!==months[0]||m.cutoff.slice(0,7)!==months.at(-1)||m.cutoff>=today||
    m.osDateField!=='data_termino_executado'||m.enrichmentStrategy!=='protocol'||m.validation!=='api_snapshot'||m.autoPublish!==true||
    !Number.isInteger(m.maxCalls)||m.maxCalls<1||m.maxCalls>5000||m.pendingLimit!==50||!/^\d{4}-\d{2}-\d{2}$/.test(m.cycleDay??'')||
    !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(m.approvedOctoberJob??'')) fail('MANIFESTO_AUTOMATICO_INVALIDO');
  checkedDay(m.cycleDay);
  if(m.from<m.startDate||m.cycleCutoff<m.cutoff||m.cycleCutoff>=today||m.cycleDay>today||m.cycleCutoff>=m.cycleDay||(m.mode==='backfill'&&(m.from!==months[0]+'-01'||m.cutoff!==endOfMonth(months.at(-1))))||
    (m.mode==='daily'&&Date.parse(m.cutoff)-Date.parse(m.from)>29*86400000)) fail('ESCOPO_AUTOMATICO_INVALIDO');
  return m;
}
export function validateAutomaticConfig(input) {
  if(input?.version!==1||input.startDate!=='2025-01-01'||input.year!==undefined||input.backfillFrom!=='2025-01'||input.backfillThrough!=='last_closed_month'||input.dailyAt!=='02:00'||input.reviewDays!==30||input.maxCalls!==5000||
    !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(input.approvedOctoberJob??'')) fail('CONFIGURACAO_AUTOMATICA_INVALIDA');
  return {version:1,startDate:'2025-01-01',backfillFrom:input.backfillFrom,backfillThrough:input.backfillThrough,dailyAt:'02:00',reviewDays:30,maxCalls:5000,approvedOctoberJob:input.approvedOctoberJob};
}
export function automaticManifest(config,mode,months,from,cutoff,cycleDay,cycleCutoff=cutoff) {
  return validateAutomaticManifest({phase:'automatic',startDate:config.startDate,mode,months,from,cutoff,cycleDay,cycleCutoff,maxCalls:config.maxCalls,pendingLimit:50,
    approvedOctoberJob:config.approvedOctoberJob,osDateField:'data_termino_executado',enrichmentStrategy:'protocol',validation:'api_snapshot',autoPublish:true});
}
