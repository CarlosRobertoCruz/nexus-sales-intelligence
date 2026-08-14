# Domain Contract

Cobre `feature/domain/`.

---

## Responsabilidade

- Regras de negocio.
- Validacoes.
- Decisoes.
- Transicoes de estado conceitual.

## Pode importar

- `feature/types`
- `core/types`
- `garden/utils`
- `garden/types`
- `@/core/domain` — funcoes puras / classifiers compartilhados entre features (ex.: `core/domain/metricas/domain/signalQuality`, reusado por `onu/wifi`, `onu/informacoes`, `onu/saude`); mesma regra do domain: sem state, service, runtime ou efeito colateral. Equivale ao que `16-viewModel.md` ja permite pra viewModel.

## Nao pode importar

- React.
- Browser.
- UI/foundations.
- State.
- Services.
- Runtime.
- `@/api/*`.

## Regras

- Funcoes puras por padrao.
- Tempo real so por injecao explicita.
- Nao formatar texto visual para UI.
- Condicao de regra de negocio com valor/threshold "magico" (ex. `rssiDbm < -70`,
  `channel > 13`) nao pode ficar solta num `if` cru — vira funcao nomeada (ex.
  `isStrongSignal(rssiDbm)`, `isValid24Channel(channel)`) que expressa a regra pelo nome. Motivo:
  em producao os dados de vizinhanca (Wi-Fi, sinal) mudam com frequencia — sem nome, auditar o
  resultado exige recacar todos os ifs pra reconstruir a explicacao. Nao precisa de classe/Strategy
  Pattern pra isso — funcao pura simples resolve; peso arquitetural maior (Strategy/interface) so
  se houver troca real de implementacao em tempo de execucao, o que hoje nao existe aqui.
