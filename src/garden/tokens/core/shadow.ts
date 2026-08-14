/**
 * Token core — box-shadow ativo.
 *
 * Mesmo padrão de `color.ts`: duas paletas organizadas em `./palettes/`
 * (`shadow.dark.ts` — ativa — e `shadow.light.ts` — preservada). Trocar de
 * tema é só trocar o import abaixo.
 *
 * Niveis 1-4 sao a escala neutra. `lg` e' alias do nivel 3 com radius maior;
 * `brand`/`glow` adicionam tinta roxa para destacar elementos do sistema;
 * `overlay` para modais/floating e `focus` para outline acessivel.
 */

export { shadow } from "./palettes/shadow.dark";
