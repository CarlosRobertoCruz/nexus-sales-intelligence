const MIN_PASSWORD_LENGTH = 8;

export type PasswordPairError = "tempPassword" | "passwordMismatch";

/**
 * Validação estrutural de "senha" + "confirmar" em formulários de cadastro (create/edit).
 * Create: obrigatório, mínimo 8 caracteres, iguais.
 * Edit: só valida se pelo menos um campo tiver texto; ambos vazios = ok.
 */
export function validatePasswordPair(input: {
  mode: "create" | "edit";
  tempPassword: string;
  confirmPassword: string;
}): PasswordPairError | null {
  if (input.mode === "create") {
    if (input.tempPassword.length < MIN_PASSWORD_LENGTH) return "tempPassword";
    if (input.tempPassword !== input.confirmPassword) return "passwordMismatch";
    return null;
  }
  if (input.tempPassword.length > 0 || input.confirmPassword.length > 0) {
    if (input.tempPassword.length < MIN_PASSWORD_LENGTH) return "tempPassword";
    if (input.tempPassword !== input.confirmPassword) return "passwordMismatch";
  }
  return null;
}
