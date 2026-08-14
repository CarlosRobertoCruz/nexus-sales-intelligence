/**
 * Foundation — `<div>` com `flex: size` para empurrar irmaos para extremos opostos
 * dentro de um Stack/Row. `size` controla a proporcao quando ha multiplos spacers.
 */

export default function Spacer({ size = 1 }: { size?: number }) {
  return (
    <div
      style={{
        flex: size,
      }}
    />
  );
}