import { useEffect, useRef, useState } from "react";
import { BrazilMap } from "./BrazilMap";
import { SalesBrand } from "./SalesBrand";

type Props = {
  ready: boolean;
  error: string;
  onComplete: () => void;
  onRetry: () => void;
  onExit: () => void;
};

export function SalesArrival({
  ready,
  error,
  onComplete,
  onRetry,
  onExit,
}: Props) {
  const [motionDone, setMotionDone] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [stage, setStage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        setMotionDone(true);
        setStage((current) => Math.max(current, 2));
      }
    };
    reduce();
    media.addEventListener("change", reduce);
    const stages = [
      window.setTimeout(
        () => setStage((current) => Math.max(current, 1)),
        1200,
      ),
      window.setTimeout(
        () => setStage((current) => Math.max(current, 2)),
        2600,
      ),
      window.setTimeout(() => setMotionDone(true), 3800),
    ];
    return () => {
      media.removeEventListener("change", reduce);
      stages.forEach(window.clearTimeout);
    };
  }, []);
  useEffect(() => {
    if (!ready || error || !motionDone) return;
    setLeaving(true);
    const timer = window.setTimeout(onComplete, reducedMotion ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [ready, error, motionDone, reducedMotion, onComplete]);
  const skip = () => {
    setStage((current) => Math.max(current, 2));
    setMotionDone(true);
  };
  return (
    <section
      className={`sales-arrival${leaving ? " is-leaving" : ""}${motionDone ? " is-arrived" : ""}${reducedMotion ? " is-reduced" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-arrival-heading"
    >
      <header className="sales-arrival-top">
        <SalesBrand />
        <span className="sales-arrival-top-note">
          <i /> NOSSA ORIGEM. NOSSO PRÓXIMO PASSO.
        </span>
      </header>
      <div className="sales-arrival-heading">
        <span className="sales-auth-eyebrow">
          CONECTANDO INTELIGÊNCIA AO TERRITÓRIO
        </span>
        <h2 id="sales-arrival-heading" tabIndex={-1} ref={heading}>
          O próximo capítulo
          <br />
          começa <em>aqui.</em>
        </h2>
      </div>
      <div className="sales-arrival-cartography">
        <div className="sales-arrival-grid" />
        <div className="sales-arrival-orbit sales-arrival-orbit-one" />
        <div className="sales-arrival-orbit sales-arrival-orbit-two" />
        <BrazilMap animated />
        <div className="sales-arrival-crosshair" />
        <div className="sales-arrival-destination">
          <span className="sales-arrival-destination-dot" />
          <div>
            <small>ONDE TUDO COMEÇOU</small>
            <strong>
              Mangaratiba<span>, RJ</span>
            </strong>
            <p>Nosso território. Nossa conexão.</p>
          </div>
        </div>
        <span className="sales-arrival-map-caption">
          BRASIL → RIO DE JANEIRO → MANGARATIBA
        </span>
      </div>
      <footer className="sales-arrival-bottom">
        <div
          className="sales-arrival-progress"
          role="status"
          aria-live="polite"
        >
          <div className="sales-arrival-steps" aria-hidden="true">
            {["Brasil", "Rio de Janeiro", "Mangaratiba"].map((label, index) => (
              <span key={label} className={stage >= index ? "is-active" : ""}>
                <i />
                {label}
              </span>
            ))}
          </div>
          <p>
            {error
              ? "Não foi possível preparar seu painel."
              : ready
                ? "Seu painel está pronto."
                : "Preparando sua visão comercial…"}
          </p>
          <div
            className={`sales-arrival-progress-track${ready ? " is-ready" : ""}`}
            aria-hidden="true"
          >
            <span />
          </div>
        </div>
        <div className="sales-arrival-actions">
          {error ? (
            <>
              <p className="sales-auth-error" role="alert">
                {error}
              </p>
              <button onClick={onRetry} className="sales-auth-submit">
                Tentar novamente
              </button>
              <button onClick={onExit}>Voltar ao login</button>
            </>
          ) : (
            <button onClick={skip} disabled={motionDone}>
              {motionDone ? "Conectando ao painel…" : "Pular animação"}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
