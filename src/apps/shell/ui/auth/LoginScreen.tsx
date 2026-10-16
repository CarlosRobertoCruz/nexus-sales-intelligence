import { useState, type FormEvent } from "react";
import {
  ArrowRightIcon,
  ChartColumnBigIcon,
  EyeOpenIcon,
  EyeSlashIcon,
  LockKeyholeIcon,
  MailEnvelopeIcon,
  MapPinnedIcon,
  UsersIcon,
} from "@/garden/foundations/assets/icons/icons";
import { BrazilMap } from "./BrazilMap";
import { SalesBrand } from "./SalesBrand";

type Props = {
  email: string;
  password: string;
  busy: boolean;
  error: string;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};
const features = [
  {
    Icon: ChartColumnBigIcon,
    title: "O comercial, por inteiro",
    text: "Vendas, renovações e resultados em uma só visão.",
  },
  {
    Icon: MapPinnedIcon,
    title: "Inteligência do seu território",
    text: "Encontre oportunidades onde a Nexus está presente.",
  },
  {
    Icon: UsersIcon,
    title: "Uma direção para toda a equipe",
    text: "Informação compartilhada para decidir com clareza.",
  },
];

export function LoginScreen({
  email,
  password,
  busy,
  error,
  onEmail,
  onPassword,
  onSubmit,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="sales-auth-layout">
      <section
        className="sales-auth-story"
        aria-label="Nexus Sales Intelligence"
      >
        <SalesBrand />
        <div className="sales-auth-art">
          <BrazilMap />
        </div>
        <div className="sales-auth-story-copy">
          <span className="sales-auth-eyebrow">
            INTELIGÊNCIA QUE CONHECE O CAMINHO
          </span>
          <h1>
            Grandes decisões.
            <br />
            Começam <em>perto.</em>
          </h1>
          <p>
            Uma visão clara do seu comercial, conectada ao território onde tudo
            começou.
          </p>
          <ul className="sales-auth-features">
            {features.map(({ Icon, title, text }) => (
              <li key={title}>
                <span className="sales-auth-feature-icon">
                  <Icon />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <footer className="sales-auth-story-footer">
          <span className="sales-auth-origin">
            <span /> Mangaratiba · Rio de Janeiro
          </span>
          <small>© {new Date().getFullYear()} Nexus Fibra</small>
        </footer>
      </section>
      <section
        className="sales-auth-form-panel"
        aria-labelledby="sales-login-title"
      >
        <div className="sales-auth-form-content">
          <span className="sales-auth-eyebrow">NEXUS SALES INTELLIGENCE</span>
          <h2 id="sales-login-title">
            Bem-vindo <span>de volta.</span>
          </h2>
          <p className="sales-auth-form-description">
            Seu próximo movimento começa com uma boa visão.
          </p>
          <form
            className="sales-auth-form"
            onSubmit={onSubmit}
            aria-busy={busy}
          >
            <div className="sales-auth-field">
              <label htmlFor="sales-email">E-MAIL</label>
              <div className="sales-auth-input-wrap">
                <span className="sales-auth-input-icon">
                  <MailEnvelopeIcon />
                </span>
                <input
                  id="sales-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="seu.email@nexusfibra.net.br"
                  required
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  disabled={busy}
                  aria-describedby={error ? "sales-login-error" : undefined}
                />
              </div>
            </div>
            <div className="sales-auth-field">
              <label htmlFor="sales-password">SENHA</label>
              <div className="sales-auth-input-wrap">
                <span className="sales-auth-input-icon">
                  <LockKeyholeIcon />
                </span>
                <input
                  id="sales-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  required
                  value={password}
                  onChange={(e) => onPassword(e.target.value)}
                  disabled={busy}
                  aria-describedby={error ? "sales-login-error" : undefined}
                />
                <button
                  type="button"
                  className="sales-auth-password-toggle"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={busy}
                >
                  {showPassword ? <EyeSlashIcon /> : <EyeOpenIcon />}
                </button>
              </div>
            </div>
            {error && (
              <p
                id="sales-login-error"
                className="sales-auth-error"
                role="alert"
              >
                {error}
              </p>
            )}
            <button className="sales-auth-submit" type="submit" disabled={busy}>
              {busy ? (
                <span className="sales-auth-spinner" aria-hidden="true" />
              ) : (
                <span className="sales-auth-submit-icon">
                  <ArrowRightIcon />
                </span>
              )}
              {busy ? "Autenticando…" : "Entrar no Nexus Sales"}
            </button>
          </form>
          <p className="sales-auth-access-note">
            <span /> Acesso exclusivo à equipe Nexus Fibra.
          </p>
        </div>
        <span className="sales-auth-panel-caption">
          DADOS QUE APROXIMAM. DECISÕES QUE TRANSFORMAM.
        </span>
      </section>
    </main>
  );
}
