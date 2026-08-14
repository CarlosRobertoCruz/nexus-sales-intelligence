# Migrations Contract

> Versao 1.0 — Junho 2026
> Cobre `app/server/src/db/migrations/`.

---

## Responsabilidade

Migration e a historia oficial do banco. Ela descreve como o schema evoluiu e garante que qualquer ambiente (dev, staging, producao) chegue ao mesmo estado rodando as migrations em ordem.

---

## Por que migrations sao permanentes

Uma migration ja aplicada em producao nao pode ser editada. Se for alterada, o banco local vai diferir do banco de producao de forma silenciosa — e o proximo deploy pode quebrar sem motivo aparente. Isso ja aconteceu.

---

## Convencao de nomes

```txt
001_core.sql
002_queues_routing.sql
014_conversation_contact_context.sql
```

- Numero sequencial de 3 digitos.
- Nome descritivo do que muda — nao do modulo.
- Evitar: `014_fix.sql`, `014_update.sql`, `014_novo.sql`.

---

## Padrao obrigatorio — idempotencia

```sql
-- correto — pode rodar N vezes sem erro
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS contact_cpf TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_contact_cpf
  ON conversations (tenant_id, contact_cpf)
  WHERE contact_cpf IS NOT NULL;
```

```sql
-- errado — quebra se ja existir
ALTER TABLE conversations ADD COLUMN contact_cpf TEXT;
```

---

## Corrigindo erro em migration ja aplicada

```txt
-- NAO faca isso:
-- Editar 012_message_attachments.sql que ja foi para producao

-- Faca isso:
-- Criar 015_fix_message_attachments.sql com a correcao
```

---

## Regras

| Regra | Motivo |
|---|---|
| Numeracao sequencial | Garante ordem de aplicacao correta |
| `IF NOT EXISTS` em DDL | Idempotencia — migration pode rodar mais de uma vez com seguranca |
| Sem dados de seed | Seed e dado de demo; migration e schema permanente |
| Sem alteracao de migration aplicada | Evita divergencia silenciosa entre ambientes |
| Nome descritivo | Historico legivel sem abrir o arquivo |
| Uma responsabilidade por migration | Facilita rollback e entendimento do historico |
