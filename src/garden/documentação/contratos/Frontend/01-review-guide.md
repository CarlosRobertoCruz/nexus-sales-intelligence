# Review Guide

Guia para auditar arquivo por arquivo sem misturar camadas.

---

## Como auditar

1. Identifique a pasta/camada do arquivo.
2. Leia o contrato correspondente.
3. Verifique imports antes de comportamento.
4. Verifique se o arquivo faz mais do que sua camada permite.
5. Feche com veredito: conforme, quase conforme ou nao conforme.

---

## Sinais de alerta

- Arquivo com nome generico demais.
- UI chamando service, domain, runtime ou state direto.
- Controller importando foundation, token ou core/ui.
- Domain importando React, browser, API, state ou service.
- Garden importando produto, app, core ou API.
- Mock/dado de exemplo dentro de feature real.
- Pasta criada "para o futuro".

---

## Promocao

- Repetiu em 3 features/projetos e e domain-blind: considerar Garden.
- E compartilhado mas conhece linguagem do produto: considerar core.
- E duvidoso: fica na feature primeiro.

---

## Tipos repetidos

Tipo repetido deve subir para `feature/types`, `core/types` ou `garden/types` conforme escopo.
