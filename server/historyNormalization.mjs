import {mergeAttendanceDetail} from './historyAttendanceDetail.mjs';
import {normalizeHubsoft} from './hubsoftAdapter.mjs';
import {exactId,localDay,assertContractRecord} from './historyPolicy.mjs';
import {orderDates} from './historyFollowup.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const clientCode=raw=>raw.cliente?.codigo_cliente??raw.cliente_servico?.cliente?.codigo_cliente??raw.codigo_cliente;
export function normalizeDate(value) {
  if(/^\d{4}-\d{2}-\d{2}/.test(String(value))) { const [y,m,d]=value.slice(0,10).split('-'); return `${d}/${m}/${y}`; }
  return value;
}
export function normalized(kind,raw,{allowIncompleteBusinessFields=false}={}) {
  const row=kind==='serviceOrders'?normalizeHubsoft(kind,orderDates(raw),{},{requireScheduled:false}):normalizeHubsoft(kind,raw,{},{allowIncompleteBusinessFields});
  if(kind==='attendance'){row.data_cadastro=row.data_cadastro.split(' ')[0];row.date_precision='day';}
  assertContractRecord(kind,row);return row;
}
export function normalizedAttendanceDetail(raw,detail,customer,created) {
  if(!detail||exactId(detail.id_atendimento)!==exactId(raw.id_atendimento)) fail('HUBSOFT_ATENDIMENTO_ID_DIVERGENTE');
  if(String(detail.protocolo)!==exactId(raw.protocolo)) fail('HUBSOFT_PROTOCOLO_DIVERGENTE');
  if(exactId(clientCode(detail))!==customer) fail('HUBSOFT_CLIENTE_DIVERGENTE');
  if(localDay(normalizeDate(detail.data_cadastro_br??detail.data_cadastro))!==created) fail('HUBSOFT_ATENDIMENTO_DIA_DIVERGENTE');
  if(detail.deleted_at) fail('EXCLUSAO_EXIGE_RECONCILIACAO');
  return normalized('attendance',mergeAttendanceDetail(raw,detail),{allowIncompleteBusinessFields:true});
}
