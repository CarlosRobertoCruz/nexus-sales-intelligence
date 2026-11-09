import type { CancellationReasonId } from "../../../core/types/commercialDashboard";

const labels: Record<CancellationReasonId, string> = {
  "no-coverage": "Mudança para local sem cobertura",
  dissatisfaction: "Insatisfação com o serviço",
  "existing-provider": "Outro provedor no endereço",
  financial: "Motivo financeiro",
  "closed-business": "Fechamento do comércio",
  "low-usage": "Pouco uso",
  moving: "Mudança de endereço",
  other: "Outros motivos",
};

function clauses(value: string): string[] {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/<br\s*\/?\s*>/g, "\n").replace(/<[^>]*>/g, " ")
    .split(/[.!?;\r\n]+|\b(?:porem|mas|entretanto|no entanto)\b/)
    .map(part => part.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const question = /(?:foi|foram|ao ser|inicialmente)\s+(?:questionad[oa]s?|perguntad[oa]s?)|questionou-se|perguntou-se|se havia alguma/;
const alternative = /(?:possibilidade|alternativa|opcao|oferta|tentativa de retencao|foi oferecid[oa]|foi ofertad[oa]|foi sugerid[oa])/;
const processComplaint = /(?:demora|dificuldade|lentidao|problema).{0,100}(?:cancelamento|cancelar|concluir o procedimento)|(?:durante|apos|andamento|processo).{0,50}cancelamento|insatisfacao.{0,65}(?:demora|nao ter conseguido concluir|ainda nao.{0,25}concluir)|tentando.{0,25}cancelar/;

// A negation only suppresses the fact it refers to, not a later affirmative fact.
function positive(part: string, pattern: RegExp): boolean {
  const flags = pattern.flags.replace(/g/g, "") + "g";
  return [...part.matchAll(new RegExp(pattern.source, flags))].some(match => {
    // Carry a denial across a coordinated list: "não há quedas ou oscilações".
    const before = part.slice(0, match.index).replace(new RegExp(`(?:${pattern.source})\\s+(?:e|ou|nem)\\s+`, flags), "");
    const after = part.slice((match.index ?? 0) + match[0].length);
    return !/(?:nao|nunca|sem|negou|nega|negando|ausencia de)\s+(?:(?:ha|houve|havia|houvesse|que|tem|tenho|tinha|possui|possuia|estava|esta|estou|estar|ter|qualquer|nenhuma|nenhum|alguma|algum|mais|relatou|relata|reclamou|demonstrou|apresentou|manifestou)\s+){0,4}$/.test(before)
      && !/^\s*(?:nao (?:ha|houve|ocorre|ocorreram|existe)|foi negad[oa])\b/.test(after);
  });
}

function reasonIn(part: string, causal: boolean): CancellationReasonId | null {
  if (question.test(part) || (!causal && alternative.test(part))) return null;

  if (positive(part, /sem cobertura|falta de cobertura|fora da area de cobertura|sem viabilidade/)) return "no-coverage";
  if (positive(part, /fechamento do comercio|encerrou (?:as |suas )?atividades|encerramento (?:do comercio|das atividades)/)) return "closed-business";
  if (positive(part, /mudanca (?:de|do) (?:imovel|endereco|residencia)|se mudou|mudou[- ]se|entregou o imovel|vai (?:se )?mudar/)) return "moving";
  if (positive(part, /(?:ja (?:havia|possui|tinha)|contratou|contratado|optou por|migrou para|vai utilizar|utiliza).{0,45}(?:outro provedor|outra operadora|internet)|(?:internet|conexao).{0,35}(?:inclusa|incluida) (?:no|na).{0,20}aluguel/)) return "existing-provider";
  if (causal && positive(part, /outro provedor|outra operadora/)) return "existing-provider";

  // Billing steps and cancellation charges do not establish why the customer left.
  if (positive(part, /dificuldades? financeir[ao]s?|problemas? financeiros?|motivos? financeiros?|questoes financeiras|sem condicoes (?:financeiras|de (?:pagar|arcar|manter))|nao (?:consegue|conseguia|pode|podia|tem condicoes de) (?:mais )?(?:arcar|manter|pagar (?:a mensalidade|o plano|a internet|o servico))|(?:mensalidade|valor do plano|preco do plano|custo da internet).{0,25}(?:alto|caro|pesad)|(?:reduzir|cortar|diminuir|economizar).{0,20}(?:gastos|despesas|custos)/)) return "financial";
  if (causal && !/multa|garantia|rescis/.test(part) && positive(part, /inadimplencia|valor (?:muito )?alto|preco (?:muito )?alto|sem dinheiro|sem condicoes/)) return "financial";
  if (positive(part, /pouco uso|nao utiliza(?:va)? (?:mais )?(?:a internet|o servico|o plano)|nao necessita(?:va)? (?:mais )?(?:da internet|do servico|do plano)|nao usa(?:va)? (?:mais )?(?:a internet|o servico|o plano)/)) return "low-usage";

  if (processComplaint.test(part)) return null;
  if (positive(part, /quedas(?: constantes| frequentes| recorrentes)?|oscilacoes|instabilidade (?:na|da) (?:internet|conexao)|problemas? (?:na|com a|de) conexao|insatisfacao|insatisfeit[oa]/)) return "dissatisfaction";
  return null;
}

function causalReason(parts: ReadonlyArray<string>): { found: boolean; reason: CancellationReasonId | null } {
  for (const part of parts) {
    if (question.test(part) || alternative.test(part)) continue;
    // Limit causal connectors to a cancellation statement or an explicit reason.
    const cause = part.match(/\bcancel(?:amento|ar|ou|ado|ada)\b.{0,120}?\b(?:devido (?:a|ao|aos|as)|por (?:motivo de|conta de|questoes de)|em (?:razao|virtude) de|porque|pois|ja que|por)\s+(.+)/)?.[1]
      ?? part.match(/\b(?:motivo|razao|causa) (?:principal )?(?:do|para o) cancelamento\s*(?:foi|e|era|:)?\s*(.+)/)?.[1];
    if (cause) return { found: true, reason: reasonIn(cause, true) };
  }
  return { found: false, reason: null };
}

export function extractCancellationReason(opening: string, closing: string): { id: CancellationReasonId; label: string } {
  const openingParts = clauses(opening), closingParts = clauses(closing);
  const initialCause = causalReason(openingParts);
  let id: CancellationReasonId;
  if (initialCause.found) {
    id = initialCause.reason ?? "other";
  } else {
    const reasons = [...new Set(openingParts.map(part => reasonIn(part, false)).filter((reason): reason is CancellationReasonId => reason !== null))];
    // Ambiguous evidence must not be resolved by dictionary order.
    id = reasons.length === 1 ? reasons[0] : "other";
    if (!reasons.length) id = causalReason(closingParts).reason ?? "other";
  }
  return { id, label: labels[id] };
}
