/** Camada core/utils/date — wrapper de Date.now() para isolar leitura de "agora" do dominio. */
export function getCurrentTimestamp(): number {
  return Date.now();
}
