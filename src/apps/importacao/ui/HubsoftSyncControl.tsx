import { useEffect, useRef, useState } from "react";
import { salesApi } from "@/core/services/salesApi";
import { Button, Icon, Row } from "@/garden/foundations";
import { RefreshIcon } from "@/garden/foundations/assets/icons/icons";
import "./hubsoftSyncControl.css";

type LastRun = { status: string; pages: number; day: string };
const RUN_LABELS: Record<string, string> = {
  complete: "Concluída",
  paused: "Pausada",
  running: "Em andamento",
  error: "Erro na consulta",
};
function displayDay(value: string): string {
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Data indisponível";
}
export function HubsoftSyncControl({
  onUpdated,
  disabled,
}: {
  onUpdated: () => Promise<void>;
  disabled: boolean;
}) {
  const today = new Date();
  const initial = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [day, setDay] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [failed, setFailed] = useState(false);
  const [restart, setRestart] = useState(false);
  const guard = useRef(false);
  useEffect(() => {
    let active = true;
    void salesApi<{ configured: boolean; runs: LastRun[] }>("/hubsoft/status")
      .then((result) => {
        if (!active) return;
        setConfigured(result.configured);
        setLastRun(result.runs[0] ?? null);
      })
      .catch((error) => {
        if (!active) return;
        setConfigured(false);
        setFailed(true);
        setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function sync() {
    if (guard.current) return;
    if (
      restart &&
      !window.confirm(
        "Consultar novamente este dia desde a primeira página? Os registros existentes serão atualizados, sem duplicação.",
      )
    )
      return;
    guard.current = true;
    setBusy(true);
    setFailed(false);
    setMessage("Consultando páginas da Hubsoft…");
    try {
      const result = await salesApi<{
        complete: boolean;
        pages: number;
        records: number;
        published: boolean;
      }>("/hubsoft/sync", {
        method: "POST",
        body: JSON.stringify({ day, restart }),
      });
      setRestart(false);
      if (result.published) await onUpdated();
      setMessage(
        `${result.records} registros consultados em ${result.pages} páginas. ${result.complete ? (result.published ? "Dia concluído e painel atualizado." : "Dia concluído. Ainda faltam atendimentos ou OS na base para calcular os indicadores.") : "Consulta pausada no limite seguro. Clique em consultar para retomar do checkpoint."}`,
      );
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Falha na consulta.");
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  return (
    <section
      className="sales-sync"
      aria-label="Importação Hubsoft"
      aria-busy={busy}
    >
      <div className="sales-sync-heading">
        <strong>Consulta Hubsoft</strong>
        <span>Manual</span>
      </div>
      <label className="sales-sync-date">
        <span>Dia da consulta</span>
        <input
          type="date"
          value={day}
          max={initial}
          onChange={(event) => setDay(event.target.value)}
          disabled={busy}
        />
      </label>
      <label className="sales-sync-restart">
        <input
          type="checkbox"
          checked={restart}
          onChange={(event) => setRestart(event.target.checked)}
          disabled={busy}
        />
        <span>Consultar novamente do início</span>
      </label>
      <p className="sales-sync-limits">
        Até 4 páginas por execução, com 50 registros por página. Consulta de um
        dia por vez.
      </p>
      <Button
        variant="soft"
        size="sm"
        fullWidth
        onPress={() => void sync()}
        disabled={configured !== true || !day || busy || disabled}
        style={{ minHeight: 40 }}
      >
        <Row align="center" justify="center" gap="8px">
          <Icon size="xs">
            <RefreshIcon />
          </Icon>
          {busy ? "Consultando…" : "Consultar / continuar"}
        </Row>
      </Button>
      {configured === null && (
        <p className="sales-sync-note" role="status">
          Verificando integração…
        </p>
      )}
      {configured === false && !failed && (
        <p className="sales-sync-note">
          Configure a integração no servidor para habilitar as consultas.
        </p>
      )}
      {message ? (
        <p
          className={
            failed ? "sales-sync-feedback is-error" : "sales-sync-feedback"
          }
          role="status"
        >
          {message}
        </p>
      ) : (
        lastRun && (
          <div className="sales-sync-last-run">
            <span>
              Última consulta{" "}
              <time dateTime={lastRun.day.slice(0, 10)}>
                {displayDay(lastRun.day)}
              </time>
            </span>
            <span className="sales-sync-run-result">
              <span className={lastRun.status === "error" ? "is-error" : ""}>
                {RUN_LABELS[lastRun.status] ?? "Registrada"}
              </span>
              <span>
                {lastRun.pages} {lastRun.pages === 1 ? "página" : "páginas"}
              </span>
            </span>
          </div>
        )
      )}
    </section>
  );
}
