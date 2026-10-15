import { useEffect, useRef, useState } from "react";
import { salesApi } from "@/core/services/salesApi";
export function HubsoftSyncControl({
  onUpdated,
  disabled,
}: {
  onUpdated: () => Promise<void>;
  disabled: boolean;
}) {
  const today = new Date();
  const initial = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [day, setDay] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [configured, setConfigured] = useState(false);
  const [restart, setRestart] = useState(false);
  const guard = useRef(false);
  useEffect(() => {
    void salesApi<{
      configured: boolean;
      runs: { status: string; pages: number; day: string }[];
    }>("/hubsoft/status")
      .then((s) => {
        setConfigured(s.configured);
        const last = s.runs[0];
        if (last)
          setMessage(
            `Última consulta: ${last.day.slice(0, 10)} · ${last.status} · ${last.pages} páginas.`,
          );
      })
      .catch((e) => setMessage(e.message));
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
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  return (
    <section className="sales-sync" aria-label="Importação Hubsoft">
      <strong>Hubsoft · consulta por dia</strong>
      <label>
        Dia da consulta
        <input
          type="date"
          value={day}
          max={initial}
          onChange={(e) => setDay(e.target.value)}
          disabled={busy}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={restart}
          onChange={(e) => setRestart(e.target.checked)}
          disabled={busy}
          style={{ width: 20 }}
        />
        Consultar novamente desde o início
      </label>
      <p>
        Até 4 páginas por execução, 50 registros por página. Sem sincronização
        automática.
      </p>
      <button
        type="button"
        onClick={() => void sync()}
        disabled={!configured || !day || busy || disabled}
      >
        {busy ? "Consultando…" : "Consultar / continuar"}
      </button>
      {!configured && (
        <p>Configure a integração no servidor para habilitar as consultas.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
