import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writePilotReview,reviewMarkdown} from '../historyReview.mjs';

test('exportação exclusiva grava JSON e roteiro legível sem gerar aprovação ou sobrescrever pacote anterior',async()=>{
  const base=await mkdtemp(join(tmpdir(),'sales-pilot-review-')),directory=join(base,'review');
  const report={jobId:'test',openingDay:'2026-10-01',followupCutoff:'2026-10-28',counts:{incompleteAttendances:1,linkedOrders:1},scopeReview:null,
    incompleteAttendances:[{attendanceId:'101',protocol:'202610010001',openedOn:'01/10/2026',missingFields:['tipo_atendimento']}],
    linkedOrders:[{protocol:'202610010001',orderNumber:'000000000000000001',orderId:'201',executionFinishedAt:'05/10/2026 11:00:00',outcome:'concluded_by_cutoff'}],attendances:[],requiredChecks:['Conferir fonte independente.'],publicationApproved:false};
  try {
    const result=await writePilotReview(report,directory);
    assert.equal(result.publicationApproved,false);
    assert.deepEqual(JSON.parse(await readFile(join(directory,'review.json'),'utf8')),report);
    const md=await readFile(join(directory,'conferencia.md'),'utf8');
    assert.ok(md.includes('000000000000000001'));assert.ok(md.includes('05/10/2026 11:00:00'));assert.ok(md.includes('tipo_atendimento'));assert.ok(md.includes('Não copiar os números'));
    await assert.rejects(writePilotReview(report,directory),{code:'EEXIST'});
    assert.equal(reviewMarkdown(report),md);
  } finally {
    for(const file of ['review.json','conferencia.md']) await unlink(join(directory,file));
    await rmdir(directory);await rmdir(base);
  }
});
