// Progresso estimado (não cronometrado às cegas) para barra de carregamento no topo da tela.
// Cresce numa curva desacelerada enquanto `active`; ao virar `false`, completa e some.
// Reage ao evento real de "dado chegou" — não é uma barra decorativa de tempo fixo.

import { useEffect, useState } from "react";

type Phase = "idle" | "loading" | "completing";

const TICK_MS = 80;
const ASYMPTOTE_PERCENT = 92;
const DECAY_MS = 3000;
const COMPLETE_FADE_MS = 260;

interface TopLoadingProgress {
  /** false quando não há nada pra mostrar (nem carregando, nem completando). */
  visible: boolean;
  /** 0-100. */
  progress: number;
}

export function useTopLoadingProgress(active: boolean): TopLoadingProgress {
  const [phase, setPhase] = useState<Phase>(active ? "loading" : "idle");
  const [progress, setProgress] = useState(0);

  // Transição de fase ao trocar `active` — ajuste de estado durante o render,
  // sem passar por efeito (evita cascata só pra reagir a uma prop mudando).
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) {
      setPhase("loading");
      setProgress(0);
    } else if (phase === "loading") {
      setPhase("completing");
      setProgress(100);
    }
  }

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsedMs = Date.now() - start;
      setProgress(ASYMPTOTE_PERCENT * (1 - Math.exp(-elapsedMs / DECAY_MS)));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (phase !== "completing") return;

    const timeout = setTimeout(() => setPhase("idle"), COMPLETE_FADE_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

  return { visible: phase !== "idle", progress };
}
