import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  AboutContent,
  CurrentUser,
  Topic,
  getAboutContent,
  getCurrentUser,
  listTopics,
  login,
  setToken,
  updateCurrentUser
} from "../lib/api/client";

type ThemePreference = "light" | "dark" | "system";

export function App() {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");

  const loginMutation = useMutation({
    mutationFn: async (input: { username: string; password: string }) => login(input.username, input.password),
    onMutate: () => setLoginError(null),
    onSuccess: () => {
      setAuthenticated(true);
      setLoginError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("invalid credentials") || message.includes("401")) {
        setLoginError("Ongeldige gebruikersnaam of wachtwoord.");
        return;
      }
      setLoginError("Inloggen mislukt. Controleer of de backend bereikbaar is en probeer opnieuw.");
    }
  });

  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    enabled: authenticated
  });

  useEffect(() => {
    if (!currentUserQuery.data) {
      return;
    }
    setThemePreference(currentUserQuery.data.theme_preference);
  }, [currentUserQuery.data]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const resolveTheme = () => {
      const resolved = themePreference === "system" ? (media.matches ? "dark" : "light") : themePreference;
      document.documentElement.setAttribute("data-theme", resolved);
    };

    resolveTheme();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", resolveTheme);
      return () => media.removeEventListener("change", resolveTheme);
    }
    media.addListener(resolveTheme);
    return () => media.removeListener(resolveTheme);
  }, [themePreference]);

  const topicsQuery = useQuery({
    queryKey: ["topics"],
    queryFn: listTopics,
    enabled: authenticated
  });

  const aboutQuery = useQuery({
    queryKey: ["about-content"],
    queryFn: getAboutContent,
    enabled: authenticated
  });

  function logout() {
    setToken("");
    setAuthenticated(false);
    setMenuOpen(false);
    setLoginError(null);
    setThemePreference("system");
    queryClient.clear();
  }

  if (!authenticated) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="eyebrow">Wervelnieuws</p>
          <h1>Communicatie Dashboard</h1>
          <p>Log in om de planning, publicaties en changelog te bekijken.</p>
          <form className="login-form" onSubmit={(e) => handleLogin(e, loginMutation.mutate)}>
            <input name="username" placeholder="Gebruikersnaam" defaultValue="admin" required />
            <input name="password" type="password" placeholder="Wachtwoord" defaultValue="admin12345" required />
            <button type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Bezig..." : "Inloggen"}
            </button>
            {loginError && (
              <p className="error" role="alert">
                {loginError}
              </p>
            )}
          </form>
        </section>
      </main>
    );
  }

  const username = currentUserQuery.data?.full_name ?? currentUserQuery.data?.username ?? "gebruiker";

  function onUserUpdated(updatedUser: CurrentUser) {
    queryClient.setQueryData(["current-user"], updatedUser);
    setThemePreference(updatedUser.theme_preference);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Wervelnieuws</div>
        <nav className="tabs" aria-label="Hoofdnavigatie">
          <NavLink to="/main">Main</NavLink>
          <NavLink to="/planning">Planning</NavLink>
          <NavLink to="/database">Database</NavLink>
          <NavLink to="/log">Log</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
        <div className="user-menu-wrap">
          <button className="user-trigger" onClick={() => setMenuOpen((open) => !open)}>
            {username}
          </button>
          {menuOpen && (
            <div className="user-menu" role="menu">
              <NavLink to="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>
                Settings
              </NavLink>
              <button type="button" role="menuitem" onClick={logout}>
                Uitloggen
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="page-content">
        <Routes>
          <Route path="/" element={<Navigate to="/main" replace />} />
          <Route path="/main" element={<MainPage username={username} />} />
          <Route path="/planning" element={<PlanningPage topics={topicsQuery.data ?? []} />} />
          <Route path="/database" element={<DummyPage title="Database" text="Database-overzicht volgt in een volgende iteratie." />} />
          <Route path="/log" element={<DummyPage title="Log" text="Logweergave volgt in een volgende iteratie." />} />
          <Route
            path="/settings"
            element={
              <SettingsPage
                user={currentUserQuery.data}
                isLoading={currentUserQuery.isLoading}
                hasError={currentUserQuery.isError}
                onUserUpdated={onUserUpdated}
              />
            }
          />
          <Route path="/about" element={<AboutPage about={aboutQuery.data} isLoading={aboutQuery.isLoading} hasError={aboutQuery.isError} />} />
          <Route path="*" element={<Navigate to="/main" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function handleLogin(
  e: FormEvent<HTMLFormElement>,
  submit: (input: { username: string; password: string }) => void
) {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  submit({
    username: String(data.get("username") ?? ""),
    password: String(data.get("password") ?? "")
  });
}

function MainPage({ username }: { username: string }) {
  return (
    <section className="panel-grid">
      <article className="panel highlight">
        <h1>Welkom, {username}</h1>
        <p>Upload hier je bestanden en houd overzicht op alle communicatiekanalen.</p>
        <div className="upload-box">
          <input type="file" aria-label="Bestand uploaden" />
          <button type="button">Upload bestand</button>
        </div>
      </article>

      <article className="panel">
        <h2>Succesvolle plaatsingen per platform</h2>
        <ul className="stats-list">
          <li>
            <span>Website</span>
            <strong>24</strong>
          </li>
          <li>
            <span>Facebook</span>
            <strong>19</strong>
          </li>
          <li>
            <span>Nieuwsbrief</span>
            <strong>17</strong>
          </li>
        </ul>
      </article>

      <article className="panel">
        <h2>Volgende geplande bericht per platform</h2>
        <ul className="next-list">
          <li>
            <span>Website</span>
            <strong>13-03-2026 09:00</strong>
          </li>
          <li>
            <span>Facebook</span>
            <strong>13-03-2026 09:15</strong>
          </li>
          <li>
            <span>Nieuwsbrief</span>
            <strong>14-03-2026 07:30</strong>
          </li>
        </ul>
      </article>
    </section>
  );
}

function PlanningPage({ topics }: { topics: Topic[] }) {
  return (
    <section className="panel">
      <h1>Planning</h1>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Onderwerp</th>
              <th>Thema</th>
              <th>Status</th>
              <th>Geplande datum</th>
              <th>Plaatsingdatum</th>
              <th>Illustratie</th>
              <th>Opmerkingen</th>
            </tr>
          </thead>
          <tbody>
            {topics.length === 0 && (
              <tr>
                <td colSpan={8}>Nog geen records beschikbaar.</td>
              </tr>
            )}
            {topics.map((topic) => (
              <tr key={topic.id}>
                <td>{topic.id.slice(0, 8)}</td>
                <td>{topic.subject}</td>
                <td>{topic.theme}</td>
                <td>{topic.workflow_state}</td>
                <td>{topic.planning_at ? new Date(topic.planning_at).toLocaleString() : "-"}</td>
                <td>-</td>
                <td>Standaard</td>
                <td>{topic.editorial_notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AboutPage({
  about,
  isLoading,
  hasError
}: {
  about: AboutContent | undefined;
  isLoading: boolean;
  hasError: boolean;
}) {
  if (isLoading) {
    return (
      <section className="panel">
        <h1>About</h1>
        <p>Laden...</p>
      </section>
    );
  }

  if (hasError || !about) {
    return (
      <section className="panel">
        <h1>About</h1>
        <p>De About-informatie kon niet worden geladen. Ververs de pagina of probeer het later opnieuw.</p>
      </section>
    );
  }

  return (
    <section className="panel panel-grid about-grid">
      <article>
        <h1>About</h1>
        <p>{about.description}</p>
        <p className="muted">{about.disclaimer}</p>
        <p>
          <strong>Ontwikkeld door:</strong> {about.developed_by}
        </p>
      </article>

      <article>
        <h2>Changelog</h2>
        <div className="changelog-list">
          {about.changelog.map((entry) => (
            <section className="changelog-item" key={`${entry.iteration}-${entry.date}`}>
              <h3>
                Iteratie {entry.iteration} - {entry.title}
              </h3>
              <p className="muted">{entry.date}</p>
              <ul>
                {entry.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}

function DummyPage({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel">
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}

function SettingsPage({
  user,
  isLoading,
  hasError,
  onUserUpdated
}: {
  user: CurrentUser | undefined;
  isLoading: boolean;
  hasError: boolean;
  onUserUpdated: (user: CurrentUser) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    setFullName(user.full_name ?? "");
    setEmail(user.email ?? "");
    setTheme(user.theme_preference);
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCurrentUser({
        full_name: fullName.trim() || null,
        email: email.trim() || null,
        theme_preference: theme
      }),
    onSuccess: (updated) => {
      onUserUpdated(updated);
      setFullName(updated.full_name ?? "");
      setEmail(updated.email ?? "");
      setTheme(updated.theme_preference);
      setFeedback("Instellingen opgeslagen.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Email already in use")) {
        setFeedback("Dit e-mailadres is al gekoppeld aan een andere gebruiker.");
        return;
      }
      if (message.toLowerCase().includes("invalid email format")) {
        setFeedback("Het e-mailadres heeft geen geldig formaat.");
        return;
      }
      setFeedback("Opslaan mislukt. Probeer het opnieuw.");
    }
  });

  if (isLoading) {
    return (
      <section className="panel">
        <h1>Settings</h1>
        <p>Laden...</p>
      </section>
    );
  }

  if (hasError || !user) {
    return (
      <section className="panel">
        <h1>Settings</h1>
        <p>Kon gebruikersinstellingen niet laden.</p>
      </section>
    );
  }

  return (
    <section className="panel panel-grid settings-grid">
      <article>
        <h1>Settings</h1>
        <p className="muted">Werk hier je profiel en thema-voorkeur bij.</p>
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            setFeedback(null);
            saveMutation.mutate();
          }}
        >
          <label>
            Volledige naam
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Bijv. Jan Jansen" />
          </label>
          <label>
            E-mailadres
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@organisatie.nl"
              inputMode="email"
            />
          </label>
          <label>
            Thema
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemePreference)}>
              <option value="system">Systeem volgen</option>
              <option value="light">Licht</option>
              <option value="dark">Donker</option>
            </select>
          </label>
          <button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Opslaan..." : "Opslaan"}
          </button>
          {feedback && (
            <p role="status" className={feedback.includes("mislukt") || feedback.includes("geldig") || feedback.includes("al gekoppeld") ? "error" : "success"}>
              {feedback}
            </p>
          )}
        </form>
      </article>

      <article>
        <h2>Aanbevolen extra instellingen</h2>
        <ul>
          <li>Notificatievoorkeuren voor Telegram en e-mailmeldingen.</li>
          <li>Standaard publicatiekanaal bij handmatig publiceren.</li>
          <li>Standaard planningstijd en tijdzone voor nieuwe berichten.</li>
          <li>Voorkeur voor schrijfstijl of tone-of-voice per gebruiker.</li>
        </ul>
      </article>
    </section>
  );
}
