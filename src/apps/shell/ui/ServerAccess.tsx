import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { salesApi } from "@/core/services/salesApi";
import "./serverAccess.css";
type User = { name: string; email: string };
export function ServerAccess({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void salesApi<{ user: User }>("/session")
      .then((d) => {
        if (active) setUser(d.user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    const expired = () => setUser(null);
    window.addEventListener("sales-session-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("sales-session-expired", expired);
    };
  }, []);
  async function login(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await salesApi<{ user: User }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(d.user);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <main className="sales-access">Carregando…</main>;
  if (!user)
    return (
      <main className="sales-access">
        <form onSubmit={login} className="sales-login">
          <h1>Nexus Sales Intelligence</h1>
          <p>Entre para consultar a base comercial da equipe.</p>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        </form>
      </main>
    );
  return (
    <>
      <div className="sales-account">
        <span>{user.name}</span>
        <button
          onClick={() => {
            void salesApi("/logout", { method: "POST", body: "{}" })
              .then(() => setUser(null))
              .catch((e) => setError(e.message));
          }}
        >
          Sair
        </button>
        {error && <span role="alert">{error}</span>}
      </div>
      {children}
    </>
  );
}
