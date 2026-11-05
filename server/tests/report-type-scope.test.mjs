import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

process.env.DATABASE_URL='postgresql://test:test@127.0.0.1:1/test';
const {createHistoryJob,approveHistoryMonth}=await import('../history.mjs');
const {attachHistoryReports,historyReconciliation}=await import('../historyReconciliation.mjs');

test('referência revisada não publica; aprovação continua transacional e preserva staging',async()=>{
  const pg=new PGlite();
  try {
    for(const migration of ['001_initial.sql','002_history.sql','003_attendance_followups.sql']) {
      await pg.exec(await readFile(new URL(`../../database/migrations/${migration}`,import.meta.url),'utf8'));
    }
    const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:true}]}):pg.query(sql,args);
    const db={query,connect:async()=>({query,release(){}})};
    const reports={
      attendance:{fileSha256:'a'.repeat(64),keyField:'protocolo',keys:['101'],exportedAt:'2026-11-03',filters:{dateField:'data_cadastro',otherFilters:'none'}},
      serviceOrders:{fileSha256:'b'.repeat(64),keyField:'numero_ordem_servico',keys:['201','202','203'],exportedAt:'2026-11-03',
        filters:{dateField:'data_termino_executado',otherFilters:'none'},
        exportFilters:{dateField:'data_termino_executado',start:'2026-10-01',end:'2026-10-31'}},
    };
    const manifest={year:2026,phase:'day',peakDay:'2026-10-01',cutoff:'2026-10-01',osDateField:'data_termino_executado',maxCalls:500,reports};
    const id=await createHistoryJob(db,manifest);
    const attendance={id_atendimento:'1',protocolo:'101',nome_razaosocial:'Teste',descricao_abertura:'Renovação',usuario_abertura:'Beatriz',tipo_atendimento:'RENOVAÇÃO DE CONTRATO',status:'Resolvido',data_cadastro:'01/10/2026'};
    const order={id_ordem_servico:'2',numero_ordem_servico:'201',tipo_ordem_servico:'INSTALAÇÃO',status:'Finalizado',data_cadastro:'01/10/2026 08:00:00',data_inicio_programado:'01/10/2026 08:00:00',data_inicio_executado:'01/10/2026 08:00:00',data_termino_executado:'01/10/2026 09:00:00',data_referencia_bi:'data_termino_executado'};
    for(const [kind,payload,upstream] of [['attendance',attendance,'1'],['serviceOrders',order,'2']]) {
      await query("INSERT INTO history_records(job_id,month,kind,upstream_id,payload,origin) VALUES($1,'2026-10',$2,$3,$4::jsonb,'direct')",[id,kind,upstream,JSON.stringify(payload)]);
    }
    await query("INSERT INTO history_months(job_id,month) VALUES($1,'2026-10')",[id]);
    await query("UPDATE history_jobs SET state='awaiting_validation' WHERE id=$1",[id]);
    const evidence={month:'2026-10',reviewer:'Operador de teste',confirmFilters:true,
      attendance:{reportSha256:reports.attendance.fileSha256,keys:['101']},
      serviceOrders:{reportSha256:reports.serviceOrders.fileSha256,keys:['201','202','203']}};
    await assert.rejects(approveHistoryMonth(db,id,evidence),/RECONCILIACAO_DIVERGENTE/);
    assert.equal((await query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0,'rollback também desfaz atendimentos já gravados');
    const revised=structuredClone(reports);
    revised.serviceOrders.commercialExclusions={reason:'checklist',keys:['202']};
    revised.serviceOrders.reportTypeExclusions={reason:'non_commercial_order_type',reportSha256:reports.serviceOrders.fileSha256,
      orders:[{key:'203',orderType:'MANUTENÇÃO',completedOn:'2026-10-01'}]};
    const invalid=structuredClone(revised);invalid.serviceOrders.reportTypeExclusions.orders[0].orderType='INSTALAÇÃO';
    await assert.rejects(attachHistoryReports(db,id,invalid),/EXCLUSOES_TIPO_RELATORIO_INVALIDAS/);
    assert.deepEqual((await query('SELECT manifest FROM history_jobs WHERE id=$1',[id])).rows[0].manifest.reports,reports);
    const reconciliation=await attachHistoryReports(db,id,revised);
    assert.equal(reconciliation.publishable,true);
    assert.equal(reconciliation.reports.serviceOrders.rawStatus,'divergent');
    assert.equal((await query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0,'anexar referências não publica dados');
    const saved=(await query('SELECT manifest FROM history_jobs WHERE id=$1',[id])).rows[0].manifest;
    assert.equal(saved.cutoff,manifest.cutoff);assert.equal(saved.maxCalls,manifest.maxCalls);
    assert.equal((await query('SELECT count(*)::int AS n FROM history_records')).rows[0].n,2);
    await approveHistoryMonth(db,id,evidence);
    assert.equal((await query('SELECT state FROM history_jobs WHERE id=$1',[id])).rows[0].state,'complete');
    assert.equal((await query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,2,'não inventa os registros excluídos');
    assert.equal((await query('SELECT count(*)::int AS n FROM history_records')).rows[0].n,2,'staging preservado');
    const audit=(await query('SELECT reconciliation FROM history_months WHERE job_id=$1',[id])).rows[0].reconciliation;
    assert.equal(audit.reportScopes.serviceOrders.rawStatus,'divergent');
    assert.deepEqual(audit.reportScopes.serviceOrders.missing,['202','203']);
    assert.deepEqual(audit.reportScopes.serviceOrders.reportTypeReview.orders,revised.serviceOrders.reportTypeExclusions.orders);
    assert.equal((await historyReconciliation(db,id)).publishable,false,'job concluído não fica disponível para segunda aprovação');
  } finally {await pg.close();}
});
