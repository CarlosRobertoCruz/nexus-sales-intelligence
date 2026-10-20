import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { UserIcon, LogOutIcon } from "@/garden/foundations/assets/icons/icons";
import { SalesAccountContext } from "./auth/salesAccount";
import { salesApi } from "@/core/services/salesApi";
import { LoginScreen } from "./auth/LoginScreen";
import { SalesArrival } from "./auth/SalesArrival";
import { SalesBrand } from "./auth/SalesBrand";
import { SalesDashboardBoundary } from "./auth/SalesDashboardBoundary";
import { SalesStartupContext } from "./auth/salesStartup";
import "./serverAccess.css";
import "./auth/salesAuth.css";

type User = { name: string; email: string };
export function ServerAccess({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const loginPending = useRef(false);
  const startupPending = useRef(false);
  const reloadNeeded = useRef(false);
  const dashboardRegion = useRef<HTMLDivElement>(null);

  const enter = useCallback((nextUser: User) => {
    startupPending.current = true;
    reloadNeeded.current = false;
    setDashboardReady(false);
    setStartupError("");
    setError("");
    setArriving(true);
    setUser(nextUser);
  }, []);
  const reportReady = useCallback((loadError: string | null) => {
    if (!startupPending.current) return;
    setStartupError(loadError ?? "");
    setDashboardReady(!loadError);
  }, []);
  const complete = useCallback(() => {
    startupPending.current = false;
    setArriving(false);
    window.requestAnimationFrame(() => dashboardRegion.current?.focus());
  }, []);
  const reset = useCallback(() => {
    startupPending.current = false;
    setUser(null);
    setArriving(false);
    setPassword("");
    setStartupError("");
    setDashboardReady(false);
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void salesApi<{ user: User }>("/session", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((d) => {
        if (active) enter(d.user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    window.addEventListener("sales-session-expired", reset);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("sales-session-expired", reset);
    };
  }, [enter, reset]);
  useEffect(() => {
    if (!arriving) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [arriving]);
  async function login(event: FormEvent) {
    event.preventDefault();
    if (loginPending.current) return;
    loginPending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await salesApi<{ user: User }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(20000),
      });
      setPassword("");
      enter(result.user);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Não foi possível entrar.",
      );
    } finally {
      loginPending.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await salesApi("/logout", { method: "POST", body: "{}" });
      reset();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Não foi possível sair.",
      );
    }
  }
  if (checking)
    return (
      <main className="sales-session-check" role="status">
        <SalesBrand />
        <span className="sales-auth-spinner" aria-hidden="true" />
        <p>Preparando seu acesso…</p>
      </main>
    );
  if (!user)
    return (
      <LoginScreen
        email={email}
        password={password}
        onEmail={setEmail}
        onPassword={setPassword}
        busy={busy}
        error={error}
        onSubmit={login}
      />
    );
  return (
    <SalesAccountContext.Provider value={user}>
      <SalesStartupContext.Provider value={reportReady}>
        <div
          className="sales-workspace"
          data-arriving={arriving}
          inert={arriving}
          aria-hidden={arriving}
        >
          <header className="sales-account" aria-label="Conta conectada">
            <div className="sales-account-profile">
              <span className="sales-account-avatar" aria-hidden="true">
                <UserIcon />
              </span>
              <span className="sales-account-identity">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
            </div>
            <button
              onClick={() => void logout()}
              className="sales-account-exit"
            >
              <span aria-hidden="true">
                <LogOutIcon />
              </span>
              Sair
            </button>
            {error && (
              <span className="sales-account-error" role="alert">
                {error}
              </span>
            )}
          </header>
          <div
            key={attempt}
            ref={dashboardRegion}
            tabIndex={-1}
            className="sales-dashboard-region"
            aria-label="Painel comercial"
          >
            <SalesDashboardBoundary
              onFailure={() => {
                reloadNeeded.current = true;
                reportReady(
                  "Não foi possível carregar o painel. Tente novamente para atualizar a página.",
                );
              }}
            >
              {children}
            </SalesDashboardBoundary>
          </div>
        </div>
        {arriving && (
          <SalesArrival
            ready={dashboardReady}
            error={startupError || error}
            onComplete={complete}
            onRetry={() => {
              if (reloadNeeded.current) {
                window.location.reload();
                return;
              }
              setStartupError("");
              setError("");
              setDashboardReady(false);
              setAttempt((value) => value + 1);
            }}
            onExit={() => void logout()}
          />
        )}
      </SalesStartupContext.Provider>
    </SalesAccountContext.Provider>
  );
}
