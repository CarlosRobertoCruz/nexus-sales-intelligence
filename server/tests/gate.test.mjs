import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {HubsoftGate,retryDelay} from '../hubsoftGate.mjs';
import {HubsoftClient} from '../hubsoft.mjs';
test('429 respeita o maior prazo e não interpreta ausência como zero',()=>{
  assert.equal(retryDelay({headers:new Headers()},{retry_after:12}),12);
  assert.equal(retryDelay({headers:new Headers({'retry-after':'30'})},{retry_after:12}),30);
  assert.equal(retryDelay({headers:new Headers()},{}),60);
});
test('gate compartilhado serializa chamadas, cifra o token e persiste cooldown e métricas',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec(await readFile(new URL('../../database/migrations/001_initial.sql',import.meta.url),'utf8'));
    await pg.exec(await readFile(new URL('../../database/migrations/002_history.sql',import.meta.url),'utf8'));
    const locks=new Set();
    const query=async(sql,args=[])=>{
      if(sql.includes('pg_try_advisory_lock')) { const locked=!locks.has(args[0]); if(locked)locks.add(args[0]); return {rows:[{locked}]}; }
      if(sql.includes('pg_advisory_unlock')) {locks.delete(args[0]);return {rows:[]};}
      return pg.query(sql,args);
    };
    const pool={query,connect:async()=>({query,release(){}})};
    const env={HUBSOFT_API_URL:'https://example.invalid',HUBSOFT_CLIENT_ID:'c',HUBSOFT_CLIENT_SECRET:'secret-test',HUBSOFT_USERNAME:'u',HUBSOFT_PASSWORD:'test'};
    let now=Date.now()+10000;const sent=[];
    const options={now:()=>now,sleep:async ms=>{now+=ms;}};
    const fetcher=async(url,options)=>{sent.push({method:options.method,at:now,url:new URL(url)}); return Response.json(options.method==='POST'?{access_token:'only-a-test-token',expires_in:3600}:{status:'suscess',atendimentos:[],paginacao:{pagina_atual:0,ultima_pagina:0}});};
    const gate1=new HubsoftGate(pool,env,options),gate2=new HubsoftGate(pool,env,options);
    await new HubsoftClient(env,fetcher,async()=>{},gate1).page('attendance','2026-10-01',0);
    await new HubsoftClient(env,fetcher,async()=>{},gate2).page('attendance','2026-10-01',0);
    assert.equal(sent.filter(c=>c.method==='POST').length,1,'token reutilizado entre clientes/processos');
    assert.ok(sent.slice(1).every((c,i)=>c.at-sent[i].at>=1000),'não acumula burst');
    const saved=(await query('SELECT token_cipher FROM hubsoft_gate')).rows[0].token_cipher;
    assert.equal(saved.includes('only-a-test-token'),false);
    assert.equal(gate2.decrypt(saved),'only-a-test-token');
    await assert.rejects(gate1.perform({method:'GET',path:'/api/v1/integracao/atendimento/todos'},async()=>({status:429,data:{},policy:'integracao',retrySeconds:20})),/LIMITE/);
    let attempted=false;
    await assert.rejects(gate2.perform({method:'GET',path:'/api/v1/integracao/atendimento/todos'},async()=>{attempted=true;}),/LIMITE/);
    assert.equal(attempted,false,'outro processo não consulta durante cooldown');
    const metric=(await query('SELECT status,policy,retry_after_seconds FROM hubsoft_call_metrics ORDER BY id DESC LIMIT 1')).rows[0];
    assert.equal(metric.status,429);assert.equal(metric.policy,'integracao');assert.equal(Number(metric.retry_after_seconds),20);
    now+=21000;
    await gate2.perform({method:'GET',path:'/api/v1/integracao/atendimento/todos'},async()=>({status:200,data:{okay:true}}));
    await gate2.invalidateToken();
    assert.equal((await query('SELECT token_cipher FROM hubsoft_gate')).rows[0].token_cipher,null);
  } finally {await pg.close();}
});
test('consulta por cliente valida dono e recusa página cheia de completude desconhecida',async()=>{
  const env={HUBSOFT_API_URL:'https://example.invalid',HUBSOFT_CLIENT_ID:'c',HUBSOFT_CLIENT_SECRET:'s',HUBSOFT_USERNAME:'u',HUBSOFT_PASSWORD:'p'};
  for(const records of [[{cliente:{codigo_cliente:99}}],Array.from({length:50},()=>({cliente:{codigo_cliente:12}}))]) {
    const client=new HubsoftClient(env,async(_url,opt)=>Response.json(opt.method==='POST'?{access_token:'x',expires_in:3600}:{status:'suscess',atendimentos:records}),async()=>{});
    await assert.rejects(client.clientAttendances('12','2026-10-01'),/CLIENTE/);
  }
});
