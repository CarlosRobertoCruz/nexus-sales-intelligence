// Foundation — overlay de carregamento que escurece e trava a tela inteira
// (`position: fixed`, cobre viewport independente de onde é montado no DOM —
// inclusive sidebar/header por cima). Cresce enquanto `active`, completa e
// desaparece assim que os dados chegam de verdade — não é um timer cego.
// Domain-blind: logo, título, subtítulo e rodapé vêm todos de fora via slot —
// ver core/ui/loading/ pro preenchimento real. Tudo (logo, texto, barra,
// rodapé) segue no mesmo fluxo vertical — nunca desalinha entre si; só o
// início desse fluxo pode ser deslocado via logoAnchorTop/logoHeight, pra
// bater com um anel desenhado na imagem de fundo (opcional).
// Os 3 pontinhos embaixo da barra são só decoração ambiente (pulso em loop),
// não representam etapas reais — evita alegar progresso que não existe.

import type { ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import { useTopLoadingProgress } from "@/garden/hooks/loading/useTopLoadingProgress";

interface LoadingOverlayProps {
  active: boolean;
  logo?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  barWidth?: number;
  /** URL de imagem decorativa de fundo (opcional) — Garden só aceita a URL, não sabe o que é. */
  backgroundImageUrl?: string;
  /**
   * Ponto de ancoragem vertical da logo, em % da tela (ex.: pra combinar com
   * um anel desenhado no fundo). Precisa de `logoHeight` junto pro cálculo
   * fechar. Sem os dois, o bloco inteiro só fica centralizado normal.
   */
  logoAnchorTop?: number;
  logoHeight?: number;
}

const KEYFRAMES = `
@keyframes nds-loading-pulse {
  0%, 100% { opacity: 0.5; transform: scale(0.94); }
  50% { opacity: 1; transform: scale(1.06); }
}
@keyframes nds-loading-dot {
  0%, 100% { opacity: 0.3; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}
@keyframes nds-loading-shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@media (prefers-reduced-motion: reduce) {
  .nds-loading-glow, .nds-loading-dot { animation: none !important; }
}
`;

export default function LoadingOverlay({
  active,
  logo,
  title,
  subtitle,
  footer,
  barWidth = 420,
  backgroundImageUrl,
  logoAnchorTop,
  logoHeight,
}: LoadingOverlayProps) {
  const { visible, progress } = useTopLoadingProgress(active);

  if (!visible) return null;

  // Quando os dois vêm preenchidos, empurra o início do bloco (padding-top)
  // até o ponto exato onde o CENTRO da logo (primeiro item) cai em cima do
  // ponto pedido — o resto (texto/barra/rodapé) só segue no fluxo normal
  // logo abaixo, sem nenhum cálculo próprio, sem risco de desalinhar.
  // IMPORTANTE: usa `vh`, não `%` — padding-top em % sempre calcula em cima
  // da LARGURA do elemento (regra do CSS), nunca da altura; `vh` é sempre
  // relativo à altura real da tela, que é o que queremos aqui.
  const anchorPaddingTop =
    logoAnchorTop !== undefined && logoHeight !== undefined
      ? `calc(${logoAnchorTop}vh - ${logoHeight / 2}px)`
      : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: TOKENS.zIndex[9999],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: anchorPaddingTop ? "flex-start" : "center",
        paddingTop: anchorPaddingTop,
        boxSizing: "border-box",
        gap: TOKENS.spacing[24],
        background: backgroundImageUrl
          ? `${TOKENS.color.surface.base} url(${backgroundImageUrl}) center / cover no-repeat`
          : TOKENS.color.surface.base,
        overflow: "hidden",
        pointerEvents: progress >= 100 ? "none" : "auto",
        opacity: progress >= 100 ? 0 : 1,
        transition: `opacity ${progress >= 100 ? 260 : 0}ms ease-out`,
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Glow radial ambiente atrás do logo — só quando não há imagem de fundo própria (evita dobrar o brilho) */}
      {!backgroundImageUrl && (
        <div
          aria-hidden
          className="nds-loading-glow"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 640,
            height: 640,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${TOKENS.color.brand.soft} 0%, ${TOKENS.color.brand.surface} 45%, transparent 72%)`,
            filter: "blur(40px)",
            animation: "nds-loading-pulse 3.6s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Bloco único centralizado — logo, texto, barra e rodapé sempre juntos,
          nunca desalinham entre si em nenhum tamanho de tela. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: TOKENS.spacing[24],
        }}
      >
        {logo}

        {(title || subtitle) && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: TOKENS.spacing[8],
              textAlign: "center",
              // Espaço extra só entre a logo e o texto — não afeta os gaps
              // seguintes (texto->barra, barra->rodapé continuam normais).
              marginTop: TOKENS.spacing[96],
            }}
          >
            {title}
            {subtitle}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: TOKENS.spacing[16] }}>
          <div
            style={{
              position: "relative",
              width: barWidth,
              maxWidth: "min(80vw, 480px)",
              height: 22,
              borderRadius: TOKENS.radius.full,
              background: TOKENS.color.surface.subtle,
              border: `1px solid ${TOKENS.color.brand.borderMuted}`,
              overflow: "hidden",
              boxShadow: `0 0 22px 3px ${TOKENS.color.brand.soft}`,
            }}
          >
            <div
              style={{
                position: "relative",
                height: "100%",
                width: `${progress}%`,
                minWidth: progress > 0 ? 22 : 0,
                borderRadius: TOKENS.radius.full,
                background: `linear-gradient(90deg, ${TOKENS.color.brand.deep}, ${TOKENS.color.brand.primary})`,
                boxShadow: `0 0 20px 4px ${TOKENS.color.brand.primary}`,
                overflow: "hidden",
                transition: `width ${progress >= 100 ? 200 : 90}ms linear`,
              }}
            >
              {/* Brilho horizontal — faixa mais clara no meio da altura, efeito "gloss" */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 45%, transparent 100%)",
                }}
              />
              {/* Ponta acesa — funde com o preenchimento em vez de flutuar separada */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 0,
                  width: 38,
                  height: 38,
                  transform: "translate(50%, -50%)",
                  borderRadius: TOKENS.radius.full,
                  background: TOKENS.color.content.inverse,
                  filter: "blur(8px)",
                  opacity: 0.9,
                }}
              />
            </div>
          </div>

          {/* Pontinhos decorativos — pulso ambiente, não são etapas reais */}
          <div style={{ display: "flex", gap: TOKENS.spacing[8] }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className="nds-loading-dot"
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: TOKENS.radius.full,
                  background: TOKENS.color.brand.primary,
                  boxShadow: `0 0 8px 1px ${TOKENS.color.brand.primary}`,
                  animation: `nds-loading-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Rodapé fixo no fundo da tela — independente de quanto o resto ocupa. */}
      {footer && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: TOKENS.spacing[40],
            transform: "translateX(-50%)",
            zIndex: 1,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
