# Nexus Sales Intelligence

Aplicação de inteligência comercial da Nexus Fibra para análise de vendas, renovações, cancelamentos, localidades e desempenho da equipe a partir da importação de planilhas.

## Recursos atuais

- Visão geral dos principais indicadores comerciais.
- Análises de vendas, renovações e cancelamentos.
- Mapa de resultados por localidade.
- Indicadores da equipe comercial.
- Seleção do mês de referência.
- Importação incremental de relatórios de atendimentos e ordens de serviço.
- Atualização de registros duplicados durante novas importações.
- Armazenamento local em IndexedDB.
- Limpeza completa dos dados importados.

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

Projeto em desenvolvimento. A próxima etapa será o empacotamento como aplicativo desktop para Windows e a publicação de instaladores versionados pelo GitHub Releases.
