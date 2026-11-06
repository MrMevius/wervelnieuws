import { FormEvent, useEffect, useRef, useState } from "react";
import { Windmill } from "./WindWillyLandingPage";

export type LoginInput = { username: string; password: string; rememberMe: boolean };

type LoginPageProps = {
  theme: "light" | "dark";
  isPending: boolean;
  error: string | null;
  onSubmit: (input: LoginInput) => void;
};

const LIGHT_LOGO = "https://www.groenenoabers.nl/Groene-Noabers-Logo.png";
const DARK_LOGO = "/groene-noabers-logo-dark.png";

export function loginErrorMessage(error: unknown): string {
  const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (status === 401 || message.includes("invalid credentials")) {
    return "Gebruikersnaam of wachtwoord klopt niet. Controleer je gegevens en probeer het opnieuw.";
  }
  if (status === 429) {
    return "Te veel inlogpogingen achter elkaar. Wacht een minuut en probeer het dan opnieuw.";
  }
  if (typeof status === "number" && status >= 500) {
    return "Er ging iets mis aan de kant van de server. Probeer het over een paar minuten opnieuw.";
  }
  if (error instanceof TypeError) {
    return "De server is niet bereikbaar. Controleer je internetverbinding en probeer het opnieuw.";
  }
  return "Inloggen is niet gelukt. Probeer het opnieuw of neem contact op met een beheerder.";
}

export function LoginPage({ theme, isPending, error, onSubmit }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) {
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  }, [error]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
      rememberMe: data.get("rememberMe") === "on"
    });
  }

  return (
    <main className="login-shell">
      <div className="login-landscape" aria-hidden="true">
        <svg className="login-hill is-back" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 58 C18 46 34 54 52 47 S82 40 100 50 V100 H0 Z" />
        </svg>
        <Windmill tone="far" className="login-windmill" />
        <Windmill tone="mid" className="login-windmill" />
        <Windmill tone="near" className="login-windmill" />
        <Windmill tone="side" className="login-windmill" />
        <svg className="login-hill is-front" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 78 C22 66 44 80 66 70 S90 66 100 72 V100 H0 Z" />
        </svg>
      </div>

      <section className="login-card" aria-labelledby="login-title">
        <img className="login-logo" src={theme === "dark" ? DARK_LOGO : LIGHT_LOGO} alt="Groene Noabers" />
        <div className="login-intro">
          <h1 id="login-title">Welkom bij WindWilly</h1>
          <p className="muted">
            De gezamenlijke werkplek van Groene Noabers voor vergaderborden, uren, planning en nieuws over het windpark.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="login-username">Gebruikersnaam</label>
            <input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Wachtwoord</label>
            <div className="login-password">
              <input
                id="login-password"
                ref={passwordRef}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={showPassword ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="M4 4l16 16" />}
                </svg>
              </button>
            </div>
          </div>
          <label className="remember-me-option">
            <input name="rememberMe" type="checkbox" />
            <span>Onthoud mij</span>
          </label>
          <button type="submit" className="login-submit" disabled={isPending}>
            {isPending ? "Bezig met inloggen..." : "Inloggen"}
          </button>
          {error && (
            <p id="login-error" className="login-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>

      <footer className="login-footer">
        <small>
          © 2026 WindWilly · Ontwikkeld door BJ &amp; MM · Een initiatief van{" "}
          <a href="https://www.groenenoabers.nl/" target="_blank" rel="noreferrer">Groene Noabers</a>
        </small>
      </footer>
    </main>
  );
}
