# Nexus Sales Intelligence

Aplicação de inteligência comercial da Nexus Fibra que transforma relatórios do Hubsoft em painéis mensais de vendas, renovações, cancelamentos, reativações, localidades e desempenho da equipe comercial.

O sistema cruza planilhas de atendimentos e ordens de serviço, consolida registros duplicados e apresenta os resultados em uma interface preparada para análise e impressão.

## Recursos atuais

- Visão geral dos principais indicadores comerciais.
- Análises de vendas, renovações e cancelamentos.
- Mapa de resultados por localidade.
- Indicadores da equipe comercial.
- Seleção do mês de referência.
- Importação simultânea de uma ou várias planilhas de atendimentos e ordens de serviço.
- Atualização de registros duplicados durante novas importações.
- Armazenamento local em IndexedDB.
- Limpeza completa dos dados importados.
- Geração de relatório PDF A4 com todas as abas e os três mapas territoriais.

## Regras comerciais principais

- Vendas são confirmadas por ordens de serviço de instalação finalizadas, com início e término executados válidos. O atendimento identifica a atendente e o período comercial.
- Renovações são identificadas pelos atendimentos comerciais de renovação e alteração de plano concluídos.
- Cancelamentos consideram somente cancelamentos efetivados; desistências e ocorrências sem conclusão permanecem fora do indicador.
- Reativações são classificadas pelo tipo e conclusão da ordem de serviço.
- Eventos repetidos do mesmo cliente são consolidados durante a importação.

## Privacidade dos dados

As planilhas são processadas no próprio navegador. Os registros importados ficam armazenados localmente no IndexedDB do dispositivo e não são incluídos no repositório Git.

## Desenvolvimento

Requisitos:

- Node.js
- npm

Instalação e execução:

```bash
npm install
npm run dev
```

Validação de produção:

```bash
npm run build
npm run lint
```

## Tecnologias

- React
- TypeScript
- Vite
- IndexedDB
- ECharts
- MapLibre GL

## Status

Versão atual: **0.2.0-beta.1**.

Projeto em validação interna. A próxima etapa será o empacotamento como aplicativo desktop para Windows e a publicação de instaladores versionados pelo GitHub Releases.
