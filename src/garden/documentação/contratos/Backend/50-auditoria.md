# Auditoria Contract

> Versao 1.0 — Junho 2026
> Cobre uso de `logAuditEvent` e `resolveResponsavel` em controllers.

---

## Responsabilidade

O sistema de auditoria registra quem fez o que, quando, de onde e por qual canal. Esses logs sao usados para suporte, compliance e rastreabilidade de acoes criticas.

---

## Onde chamar

Sempre no **controller**, apos a acao ter sido executada com sucesso:

```ts
const result = await service.createLead(body);   // 1. executa
logAuditEvent({ ... }, tenant(req)).catch(...);   // 2. registra
res.status(201).json(result);                     // 3. responde
```

Nunca no service — o service nao tem acesso a `req.ip`, `req.headers` nem sabe quem iniciou a chamada.

---

## Campos e regras por campo

### `tipo`

```ts
"usuario"   // acao iniciada por humano via interface
"sistema"   // acao automatizada (webhook, cron, n8n)
"bot"       // acao iniciada pela Nexus IA
```

```ts
// errado — humano criou o lead, nao o sistema
tipo: "sistema"

// correto
tipo: "usuario"
```

### `responsavel`

```ts
// correto — nome vem do token de sessao
responsavel: resolveResponsavel(req.headers)

// errado — nunca string literal
responsavel: "Sistema"
responsavel: "Admin"
```

### `canal`

```ts
// correto — canal real da conversa
canal: body.channel ?? "Dashboard"

// errado — assume que todo lead vem do WhatsApp
canal: "WhatsApp"
```

### `tenant` (segundo argumento)

```ts
// correto
logAuditEvent({ ... }, tenant(req))

// errado
logAuditEvent({ ... }, "default")
```

---

## Quando registrar

| Registrar | Nao registrar |
|---|---|
| Criacao de agente, lead, conversa | Listagens e leituras simples |
| Edicao de configuracoes | Erros de validacao de input |
| Remocao de qualquer entidade | Requisicoes de polling |
| Acesso a relatorio sensivel | Health checks |
| Transbordo e encerramento de ticket | |

---

## Niveis de status

| Status | Quando usar |
|---|---|
| `"sucesso"` | Acao completada normalmente |
| `"atencao"` | Acao completada mas merece revisao (ex: arquivar card) |
| `"critico"` | Acao destrutiva ou sensivel (ex: deletar agente, remover quadro) |

---

## Template completo

```ts
logAuditEvent({
  tipo: "usuario",
  acao: "Lead criado no CRM",
  origem: "CRM",
  responsavel: resolveResponsavel(req.headers),
  detalhes: `Lead **"${body.contactName}"** criado no funil de vendas`,
  status: "sucesso",
  ip: req.ip ?? "",
  canal: body.channel ?? "Dashboard",
  acoes: ["Lead adicionado ao funil de vendas"],
  cliente: body.contactName,
}, tenant(req)).catch((err) => console.error("[audit]", err));
```

O `.catch` e obrigatorio — falha de log nao deve derrubar a operacao principal.
