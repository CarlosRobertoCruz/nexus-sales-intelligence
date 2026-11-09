import { useEffect, useRef, useState } from "react";
import { MultiDonutChart } from "@/garden/charts";
import { Badge, Modal, Row, Stack, Surface, Text } from "@/garden/foundations";
import { TOKENS } from "@/garden/tokens";
import type { CancellationDetail } from "@/core/types/commercialDashboard";
import type { CancellationsViewModel } from "../viewModel/buildCancellationsViewModel";
import "./cancellationDetails.css";

const reasonColors = [TOKENS.color.feedback.danger, TOKENS.color.feedback.warning, TOKENS.color.chart.info, TOKENS.color.category.accentPink, TOKENS.color.chart.neutral];
const reasonColor = (index: number) => reasonColors[index % reasonColors.length];
const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Não informada";

function Report({ title, value }: { title: string; value: string }) {
  return <section className="cancellation-report"><h4>{title}</h4><p>{value || "Não informado na base disponível."}</p></section>;
}

function CaseDetail({ item }: { item: CancellationDetail }) {
  return <details className="cancellation-case">
    <summary><span><strong>{item.customer}</strong><small>{item.id} · {item.date} · {item.location}</small></span><span>Ver relato e OS</span></summary>
    <div className="cancellation-case-body">
      <p className="cancellation-detail-note">Plano: {item.plan}</p>
      <Report title="Relato na abertura do atendimento" value={item.openingReport} />
      <Report title="Desfecho registrado no fechamento" value={item.closingReport} />
      <h4>Últimas OS disponíveis ({item.orders.length} de {item.availableOrders})</h4>
      <p className="cancellation-detail-note">Histórico local até o atendimento, além das OS diretamente vinculadas ao cancelamento. Pode não incluir todo o histórico da Hubsoft.</p>
      {!item.orders.length && <p>Nenhuma OS disponível com vínculo seguro a este cliente. Isso não significa que ele nunca teve uma OS.</p>}
      {item.orders.map(order => <article className="cancellation-order" key={order.id}>
        <header><strong>OS {order.number} · {order.type}</strong><span>{order.status}{order.linkedToCancellation ? " · Vinculada ao cancelamento" : ""}</span></header>
        <dl><div><dt>Cadastro</dt><dd>{formatDate(order.openedAt)}</dd></div><div><dt>Início executado</dt><dd>{formatDate(order.startedAt)}</dd></div><div><dt>Conclusão</dt><dd>{formatDate(order.finishedAt)}</dd></div></dl>
        <Report title="Abertura da OS" value={order.openingReport} />
        <Report title="Relato do serviço" value={order.serviceReport} />
        <Report title="Fechamento da OS" value={order.closingReport} />
      </article>)}
    </div>
  </details>;
}

