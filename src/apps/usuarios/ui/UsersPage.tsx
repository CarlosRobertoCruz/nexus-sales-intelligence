import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { salesApi } from "@/core/services/salesApi";
import { SalesAccountContext } from "@/apps/shell/ui/auth/salesAccount";
import {
  UserIcon,
  UserKeyIcon,
  CloseIcon,
  EyeOpenIcon,
  EyeSlashIcon,
} from "@/garden/foundations/assets/icons/icons";
import "./users.css";

type User = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
};
type UserList = {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
};
const EMPTY_FORM = { name: "", email: "", password: "", confirmPassword: "" };
function createdDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR").format(date);
}
export function UsersPage() {
  const account = useContext(SalesAccountContext);
  const [list, setList] = useState<UserList>({
    users: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM),
    [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false),
    [success, setSuccess] = useState("");
  const pending = useRef(false),
    mounted = useRef(true);
  const dialog = useRef<HTMLDialogElement>(null),
    nameInput = useRef<HTMLInputElement>(null),
    confirmInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void salesApi<UserList>(`/users?page=${page}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setList(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os usuários.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, revision]);
  useEffect(() => {
    const node = dialog.current;
    if (!open) {
      node?.close();
      return;
    }
    node?.showModal();
    nameInput.current?.focus();
    return () => {
      node?.close();
    };
  }, [open]);
  function openForm() {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowPassword(false);
    setSuccess("");
    setOpen(true);
  }
  function closeForm() {
    if (pending.current) return;
    setOpen(false);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowPassword(false);
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (form.password !== form.confirmPassword) {
      setFormError("As senhas não coincidem.");
      confirmInput.current?.focus();
      return;
    }
    pending.current = true;
    setSaving(true);
    setFormError("");
    try {
      const result = await salesApi<{ user: User }>("/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });
      if (!mounted.current) return;
      setOpen(false);
      setForm(EMPTY_FORM);
      setShowPassword(false);
      setSuccess(`Acesso de ${result.user.name} criado com sucesso.`);
      setPage(1);
      setRevision((value) => value + 1);
    } catch (error) {
      if (mounted.current)
        setFormError(
          error instanceof Error
            ? error.message
            : "Não foi possível criar o usuário.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  return (
    <main className="app-main sales-users-page">
      <header className="page-header">
        <div>
          <span className="sales-users-eyebrow">ACESSO AO SALES</span>
          <h1>Usuários</h1>
          <p>
            Uma conta para cada pessoa. Uma visão compartilhada para a equipe.
          </p>
        </div>
        <button
          type="button"
          className="sales-users-primary"
          onClick={openForm}
        >
          <UserKeyIcon aria-hidden="true" />
          Novo usuário
        </button>
      </header>
      <div className="sales-users-policy">
        <span aria-hidden="true">
          <UserKeyIcon />
        </span>
        <p>
          Todos os usuários têm as mesmas permissões de acesso ao Nexus Sales.
        </p>
      </div>
      {success && (
        <p className="sales-users-success" role="status">
          {success}
        </p>
      )}
      <section
        className="sales-users-panel"
        aria-label="Contas cadastradas"
        aria-busy={loading}
      >
        <div className="sales-users-panel-header">
          <div>
            <h2>Acessos da equipe</h2>
            <p>
              {loading
                ? "Carregando usuários…"
                : `${list.total} ${list.total === 1 ? "conta cadastrada" : "contas cadastradas"}`}
            </p>
          </div>
          <span className="sales-users-panel-icon" aria-hidden="true">
            <UserKeyIcon />
          </span>
        </div>
        {loadError ? (
          <div className="sales-users-load-error">
            <p role="alert">{loadError}</p>
            <button
              type="button"
              className="sales-users-secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <p className="sales-users-loading" role="status">
            Preparando os acessos da equipe…
          </p>
        ) : list.users.length ? (
          <ul className="sales-users-list">
            {list.users.map((user) => (
              <li key={user.id}>
                <span className="sales-users-avatar" aria-hidden="true">
                  <UserIcon />
                </span>
                <div className="sales-users-person">
                  <div>
                    <strong>{user.name}</strong>
                    {user.email === account?.email && (
                      <span className="sales-users-you">Você</span>
                    )}
                  </div>
                  <span>{user.email}</span>
                </div>
                <div className="sales-users-state">
                  <span
                    className={
                      user.active
                        ? "sales-users-active"
                        : "sales-users-inactive"
                    }
                  >
                    {user.active ? "Ativo" : "Inativo"}
                  </span>
                  <small>Criado em {createdDate(user.created_at)}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sales-users-loading">
            Nenhuma conta encontrada nesta página.
          </p>
        )}
        {!loadError && !loading && totalPages > 1 && (
          <nav
            className="sales-users-pagination"
            aria-label="Paginação de usuários"
          >
            <button
              className="sales-users-secondary"
              onClick={() => setPage((value) => value - 1)}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              className="sales-users-secondary"
              onClick={() => setPage((value) => value + 1)}
              disabled={page >= totalPages}
            >
              Próxima
            </button>
          </nav>
        )}
      </section>
      <dialog
        className="sales-user-dialog"
        ref={dialog}
        aria-labelledby="sales-new-user-title"
        aria-describedby="sales-new-user-description"
        onCancel={(event) => {
          event.preventDefault();
          closeForm();
        }}
      >
        <header className="sales-user-dialog-header">
          <div>
            <h2 id="sales-new-user-title">Novo usuário</h2>
            <p>Crie um acesso individual para a equipe.</p>
          </div>
          <button
            type="button"
            className="sales-user-dialog-close"
            aria-label="Fechar cadastro"
            onClick={closeForm}
            disabled={saving}
          >
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={(event) => void create(event)} aria-busy={saving}>
          <div className="sales-user-dialog-body">
            <p
              id="sales-new-user-description"
              className="sales-users-form-note"
            >
              A nova conta terá as mesmas permissões dos demais usuários.
            </p>
            <label className="sales-users-field">
              Nome
              <input
                ref={nameInput}
                autoComplete="name"
                required
                maxLength={100}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={saving}
                placeholder="Nome da pessoa"
              />
            </label>
            <label className="sales-users-field">
              E-mail
              <input
                type="email"
                autoComplete="off"
                required
                maxLength={254}
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                disabled={saving}
                placeholder="pessoa@nexusfibra.net.br"
              />
            </label>
            <div className="sales-users-password-grid">
              <div className="sales-users-field">
                <label htmlFor="sales-new-password">Senha inicial</label>
                <div className="sales-users-password">
                  <input
                    id="sales-new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={256}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    disabled={saving}
                    aria-describedby="sales-new-password-help"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Ocultar senha inicial"
                        : "Mostrar senha inicial"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={saving}
                  >
                    {showPassword ? <EyeSlashIcon /> : <EyeOpenIcon />}
                  </button>
                </div>
              </div>
              <label className="sales-users-field">
                Confirmar senha
                <input
                  ref={confirmInput}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </label>
            </div>
            <p id="sales-new-password-help" className="sales-users-form-note">
              Use uma senha de 12 a 256 caracteres e compartilhe-a diretamente
              com a pessoa.
            </p>
            {formError && (
              <p className="sales-users-form-error" role="alert">
                {formError}
              </p>
            )}
          </div>
          <footer className="sales-user-dialog-footer">
            <button
              type="button"
              className="sales-users-secondary"
              onClick={closeForm}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="sales-users-primary"
              disabled={saving}
            >
              {saving ? "Criando acesso…" : "Criar usuário"}
            </button>
          </footer>
        </form>
      </dialog>
    </main>
  );
}
