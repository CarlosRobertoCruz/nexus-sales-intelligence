export const serverMode = import.meta.env.VITE_DATA_MODE === "server";
export async function salesApi<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("sales-session-expired"));
    const messages: Record<string, string> = {
      USUARIO_DADOS_INVALIDOS: "Confira os dados do novo usuário.",
      USUARIO_NOME_INVALIDO: "Informe um nome com até 100 caracteres.",
      USUARIO_EMAIL_INVALIDO: "Informe um e-mail válido.",
      USUARIO_SENHA_INVALIDA: "A senha deve ter entre 12 e 256 caracteres.",
      USUARIO_EMAIL_EXISTENTE: "Já existe um usuário com esse e-mail.",
      USUARIOS_PAGINA_INVALIDA: "A página de usuários é inválida.",
      EMAIL_OU_SENHA_INVALIDOS: "E-mail ou senha inválidos.",
      SESSAO_NECESSARIA: "Entre novamente para continuar.",
      HUBSOFT_NAO_CONFIGURADA:
        "A integração Hubsoft ainda não foi configurada no servidor.",
      HUBSOFT_ATENDIMENTO_CAMPOS_INSUFICIENTES:
        "A Hubsoft não retornou todos os campos de atendimento. Confira as relações e o mapeamento do usuário de abertura no servidor.",
      HUBSOFT_OS_CAMPOS_INSUFICIENTES:
        "A Hubsoft não retornou todos os campos necessários da OS. Confira o mapeamento antes de continuar.",
      HUBSOFT_LIMITE_AGUARDE:
        "A Hubsoft atingiu o limite de consultas. Aguarde antes de retomar.",
      SINCRONIZACAO_EM_ANDAMENTO:
        "Já existe uma importação em andamento. Aguarde.",
    };
    throw new Error(
      messages[data.error] ??
        `Não foi possível concluir a operação (${data.error ?? response.status}).`,
    );
  }
  return data as T;
}
