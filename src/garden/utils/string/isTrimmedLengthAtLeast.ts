/** Comprimento mínimo após `trim` (ex.: nome com pelo menos 2 caracteres). */
export function isTrimmedLengthAtLeast(value: string, min: number): boolean {
  return value.trim().length >= min;
}