function DetailModal({ vm, onClose }: { vm: CancellationsViewModel; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button, summary, [tabindex="0"]') ?? [])].filter(element => element.getClientRects().length && !element.hasAttribute("disabled"));
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  const selectedReason = vm.reasons.find(reason => reason.id === selected);
  const cases = (vm.details ?? []).filter(item => !selected || item.reasonId === selected);
  return <Modal ref={dialog} open onClose={onClose} title="Detalhamento dos cancelamentos" subtitle={vm.referenceMonth}
    ariaLabel="Detalhamento dos cancelamentos" showClose={false} width={1100} maxHeight="90dvh"
    style={{ maxWidth: "calc(100vw - 24px)" }} bodyStyle={{ overflowY: "auto", flex: 1, color: TOKENS.color.content.primary }}
    footer={<button type="button" className="cancellation-detail-close" onClick={onClose}>Fechar detalhes</button>}>
    <div className="cancellation-detail-summary">
      <MultiDonutChart size={240} strokeWidth={10} segments={vm.reasons.map((reason, index) => ({ percentage: reason.share, color: reasonColor(index) }))}
        trackColor={TOKENS.color.stroke.subtle} onSegmentSelect={index => setSelected(vm.reasons[index].id)}
        tooltip={{ heading: "Motivos de cancelamento", valueLabels: vm.reasons.map(reason => reason.label), counts: vm.reasons.map(reason => reason.count) }}>
        <Stack align="center"><Text size="value" weight={800}>{vm.summary.total}</Text><Text size="xs" tone="muted">cancelamentos</Text></Stack>
      </MultiDonutChart>
      <div className="cancellation-reason-filters" aria-label="Selecionar motivo de cancelamento">
        <button type="button" aria-pressed={!selected} onClick={() => setSelected(null)}>Todos os motivos · {vm.summary.total}</button>
        {vm.reasons.map((reason, index) => <button type="button" key={reason.id} aria-pressed={selected === reason.id} onClick={() => setSelected(reason.id)}>
          <span className="reason-dot" style={{ background: reasonColor(index) }} /><span>{reason.label}</span><strong>{reason.count} · {pct(reason.share)}</strong>
        </button>)}
      </div>
    </div>
    <section aria-label="Atendimentos do motivo selecionado" aria-live="polite">
      <h3>{selectedReason?.label ?? "Todos os motivos"}</h3>
      {vm.details === undefined ? <p>Os detalhes ainda não estão disponíveis nesta base. É necessário atualizar os indicadores a partir dos dados já armazenados.</p> : <>
        <p className="cancellation-detail-note">{cases.length} atendimento(s). Selecione um cliente para ler os relatos registrados.</p>
        {cases.map(item => <CaseDetail item={item} key={item.id} />)}
        {!cases.length && <p>Nenhum cancelamento neste motivo e período.</p>}
      </>}
    </section>
  </Modal>;
}

export function CancellationReasons({ vm }: { vm: CancellationsViewModel }) {
  const [open, setOpen] = useState(false);
  // Closing is stable so changing filters does not reset modal focus.
  const close = useRef(() => setOpen(false)).current;
  useEffect(() => setOpen(false), [vm.referenceMonth]);
  return <>
    <button type="button" className="cancellation-reasons-opener" style={{ color: TOKENS.color.content.primary }} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Ampliar motivos de cancelamento">
      <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}`, height: "100%" }}>
        <Stack gap={TOKENS.spacing[20]}>
          <Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>Motivos de cancelamento</Text><Text size="sm" tone="muted">Participação de cada causa no total do mês.</Text></Stack>
          <div className="cancellation-reasons-content">
            <MultiDonutChart size={190} strokeWidth={10} trackColor={TOKENS.color.stroke.subtle} segments={vm.reasons.map((reason, index) => ({ percentage: reason.share, color: reasonColor(index) }))}>
              <Stack align="center"><Text size="value" weight={800}>{vm.summary.total}</Text><Text size="xs" tone="muted">cancelamentos</Text></Stack>
            </MultiDonutChart>
            <Stack gap={TOKENS.spacing[10]} style={{ flex: 1 }}>
              {vm.reasons.map((reason, index) => <Row key={reason.id} align="center" gap={TOKENS.spacing[10]}>
                <span className="reason-dot" style={{ background: reasonColor(index) }} />
                <Stack gap={TOKENS.spacing[2]} style={{ flex: 1 }}>
                  <Row align="center" gap={TOKENS.spacing[6]}>
                    <Text size="sm" weight={700}>{reason.label}</Text>
                    {reason.avoidable && <Badge size="xs" variant="warning">tratável</Badge>}
                  </Row>
                  <Text size="xs" tone="muted">{pct(reason.share)} do total</Text>
                </Stack>
                <Text size="sm" weight={800}>{reason.count}</Text>
              </Row>)}
            </Stack>
          </div>
          <Text size="xs" tone="brand" weight={700}>Ampliar e explorar relatos e OS →</Text>
        </Stack>
      </Surface>
    </button>
    {open && <DetailModal vm={vm} onClose={close} />}
  </>;
}
