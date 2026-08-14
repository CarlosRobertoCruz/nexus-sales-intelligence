/**
 * Token core — paleta semantica ativa.
 *
 * O NDS tem duas paletas organizadas em `./palettes/` (`color.dark.ts` — ativa —
 * e `color.light.ts` — preservada, não usada hoje). Trocar de tema é só trocar
 * o import abaixo; nenhum componente muda, porque todos leem `TOKENS.color.*`
 * por essa mesma exportação.
 *
 * Categorias: `brand` (purple system), `surface` (fundos), `content` (textos),
 * `stroke` (bordas), `interactive` (hover/selected/focus, com sub-paleta `dark` para
 * superficies inversas como o rail), `feedback` (success/attention/warning/danger/info).
 */

export { color } from "./palettes/color.dark";
