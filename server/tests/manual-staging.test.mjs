import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

process.env.DATABASE_URL='postgresql://test:test@127.0.0.1:1/test';
const {upsertRows,rebuild,quarantineLegacyManualRows}=await import('../records.mjs');

const attendance={
  id_atendimento:'101',protocolo:'202610010001',nome_razaosocial:'Cliente',codigo_cliente:'12',
  descricao_abertura:'Renovação com bônus',descricao_fechamento:'',data_cadastro:'01/10/2026',
  usuario_abertura:'Beatriz',status:'Resolvido',tipo_atendimento:'RENOVAÇÃO DE CONTRATO',
};
const order={
  id_ordem_servico:'201',id_atendimento:'101',numero_ordem_servico:'201',nome_razaosocial:'Cliente',codigo_cliente:'12',
  tipo_ordem_servico:'INSTALAÇÃO',status:'finalizado',data_inicio_programado:'01/10/2026 10:00:00',
  data_inicio_executado:'01/10/2026 10:00:00',data_termino_executado:'01/10/2026 11:00:00',
};

test('sincronização manual fica em staging e não altera o período publicado',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec(await readFile(new URL('../../database/migrations/001_initial.sql',import.meta.url),'utf8'));
    const query=(sql,args=[])=>pg.query(sql,args);
    const db={query};

    await upsertRows(db,'attendance',[attendance],'hubsoft');
    await upsertRows(db,'serviceOrders',[order],'hubsoft');
    await rebuild(db);
    assert.equal(Number((await query("SELECT count(*) AS n FROM commercial_records WHERE kind='renewals'")).rows[0].n),1);

    // A consulta manual do mesmo ID não pode rebaixar o registro já aprovado.
    await upsertRows(db,'attendance',[{...attendance,descricao_abertura:'Consulta manual posterior',publication_scope:'manual_staging'}],'hubsoft');
    const preserved=(await query("SELECT payload FROM source_records WHERE kind='attendance' AND id='hubsoft:101'")).rows[0].payload;
    assert.equal(preserved.publication_scope,undefined);
    assert.equal(preserved.descricao_abertura,attendance.descricao_abertura);

    // Um registro manual novo permanece rastreável, mas fora dos indicadores.
    await upsertRows(db,'attendance',[{...attendance,id_atendimento:undefined,protocolo:'20261007000001',data_cadastro:'07/10/2026',publication_scope:'manual_staging'}],'hubsoft');
    await rebuild(db);
    assert.equal(Number((await query("SELECT count(*) AS n FROM commercial_records WHERE kind='renewals'")).rows[0].n),1);

    // Linhas manuais legadas sem ID canônico são isoladas sem serem apagadas.
    await upsertRows(db,'attendance',[{...attendance,id_atendimento:undefined,protocolo:'20261007000002',data_cadastro:'07/10/2026'}],'hubsoft');
    assert.deepEqual(await quarantineLegacyManualRows(db),{attendance:1});
    await rebuild(db);
    assert.equal(Number((await query("SELECT count(*) AS n FROM commercial_records WHERE kind='renewals'")).rows[0].n),1);
    assert.equal(Number((await query("SELECT count(*) AS n FROM source_records WHERE kind='attendance'")).rows[0].n),3);
  } finally { await pg.close(); }
});
