import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragEvent, FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  AdminTheme,
  AdminUser,
  ActivityFeedItem,
  AboutContent,
  ContentChannelVariant,
  ContentVersion,
  CurrentUser,
  DatabaseDocument,
  GenAIConfig,
  GenAIModelOptions,
  NotificationFeedItem,
  UiSettings,
  Project,
  SourceTraceHit,
  SchedulerOverview,
  Topic,
  changeAdminUserPassword,
  changeCurrentUserPassword,
  createAdminUser,
  createAdminTheme,
  createAdminProject,
  bulkCopyDatabaseDocuments,
  bulkDeleteDatabaseDocuments,
  bulkMoveDatabaseDocuments,
  approveTopic,
  approveVariantPart,
  createTopic,
  deleteAdminUser,
  getCurrentUserAvatarBlob,
  getAdminUiSettings,
  getCurrentUser,
  importTopicsCsv,
  listAdminUsers,
  listAdminActivity,
  listAdminThemes,
  getCurrentSchedule,
  getGeneratedImageBlob,
  getUiSettings,
  getAdminGenAIConfig,
  getAdminGenAIModelOptions,
  listActivityFeed,
  listNotificationFeed,
  listCurrentVariants,
  listAdminProjects,
  listDatabaseDocuments,
  listDatabaseProjects,
  listTopicScheduleTemplates,
  listTopicThemes,
  listVersions,
  login,
  triggerGeneration,
  regenerateContent,
  getSchedulerOverview,
  rejectVariantPart,
  scheduleTopic,
  setToken,
  updateTopic,
  updateVariant,
  updateAdminUserActive,
  updateAdminGenAIConfig,
  updateAdminUiSettings,
  updateAdminProject,
  updateAdminTheme,
  updateAdminUser,
  uploadDatabaseDocumentWithProgress,
  uploadCurrentUserAvatar,
  updateCurrentUser
} from "../../lib/api/client";
import { WERVEL_PATHS, WINDWILLY_PATHS } from "../routes/paths";
import { useMainDashboardData } from "../features/main/hooks/useMainDashboardData";
import { usePlanningData } from "../features/planning/hooks/usePlanningData";

type ThemePreference = "light" | "dark" | "system";
type VariantDraft = Pick<ContentChannelVariant, "title" | "article_body" | "summary">;
type SourceTraceDisplayHit = SourceTraceHit & { display_score: number };

export function App() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [topbarHidden, setTopbarHidden] = useState(false);
  const [wervelDropdownOpen, setWervelDropdownOpen] = useState(false);
  const lastScrollYRef = useRef(0);
  const wervelDropdownCloseTimeoutRef = useRef<number | null>(null);
  const showWervelDropdown = wervelDropdownOpen;

  function openWervelDropdown() {
    if (wervelDropdownCloseTimeoutRef.current !== null) {
      window.clearTimeout(wervelDropdownCloseTimeoutRef.current);
      wervelDropdownCloseTimeoutRef.current = null;
    }
    setWervelDropdownOpen(true);
  }

  function scheduleWervelDropdownClose() {
    if (wervelDropdownCloseTimeoutRef.current !== null) {
      window.clearTimeout(wervelDropdownCloseTimeoutRef.current);
    }
    wervelDropdownCloseTimeoutRef.current = window.setTimeout(() => {
      setWervelDropdownOpen(false);
      wervelDropdownCloseTimeoutRef.current = null;
    }, 120);
  }

  useEffect(() => {
    return () => {
      if (wervelDropdownCloseTimeoutRef.current !== null) {
        window.clearTimeout(wervelDropdownCloseTimeoutRef.current);
      }
    };
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (input: { username: string; password: string }) => login(input.username, input.password),
    onMutate: () => setLoginError(null),
    onSuccess: () => {
      setAuthenticated(true);
      setLoginError(null);
      navigate(WINDWILLY_PATHS.landing, { replace: true });
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

  useEffect(() => {
    if (!authenticated || !currentUserQuery.data?.has_avatar) {
      setAvatarUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;

    getCurrentUserAvatarBlob()
      .then((blob) => {
        if (!active) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setAvatarUrl(objectUrl);
      })
      .catch(() => {
        if (active) {
          setAvatarUrl(null);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [authenticated, currentUserQuery.data?.has_avatar, avatarVersion]);

  const uiSettingsQuery = useQuery({
    queryKey: ["ui-settings"],
    queryFn: getUiSettings,
    enabled: authenticated
  });

  useEffect(() => {
    const enabled = uiSettingsQuery.data?.wind_theme_enabled ?? true;
    document.documentElement.setAttribute("data-wind-theme", enabled ? "on" : "off");
  }, [uiSettingsQuery.data?.wind_theme_enabled]);

  const topicsQuery = usePlanningData(authenticated);
  const { aboutQuery, mainActivityQuery, mainNotificationQuery } = useMainDashboardData(authenticated);

  useEffect(() => {
    if (!authenticated) {
      setTopbarHidden(false);
      return undefined;
    }

    const onScroll = () => {
      const current = window.scrollY;
      const previous = lastScrollYRef.current;

      if (current <= 24) {
        setTopbarHidden(false);
      } else if (current > previous + 8) {
        setTopbarHidden(true);
      } else if (current < previous - 8) {
        setTopbarHidden(false);
      }

      lastScrollYRef.current = current;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [authenticated]);

  function logout() {
    setToken("");
    setAuthenticated(false);
    setMenuOpen(false);
    setLoginError(null);
    setThemePreference("system");
    setAvatarUrl(null);
    setAvatarVersion(0);
    document.documentElement.setAttribute("data-wind-theme", "on");
    queryClient.clear();
  }

  if (!authenticated) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="eyebrow">WindWilly</p>
          <h1>Suite Dashboard</h1>
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

  const displayName = currentUserQuery.data?.full_name ?? currentUserQuery.data?.username ?? "gebruiker";
  const avatarFallback = initialsForName(displayName);

  function onUserUpdated(updatedUser: CurrentUser) {
    queryClient.setQueryData(["current-user"], updatedUser);
    setThemePreference(updatedUser.theme_preference);
  }

  return (
    <div className="app-shell">
      <header className={`topbar ${topbarHidden ? "is-hidden" : ""}`}>
        <NavLink to={WINDWILLY_PATHS.landing} className="brand" aria-label="WindWilly landing">
          <svg className="windmill-logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <circle cx="32" cy="24" r="4" />
            <line x1="32" y1="28" x2="32" y2="54" />
            <line x1="32" y1="24" x2="50" y2="14" />
            <line x1="32" y1="24" x2="53" y2="27" />
            <line x1="32" y1="24" x2="21" y2="9" />
          </svg>
          <span className="sr-only">WindWilly</span>
        </NavLink>
        <nav className="tabs suite-tabs" aria-label="Hoofdnavigatie">
          <NavLink to={WINDWILLY_PATHS.module}>WindWilly</NavLink>
          <div
            className={`suite-group ${showWervelDropdown ? "is-open" : ""}`}
            aria-label="Wervelnieuws module"
            onMouseEnter={openWervelDropdown}
            onMouseLeave={scheduleWervelDropdownClose}
            onFocus={openWervelDropdown}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                scheduleWervelDropdownClose();
              }
            }}
          >
            <NavLink to={WERVEL_PATHS.base}>
              Wervelnieuws
            </NavLink>
            <nav
              className={`wervel-dropdown ${showWervelDropdown ? "is-open" : ""}`}
              aria-label="Wervelnieuws navigatie"
              aria-hidden={!showWervelDropdown}
            >
              <NavLink to={WERVEL_PATHS.main}>Main</NavLink>
              <NavLink to={WERVEL_PATHS.planning}>Planning</NavLink>
              <NavLink to={WERVEL_PATHS.database}>Bronbestanden</NavLink>
              <NavLink to={WERVEL_PATHS.log}>Log</NavLink>
              <NavLink to={WERVEL_PATHS.about}>About</NavLink>
            </nav>
          </div>
          <NavLink to="/trello">Trello</NavLink>
          <NavLink to="/urenverantwoording">Urenverantwoording</NavLink>
          <NavLink to="/participatiemomenten">Participatiemomenten</NavLink>
        </nav>
        <div className="user-menu-wrap">
          <button className="user-trigger" onClick={() => setMenuOpen((open) => !open)}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profielfoto" className="avatar" />
            ) : (
              <span aria-hidden="true" className="avatar avatar-fallback">
                {avatarFallback}
              </span>
            )}
            <span>{displayName}</span>
          </button>
          {menuOpen && (
            <div className="user-menu" role="menu">
              <NavLink to={WERVEL_PATHS.settings} role="menuitem" onClick={() => setMenuOpen(false)}>
                Settings
              </NavLink>
              {currentUserQuery.data?.is_admin && (
                <NavLink to={WERVEL_PATHS.admin} role="menuitem" onClick={() => setMenuOpen(false)}>
                  Admin
                </NavLink>
              )}
              <button type="button" role="menuitem" onClick={logout}>
                Uitloggen
              </button>
            </div>
          )}
        </div>

      </header>

      <main className="page-content">
        <Routes>
          <Route path={WINDWILLY_PATHS.landing} element={<WindWillyLandingPage />} />
          <Route path={WINDWILLY_PATHS.module} element={<WindWillyModulePlaceholder />} />
          <Route
            path={WERVEL_PATHS.main}
            element={
              <MainPage
                topics={topicsQuery.data ?? []}
                isLoading={topicsQuery.isLoading}
                hasError={topicsQuery.isError}
                recentActivity={mainActivityQuery.data ?? []}
                logIsLoading={mainActivityQuery.isLoading}
                logHasError={mainActivityQuery.isError}
                recentNotifications={mainNotificationQuery.data ?? []}
                notificationIsLoading={mainNotificationQuery.isLoading}
                notificationHasError={mainNotificationQuery.isError}
              />
            }
          />
          <Route path={WERVEL_PATHS.base} element={<Navigate to={WERVEL_PATHS.main} replace />} />
          <Route path={WERVEL_PATHS.planning} element={<PlanningPage topics={topicsQuery.data ?? []} />} />
          <Route
            path={`${WERVEL_PATHS.planning}/:topicId`}
            element={<PlanningRuleDetailPage topics={topicsQuery.data ?? []} />}
          />
          <Route path={WERVEL_PATHS.database} element={<DatabasePage currentUser={currentUserQuery.data} />} />
          <Route path={WERVEL_PATHS.log} element={<LogPage />} />
          <Route
            path={WERVEL_PATHS.settings}
            element={
              <SettingsPage
                user={currentUserQuery.data}
                avatarUrl={avatarUrl}
                displayName={displayName}
                isLoading={currentUserQuery.isLoading}
                hasError={currentUserQuery.isError}
                onUserUpdated={onUserUpdated}
                onAvatarUpdated={() => setAvatarVersion((value) => value + 1)}
              />
            }
          />
          <Route
            path={WERVEL_PATHS.admin}
            element={<AdminPage currentUser={currentUserQuery.data} />}
          />
          <Route
            path={WERVEL_PATHS.adminScheduler}
            element={<AdminSchedulerPage currentUser={currentUserQuery.data} />}
          />
          <Route path={WERVEL_PATHS.about} element={<AboutPage about={aboutQuery.data} isLoading={aboutQuery.isLoading} hasError={aboutQuery.isError} />} />

          <Route path="/urenverantwoording" element={<SuitePlaceholderPage title="Urenverantwoording" description="Deze module wordt in een volgende iteratie uitgewerkt." />} />
          <Route path="/trello" element={<TrelloPlaceholderPage />} />
          <Route path="/participatiemomenten" element={<SuitePlaceholderPage title="Participatiemomenten" description="Deze module wordt in een volgende iteratie uitgewerkt." />} />

          <Route path="/main" element={<Navigate to={WERVEL_PATHS.main} replace />} />
          <Route path="/planning" element={<Navigate to={WERVEL_PATHS.planning} replace />} />
          <Route path="/planning/:topicId" element={<LegacyPlanningDetailRedirect />} />
          <Route path="/database" element={<Navigate to={WERVEL_PATHS.database} replace />} />
          <Route path="/log" element={<Navigate to={WERVEL_PATHS.log} replace />} />
          <Route path="/settings" element={<Navigate to={WERVEL_PATHS.settings} replace />} />
          <Route path="/admin" element={<Navigate to={WERVEL_PATHS.admin} replace />} />
          <Route path="/admin/scheduler" element={<Navigate to={WERVEL_PATHS.adminScheduler} replace />} />
          <Route path="/about" element={<Navigate to={WERVEL_PATHS.about} replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <small>© 2026 WindWilly · Vibecoded by BJ & MR</small>
      </footer>
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

function WindWillyLandingPage() {
  return (
    <section className="panel main-dashboard">
      <div className="panel-grid">
        <article className="panel feature-card">
          <h2>WindWilly</h2>
          <p className="muted">Komende chatbotmodule voor snelle beantwoording van projectvragen.</p>
        </article>
        <article className="panel feature-card">
          <h2>Wervelnieuws</h2>
          <p className="muted">Volledige redactie- en publicatieflow voor lokale windparkcommunicatie.</p>
        </article>
        <article className="panel feature-card">
          <h2>Urenverantwoording</h2>
          <p className="muted">Placeholder voor urenregistratie en teaminzicht per projectfase.</p>
        </article>
        <article className="panel feature-card">
          <h2>Trello</h2>
          <p className="muted">Placeholder voor een intern projectboard dat we in komende iteraties gaan nabouwen.</p>
        </article>
        <article className="panel feature-card">
          <h2>Participatiemomenten</h2>
          <p className="muted">Placeholder voor planning en verslaglegging van bewonersmomenten.</p>
        </article>
      </div>

      <header className="main-hero windwilly-hero suite-overview-banner">
        <p className="eyebrow">Suite-overzicht</p>
        <h1>Welkom bij WindWilly</h1>
        <p>Alles voor planning, content en publicatie in één overzichtelijke omgeving.</p>
      </header>

      <section className="panel cooperatives-section" aria-labelledby="cooperatives-heading">
        <h2 id="cooperatives-heading">Bestuur (placeholder)</h2>
        <div className="board-placeholder-grid" aria-label="Bestuursleden placeholders">
          <article className="panel board-member-card" aria-label="Bestuurslid placeholder 1">
            <span className="member-avatar" aria-hidden="true">👤</span>
            <h3>Bestuurslid 1</h3>
          </article>
          <article className="panel board-member-card" aria-label="Bestuurslid placeholder 2">
            <span className="member-avatar" aria-hidden="true">👤</span>
            <h3>Bestuurslid 2</h3>
          </article>
          <article className="panel board-member-card" aria-label="Bestuurslid placeholder 3">
            <span className="member-avatar" aria-hidden="true">👤</span>
            <h3>Bestuurslid 3</h3>
          </article>
        </div>
      </section>
    </section>
  );
}

function WindWillyModulePlaceholder() {
  return (
    <section className="panel windwilly-chat-page">
      <header className="windwilly-chat-header">
        <p className="eyebrow">Placeholder · nog niet live</p>
        <h1>WindWilly Assistent</h1>
        <p className="muted">
          Een chat-achtige omgeving voor vragen over windprojectinformatie, planning en
          bewonerscommunicatie.
        </p>
      </header>

      <div className="windwilly-chat-layout">
        <aside className="windwilly-chat-sidebar" aria-label="Voorbeeldvragen">
          <h2>Voorbeeldvragen</h2>
          <ul>
            <li>Wat is de huidige status van Windpark de Boldijk?</li>
            <li>Welke participatiemomenten staan deze maand gepland?</li>
            <li>Vat de belangrijkste omgevingsmaatregelen samen.</li>
            <li>Welke bronnen ondersteunen deze projectupdate?</li>
          </ul>
        </aside>

        <section className="windwilly-chat-window" aria-label="Chatvenster placeholder">
          <article className="chat-bubble chat-bubble-user">
            <p>Kun je een korte update geven voor bewoners over de planning van volgende week?</p>
          </article>

          <article className="chat-bubble chat-bubble-assistant">
            <p>
              Zeker. Voor volgende week staat vooral voorbereidende afstemming gepland. Er zijn
              geen werkzaamheden met directe hinder voorzien. Ik kan dit ook herschrijven als
              nieuwsbrieftekst, websitebericht of Facebookupdate.
            </p>
          </article>

          <article className="chat-bubble chat-bubble-user">
            <p>Welke punten moet ik extra duidelijk maken richting omwonenden?</p>
          </article>

          <article className="chat-bubble chat-bubble-assistant">
            <p>
              Leg vooral planning, verwachte impact en contactmogelijkheid helder uit. Verwijs naar
              bronbestanden en noteer expliciet wat al bevestigd is en wat nog onder voorbehoud
              staat.
            </p>
          </article>
        </section>
      </div>

      <div className="windwilly-chat-input" aria-label="Prompt placeholder">
        <input
          type="text"
          placeholder="Stel een vraag over windinformatie (placeholder)"
          aria-label="Vraag invoeren"
          disabled
        />
        <button type="button" disabled>
          Versturen
        </button>
      </div>
    </section>
  );
}

function TrelloPlaceholderPage() {
  return (
    <section className="panel trello-placeholder-page">
      <header>
        <p className="eyebrow">Binnenkort</p>
        <h1>Trello</h1>
        <p className="muted">
          Placeholder voor onze eigen Trello-achtige module voor projectwerk. In een volgende iteratie
          bouwen we hier kolommen, kaarten en voortgangsbeheer.
        </p>
      </header>
      <div className="trello-board-preview" aria-hidden="true">
        <div className="trello-lane">
          <strong>Te doen</strong>
          <span className="trello-card">Kick-off voorbereiden</span>
          <span className="trello-card">Bronnen verzamelen</span>
        </div>
        <div className="trello-lane">
          <strong>Bezig</strong>
          <span className="trello-card">Planning reviewen</span>
        </div>
        <div className="trello-lane">
          <strong>Klaar</strong>
          <span className="trello-card">Scope afgestemd</span>
        </div>
      </div>
    </section>
  );
}

function SuitePlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="panel">
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </section>
  );
}

function LegacyPlanningDetailRedirect() {
  const params = useParams<{ topicId: string }>();
  if (!params.topicId) {
    return <Navigate to={WERVEL_PATHS.planning} replace />;
  }
  return <Navigate to={`${WERVEL_PATHS.planning}/${params.topicId}`} replace />;
}

function MainPage({
  topics,
  isLoading,
  hasError,
  recentActivity,
  logIsLoading,
  logHasError,
  recentNotifications,
  notificationIsLoading,
  notificationHasError
}: {
  topics: Topic[];
  isLoading: boolean;
  hasError: boolean;
  recentActivity: ActivityFeedItem[];
  logIsLoading: boolean;
  logHasError: boolean;
  recentNotifications: NotificationFeedItem[];
  notificationIsLoading: boolean;
  notificationHasError: boolean;
}) {
  const totalTopics = topics.length;
  const plannedTopics = topics.filter((topic) => Boolean(topic.planning_at)).length;
  const readyTopics = topics.filter(
    (topic) => topic.workflow_state === "approved" || topic.workflow_state === "scheduled"
  ).length;
  const publishedTopics = topics.filter((topic) => topic.workflow_state === "published").length;
  const reviewTopics = topics.filter((topic) => topic.workflow_state === "review").length;

  const nextPlannedTopic =
    [...topics]
      .filter((topic) => Boolean(topic.planning_at))
      .sort((left, right) => {
        const leftTime = left.planning_at ? new Date(left.planning_at).getTime() : Number.MAX_SAFE_INTEGER;
        const rightTime = right.planning_at ? new Date(right.planning_at).getTime() : Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      })[0] ?? null;

  const topThemes = Object.entries(
    topics.reduce<Record<string, number>>((acc, topic) => {
      const key = topic.theme.trim() || "Onbekend thema";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);

  return (
    <section className="main-dashboard">
      {isLoading && (
        <article className="panel">
          <h2>Dashboard laden</h2>
          <p className="muted">De actuele statistieken worden opgehaald.</p>
        </article>
      )}

      {hasError && !isLoading && (
        <article className="panel">
          <h2>Statistieken niet beschikbaar</h2>
          <p className="error">De planning kon niet worden geladen. Vernieuw de pagina of probeer het later opnieuw.</p>
        </article>
      )}

      {!isLoading && !hasError && (
        <>
          <section className="main-stats-grid" aria-label="Main statistieken">
            <article className="panel main-stat-card">
              <p className="eyebrow">Totaal onderwerpen</p>
              <strong>{totalTopics}</strong>
              <span className="muted">Alle onderwerpen in het systeem.</span>
            </article>
            <article className="panel main-stat-card">
              <p className="eyebrow">Met planningdatum</p>
              <strong>{plannedTopics}</strong>
              <span className="muted">Onderwerpen met een ingeplande genereerdatum.</span>
            </article>
            <article className="panel main-stat-card">
              <p className="eyebrow">Klaar voor publicatie</p>
              <strong>{readyTopics}</strong>
              <span className="muted">Onderwerpen in akkoord of publicatieplanning.</span>
            </article>
            <article className="panel main-stat-card">
              <p className="eyebrow">Gepubliceerd</p>
              <strong>{publishedTopics}</strong>
              <span className="muted">Onderwerpen die al live staan.</span>
            </article>
          </section>

          <section className="main-content-grid">
            <article className="panel">
              <h2>Workflow overzicht</h2>
              {topics.length === 0 ? (
                <p className="muted">
                  Voeg je eerste planningsregel toe in Planning. Upload daarna bronbestanden in Database voor
                  betere AI-onderbouwing.
                </p>
              ) : (
                <ul className="next-list">
                  <li>
                    <span>In review</span>
                    <strong>{reviewTopics}</strong>
                  </li>
                  <li>
                    <span>Klaar voor publicatie</span>
                    <strong>{readyTopics}</strong>
                  </li>
                  <li>
                    <span>Nog op te starten</span>
                    <strong>{Math.max(totalTopics - plannedTopics, 0)}</strong>
                  </li>
                </ul>
              )}
            </article>

            <article className="panel">
              <h2>Komende planning</h2>
              {nextPlannedTopic ? (
                <>
                  <p>
                    <strong>{nextPlannedTopic.subject}</strong>
                  </p>
                  <p className="muted">
                    {nextPlannedTopic.project_name} - {nextPlannedTopic.planning_at ? formatAmsterdamDateTime(nextPlannedTopic.planning_at) : "-"}
                  </p>
                </>
              ) : (
                <p className="muted">Er staat nog geen planningdatum ingevuld.</p>
              )}

              <h3>Topthema's</h3>
              <ul className="stats-list">
                {topThemes.length === 0 && <li>Geen themagegevens beschikbaar.</li>}
                {topThemes.map(([theme, count]) => (
                  <li key={theme}>
                    <span>{theme}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </article>

              <article className="panel">
                <h2>Recente meldingen</h2>
                <p className="muted">Succes- en foutmeldingen richting n8n (afgelopen 7 dagen).</p>
                {notificationIsLoading && <p className="muted">Meldingen laden...</p>}
                {notificationHasError && !notificationIsLoading && (
                  <p className="error">Meldingen konden niet worden geladen.</p>
                )}
                {!notificationIsLoading && !notificationHasError && recentNotifications.length === 0 && (
                  <p className="muted">Nog geen meldingen beschikbaar.</p>
                )}
                {!notificationIsLoading && !notificationHasError && recentNotifications.length > 0 && (
                  <ul className="main-log-list">
                    {recentNotifications.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{notificationEventLabel(item.event_type)}</strong>
                          <span className="muted">{item.topic_subject?.trim() || "Zonder onderwerp"}</span>
                        </div>
                        <span className={`notification-pill notification-${item.status}`}>
                          {item.status === "success" ? "Succes" : "Fout"}
                        </span>
                        <span className="muted">
                          {formatAmsterdamDateTime(item.created_at)} - {item.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!notificationIsLoading && !notificationHasError && recentNotifications.length === 0 && !logHasError && !logIsLoading && recentActivity.length > 0 && (
                  <p className="muted">Er zijn wel activiteiten, maar nog geen notificatiemeldingen.</p>
                )}
                <NavLink to={WERVEL_PATHS.log} className="main-inline-link">
                  Bekijk volledig logboek
                </NavLink>
              </article>

            <article className="panel feature-suggestion-panel">
              <h2>Feature suggestie #1</h2>
              <p>
                Voeg op de Log-pagina een exportknop toe om gefilterde logregels als CSV te downloaden voor
                intern overleg en maandrapportages.
              </p>
            </article>
          </section>
        </>
      )}
    </section>
  );
}

function PlanningPage({ topics }: { topics: Topic[] }) {
  type PlanningSortKey =
    | "subject"
    | "theme"
    | "project"
    | "status"
    | "planning_at"
    | "published_at"
    | "website"
    | "facebook"
    | "newsletter";

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [newEditorialNotes, setNewEditorialNotes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const projectsQuery = useQuery({
    queryKey: ["database-projects"],
    queryFn: listDatabaseProjects
  });
  const topicThemesQuery = useQuery({
    queryKey: ["topic-themes"],
    queryFn: listTopicThemes
  });
  const topicTemplatesQuery = useQuery({
    queryKey: ["topic-schedule-templates"],
    queryFn: listTopicScheduleTemplates
  });
  const [newProjectId, setNewProjectId] = useState("");
  const [projectFilterId, setProjectFilterId] = useState("all");
  const [newPlanningAt, setNewPlanningAt] = useState("");
  const [newChannels, setNewChannels] = useState<string[]>([
    "website",
    "facebook",
    "newsletter"
  ]);
  const planningThemeOptions = useMemo(() => {
    const fromApi = (topicThemesQuery.data ?? []).map((item) => item.name.trim()).filter(Boolean);
    if (fromApi.length > 0) {
      return fromApi.sort((left, right) => left.localeCompare(right, "nl-NL"));
    }
    const fallback = ["Algemeen", "Planning", "Techniek", "Omgeving", "Veiligheid", "Participatie"];
    return fallback.sort((left, right) => left.localeCompare(right, "nl-NL"));
  }, [topicThemesQuery.data]);
  const [sortKey, setSortKey] = useState<PlanningSortKey>("planning_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (newProjectId) {
      return;
    }
    const firstProject = projectsQuery.data?.[0];
    if (firstProject) {
      setNewProjectId(firstProject.id);
    }
  }, [projectsQuery.data, newProjectId]);

  const createTopicMutation = useMutation({
    mutationFn: createTopic,
    onSuccess: () => {
      setFeedback("Planningsregel toegevoegd.");
      setNewSubject("");
      setNewTheme("");
      setNewEditorialNotes("");
      setSelectedTemplateId("");
      setNewProjectId(projectsQuery.data?.[0]?.id ?? "");
      setNewPlanningAt("");
      setNewChannels(["website", "facebook", "newsletter"]);
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: () => setFeedback("Toevoegen van planningsregel is mislukt.")
  });

  const updateTopicMutation = useMutation({
    mutationFn: ({
      topicId,
      payload
    }: {
      topicId: string;
      payload: Partial<{
        workflow_state: string;
        target_channels: string[];
      }>;
    }) => updateTopic(topicId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: () => {
      setFeedback("Bijwerken van planningsregel is mislukt.");
    }
  });

  const importCsvMutation = useMutation({
    mutationFn: importTopicsCsv,
    onSuccess: (result) => {
      if (result.failed > 0) {
        const first = result.errors[0]?.error ?? "Onbekende fout";
        setFeedback(
          `Import klaar: ${result.created} toegevoegd, ${result.failed} mislukt (eerste fout: ${first}).`
        );
      } else {
        setFeedback(`Import klaar: ${result.created} toegevoegd.`);
      }
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("CSV columns must be exactly")) {
        setFeedback(
          "CSV-kolommen zijn ongeldig. Gebruik: onderwerp,thema,project,geplande_datum,opmerkingen,website,facebook,nieuwsbrief"
        );
        return;
      }
      setFeedback("CSV-import mislukt.");
    }
  });

  const filteredTopics = topics.filter((topic) =>
    projectFilterId === "all" ? true : topic.project_id === projectFilterId
  );

  const sortedTopics = [...filteredTopics].sort((left, right) => {
    const leftStatus = displayStatus(left.workflow_state);
    const rightStatus = displayStatus(right.workflow_state);
    const leftProject = left.project_name;
    const rightProject = right.project_name;
    const leftPlan = left.planning_at ? new Date(left.planning_at).getTime() : 0;
    const rightPlan = right.planning_at ? new Date(right.planning_at).getTime() : 0;
    const leftWeb = left.target_channels.includes("website") ? 1 : 0;
    const rightWeb = right.target_channels.includes("website") ? 1 : 0;
    const leftFb = left.target_channels.includes("facebook") ? 1 : 0;
    const rightFb = right.target_channels.includes("facebook") ? 1 : 0;
    const leftNl = left.target_channels.includes("newsletter") ? 1 : 0;
    const rightNl = right.target_channels.includes("newsletter") ? 1 : 0;
    let compare = 0;
    if (sortKey === "subject") {
      compare = left.subject.localeCompare(right.subject);
    } else if (sortKey === "theme") {
      compare = left.theme.localeCompare(right.theme);
    } else if (sortKey === "project") {
      compare = leftProject.localeCompare(rightProject);
    } else if (sortKey === "status") {
      compare = leftStatus.localeCompare(rightStatus);
    } else if (sortKey === "planning_at") {
      compare = leftPlan - rightPlan;
    } else if (sortKey === "published_at") {
      compare = 0;
    } else if (sortKey === "website") {
      compare = leftWeb - rightWeb;
    } else if (sortKey === "facebook") {
      compare = leftFb - rightFb;
    } else if (sortKey === "newsletter") {
      compare = leftNl - rightNl;
    }
    return sortDirection === "asc" ? compare : -compare;
  });

  function toggleChannel(channel: string, checked: boolean) {
    setNewChannels((current) => {
      if (checked) {
        return Array.from(new Set([...current, channel]));
      }
      return current.filter((item) => item !== channel);
    });
  }

  function submitPlanningRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (newChannels.length === 0) {
      setFeedback("Selecteer minimaal een doelmedium.");
      return;
    }
    if (!newPlanningAt) {
      setFeedback("Vul een geplande datum en tijd in.");
      return;
    }
    if (!newTheme) {
      setFeedback("Kies een thema.");
      return;
    }
    if (!newProjectId) {
      setFeedback("Kies een project.");
      return;
    }
    createTopicMutation.mutate({
      title: newSubject.trim(),
      subject: newSubject.trim(),
      theme: newTheme.trim(),
      project_id: newProjectId,
      editorial_notes: newEditorialNotes.trim(),
      planning_at: new Date(newPlanningAt).toISOString(),
      target_channels: newChannels
    });
  }

  function applyPlanningTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = (topicTemplatesQuery.data ?? []).find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    const projectName =
      (projectsQuery.data ?? []).find((project) => project.id === newProjectId)?.name ?? "project";
    const subject = template.subject_template.replaceAll("{project}", projectName);
    setNewSubject(subject);
    setNewTheme(template.theme);
    setNewEditorialNotes(template.editorial_notes);
    const base = new Date();
    base.setDate(base.getDate() + 1);
    const [hours, minutes] = template.planning_time.split(":").map((value) => Number(value));
    base.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    const localIso = new Date(base.getTime() - base.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setNewPlanningAt(localIso);
    setFeedback(`Sjabloon toegepast: ${template.label}.`);
  }

  async function onCsvPicked(file: File | null) {
    if (!file) {
      return;
    }
    setFeedback("CSV wordt geimporteerd...");
    await importCsvMutation.mutateAsync(file);
  }

  function toggleSort(nextKey: PlanningSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "planning_at" ? "desc" : "asc");
  }

  function sortClass(key: PlanningSortKey): string {
    if (sortKey !== key) {
      return "";
    }
    return sortDirection === "asc" ? "is-sorted-asc" : "is-sorted-desc";
  }

  function ariaSortFor(key: PlanningSortKey): "none" | "ascending" | "descending" {
    if (sortKey !== key) {
      return "none";
    }
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  function updateTopicChannel(topic: Topic, channel: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...topic.target_channels, channel]))
      : topic.target_channels.filter((item) => item !== channel);
    if (next.length === 0) {
      setFeedback("Minimaal een doelmedium moet aan staan.");
      return;
    }
    setFeedback(null);
    updateTopicMutation.mutate({
      topicId: topic.id,
      payload: { target_channels: next }
    });
  }

  return (
    <section className="panel">
      <h1>Planning</h1>
      <p className="muted">Elke planningsregel is een apart bericht met eigen doelmedia.</p>

      <div className="planning-actions">
        <label className="planning-import-label">
          CSV importeren
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV planning import"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void onCsvPicked(file);
              event.currentTarget.value = "";
            }}
            disabled={importCsvMutation.isPending}
          />
          <span className="muted small-text">
            Vaste kolommen: onderwerp,thema,project,geplande_datum,opmerkingen,website,facebook,nieuwsbrief
          </span>
        </label>

        <label>
          Projectfilter
          <select
            aria-label="Projectfilter"
            value={projectFilterId}
            onChange={(event) => setProjectFilterId(event.target.value)}
          >
            <option value="all">Alle projecten</option>
            {(projectsQuery.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <form className="planning-form" onSubmit={submitPlanningRule}>
          <select
            aria-label="Planningssjabloon"
            value={selectedTemplateId}
            onChange={(event) => applyPlanningTemplate(event.target.value)}
          >
            <option value="">Kies sjabloon (optioneel)</option>
            {(topicTemplatesQuery.data ?? []).map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Onderwerp"
            placeholder="Onderwerp"
            value={newSubject}
            onChange={(event) => setNewSubject(event.target.value)}
            minLength={3}
            required
          />
          <select
            aria-label="Thema"
            value={newTheme}
            onChange={(event) => setNewTheme(event.target.value)}
            required
          >
            <option value="" disabled>
              Kies thema
            </option>
            {planningThemeOptions.map((themeOption) => (
              <option key={themeOption} value={themeOption}>
                {themeOption}
              </option>
            ))}
          </select>
          <select
            aria-label="Project"
            value={newProjectId}
            onChange={(event) => setNewProjectId(event.target.value)}
            required
          >
            <option value="" disabled>
              Kies project
            </option>
            {(projectsQuery.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            aria-label="Geplande datum en tijd"
            value={newPlanningAt}
            onChange={(event) => setNewPlanningAt(event.target.value)}
            required
          />
          <textarea
            aria-label="Opmerkingen"
            placeholder="Opmerkingen voor redactie/AI"
            value={newEditorialNotes}
            onChange={(event) => setNewEditorialNotes(event.target.value)}
            rows={2}
          />
          <div className="planning-media-options" role="group" aria-label="Doelmedia">
            <label>
              <input
                type="checkbox"
                checked={newChannels.includes("website")}
                onChange={(event) => toggleChannel("website", event.target.checked)}
              />
              Website
            </label>
            <label>
              <input
                type="checkbox"
                checked={newChannels.includes("facebook")}
                onChange={(event) => toggleChannel("facebook", event.target.checked)}
              />
              Facebook
            </label>
            <label>
              <input
                type="checkbox"
                checked={newChannels.includes("newsletter")}
                onChange={(event) => toggleChannel("newsletter", event.target.checked)}
              />
              Nieuwsbrief
            </label>
          </div>
          <button type="submit" disabled={createTopicMutation.isPending}>
            Regel toevoegen
          </button>
        </form>
      </div>

      {feedback && (
        <p
          role="status"
          className={feedback.includes("mislukt") || feedback.includes("ongeldig") ? "error" : "success"}
        >
          {feedback}
        </p>
      )}

      <div className="table-wrap">
        <table className="planning-table">
          <thead>
            <tr>
              <th aria-sort={ariaSortFor("subject")}>
                <button type="button" className={`table-sort ${sortClass("subject")}`} onClick={() => toggleSort("subject")}>Onderwerp</button>
              </th>
              <th aria-sort={ariaSortFor("theme")}>
                <button type="button" className={`table-sort ${sortClass("theme")}`} onClick={() => toggleSort("theme")}>Thema</button>
              </th>
              <th aria-sort={ariaSortFor("project")}>
                <button type="button" className={`table-sort ${sortClass("project")}`} onClick={() => toggleSort("project")}>Project</button>
              </th>
              <th aria-sort={ariaSortFor("status")}>
                <button type="button" className={`table-sort ${sortClass("status")}`} onClick={() => toggleSort("status")}>Status</button>
              </th>
              <th aria-sort={ariaSortFor("planning_at")}>
                <button type="button" className={`table-sort ${sortClass("planning_at")}`} onClick={() => toggleSort("planning_at")}>Geplande datum</button>
              </th>
              <th aria-sort={ariaSortFor("published_at")}>
                <button type="button" className={`table-sort ${sortClass("published_at")}`} onClick={() => toggleSort("published_at")}>Plaatsingdatum</button>
              </th>
              <th aria-sort={ariaSortFor("website")}>
                <button type="button" className={`table-sort ${sortClass("website")}`} onClick={() => toggleSort("website")}>Website</button>
              </th>
              <th aria-sort={ariaSortFor("facebook")}>
                <button type="button" className={`table-sort ${sortClass("facebook")}`} onClick={() => toggleSort("facebook")}>Facebook</button>
              </th>
              <th aria-sort={ariaSortFor("newsletter")}>
                <button type="button" className={`table-sort ${sortClass("newsletter")}`} onClick={() => toggleSort("newsletter")}>Nieuwsbrief</button>
              </th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {sortedTopics.length === 0 && (
              <tr>
                <td colSpan={10}>Nog geen records beschikbaar.</td>
              </tr>
            )}
            {sortedTopics.map((topic) => (
              <tr key={topic.id}>
                <td>{topic.subject}</td>
                <td>{topic.theme}</td>
                <td>{topic.project_name}</td>
                <td>
                  <span title={statusHelp(topic.workflow_state)}>{displayStatus(topic.workflow_state)}</span>
                </td>
                <td>{topic.planning_at ? formatAmsterdamDateTime(topic.planning_at) : "-"}</td>
                <td>-</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Website ${topic.subject}`}
                    checked={topic.target_channels.includes("website")}
                    onChange={(event) => updateTopicChannel(topic, "website", event.target.checked)}
                    disabled={updateTopicMutation.isPending}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Facebook ${topic.subject}`}
                    checked={topic.target_channels.includes("facebook")}
                    onChange={(event) => updateTopicChannel(topic, "facebook", event.target.checked)}
                    disabled={updateTopicMutation.isPending}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Nieuwsbrief ${topic.subject}`}
                    checked={topic.target_channels.includes("newsletter")}
                    onChange={(event) => updateTopicChannel(topic, "newsletter", event.target.checked)}
                    disabled={updateTopicMutation.isPending}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => navigate(`${WERVEL_PATHS.planning}/${topic.id}`)}
                    aria-label={`Open planningsregel ${topic.subject}`}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlanningRuleDetailPage({ topics }: { topics: Topic[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ topicId: string }>();
  const topicId = params.topicId ?? "";
  const topic = topics.find((item) => item.id === topicId) ?? null;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [textFeedbackDraft, setTextFeedbackDraft] = useState("");
  const [imageFeedbackDraft, setImageFeedbackDraft] = useState("");
  const [generationAtDraft, setGenerationAtDraft] = useState("");
  const [publicationAtDraft, setPublicationAtDraft] = useState("");
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantDraft>>({});
  const [activeChannel, setActiveChannel] = useState<ContentChannelVariant["channel"] | null>(null);

  const versionsQuery = useQuery({
    queryKey: ["topic-versions", topicId],
    queryFn: () => listVersions(topicId),
    enabled: Boolean(topicId)
  });

  const variantsQuery = useQuery({
    queryKey: ["topic-variants", topicId],
    queryFn: () => listCurrentVariants(topicId),
    enabled: Boolean(topicId)
  });

  const scheduleQuery = useQuery({
    queryKey: ["topic-current-schedule", topicId],
    queryFn: () => getCurrentSchedule(topicId),
    enabled: Boolean(topicId),
    retry: false
  });

  const updateNotesMutation = useMutation({
    mutationFn: (editorialNotes: string) => updateTopic(topicId, { editorial_notes: editorialNotes }),
    onSuccess: () => {
      setFeedback("Opmerkingen opgeslagen.");
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: () => setFeedback("Opslaan van opmerkingen is mislukt.")
  });

  const updatePartFeedbackMutation = useMutation({
    mutationFn: ({ textFeedback, imageFeedback }: { textFeedback: string; imageFeedback: string }) =>
      updateTopic(topicId, { text_feedback: textFeedback, image_feedback: imageFeedback }),
    onSuccess: () => {
      setFeedback("Opmerkingen voor tekst en afbeelding opgeslagen.");
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: () => setFeedback("Opslaan van tekst/afbeelding opmerkingen is mislukt.")
  });

  const updateGenerationDateMutation = useMutation({
    mutationFn: (planningAt: string) => updateTopic(topicId, { planning_at: planningAt }),
    onSuccess: () => {
      setFeedback("Generatiedatum opgeslagen.");
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: () => setFeedback("Opslaan van generatiedatum is mislukt.")
  });

  const updatePublicationDateMutation = useMutation({
    mutationFn: async (publishAt: string) => {
      try {
        return await scheduleTopic(topicId, publishAt);
      } catch {
        await regenerateContent(topicId);
        return scheduleTopic(topicId, publishAt);
      }
    },
    onSuccess: () => {
      setFeedback("Publicatiedatum opgeslagen.");
      queryClient.invalidateQueries({ queryKey: ["topic-versions", topicId] });
      queryClient.invalidateQueries({ queryKey: ["topic-variants", topicId] });
      queryClient.invalidateQueries({ queryKey: ["topic-current-schedule", topicId] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      if (message) {
        setFeedback(`Opslaan van publicatiedatum is mislukt: ${message}`);
        return;
      }
      setFeedback("Opslaan van publicatiedatum is mislukt.");
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateContent(topicId),
    onSuccess: () => {
      setFeedback("Artikelen opnieuw gegenereerd.");
      queryClient.invalidateQueries({ queryKey: ["topic-versions", topicId] });
      queryClient.invalidateQueries({ queryKey: ["topic-variants", topicId] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      if (message) {
        setFeedback(`Opnieuw genereren is mislukt: ${message}`);
        return;
      }
      setFeedback("Opnieuw genereren is mislukt.");
    }
  });

  const generateMutation = useMutation({
    mutationFn: () => triggerGeneration(topicId),
    onSuccess: () => {
      setFeedback("Content gegenereerd.");
      queryClient.invalidateQueries({ queryKey: ["topic-versions", topicId] });
      queryClient.invalidateQueries({ queryKey: ["topic-variants", topicId] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      if (message) {
        setFeedback(`Genereren is mislukt: ${message}`);
        return;
      }
      setFeedback("Genereren is mislukt.");
    }
  });

  const saveVariantMutation = useMutation({
    mutationFn: ({
      channel,
      payload
    }: {
      channel: ContentChannelVariant["channel"];
      payload: Pick<ContentChannelVariant, "title" | "article_body" | "summary">;
    }) => updateVariant(topicId, channel, payload),
    onSuccess: () => {
      setFeedback("Wijzigingen opgeslagen.");
      queryClient.invalidateQueries({ queryKey: ["topic-variants", topicId] });
    },
    onError: () => setFeedback("Opslaan van variant is mislukt.")
  });

  const approveVariantPartMutation = useMutation({
    mutationFn: ({ channel, part }: { channel: ContentChannelVariant["channel"]; part: "text" | "image" }) =>
      approveVariantPart(topicId, channel, part),
    onSuccess: () => {
      setFeedback("Onderdeel goedgekeurd.");
      queryClient.invalidateQueries({ queryKey: ["topic-variants", topicId] });
    },
    onError: () => setFeedback("Onderdeel goedkeuren is mislukt.")
  });

  const rejectVariantPartMutation = useMutation({
    mutationFn: ({
      channel,
      part,
      note
    }: {
      channel: ContentChannelVariant["channel"];
      part: "text" | "image";
      note: string;
    }) => rejectVariantPart(topicId, channel, part, note),
    onSuccess: () => {
      setFeedback("Onderdeel afgewezen.");
      queryClient.invalidateQueries({ queryKey: ["topic-variants", topicId] });
    },
    onError: () => setFeedback("Onderdeel afwijzen is mislukt.")
  });

  const approveTopicMutation = useMutation({
    mutationFn: () => approveTopic(topicId),
    onSuccess: () => {
      setFeedback("Planningsregel is akkoord gezet.");
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Not all channels approved")) {
        setFeedback("Nog niet alle actieve doelmedia zijn goedgekeurd.");
        return;
      }
      setFeedback("Akkoord zetten is mislukt.");
    }
  });

  const selectedVersion =
    (versionsQuery.data ?? []).find((version) => version.is_current) ??
    (versionsQuery.data ?? [])[0] ??
    null;
  const variants = variantsQuery.data ?? [];
  const variantsErrorMessage = extractApiErrorMessage(variantsQuery.error);

  useEffect(() => {
    setNotesDraft(topic?.editorial_notes ?? "");
  }, [topic?.id, topic?.editorial_notes]);

  useEffect(() => {
    setTextFeedbackDraft(topic?.text_feedback ?? "");
    setImageFeedbackDraft(topic?.image_feedback ?? "");
  }, [topic?.id, topic?.text_feedback, topic?.image_feedback]);

  useEffect(() => {
    setGenerationAtDraft(toDatetimeLocalInputValue(topic?.planning_at ?? null));
  }, [topic?.id, topic?.planning_at]);

  useEffect(() => {
    const scheduled = scheduleQuery.data?.scheduled_for ?? null;
    setPublicationAtDraft(toDatetimeLocalInputValue(scheduled));
  }, [scheduleQuery.data?.scheduled_for, topic?.id]);

  useEffect(() => {
    if (variants.length === 0) {
      return;
    }
    setVariantDrafts((current) => {
      const next = { ...current };
      for (const variant of variants) {
        if (!next[variant.channel]) {
          next[variant.channel] = {
            title: variant.title,
            article_body: variant.article_body,
            summary: variant.summary
          };
        }
      }
      return next;
    });
  }, [variants]);

  useEffect(() => {
    const firstChannel = topic?.target_channels[0] as ContentChannelVariant["channel"] | undefined;
    if (!firstChannel) {
      setActiveChannel(null);
      return;
    }
    setActiveChannel((current) => {
      if (current && topic?.target_channels.includes(current)) {
        return current;
      }
      return firstChannel;
    });
  }, [topic?.id, topic?.target_channels]);

  const sourceTrace = extractSourceTrace(selectedVersion);
  const sourceTraceDisplay = useMemo(() => rankSourceTraceByScore(sourceTrace), [sourceTrace]);
  if (!topic) {
    return (
      <section className="panel">
        <h1>Planningsregel niet gevonden</h1>
        <p className="muted">Deze planningsregel bestaat niet meer of is nog niet geladen.</p>
        <div className="detail-actions">
          <button type="button" onClick={() => navigate(WERVEL_PATHS.planning)}>Terug naar planning</button>
        </div>
      </section>
    );
  }

  const generationPlannedAt = topic.planning_at
    ? formatAmsterdamDateTime(topic.planning_at)
    : "nog niet gepland";
  const topicSubject = topic.subject;
  const publicationPlannedAt = scheduleQuery.data?.scheduled_for
    ? formatAmsterdamDateTime(scheduleQuery.data.scheduled_for)
    : "nog niet gepland";

  const planningSteps = getPlanningSteps({
    workflowState: topic.workflow_state,
    generationPlannedAt,
    publicationPlannedAt,
    hasGenerationPlan: Boolean(topic.planning_at),
    hasPublicationPlan: Boolean(scheduleQuery.data?.scheduled_for)
  });
  const currentStep = planningSteps.find((step) => step.isCurrent) ?? planningSteps[0];
  const requiredChannels = topic.target_channels;
  const allApproved = requiredChannels.every((channel) => {
    const item = variants.find((variant) => variant.channel === channel);
    return item?.text_approval_state === "approved" && item?.image_approval_state === "approved";
  });

  const availableChannels = topic.target_channels as ContentChannelVariant["channel"][];
  const previewChannels: ContentChannelVariant["channel"][] = ["facebook", "newsletter", "website"];
  const selectedChannel =
    (activeChannel && availableChannels.includes(activeChannel) ? activeChannel : availableChannels[0]) ??
    "website";
  const selectedVariant = variants.find((item) => item.channel === selectedChannel) ?? null;
  const selectedFallbackDraft: VariantDraft = {
    title: selectedVariant?.title ?? selectedVersion?.title ?? topicSubject,
    article_body: selectedVariant?.article_body ?? selectedVersion?.article_body ?? "",
    summary: selectedVariant?.summary ?? selectedVersion?.summary ?? ""
  };
  const selectedDraft = normalizeVariantDraft(variantDrafts[selectedChannel] ?? selectedFallbackDraft, {
    fallbackTitle: topicSubject
  });
  const selectedApprovalState = selectedVariant?.approval_state ?? "pending";
  const selectedApprovalLabel = approvalStateLabel(selectedApprovalState);

  function getNormalizedDraftForChannel(channel: ContentChannelVariant["channel"]): VariantDraft {
    const variant = variants.find((item) => item.channel === channel) ?? null;
    const fallbackDraft: VariantDraft = {
      title: variant?.title ?? selectedVersion?.title ?? topicSubject,
      article_body: variant?.article_body ?? selectedVersion?.article_body ?? "",
      summary: variant?.summary ?? selectedVersion?.summary ?? ""
    };
    return normalizeVariantDraft(variantDrafts[channel] ?? fallbackDraft, {
      fallbackTitle: topicSubject
    });
  }

  return (
    <section className="panel planning-detail-page planning-detail-grid-12">
      <header className="planning-detail-intro">
        <h1>Planningsregel detail</h1>
        <p className="muted">
          Werk per doelmedium aan artikel, samenvatting en goedkeuring. Pas daarna kun je de regel akkoord zetten.
        </p>
      </header>

      <div className="planning-detail-top-grid">
        <section className="panel planning-notes-panel" aria-label="Opmerkingen">
          <h2>Opmerkingen</h2>
          <p className="muted">Bewaar apart opmerkingen voor generatie, tekstreview en afbeeldingsreview.</p>
          <textarea
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            rows={4}
            aria-label="Opmerkingen generatie"
            placeholder="Bijvoorbeeld gewenste toon, lokale context of aandachtspunten"
          />
          <div className="notes-feedback-grid">
            <label className="notes-feedback-field">
              Opmerkingen tekst
              <textarea
                value={textFeedbackDraft}
                onChange={(event) => setTextFeedbackDraft(event.target.value)}
                rows={3}
                aria-label="Opmerkingen tekst"
                placeholder="Optioneel: feedback voor tekstafwijzingen"
              />
            </label>
            <label className="notes-feedback-field">
              Opmerkingen afbeelding
              <textarea
                value={imageFeedbackDraft}
                onChange={(event) => setImageFeedbackDraft(event.target.value)}
                rows={3}
                aria-label="Opmerkingen afbeelding"
                placeholder="Optioneel: feedback voor afbeeldingafwijzingen"
              />
            </label>
          </div>
          <div className="detail-dates-grid">
            <div className="detail-date-row">
              <label>
                Generatiedatum
                <input
                  type="datetime-local"
                  value={generationAtDraft}
                  onChange={(event) => setGenerationAtDraft(event.target.value)}
                  aria-label="Generatiedatum"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!generationAtDraft) {
                    setFeedback("Kies eerst een generatiedatum.");
                    return;
                  }
                  setFeedback(null);
                  updateGenerationDateMutation.mutate(new Date(generationAtDraft).toISOString());
                }}
                disabled={updateGenerationDateMutation.isPending}
              >
                Generatiedatum opslaan
              </button>
            </div>
            <div className="detail-date-row">
              <label>
                Publicatiedatum
                <input
                  type="datetime-local"
                  value={publicationAtDraft}
                  onChange={(event) => setPublicationAtDraft(event.target.value)}
                  aria-label="Publicatiedatum"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!publicationAtDraft) {
                    setFeedback("Kies eerst een publicatiedatum.");
                    return;
                  }
                  setFeedback(null);
                  updatePublicationDateMutation.mutate(new Date(publicationAtDraft).toISOString());
                }}
                disabled={updatePublicationDateMutation.isPending}
              >
                Publicatiedatum opslaan
              </button>
            </div>
          </div>
          <div className="detail-actions section-actions">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                updateNotesMutation.mutate(notesDraft);
              }}
              disabled={updateNotesMutation.isPending}
            >
              Generatie-opmerkingen opslaan
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                updatePartFeedbackMutation.mutate({
                  textFeedback: textFeedbackDraft,
                  imageFeedback: imageFeedbackDraft
                });
              }}
              disabled={updatePartFeedbackMutation.isPending}
            >
              Tekst/afbeelding opmerkingen opslaan
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                generateMutation.mutate();
              }}
              disabled={generateMutation.isPending || regenerateMutation.isPending}
            >
              Genereer content
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                regenerateMutation.mutate();
              }}
              disabled={generateMutation.isPending || regenerateMutation.isPending}
            >
              Artikelen opnieuw genereren
            </button>
          </div>
        </section>

        <section className="panel planning-progress-panel" aria-label="Planningvoortgang">
          <h2>Planningvoortgang</h2>
          <p className="muted">
            Huidige stap: <strong>{currentStep.label}</strong>
          </p>
          <ul className="planning-step-list">
            {planningSteps.map((step) => (
              <li key={step.key} className={step.isDone ? "step-done" : "step-pending"}>
                <span className="step-indicator" aria-hidden="true">
                  {step.isDone ? "x" : "-"}
                </span>
                <span className="step-label">{step.label}</span>
                <span className="step-meta">{step.metaLabel}</span>
                {step.detail && <span className="step-detail">{step.detail}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel planning-channel-workspace" aria-label="Kanaalredactie">
        <div className="planning-channel-header">
          <h2>Kanaalredactie</h2>
          <p className="muted">Werk per kanaal in de editor; alle drie media-previews staan altijd naast elkaar.</p>
        </div>

        <div className="planning-channel-tabs" role="tablist" aria-label="Doelmedia">
          {availableChannels.map((channel) => {
            const variant = variants.find((item) => item.channel === channel) ?? null;
            const isActive = selectedChannel === channel;
            return (
              <button
                type="button"
                key={channel}
                className={isActive ? "channel-tab active" : "channel-tab"}
                aria-selected={isActive}
                role="tab"
                onClick={() => setActiveChannel(channel)}
              >
                <span>{channelLabel(channel)}</span>
                <span className={`status-pill status-${variant?.approval_state ?? "pending"}`}>
                  {approvalStateLabel(variant?.approval_state ?? "pending")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="channel-workspace-grid">
          <article className="channel-editor" aria-label={`Redactie ${channelLabel(selectedChannel)}`}>
            <h3>{channelLabel(selectedChannel)}</h3>
            <p className="muted channel-status-line">
              Status: <span className={`status-pill status-${selectedApprovalState}`}>{selectedApprovalLabel}</span>
            </p>
            {variantsQuery.isLoading && <p>Laden...</p>}
            {variantsQuery.isError && (
              <p className="error">
                Kanaalvariant kon niet worden geladen
                {variantsErrorMessage ? `: ${variantsErrorMessage}` : "."}
              </p>
            )}
            {!variantsQuery.isLoading && !variantsQuery.isError && (
              <>
                <label>
                  Titel
                  <input
                    value={selectedDraft.title}
                    onChange={(event) =>
                      setVariantDrafts((current) => ({
                        ...current,
                        [selectedChannel]: { ...selectedDraft, title: event.target.value }
                      }))
                    }
                    aria-label={`Titel ${channelLabel(selectedChannel)}`}
                  />
                </label>
                <RichTextEditor
                  label={`Artikel ${channelLabel(selectedChannel)}`}
                  value={selectedDraft.article_body}
                  onChange={(value) =>
                    setVariantDrafts((current) => ({
                      ...current,
                      [selectedChannel]: { ...selectedDraft, article_body: value }
                    }))
                  }
                />
                <RichTextEditor
                  label={`Samenvatting ${channelLabel(selectedChannel)}`}
                  value={selectedDraft.summary}
                  onChange={(value) =>
                    setVariantDrafts((current) => ({
                      ...current,
                      [selectedChannel]: { ...selectedDraft, summary: value }
                    }))
                  }
                  compact
                />
                <div className="detail-actions section-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(null);
                      saveVariantMutation.mutate({
                        channel: selectedChannel,
                        payload: {
                          title: selectedDraft.title,
                          article_body: selectedDraft.article_body,
                          summary: selectedDraft.summary
                        }
                      });
                    }}
                    disabled={saveVariantMutation.isPending || selectedDraft.title.trim().length < 3}
                  >
                    Opslaan
                  </button>
                </div>
              </>
            )}
          </article>
        </div>

        <div className="all-previews-grid" aria-label="Alle kanaalpreviews">
          {previewChannels.map((channel) => {
            const channelEnabled = availableChannels.includes(channel);
            const variant = variants.find((item) => item.channel === channel) ?? null;
            const approvalState = variant?.approval_state ?? "pending";
            return (
              <ChannelPreview
                key={`all-preview-${channel}`}
                channel={channel}
                draft={getNormalizedDraftForChannel(channel)}
                imageId={variant?.generated_image_id ?? null}
                imagePath={variant?.generated_image_path ?? null}
                approvalState={approvalState}
                textApprovalState={variant?.text_approval_state ?? "pending"}
                imageApprovalState={variant?.image_approval_state ?? "pending"}
                onApprovePart={(part) => {
                  setFeedback(null);
                  approveVariantPartMutation.mutate({ channel, part });
                }}
                onRejectPart={(part) => {
                  setFeedback(null);
                  rejectVariantPartMutation.mutate({
                    channel,
                    part,
                    note: part === "text" ? textFeedbackDraft : imageFeedbackDraft
                  });
                }}
                actionsDisabled={
                  !channelEnabled || approveVariantPartMutation.isPending || rejectVariantPartMutation.isPending
                }
              />
            );
          })}
        </div>
      </section>

      {feedback && (
        <p
          role="status"
          className={
            feedback.includes("mislukt") ||
            feedback.includes("niet") ||
            feedback.includes("fout") ||
            feedback.includes("afgekeurd") ||
            feedback.includes("afgewezen")
              ? "error"
              : "success"
          }
        >
          {feedback}
        </p>
      )}

      <section className="review-panel" aria-label="Bronreview detail">
        <h2>Bronpassages</h2>
        {versionsQuery.isLoading && <p>Bronpassages worden geladen...</p>}
        {versionsQuery.isError && <p className="error">Bronpassages konden niet worden geladen.</p>}
        {!versionsQuery.isLoading && !versionsQuery.isError && sourceTrace.length === 0 && (
          <p>Geen bronpassages gekoppeld.</p>
        )}
        {sourceTraceDisplay.length > 0 && (
          <div className="source-trace-list" role="list" aria-label="Bronpassage accordion">
            {sourceTraceDisplay.map((hit) => (
              <details className="source-trace-item" key={`${hit.source_type}-${hit.chunk_id}`}>
                <summary className="source-trace-summary">
                  <span className="source-label">
                    {`Bron: ${hit.source_type === "database" ? "Database" : "Topic"} - ${
                      hit.document_name || "Onbekend document"
                    } - chunk ${hit.chunk_index || "?"}`}
                  </span>
                  <span className="source-score-badge">Score {hit.display_score}</span>
                </summary>
                <div className="source-trace-content">
                  <p>{hit.text}</p>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <div className="detail-actions section-actions detail-final-actions">
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            approveTopicMutation.mutate();
          }}
          disabled={!allApproved || approveTopicMutation.isPending}
        >
          Zet planningsregel op akkoord
        </button>
        <button type="button" onClick={() => navigate(WERVEL_PATHS.planning)}>Terug naar planning</button>
      </div>
    </section>
  );
}

function channelLabel(channel: string): string {
  if (channel === "website") {
    return "Website";
  }
  if (channel === "facebook") {
    return "Facebook";
  }
  if (channel === "newsletter") {
    return "Nieuwsbrief";
  }
  return channel;
}

function approvalStateLabel(state: ContentChannelVariant["approval_state"]): string {
  if (state === "approved") {
    return "Akkoord";
  }
  if (state === "rejected") {
    return "Afgewezen";
  }
  return "Concept";
}

function schedulerStatusTone(status: string): "approved" | "pending" | "rejected" {
  if (status === "published" || status === "updated" || status === "resolved") {
    return "approved";
  }
  if (status === "error" || status === "failed") {
    return "rejected";
  }
  return "pending";
}

function ChannelPreview({
  channel,
  draft,
  imageId,
  imagePath,
  approvalState,
  textApprovalState,
  imageApprovalState,
  onApprovePart,
  onRejectPart,
  actionsDisabled
}: {
  channel: ContentChannelVariant["channel"];
  draft: VariantDraft;
  imageId: string | null;
  imagePath: string | null;
  approvalState: ContentChannelVariant["approval_state"];
  textApprovalState: ContentChannelVariant["approval_state"];
  imageApprovalState: ContentChannelVariant["approval_state"];
  onApprovePart: (part: "text" | "image") => void;
  onRejectPart: (part: "text" | "image") => void;
  actionsDisabled: boolean;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageId) {
      setImageUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    getGeneratedImageBlob(imageId)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setImageUrl(null);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageId]);

  const approvalLabel = approvalStateLabel(approvalState);
  const textApprovalLabel = approvalStateLabel(textApprovalState);
  const imageApprovalLabel = approvalStateLabel(imageApprovalState);
  return (
    <aside className={`channel-preview preview-${channel}`} aria-label={`Preview ${channelLabel(channel)}`}>
      <h3>Preview {channelLabel(channel)}</h3>
      <p className="muted channel-status-line">
        Status: <span className={`status-pill status-${approvalState}`}>{approvalLabel}</span>
      </p>
      <article className="media-preview-card">
        <p className="media-preview-eyebrow">
          {channel === "facebook" ? "Facebook bericht" : channel === "newsletter" ? "Nieuwsbrief" : "Website artikel"}
        </p>
        <h4>{draft.title.trim() || "Zonder titel"}</h4>
        <section className="media-preview-section">
          <div className="media-preview-label-row">
            <p className="media-preview-label">Tekst</p>
            <span className={`status-pill status-${textApprovalState}`}>{textApprovalLabel}</span>
          </div>
          <div className="media-preview-html" dangerouslySetInnerHTML={{ __html: toPreviewHtml(draft.article_body) }} />
          <div className="detail-actions preview-part-actions">
            <button type="button" onClick={() => onApprovePart("text")} disabled={actionsDisabled}>
              Tekst akkoord
            </button>
            <button type="button" onClick={() => onRejectPart("text")} disabled={actionsDisabled}>
              Tekst afwijzen
            </button>
          </div>
        </section>
        <section className="media-preview-section">
          <p className="media-preview-label">Samenvatting</p>
          <div className="media-preview-html" dangerouslySetInnerHTML={{ __html: toPreviewHtml(draft.summary) }} />
        </section>
        <section className="media-preview-section">
          <div className="media-preview-label-row">
            <p className="media-preview-label">Afbeelding</p>
            <span className={`status-pill status-${imageApprovalState}`}>{imageApprovalLabel}</span>
          </div>
          {imageUrl ? (
            <img className="media-preview-image-render" src={imageUrl} alt={`Illustratie ${channelLabel(channel)}`} />
          ) : (
            <p className="media-preview-image">Geen afbeelding beschikbaar.</p>
          )}
          <div className="detail-actions preview-part-actions">
            <button type="button" onClick={() => onApprovePart("image")} disabled={actionsDisabled}>
              Afbeelding akkoord
            </button>
            <button type="button" onClick={() => onRejectPart("image")} disabled={actionsDisabled}>
              Afbeelding afwijzen
            </button>
          </div>
          {imagePath && <p className="media-preview-image">Bronpad: <code>{imagePath}</code></p>}
        </section>
      </article>
    </aside>
  );
}

function normalizeVariantDraft(draft: VariantDraft, options: { fallbackTitle: string }): VariantDraft {
  let normalizedTitle = draft.title.trim() || options.fallbackTitle;
  let normalizedArticleBody = draft.article_body;
  let normalizedSummary = draft.summary;

  const candidates = [draft.title, draft.article_body, draft.summary]
    .map((value) => extractStructuredContentFromRaw(value))
    .filter((value): value is Partial<VariantDraft> => value !== null);

  for (const candidate of candidates) {
    if (candidate.title && candidate.title.trim().length > 0) {
      normalizedTitle = candidate.title.trim();
    }
    if (candidate.article_body && candidate.article_body.trim().length > 0) {
      normalizedArticleBody = candidate.article_body;
    }
    if (candidate.summary && candidate.summary.trim().length > 0) {
      normalizedSummary = candidate.summary;
    }
  }

  return {
    title: normalizedTitle,
    article_body: normalizedArticleBody,
    summary: normalizedSummary
  };
}

function extractStructuredContentFromRaw(raw: string): Partial<VariantDraft> | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;
  const codeFence = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeFence?.[1]) {
    candidate = codeFence[1].trim();
  }
  if (candidate.toLowerCase().startsWith("json")) {
    candidate = candidate.slice(4).trim();
  }
  if (!(candidate.startsWith("{") && candidate.endsWith("}"))) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate) as {
      title?: unknown;
      article_body?: unknown;
      summary?: unknown;
    };
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const next: Partial<VariantDraft> = {};
    if (typeof parsed.title === "string") {
      next.title = parsed.title;
    }
    if (typeof parsed.article_body === "string") {
      next.article_body = parsed.article_body;
    }
    if (typeof parsed.summary === "string") {
      next.summary = parsed.summary;
    }
    return Object.keys(next).length > 0 ? next : null;
  } catch {
    return null;
  }
}

function toPreviewHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "<p>Nog geen inhoud toegevoegd.</p>";
  }
  if (looksLikeHtml(trimmed)) {
    return trimmed;
  }
  return `<p>${escapeHtml(trimmed).replace(/\n/g, "<br />")}</p>`;
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function RichTextEditor({
  label,
  value,
  onChange,
  compact = false
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  function runCommand(command: "bold" | "italic" | "insertUnorderedList") {
    if (typeof document.execCommand !== "function") {
      return;
    }
    document.execCommand(command);
    onChange(ref.current?.innerHTML ?? "");
  }

  return (
    <label className="wysiwyg-field">
      {label}
      <div className="wysiwyg-toolbar" role="toolbar" aria-label={`${label} toolbar`}>
        <button type="button" onClick={() => runCommand("bold")}>
          Vet
        </button>
        <button type="button" onClick={() => runCommand("italic")}>
          Cursief
        </button>
        <button type="button" onClick={() => runCommand("insertUnorderedList")}>
          Lijst
        </button>
      </div>
      <div
        ref={ref}
        className={compact ? "wysiwyg-editor compact" : "wysiwyg-editor"}
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
      />
    </label>
  );
}

function displayStatus(workflowState: string): "Nieuw" | "Gepland" | "Gereed" | "Akkoord" | "Gepubliceerd" {
  if (workflowState === "published") {
    return "Gepubliceerd";
  }
  if (workflowState === "approved") {
    return "Akkoord";
  }
  if (workflowState === "review") {
    return "Gereed";
  }
  if (workflowState === "planned" || workflowState === "scheduled") {
    return "Gepland";
  }
  return "Nieuw";
}

function statusHelp(workflowState: string): string {
  const status = displayStatus(workflowState);
  if (status === "Nieuw") {
    return "nog niet ingepland";
  }
  if (status === "Gepland") {
    return "onderwerp gekozen voor generatie op Geplande datum";
  }
  if (status === "Gereed") {
    return "artikel, samenvatting en illustratie zijn afgerond";
  }
  if (status === "Akkoord") {
    return "klaar voor publicatie";
  }
  return "bericht en samenvatting live gezet";
}

function getPlanningSteps(input: {
  workflowState: string;
  generationPlannedAt: string;
  publicationPlannedAt: string;
  hasGenerationPlan: boolean;
  hasPublicationPlan: boolean;
}): Array<{
  key: string;
  label: string;
  isDone: boolean;
  isCurrent: boolean;
  metaLabel: string;
  detail?: string;
}> {
  let currentIndex = 0;
  if (input.workflowState === "planned" || input.workflowState === "generating") {
    currentIndex = 1;
  } else if (input.workflowState === "review") {
    currentIndex = 2;
  } else if (input.workflowState === "approved") {
    currentIndex = 3;
  } else if (input.workflowState === "scheduled" || input.workflowState === "publishing") {
    currentIndex = 4;
  } else if (input.workflowState === "published") {
    currentIndex = 5;
  }

  const ordered = [
    { key: "nieuw", label: "Nieuw" },
    {
      key: "gepland",
      label: "Gepland",
      detail: `AI generatie gepland: ${input.generationPlannedAt}`
    },
    { key: "gereed", label: "Gereed" },
    { key: "akkoord", label: "Akkoord" },
    {
      key: "publicatie-gepland",
      label: "Publicatie gepland",
      detail: `Publicatie gepland: ${input.publicationPlannedAt}`
    },
    {
      key: "gepubliceerd",
      label: "Gepubliceerd",
      detail: `Geplande publicatiedatum: ${input.publicationPlannedAt}`
    }
  ];

  return ordered.map((step, index) => {
    const isDone = index <= currentIndex;
    let metaLabel = isDone ? "afgerond" : "moet nog gebeuren";
    if (!isDone && step.key === "gepland" && input.hasGenerationPlan) {
      metaLabel = "gepland";
    }
    if (!isDone && step.key === "publicatie-gepland" && input.hasPublicationPlan) {
      metaLabel = "gepland";
    }
    return {
      key: step.key,
      label: step.label,
      detail: step.detail,
      isDone,
      isCurrent: index === currentIndex,
      metaLabel
    };
  });
}

function extractSourceTrace(version: ContentVersion | null): SourceTraceHit[] {
  if (!version) {
    return [];
  }
  if (Array.isArray(version.source_trace) && version.source_trace.length > 0) {
    return version.source_trace;
  }
  try {
    const parsed = JSON.parse(version.source_trace_json) as Array<
      Partial<SourceTraceHit> & { score?: unknown; relevance_score?: unknown }
    >;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => ({
      source: item.source ?? item.source_type ?? "topic",
      source_type: item.source_type ?? item.source ?? "topic",
      chunk_id: item.chunk_id ?? "",
      chunk_index: item.chunk_index ?? "",
      text: item.text ?? "",
      document_id: item.document_id ?? "",
      document_name: item.document_name ?? "",
      topic_id: item.topic_id ?? "",
      project_id: item.project_id ?? "",
      project_name: item.project_name ?? "",
      relevance_score: parseSourceTraceScoreValue(item.relevance_score ?? item.score ?? null)
    }));
  } catch {
    return [];
  }
}

function rankSourceTraceByScore(hits: SourceTraceHit[]): SourceTraceDisplayHit[] {
  const total = hits.length;
  return hits
    .map((hit, index) => ({
      ...hit,
      display_score: resolveSourceTraceScore(hit, index, total)
    }))
    .sort((left, right) => right.display_score - left.display_score);
}

function resolveSourceTraceScore(hit: SourceTraceHit, index: number, total: number): number {
  const parsed = parseSourceTraceScoreValue(hit.relevance_score ?? null);
  if (parsed !== null) {
    return parsed;
  }
  if (total <= 1) {
    return 100;
  }
  const fallback = 100 - Math.round((index / Math.max(1, total - 1)) * 40);
  return Math.max(0, Math.min(100, fallback));
}

function parseSourceTraceScoreValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 1) {
      return Math.max(0, Math.min(100, Math.round(value * 100)));
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      if (numeric <= 1) {
        return Math.max(0, Math.min(100, Math.round(numeric * 100)));
      }
      return Math.max(0, Math.min(100, Math.round(numeric)));
    }
  }
  return null;
}

function DatabasePage({ currentUser }: { currentUser: CurrentUser | undefined }) {
  const queryClient = useQueryClient();
  const [filterProjectId, setFilterProjectId] = useState("all");
  const [uploadProjectId, setUploadProjectId] = useState("");
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"delete" | "copy" | "move">("move");
  const [bulkTargetProjectId, setBulkTargetProjectId] = useState("");
  const [sortKey, setSortKey] = useState<"filename" | "project" | "uploader" | "created_at" | "size_bytes" | "status">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const projectsQuery = useQuery({
    queryKey: ["database-projects"],
    queryFn: listDatabaseProjects
  });

  useEffect(() => {
    if (uploadProjectId) {
      return;
    }
    const first = projectsQuery.data?.[0];
    if (first) {
      setUploadProjectId(first.id);
    }
  }, [projectsQuery.data, uploadProjectId]);

  useEffect(() => {
    if (bulkTargetProjectId) {
      return;
    }
    const first = projectsQuery.data?.[0];
    if (first) {
      setBulkTargetProjectId(first.id);
    }
  }, [projectsQuery.data, bulkTargetProjectId]);

  const documentsQuery = useQuery({
    queryKey: ["database-documents", filterProjectId],
    queryFn: () =>
      listDatabaseDocuments(
        filterProjectId && filterProjectId !== "all" ? filterProjectId : undefined
      )
  });

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      onProgress
    }: {
      file: File;
      onProgress: (progress: number) => void;
    }) => {
      if (!uploadProjectId) {
        throw new Error("Kies eerst een project");
      }
      return uploadDatabaseDocumentWithProgress(uploadProjectId, file, onProgress);
    }
  });

  const bulkActionMutation = useMutation({
    mutationFn: async () => {
      if (selectedDocumentIds.length === 0) {
        throw new Error("Selecteer eerst bestanden");
      }
      if (bulkAction === "delete") {
        if (currentUser?.is_admin !== true) {
          throw new Error("Alleen admins kunnen bulk verwijderen");
        }
        return bulkDeleteDatabaseDocuments(selectedDocumentIds);
      }
      if (!bulkTargetProjectId) {
        throw new Error("Kies een doelproject");
      }
      if (bulkAction === "move") {
        return bulkMoveDatabaseDocuments(selectedDocumentIds, bulkTargetProjectId);
      }
      return bulkCopyDatabaseDocuments(selectedDocumentIds, bulkTargetProjectId);
    },
    onSuccess: (result) => {
      setUploadFeedback(`Bulkactie uitgevoerd op ${result.affected} bestand(en).`);
      setSelectedDocumentIds([]);
      queryClient.invalidateQueries({ queryKey: ["database-documents"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Admin")) {
        setUploadFeedback("Alleen admins kunnen bestanden verwijderen.");
        return;
      }
      if (message.includes("doelproject") || message.includes("target_project_id")) {
        setUploadFeedback("Kies een doelproject voor deze bulkactie.");
        return;
      }
      setUploadFeedback("Bulkactie mislukt.");
    }
  });

  const allDocuments = documentsQuery.data ?? [];
  const sortedDocuments = [...allDocuments].sort((left, right) => {
    let comparison = 0;
    if (sortKey === "filename") {
      comparison = left.filename.localeCompare(right.filename);
    } else if (sortKey === "project") {
      comparison = left.project_name.localeCompare(right.project_name);
    } else if (sortKey === "uploader") {
      comparison = left.uploaded_by_username.localeCompare(right.uploaded_by_username);
    } else if (sortKey === "size_bytes") {
      comparison = left.size_bytes - right.size_bytes;
    } else if (sortKey === "status") {
      comparison = left.status.localeCompare(right.status);
    } else {
      comparison = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const allSelected =
    sortedDocuments.length > 0 && selectedDocumentIds.length === sortedDocuments.length;

  function toggleSort(nextKey: typeof sortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "created_at" ? "desc" : "asc");
  }

  function toggleDocumentSelection(documentId: string, checked: boolean) {
    setSelectedDocumentIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, documentId]));
      }
      return current.filter((id) => id !== documentId);
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedDocumentIds(sortedDocuments.map((document) => document.id));
      return;
    }
    setSelectedDocumentIds([]);
  }

  function mapUploadError(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("File too large")) {
      return "Een of meer bestanden zijn te groot (maximaal 100 MB per bestand).";
    }
    if (message.includes("Unsupported")) {
      return "Een of meer bestandstypen worden niet ondersteund.";
    }
    if (message.includes("Project")) {
      return "Kies een geldig project voor upload.";
    }
    return "Uploaden mislukt. Probeer opnieuw.";
  }

  async function onFilesSelected(files: File[]) {
    if (files.length === 0) {
      return;
    }
    setUploadFeedback(`Uploaden van ${files.length} bestand(en)...`);
    setUploadProgress(0);

    let successCount = 0;
    let processedCount = 0;
    let firstError: string | null = null;

    for (const file of files) {
      try {
        await uploadMutation.mutateAsync({
          file,
          onProgress: (fileProgress) => {
            const overall = Math.round(((processedCount + fileProgress / 100) / files.length) * 100);
            setUploadProgress(overall);
          }
        });
        successCount += 1;
      } catch (error) {
        if (!firstError) {
          firstError = mapUploadError(error);
        }
      } finally {
        processedCount += 1;
        if (processedCount < files.length) {
          setUploadFeedback(
            `Uploaden van ${files.length} bestand(en)... (${processedCount}/${files.length})`
          );
        }
      }
    }

    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["database-documents"] });
      setUploadProgress(100);
      if (firstError) {
        setUploadFeedback(`${successCount} bestand(en) geupload. ${firstError}`);
        setTimeout(() => setUploadProgress(null), 600);
        return;
      }
      setUploadFeedback(`${successCount} bestand(en) geupload naar de database.`);
      setTimeout(() => setUploadProgress(null), 600);
      return;
    }

    setUploadFeedback(firstError ?? "Uploaden mislukt. Probeer opnieuw.");
    setUploadProgress(null);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    void onFilesSelected(files);
  }

  return (
    <section className="panel database-page">
      <h1>Database</h1>
      <div className="database-upload-controls">
        <label>
          Filter project
          <select
            aria-label="Filter project"
            value={filterProjectId}
            onChange={(event) => setFilterProjectId(event.target.value)}
          >
            <option value="all">Alle projecten</option>
            {(projectsQuery.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Upload project
          <select
            aria-label="Upload project"
            value={uploadProjectId}
            onChange={(event) => setUploadProjectId(event.target.value)}
          >
            {(projectsQuery.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label
        className={`database-dropzone ${isDragActive ? "drag-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={onDrop}
      >
        <input
          type="file"
          aria-label="Database bestand uploaden"
          multiple
          onChange={(event) => void onFilesSelected(Array.from(event.target.files ?? []))}
          disabled={uploadMutation.isPending || !uploadProjectId}
        />
        <strong>Sleep bestanden hierheen of klik om te kiezen</strong>
        <span>Ondersteund: PDF, DOCX, XLSX, TXT, Markdown - max 100 MB per bestand</span>
      </label>

      {uploadProgress !== null && (
        <div className="upload-progress-wrap" aria-live="polite">
          <progress value={uploadProgress} max={100} aria-label="Upload voortgang" />
          <span>{uploadProgress}%</span>
        </div>
      )}

      {uploadFeedback && (
        <p
          role="status"
          className={uploadFeedback.includes("mislukt") || uploadFeedback.includes("niet") ? "error" : "success"}
        >
          {uploadFeedback}
        </p>
      )}

      {selectedDocumentIds.length > 0 && (
        <div className="database-bulk-controls">
          <select
            aria-label="Bulkactie"
            value={bulkAction}
            onChange={(event) => setBulkAction(event.target.value as "delete" | "copy" | "move")}
          >
            <option value="move">Verplaats</option>
            <option value="copy">Kopieer</option>
            <option value="delete">Verwijder</option>
          </select>
          {(bulkAction === "move" || bulkAction === "copy") && (
            <select
              aria-label="Doelproject"
              value={bulkTargetProjectId}
              onChange={(event) => setBulkTargetProjectId(event.target.value)}
            >
              {(projectsQuery.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              if (selectedDocumentIds.length === 0) {
                setUploadFeedback("Selecteer eerst een of meer bestanden.");
                return;
              }
              if (
                bulkAction === "delete" &&
                !window.confirm(
                  `Weet u het zeker? ${selectedDocumentIds.length} geselecteerde bestand(en) worden verwijderd.`
                )
              ) {
                return;
              }
              setUploadFeedback(null);
              bulkActionMutation.mutate();
            }}
            disabled={bulkActionMutation.isPending || selectedDocumentIds.length === 0}
          >
            Voer bulkactie uit
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Selecteer alle bestanden"
                  checked={allSelected}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                />
              </th>
              <th aria-label="Type" />
              <th>
                <button type="button" className="table-sort" onClick={() => toggleSort("filename")}>Bestand</button>
              </th>
              <th>
                <button type="button" className="table-sort" onClick={() => toggleSort("project")}>Project</button>
              </th>
              <th>
                <button type="button" className="table-sort" onClick={() => toggleSort("uploader")}>Geupload door</button>
              </th>
              <th>
                <button type="button" className="table-sort" onClick={() => toggleSort("created_at")}>Geupload op</button>
              </th>
              <th>
                <button type="button" className="table-sort" onClick={() => toggleSort("size_bytes")}>Grootte</button>
              </th>
              <th>
                <button type="button" className="table-sort" onClick={() => toggleSort("status")}>Status</button>
              </th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {documentsQuery.isLoading && (
              <tr>
                <td colSpan={9}>Laden...</td>
              </tr>
            )}
            {documentsQuery.isError && (
              <tr>
                <td colSpan={9}>Bestandslijst kon niet geladen worden.</td>
              </tr>
            )}
            {!documentsQuery.isLoading && !documentsQuery.isError && sortedDocuments.length === 0 && (
              <tr>
                <td colSpan={9}>
                  {filterProjectId === "all"
                    ? "Nog geen bestanden gevonden."
                    : "Nog geen bestanden voor dit project."}
                </td>
              </tr>
            )}
            {sortedDocuments.map((document) => (
              <DatabaseDocumentRow
                key={document.id}
                document={document}
                isSelected={selectedDocumentIds.includes(document.id)}
                onSelect={(checked) => toggleDocumentSelection(document.id, checked)}
              />
            ))}
          </tbody>
        </table>
      </div>

    </section>
  );
}

function DatabaseDocumentRow({
  document,
  isSelected,
  onSelect
}: {
  document: DatabaseDocument;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  return (
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label={`Selecteer bestand ${document.filename}`}
          checked={isSelected}
          onChange={(event) => onSelect(event.target.checked)}
        />
      </td>
      <td>
        <span
          className={`filetype-pill filetype-${document.doc_type.toLowerCase()}`}
          aria-label={`Bestandstype ${document.doc_type}`}
        >
          {fileTypeBadge(document.doc_type)}
        </span>
      </td>
      <td>{document.filename}</td>
      <td>{document.project_name}</td>
      <td>{document.uploaded_by_username}</td>
      <td>{formatAmsterdamDateTime(document.created_at)}</td>
      <td>{formatSize(document.size_bytes)}</td>
      <td>{document.status}</td>
      <td>-</td>
    </tr>
  );
}

function fileTypeBadge(docType: string): string {
  const normalized = docType.toLowerCase();
  if (normalized === "pdf") {
    return "PDF";
  }
  if (normalized === "docx") {
    return "DOCX";
  }
  if (normalized === "xlsx") {
    return "XLSX";
  }
  if (normalized === "markdown") {
    return "MD";
  }
  if (normalized === "txt") {
    return "TXT";
  }
  return normalized.toUpperCase();
}

function formatAmsterdamDateTime(value: string): string {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

function formatRelativeAge(value: string, nowMs: number = Date.now()): string {
  const timestampMs = new Date(value).getTime();
  if (Number.isNaN(timestampMs)) {
    return "onbekend";
  }
  const ageSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (ageSeconds < 60) {
    return `${ageSeconds} sec geleden`;
  }
  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) {
    return `${ageMinutes} min geleden`;
  }
  const ageHours = Math.floor(ageMinutes / 60);
  return `${ageHours} uur geleden`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function toDatetimeLocalInputValue(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return formatter.format(date).replace(" ", "T");
}

function extractApiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "";
  }
  const raw = error.message?.trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim().length > 0) {
      return parsed.detail.trim();
    }
  } catch {
    return raw;
  }
  return raw;
}

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  const kb = sizeBytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
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

function AdminSchedulerPage({ currentUser }: { currentUser: CurrentUser | undefined }) {
  const schedulerQuery = useQuery({
    queryKey: ["scheduler-overview"],
    queryFn: getSchedulerOverview,
    enabled: currentUser?.is_admin === true,
    refetchInterval: 30000
  });

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!currentUser?.is_admin) {
    return (
      <section className="panel">
        <h1>Scheduler</h1>
        <p>Je hebt geen toegang tot deze pagina.</p>
      </section>
    );
  }

  if (schedulerQuery.isLoading) {
    return (
      <section className="panel">
        <h1>Scheduler</h1>
        <p>Laden...</p>
      </section>
    );
  }

  if (schedulerQuery.isError || !schedulerQuery.data) {
    return (
      <section className="panel">
        <h1>Scheduler</h1>
        <p>Scheduler-overzicht kon niet worden geladen.</p>
      </section>
    );
  }

  const data: SchedulerOverview = schedulerQuery.data;
  const refreshAgeLabel = formatRelativeAge(data.generated_at, nowMs);

  return (
    <section className="panel scheduler-page">
      <h1>Scheduler</h1>
      <p className="muted">
        Laatste update: {formatAmsterdamDateTime(data.generated_at)} ({refreshAgeLabel})
      </p>
      <p className="muted">Ververs automatisch elke 30 sec.</p>

      <section className="scheduler-grid">
        <article className="panel">
          <h2>Recent gedraaid</h2>
          {data.recent_runs.length === 0 ? (
            <p className="muted">Nog geen scheduler-runs gevonden.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Taak</th>
                    <th>Status</th>
                    <th>Gepland voor</th>
                    <th>Laatst bijgewerkt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_runs.map((run) => (
                    <tr key={run.schedule_id}>
                      <td>{run.topic_subject}</td>
                      <td>
                        <span className={`status-pill status-${schedulerStatusTone(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td>{formatAmsterdamDateTime(run.scheduled_for)}</td>
                      <td>{formatAmsterdamDateTime(run.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel">
          <h2>Komende planning</h2>
          {data.upcoming_runs.length === 0 ? (
            <p className="muted">Er staan geen taken gepland.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Taak</th>
                    <th>Status</th>
                    <th>Volgende run</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming_runs.map((run) => (
                    <tr key={run.schedule_id}>
                      <td>{run.topic_subject}</td>
                      <td>
                        <span className={`status-pill status-${schedulerStatusTone(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td>{formatAmsterdamDateTime(run.scheduled_for)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <article className="panel">
        <h2>Retry-queue</h2>
        {data.retry_jobs.length === 0 ? (
          <p className="muted">Geen retrytaken in de queue.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Taak</th>
                  <th>Flow</th>
                  <th>Status</th>
                  <th>Poging</th>
                  <th>Volgende run</th>
                  <th>Laatste fout</th>
                </tr>
              </thead>
              <tbody>
                {data.retry_jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.topic_subject}</td>
                    <td>{job.flow_name}</td>
                    <td>
                      <span className={`status-pill status-${schedulerStatusTone(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td>
                      {job.attempt}/{job.max_attempts}
                    </td>
                    <td>{formatAmsterdamDateTime(job.next_run_at)}</td>
                    <td>{job.error_message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

function LogPage() {
  const [eventTypeDraft, setEventTypeDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<"" | "success" | "error">("");
  const [topicDraft, setTopicDraft] = useState("");
  const [periodDraft, setPeriodDraft] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [filters, setFilters] = useState<{
    eventType: string;
    status: "" | "success" | "error";
    topic: string;
    period: "24h" | "7d" | "30d" | "all";
  }>({ eventType: "", status: "", topic: "", period: "7d" });

  const activityQuery = useQuery({
    queryKey: ["activity-feed", "log", filters.eventType, filters.topic, filters.period],
    queryFn: () =>
      listActivityFeed({
        event_type: filters.eventType || undefined,
        topic: filters.topic || undefined,
        period: filters.period,
        limit: 120
      }),
    refetchInterval: 30000
  });

  const notificationQuery = useQuery({
    queryKey: ["notification-feed", "log", filters.eventType, filters.status, filters.topic, filters.period],
    queryFn: () =>
      listNotificationFeed({
        event_type: filters.eventType || undefined,
        status: filters.status || undefined,
        topic: filters.topic || undefined,
        period: filters.period,
        limit: 120
      }),
    refetchInterval: 30000
  });

  const knownEventTypes = useMemo(() => {
    const seen = new Set(LOG_EVENT_TYPE_OPTIONS.map((option) => option.value));
    const dynamic = (activityQuery.data ?? [])
      .map((item) => item.event_type)
      .filter((value) => {
        if (seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      })
      .sort((left, right) => left.localeCompare(right));

    return [
      ...LOG_EVENT_TYPE_OPTIONS,
      ...dynamic.map((value) => ({ value, label: activityEventLabel(value) }))
    ];
  }, [activityQuery.data]);

  return (
    <section className="panel log-page">
      <h1>Log</h1>
      <p className="muted">
        Bekijk recente systeemacties en filter op onderwerp, actietype en periode.
      </p>

      <form
        className="log-filter-form"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({
            eventType: eventTypeDraft,
            status: statusDraft,
            topic: topicDraft.trim(),
            period: periodDraft
          });
        }}
      >
        <label>
          Actie
          <select value={eventTypeDraft} onChange={(event) => setEventTypeDraft(event.target.value)}>
            {knownEventTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={statusDraft}
            onChange={(event) => setStatusDraft(event.target.value as "" | "success" | "error")}
          >
            <option value="">Alle statussen</option>
            <option value="success">Succes</option>
            <option value="error">Fout</option>
          </select>
        </label>
        <label>
          Onderwerp
          <input
            value={topicDraft}
            onChange={(event) => setTopicDraft(event.target.value)}
            placeholder="Zoek op onderwerp"
          />
        </label>
        <label>
          Periode
          <select
            value={periodDraft}
            onChange={(event) => setPeriodDraft(event.target.value as "24h" | "7d" | "30d" | "all")}
          >
            <option value="24h">Afgelopen 24 uur</option>
            <option value="7d">Afgelopen 7 dagen</option>
            <option value="30d">Afgelopen 30 dagen</option>
            <option value="all">Alles</option>
          </select>
        </label>
        <div className="log-filter-actions">
          <button type="submit">Filter toepassen</button>
          <button
            type="button"
            onClick={() => {
              setEventTypeDraft("");
              setStatusDraft("");
              setTopicDraft("");
              setPeriodDraft("7d");
              setFilters({ eventType: "", status: "", topic: "", period: "7d" });
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {activityQuery.isLoading && <p className="muted">Logregels laden...</p>}
      {activityQuery.isError && <p className="error">Logregels konden niet worden geladen.</p>}

      <h2>Notificatiemeldingen</h2>
      <p className="muted">Meldingen die naar n8n worden gepusht (succes/fout).</p>
      {notificationQuery.isLoading && <p className="muted">Meldingen laden...</p>}
      {notificationQuery.isError && <p className="error">Meldingen konden niet worden geladen.</p>}

      {!notificationQuery.isLoading && !notificationQuery.isError && (notificationQuery.data ?? []).length === 0 && (
        <p className="muted">Geen meldingen gevonden voor deze filters.</p>
      )}

      {!notificationQuery.isLoading && !notificationQuery.isError && (notificationQuery.data ?? []).length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tijd</th>
                <th>Status</th>
                <th>Event</th>
                <th>Onderwerp</th>
                <th>Melding</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {(notificationQuery.data ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{formatAmsterdamDateTime(item.created_at)}</td>
                  <td>
                    <span className={`notification-pill notification-${item.status}`}>
                      {item.status === "success" ? "Succes" : "Fout"}
                    </span>
                  </td>
                  <td>{notificationEventLabel(item.event_type)}</td>
                  <td title={item.topic_subject ?? undefined}>{item.topic_subject || "-"}</td>
                  <td>{item.message}</td>
                  <td>{item.delivered_at ? "Afgeleverd" : `Nog niet (${item.delivery_attempts} pogingen)`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!activityQuery.isLoading && !activityQuery.isError && (activityQuery.data ?? []).length === 0 && (
        <p className="muted">Geen logregels gevonden voor deze filters.</p>
      )}

      {!activityQuery.isLoading && !activityQuery.isError && (activityQuery.data ?? []).length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tijd</th>
                <th>Gebruiker</th>
                <th>Actie</th>
                <th>Onderwerp</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {(activityQuery.data ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{formatAmsterdamDateTime(item.created_at)}</td>
                  <td>{item.actor_username}</td>
                  <td>{activityEventLabel(item.event_type)}</td>
                  <td title={item.topic_subject ?? undefined}>{item.topic_subject || "-"}</td>
                  <td>{activityDetailsLabel(item.details_json)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const LOG_EVENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Alle acties" },
  { value: "topic.created", label: "Onderwerp aangemaakt" },
  { value: "topic.updated", label: "Onderwerp bijgewerkt" },
  { value: "content.generated", label: "Content gegenereerd" },
  { value: "content.regenerated", label: "Content opnieuw gegenereerd" },
  { value: "content.approved", label: "Onderwerp op akkoord" },
  { value: "content.scheduled", label: "Publicatie ingepland" },
  { value: "content.variant.updated", label: "Kanaalvariant bijgewerkt" },
  { value: "content.variant.approved", label: "Kanaalvariant goedgekeurd" },
  { value: "content.variant.rejected", label: "Kanaalvariant afgekeurd" },
  { value: "database.document.uploaded", label: "Databasebestand geupload" }
];

function notificationEventLabel(eventType: string): string {
  const mapping: Record<string, string> = {
    "content.publication": "Publicatie",
    "content.generation": "Generatie"
  };
  if (mapping[eventType]) {
    return mapping[eventType];
  }
  return eventType.replaceAll(".", " / ");
}

function activityEventLabel(eventType: string): string {
  const mapping: Record<string, string> = {
    "topic.created": "Onderwerp aangemaakt",
    "topic.updated": "Onderwerp bijgewerkt",
    "topic.deleted": "Onderwerp verwijderd",
    "topic.document.uploaded": "Topicbron geupload",
    "content.generated": "Content gegenereerd",
    "content.regenerated": "Content opnieuw gegenereerd",
    "content.manual_edited": "Content handmatig bijgewerkt",
    "content.approved": "Onderwerp op akkoord",
    "content.rejected": "Onderwerp afgekeurd",
    "content.scheduled": "Publicatie ingepland",
    "content.variant.updated": "Kanaalvariant bijgewerkt",
    "content.variant.approved": "Kanaalvariant goedgekeurd",
    "content.variant.rejected": "Kanaalvariant afgekeurd",
    "database.document.uploaded": "Databasebestand geupload",
    "database.document.deleted": "Databasebestand verwijderd",
    "database.document.bulk_deleted": "Databasebestanden bulk verwijderd",
    "database.document.bulk_moved": "Databasebestanden verplaatst",
    "database.document.bulk_copied": "Databasebestanden gekopieerd",
    "retry.requeued": "Retryjob opnieuw in wachtrij"
  };
  if (mapping[eventType]) {
    return mapping[eventType];
  }
  return eventType.replaceAll(".", " / ");
}

function activityDetailsLabel(detailsJson: string): string {
  const trimmed = detailsJson.trim();
  if (!trimmed || trimmed === "{}") {
    return "-";
  }
  try {
    const parsed = JSON.parse(trimmed) as { channels?: unknown; channel?: unknown };
    if (Array.isArray(parsed.channels) && parsed.channels.length > 0) {
      return `Kanalen: ${parsed.channels.join(", ")}`;
    }
    if (typeof parsed.channel === "string" && parsed.channel.trim()) {
      return `Kanaal: ${parsed.channel.trim()}`;
    }
  } catch {
    return trimmed;
  }
  return "-";
}

function AdminPage({ currentUser }: { currentUser: CurrentUser | undefined }) {
  type AdminTab = "users" | "projects" | "themes" | "ai" | "scheduler" | "activity";

  const queryClient = useQueryClient();
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>("users");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [passwordEditorUserId, setPasswordEditorUserId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newThemeName, setNewThemeName] = useState("");
  const [genAIApiKey, setGenAIApiKey] = useState("");
  const [genAIForm, setGenAIForm] = useState<{
    system_prompt: string;
    website_prompt: string;
    facebook_prompt: string;
    newsletter_prompt: string;
    text_model: string;
    image_model: string;
    websearch_enabled: boolean;
    websearch_max_results: number;
  } | null>(null);
  const [projectDrafts, setProjectDrafts] = useState<Record<string, string>>({});
  const [themeDrafts, setThemeDrafts] = useState<Record<string, string>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<
    Record<string, { password: string; confirm: string }>
  >({});

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
    enabled: currentUser?.is_admin === true
  });

  const projectsQuery = useQuery({
    queryKey: ["admin-projects"],
    queryFn: listAdminProjects,
    enabled: currentUser?.is_admin === true
  });

  const themesQuery = useQuery({
    queryKey: ["admin-themes"],
    queryFn: listAdminThemes,
    enabled: currentUser?.is_admin === true
  });

  const adminActivityQuery = useQuery({
    queryKey: ["admin-activity"],
    queryFn: listAdminActivity,
    enabled: currentUser?.is_admin === true,
    refetchInterval: 30000
  });

  const schedulerQuery = useQuery({
    queryKey: ["scheduler-overview"],
    queryFn: getSchedulerOverview,
    enabled: currentUser?.is_admin === true,
    refetchInterval: 30000
  });

  const adminUiSettingsQuery = useQuery({
    queryKey: ["admin-ui-settings"],
    queryFn: getAdminUiSettings,
    enabled: currentUser?.is_admin === true
  });

  const genAIConfigQuery = useQuery({
    queryKey: ["admin-genai-config"],
    queryFn: getAdminGenAIConfig,
    enabled: currentUser?.is_admin === true
  });

  const modelOptionsQuery = useQuery({
    queryKey: ["admin-genai-model-options"],
    queryFn: getAdminGenAIModelOptions,
    enabled: currentUser?.is_admin === true
  });

  const modelOptions: GenAIModelOptions = modelOptionsQuery.data ?? {
    text_models: [],
    image_models: []
  };
  const textModelOptions = modelOptions.text_models;
  const imageModelOptions = modelOptions.image_models;

  useEffect(() => {
    if (!genAIConfigQuery.data) {
      return;
    }
    setGenAIForm({
      system_prompt: genAIConfigQuery.data.system_prompt,
      website_prompt: genAIConfigQuery.data.website_prompt,
      facebook_prompt: genAIConfigQuery.data.facebook_prompt,
      newsletter_prompt: genAIConfigQuery.data.newsletter_prompt,
      text_model: genAIConfigQuery.data.text_model,
      image_model: genAIConfigQuery.data.image_model,
      websearch_enabled: genAIConfigQuery.data.websearch_enabled,
      websearch_max_results: genAIConfigQuery.data.websearch_max_results
    });
    setGenAIApiKey("");
  }, [genAIConfigQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      updateAdminUser(userId, isAdmin),
    onSuccess: (updated) => {
      queryClient.setQueryData<AdminUser[] | undefined>(["admin-users"], (existing) => {
        if (!existing) {
          return existing;
        }
        return existing.map((user) =>
          user.id === updated.id ? { ...user, is_admin: updated.is_admin } : user
        );
      });
      setFeedback("Adminrechten bijgewerkt.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("last admin")) {
        setFeedback("Dit is de laatste admin en kan niet worden gedegradeerd.");
        return;
      }
      setFeedback("Bijwerken van adminrechten is mislukt.");
    }
  });

  const activeMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateAdminUserActive(userId, isActive),
    onSuccess: (updated) => {
      queryClient.setQueryData<AdminUser[] | undefined>(["admin-users"], (existing) => {
        if (!existing) {
          return existing;
        }
        return existing.map((user) =>
          user.id === updated.id ? { ...user, is_active: updated.is_active } : user
        );
      });
      setFeedback("Gebruikersstatus bijgewerkt.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("last admin")) {
        setFeedback("De laatste admin kan niet worden gedeactiveerd.");
        return;
      }
      setFeedback("Gebruiker status wijzigen is mislukt.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteAdminUser(userId),
    onSuccess: (_, deletedUserId) => {
      queryClient.setQueryData<AdminUser[] | undefined>(["admin-users"], (existing) =>
        existing ? existing.filter((user) => user.id !== deletedUserId) : existing
      );
      setPasswordEditorUserId((current) => (current === deletedUserId ? null : current));
      setFeedback("Gebruiker verwijderd.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("last admin")) {
        setFeedback("De laatste admin kan niet worden verwijderd.");
        return;
      }
      if (message.includes("cannot delete themselves")) {
        setFeedback("Je kunt jezelf niet verwijderen.");
        return;
      }
      setFeedback("Gebruiker verwijderen is mislukt.");
    }
  });

  const createMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      createAdminUser(username, password),
    onSuccess: (created) => {
      queryClient.setQueryData<AdminUser[] | undefined>(["admin-users"], (existing) => {
        if (!existing) {
          return [created];
        }
        return [...existing, created].sort((a, b) => a.username.localeCompare(b.username));
      });
      setNewUsername("");
      setNewPassword("");
      setFeedback("Nieuwe gebruiker toegevoegd.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("already exists")) {
        setFeedback("Gebruikersnaam bestaat al.");
        return;
      }
      if (message.includes("422")) {
        setFeedback("Gebruikersnaam of wachtwoord is ongeldig.");
        return;
      }
      setFeedback("Nieuwe gebruiker toevoegen is mislukt.");
    }
  });

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => createAdminProject(name),
    onSuccess: (created) => {
      queryClient.setQueryData(["admin-projects"], (existing: Project[] | undefined) => {
        if (!existing) {
          return [created];
        }
        return [...existing, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      setNewProjectName("");
      setFeedback("Project toegevoegd.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("already exists")) {
        setFeedback("Projectnaam bestaat al.");
        return;
      }
      setFeedback("Project toevoegen is mislukt.");
    }
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: { name?: string; is_active?: boolean } }) =>
      updateAdminProject(projectId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin-projects"], (existing: Project[] | undefined) => {
        if (!existing) {
          return existing;
        }
        return existing
          .map((project) => (project.id === updated.id ? updated : project))
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      setFeedback("Project bijgewerkt.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("already exists")) {
        setFeedback("Projectnaam bestaat al.");
        return;
      }
      setFeedback("Project bijwerken is mislukt.");
    }
  });

  const createThemeMutation = useMutation({
    mutationFn: (name: string) => createAdminTheme(name),
    onSuccess: (created) => {
      queryClient.setQueryData(["admin-themes"], (existing: AdminTheme[] | undefined) => {
        if (!existing) {
          return [created];
        }
        return [...existing, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      setNewThemeName("");
      setFeedback("Thema toegevoegd.");
      queryClient.invalidateQueries({ queryKey: ["topic-themes"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("already exists")) {
        setFeedback("Themanaam bestaat al.");
        return;
      }
      setFeedback("Thema toevoegen is mislukt.");
    }
  });

  const updateThemeMutation = useMutation({
    mutationFn: ({ themeId, payload }: { themeId: string; payload: { name?: string; is_active?: boolean } }) =>
      updateAdminTheme(themeId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin-themes"], (existing: AdminTheme[] | undefined) => {
        if (!existing) {
          return existing;
        }
        return existing
          .map((theme) => (theme.id === updated.id ? updated : theme))
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      setFeedback("Thema bijgewerkt.");
      queryClient.invalidateQueries({ queryKey: ["topic-themes"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("already exists")) {
        setFeedback("Themanaam bestaat al.");
        return;
      }
      setFeedback("Thema bijwerken is mislukt.");
    }
  });

  const updateGenAIMutation = useMutation({
    mutationFn: (payload: {
      system_prompt: string;
      website_prompt: string;
      facebook_prompt: string;
      newsletter_prompt: string;
      text_model: string;
      image_model: string;
      websearch_enabled: boolean;
      websearch_max_results: number;
      openai_api_key?: string;
    }) => updateAdminGenAIConfig(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<GenAIConfig | undefined>(["admin-genai-config"], updated);
      setGenAIApiKey("");
      setFeedback("GenAI-config opgeslagen.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("422")) {
        setFeedback("GenAI-config bevat ongeldige waarden.");
        return;
      }
      setFeedback("GenAI-config opslaan is mislukt.");
    }
  });

  const updateUiSettingsMutation = useMutation({
    mutationFn: (payload: UiSettings) => updateAdminUiSettings(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<UiSettings | undefined>(["admin-ui-settings"], updated);
      queryClient.setQueryData<UiSettings | undefined>(["ui-settings"], updated);
      setFeedback(updated.wind_theme_enabled ? "Wind-thema ingeschakeld." : "Wind-thema uitgeschakeld.");
    },
    onError: () => {
      setFeedback("Wind-thema bijwerken is mislukt.");
    }
  });

  const passwordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      changeAdminUserPassword(userId, password),
    onSuccess: (_, variables) => {
      setPasswordDrafts((current) => ({
        ...current,
        [variables.userId]: { password: "", confirm: "" }
      }));
      setPasswordEditorUserId(null);
      setFeedback("Wachtwoord bijgewerkt.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("422")) {
        setFeedback("Wachtwoord moet minimaal 4 tekens bevatten.");
        return;
      }
      setFeedback("Wachtwoord wijzigen is mislukt.");
    }
  });

  function updatePasswordDraft(userId: string, field: "password" | "confirm", value: string) {
    setPasswordDrafts((current) => {
      const existing = current[userId] ?? { password: "", confirm: "" };
      return {
        ...current,
        [userId]: {
          ...existing,
          [field]: value
        }
      };
    });
  }

  function updateProjectDraft(projectId: string, value: string) {
    setProjectDrafts((current) => ({
      ...current,
      [projectId]: value
    }));
  }

  function updateThemeDraft(themeId: string, value: string) {
    setThemeDrafts((current) => ({
      ...current,
      [themeId]: value
    }));
  }

  function updateGenAIField<K extends keyof NonNullable<typeof genAIForm>>(
    field: K,
    value: NonNullable<typeof genAIForm>[K]
  ) {
    setGenAIForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [field]: value
      };
    });
  }

  if (!currentUser?.is_admin) {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p>Je hebt geen toegang tot deze pagina.</p>
      </section>
    );
  }

  if (
    usersQuery.isLoading ||
    projectsQuery.isLoading ||
    themesQuery.isLoading ||
    genAIConfigQuery.isLoading ||
    adminUiSettingsQuery.isLoading
  ) {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p>Laden...</p>
      </section>
    );
  }

  if (
    usersQuery.isError ||
    projectsQuery.isError ||
    themesQuery.isError ||
    genAIConfigQuery.isError ||
    adminUiSettingsQuery.isError
  ) {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p>Gebruikers konden niet worden geladen.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Admin</h1>
      <div className="admin-tab-row" role="tablist" aria-label="Admin onderdelen">
        <button type="button" role="tab" aria-selected={activeAdminTab === "users"} onClick={() => setActiveAdminTab("users")}>Gebruikers</button>
        <button type="button" role="tab" aria-selected={activeAdminTab === "projects"} onClick={() => setActiveAdminTab("projects")}>Projecten</button>
        <button type="button" role="tab" aria-selected={activeAdminTab === "themes"} onClick={() => setActiveAdminTab("themes")}>Thema&apos;s</button>
        <button type="button" role="tab" aria-selected={activeAdminTab === "ai"} onClick={() => setActiveAdminTab("ai")}>AI</button>
        <button type="button" role="tab" aria-selected={activeAdminTab === "scheduler"} onClick={() => setActiveAdminTab("scheduler")}>Scheduler</button>
        <button type="button" role="tab" aria-selected={activeAdminTab === "activity"} onClick={() => setActiveAdminTab("activity")}>Admin log</button>
      </div>
      {feedback && (
        <p
          role="status"
          className={
            feedback.includes("mislukt") ||
            feedback.includes("laatste") ||
            feedback.includes("niet") ||
            feedback.includes("bestaat")
              ? "error"
              : "success"
          }
        >
          {feedback}
        </p>
      )}

      <div hidden={activeAdminTab !== "users"}>
      <p className="muted">Geef gebruikers adminrechten of haal ze weer weg.</p>
      <form
        className="admin-create-user"
        onSubmit={(event) => {
          event.preventDefault();
          setFeedback(null);
          createMutation.mutate({
            username: newUsername.trim(),
            password: newPassword
          });
        }}
      >
        <input
          type="text"
          value={newUsername}
          onChange={(event) => setNewUsername(event.target.value)}
          placeholder="Nieuwe gebruikersnaam"
          aria-label="Nieuwe gebruikersnaam"
          minLength={3}
          maxLength={80}
          required
        />
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Tijdelijk wachtwoord"
          aria-label="Tijdelijk wachtwoord"
          minLength={4}
          maxLength={128}
          required
        />
        <button
          type="submit"
          disabled={createMutation.isPending || newUsername.trim().length < 3 || newPassword.length < 4}
        >
          Gebruiker toevoegen
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gebruiker</th>
              <th>Naam</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Rol</th>
              <th>Rolbeheer</th>
              <th>Account</th>
              <th>Wachtwoord</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data ?? []).map((user) => {
              const nextIsAdmin = !user.is_admin;
              const nextIsActive = !user.is_active;
              const draft = passwordDrafts[user.id] ?? { password: "", confirm: "" };
              const isPasswordEditorOpen = passwordEditorUserId === user.id;
              return (
                <Fragment key={user.id}>
                  <tr>
                    <td>{user.username}</td>
                    <td>{user.full_name ?? "-"}</td>
                    <td>{user.email ?? "-"}</td>
                    <td>{user.is_active ? "actief" : "disabled"}</td>
                    <td>{user.is_admin ? "admin" : "user"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(null);
                          updateMutation.mutate({ userId: user.id, isAdmin: nextIsAdmin });
                        }}
                        disabled={updateMutation.isPending}
                      >
                        {user.is_admin ? "Verwijder admin" : "Maak admin"}
                      </button>
                    </td>
                    <td>
                      <div className="admin-account-actions">
                        <button
                          type="button"
                          aria-label={`${user.is_active ? "Disable" : "Enable"} gebruiker ${user.username}`}
                          onClick={() => {
                            setFeedback(null);
                            activeMutation.mutate({
                              userId: user.id,
                              isActive: nextIsActive
                            });
                          }}
                          disabled={activeMutation.isPending || deleteMutation.isPending}
                        >
                          {user.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Verwijder gebruiker ${user.username}`}
                          onClick={() => {
                            setFeedback(null);
                            const confirmed = window.confirm(
                              "Wilt u deze gebruiker echt verwijderen?"
                            );
                            if (!confirmed) {
                              return;
                            }
                            deleteMutation.mutate(user.id);
                          }}
                          disabled={deleteMutation.isPending || activeMutation.isPending}
                        >
                          Verwijder
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-expanded={isPasswordEditorOpen}
                        aria-label={`Reset wachtwoord voor ${user.username}`}
                        onClick={() => {
                          setFeedback(null);
                          setPasswordEditorUserId((current) =>
                            current === user.id ? null : user.id
                          );
                        }}
                      >
                        {isPasswordEditorOpen ? "Verberg" : "Reset wachtwoord"}
                      </button>
                    </td>
                  </tr>
                  {isPasswordEditorOpen && (
                    <tr className="admin-password-row">
                      <td colSpan={8}>
                        <div className="admin-password-editor">
                          <input
                            type="password"
                            value={draft.password}
                            onChange={(e) =>
                              updatePasswordDraft(user.id, "password", e.target.value)
                            }
                            minLength={4}
                            placeholder="Nieuw wachtwoord"
                            aria-label={`Nieuw wachtwoord voor ${user.username}`}
                          />
                          <input
                            type="password"
                            value={draft.confirm}
                            onChange={(e) =>
                              updatePasswordDraft(user.id, "confirm", e.target.value)
                            }
                            minLength={4}
                            placeholder="Bevestig"
                            aria-label={`Bevestig wachtwoord voor ${user.username}`}
                          />
                          <div className="admin-password-actions">
                            <button
                              type="button"
                              aria-label={`Wijzig wachtwoord voor ${user.username}`}
                              onClick={() => {
                                setFeedback(null);
                                if (draft.password !== draft.confirm) {
                                  setFeedback("Wachtwoorden komen niet overeen.");
                                  return;
                                }
                                passwordMutation.mutate({
                                  userId: user.id,
                                  password: draft.password
                                });
                              }}
                              disabled={
                                passwordMutation.isPending ||
                                draft.password.length < 4 ||
                                draft.confirm.length < 4
                              }
                            >
                              Wijzig wachtwoord
                            </button>
                            <button
                              type="button"
                              onClick={() => setPasswordEditorUserId(null)}
                              disabled={passwordMutation.isPending}
                            >
                              Annuleer
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      <div hidden={activeAdminTab !== "projects"}>
      <h2>Projecten</h2>
      <p className="muted">Beheer hier de projecten waaraan databasebestanden gekoppeld worden.</p>
      <form
        className="admin-create-user"
        onSubmit={(event) => {
          event.preventDefault();
          setFeedback(null);
          createProjectMutation.mutate(newProjectName.trim());
        }}
      >
        <input
          type="text"
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          placeholder="Nieuw project"
          aria-label="Nieuw project"
          minLength={2}
          maxLength={120}
          required
        />
        <span />
        <button
          type="submit"
          disabled={createProjectMutation.isPending || newProjectName.trim().length < 2}
        >
          Project toevoegen
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Bewerken</th>
            </tr>
          </thead>
          <tbody>
            {(projectsQuery.data ?? []).map((project) => {
              const draftName = projectDrafts[project.id] ?? project.name;
              return (
                <tr key={project.id}>
                  <td>
                    <input
                      type="text"
                      value={draftName}
                      aria-label={`Projectnaam ${project.name}`}
                      onChange={(event) => updateProjectDraft(project.id, event.target.value)}
                    />
                  </td>
                  <td>{project.is_active ? "actief" : "inactief"}</td>
                  <td>
                    <div className="admin-account-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(null);
                          updateProjectMutation.mutate({
                            projectId: project.id,
                            payload: { name: draftName.trim() }
                          });
                        }}
                        disabled={updateProjectMutation.isPending || draftName.trim().length < 2}
                      >
                        Naam opslaan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(null);
                          updateProjectMutation.mutate({
                            projectId: project.id,
                            payload: { is_active: !project.is_active }
                          });
                        }}
                        disabled={updateProjectMutation.isPending}
                      >
                        {project.is_active ? "Deactiveer" : "Activeer"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      <div hidden={activeAdminTab !== "themes"}>
        <h2>Thema&apos;s</h2>
        <p className="muted">Beheer hier de themalijst die gebruikt wordt in Planning en AI-context.</p>
        <article className="panel">
          <h3>Wind-thema</h3>
          <p className="muted">Zet subtiele windturbine-accenten in de interface centraal aan of uit.</p>
          <label className="admin-checkbox-field">
            <input
              type="checkbox"
              aria-label="Wind-thema actief"
              checked={adminUiSettingsQuery.data?.wind_theme_enabled ?? true}
              onChange={(event) => {
                setFeedback(null);
                updateUiSettingsMutation.mutate({ wind_theme_enabled: event.target.checked });
              }}
              disabled={updateUiSettingsMutation.isPending}
            />
            Windthema actief
          </label>
        </article>
        <form
          className="admin-create-user"
          onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            createThemeMutation.mutate(newThemeName.trim());
          }}
        >
          <input
            type="text"
            value={newThemeName}
            onChange={(event) => setNewThemeName(event.target.value)}
            placeholder="Nieuw thema"
            aria-label="Nieuw thema"
            minLength={2}
            maxLength={120}
            required
          />
          <span />
          <button
            type="submit"
            disabled={createThemeMutation.isPending || newThemeName.trim().length < 2}
          >
            Thema toevoegen
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thema</th>
                <th>Status</th>
                <th>Bewerken</th>
              </tr>
            </thead>
            <tbody>
              {(themesQuery.data ?? []).map((theme) => {
                const draftName = themeDrafts[theme.id] ?? theme.name;
                return (
                  <tr key={theme.id}>
                    <td>
                      <input
                        type="text"
                        value={draftName}
                        aria-label={`Themanaam ${theme.name}`}
                        onChange={(event) => updateThemeDraft(theme.id, event.target.value)}
                      />
                    </td>
                    <td>{theme.is_active ? "actief" : "inactief"}</td>
                    <td>
                      <div className="admin-account-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setFeedback(null);
                            updateThemeMutation.mutate({
                              themeId: theme.id,
                              payload: { name: draftName.trim() }
                            });
                          }}
                          disabled={updateThemeMutation.isPending || draftName.trim().length < 2}
                        >
                          Naam opslaan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFeedback(null);
                            updateThemeMutation.mutate({
                              themeId: theme.id,
                              payload: { is_active: !theme.is_active }
                            });
                          }}
                          disabled={updateThemeMutation.isPending}
                        >
                          {theme.is_active ? "Deactiveer" : "Activeer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div hidden={activeAdminTab !== "ai"}>
      <h2>GenAI configuratie</h2>
      <p className="muted">Compact beheer van prompts, modellen en websearch.</p>
      {genAIForm && (
        <form
          className="admin-genai-form"
          onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            updateGenAIMutation.mutate({
              ...genAIForm,
              ...(genAIApiKey.trim() ? { openai_api_key: genAIApiKey.trim() } : {})
            });
          }}
        >
          <label className="admin-genai-span-2">
            Systeemprompt
            <textarea
              value={genAIForm.system_prompt}
              onChange={(event) => updateGenAIField("system_prompt", event.target.value)}
              rows={10}
              required
            />
          </label>
          <label>
            Website prompt
            <input
              type="text"
              value={genAIForm.website_prompt}
              onChange={(event) => updateGenAIField("website_prompt", event.target.value)}
              minLength={5}
              required
            />
          </label>
          <label>
            Facebook prompt
            <input
              type="text"
              value={genAIForm.facebook_prompt}
              onChange={(event) => updateGenAIField("facebook_prompt", event.target.value)}
              minLength={5}
              required
            />
          </label>
          <label>
            Nieuwsbrief prompt
            <input
              type="text"
              value={genAIForm.newsletter_prompt}
              onChange={(event) => updateGenAIField("newsletter_prompt", event.target.value)}
              minLength={5}
              required
            />
          </label>
          <label>
            Tekstmodel
            <select
              value={genAIForm.text_model}
              onChange={(event) => updateGenAIField("text_model", event.target.value)}
            >
              {!textModelOptions.includes(genAIForm.text_model) && (
                <option value={genAIForm.text_model}>{genAIForm.text_model}</option>
              )}
              {textModelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <label>
            Afbeeldingsmodel
            <select
              value={genAIForm.image_model}
              onChange={(event) => updateGenAIField("image_model", event.target.value)}
            >
              {!imageModelOptions.includes(genAIForm.image_model) && (
                <option value={genAIForm.image_model}>{genAIForm.image_model}</option>
              )}
              {imageModelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <label>
            OpenAI API key {genAIConfigQuery.data?.has_api_key ? "(ingesteld)" : "(niet ingesteld)"}
            <input
              type="password"
              value={genAIApiKey}
              onChange={(event) => setGenAIApiKey(event.target.value)}
              placeholder="Leeg laten om bestaande key te behouden"
            />
          </label>
          <label className="admin-checkbox-field">
            <input
              type="checkbox"
              checked={genAIForm.websearch_enabled}
              onChange={(event) =>
                updateGenAIField("websearch_enabled", event.target.checked)
              }
            />
            Websearch inschakelen (standaard uit)
          </label>
          <label>
            Max websearch resultaten
            <input
              type="number"
              min={1}
              max={10}
              value={genAIForm.websearch_max_results}
              onChange={(event) =>
                updateGenAIField(
                  "websearch_max_results",
                  Math.max(1, Math.min(10, Number(event.target.value) || 1))
                )
              }
              required
            />
          </label>
          <div className="admin-account-actions">
            <button
              type="submit"
              disabled={
                updateGenAIMutation.isPending ||
                genAIForm.system_prompt.trim().length < 10 ||
                genAIForm.website_prompt.trim().length < 5 ||
                genAIForm.facebook_prompt.trim().length < 5 ||
                genAIForm.newsletter_prompt.trim().length < 5
              }
            >
              GenAI-config opslaan
            </button>
          </div>
        </form>
      )}
      </div>

      <div hidden={activeAdminTab !== "scheduler"}>
        <h2>Scheduler</h2>
        {schedulerQuery.isLoading && <p>Laden...</p>}
        {schedulerQuery.isError && <p className="error">Scheduler-overzicht kon niet worden geladen.</p>}
        {schedulerQuery.data && (
          <div className="scheduler-grid">
            <article className="panel">
              <h3>Recent gedraaid</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Taak</th>
                      <th>Status</th>
                      <th>Gepland voor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedulerQuery.data.recent_runs.slice(0, 8).map((run) => (
                      <tr key={run.schedule_id}>
                        <td>{run.topic_subject}</td>
                        <td>{run.status}</td>
                        <td>{formatAmsterdamDateTime(run.scheduled_for)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="panel">
              <h3>Komende planning</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Taak</th>
                      <th>Status</th>
                      <th>Volgende run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedulerQuery.data.upcoming_runs.slice(0, 8).map((run) => (
                      <tr key={run.schedule_id}>
                        <td>{run.topic_subject}</td>
                        <td>{run.status}</td>
                        <td>{formatAmsterdamDateTime(run.scheduled_for)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        )}
      </div>

      <div hidden={activeAdminTab !== "activity"}>
        <h2>Admin log</h2>
        <p className="muted">Recente beheeracties en systeemevents (automatisch elke 30 sec ververst).</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tijd</th>
                <th>Gebruiker</th>
                <th>Actie</th>
                <th>Topic</th>
              </tr>
            </thead>
            <tbody>
              {(adminActivityQuery.data ?? []).map((item) => {
                const topicSubject = item.topic_subject?.trim() ?? "";
                return (
                  <tr key={item.id}>
                    <td>{formatAmsterdamDateTime(item.created_at)}</td>
                    <td>{item.actor_username}</td>
                    <td>{item.event_type}</td>
                    <td title={topicSubject || undefined}>
                      {topicSubject ? truncateText(topicSubject, 60) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SettingsPage({
  user,
  avatarUrl,
  displayName,
  isLoading,
  hasError,
  onUserUpdated,
  onAvatarUpdated
}: {
  user: CurrentUser | undefined;
  avatarUrl: string | null;
  displayName: string;
  isLoading: boolean;
  hasError: boolean;
  onUserUpdated: (user: CurrentUser) => void;
  onAvatarUpdated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

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

  const passwordMutation = useMutation({
    mutationFn: () =>
      changeCurrentUserPassword({
        current_password: currentPassword,
        new_password: newPassword
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback("Wachtwoord succesvol gewijzigd.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Current password is incorrect")) {
        setPasswordFeedback("Huidig wachtwoord is onjuist.");
        return;
      }
      setPasswordFeedback("Wachtwoord wijzigen mislukt. Probeer het opnieuw.");
    }
  });

  const avatarMutation = useMutation({
    mutationFn: (file: Blob) => uploadCurrentUserAvatar(file),
    onSuccess: (updated) => {
      onUserUpdated(updated);
      onAvatarUpdated();
      setAvatarFeedback("Profielfoto opgeslagen.");
      setCropSource(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Avatar file too large")) {
        setAvatarFeedback("Bestand is te groot. Gebruik maximaal 5 MB.");
        return;
      }
      if (message.includes("Avatar must be a PNG image")) {
        setAvatarFeedback("Uploaden mislukt. Probeer opnieuw na het bijsnijden.");
        return;
      }
      setAvatarFeedback("Profielfoto opslaan mislukt. Probeer het opnieuw.");
    }
  });

  function resetCropState() {
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    dragStartRef.current = null;
  }

  function startDrag(clientX: number, clientY: number) {
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      offsetX: cropOffsetX,
      offsetY: cropOffsetY
    };
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragStartRef.current) {
      return;
    }
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    setCropOffsetX(clamp(dragStartRef.current.offsetX + deltaX, -120, 120));
    setCropOffsetY(clamp(dragStartRef.current.offsetY + deltaY, -120, 120));
  }

  function endDrag() {
    dragStartRef.current = null;
  }

  function onAvatarFileSelected(file: File | null) {
    if (!file) {
      return;
    }
    setAvatarFeedback(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCropSource(typeof reader.result === "string" ? reader.result : null);
      resetCropState();
    };
    reader.onerror = () => {
      setAvatarFeedback("Kon het gekozen bestand niet lezen.");
    };
    reader.readAsDataURL(file);
  }

  async function saveAvatarCrop() {
    if (!cropSource) {
      return;
    }
    setAvatarFeedback(null);
    const blob = await createCircularAvatarPng(cropSource, cropZoom, cropOffsetX, cropOffsetY);
    avatarMutation.mutate(blob);
  }

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

        <section className="avatar-section">
          <h2>Profielfoto</h2>
          <div className="avatar-preview-row">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Huidige profielfoto" className="avatar avatar-large" />
            ) : (
              <span aria-hidden="true" className="avatar avatar-large avatar-fallback">
                {initialsForName(displayName)}
              </span>
            )}
            <label className="avatar-upload-label">
              Kies foto
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => onAvatarFileSelected(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <p className="muted">Na kiezen kun je de foto rond bijsnijden. Het resultaat wordt als PNG opgeslagen.</p>
          {avatarFeedback && (
            <p
              role="status"
              className={avatarFeedback.includes("mislukt") || avatarFeedback.includes("te groot") ? "error" : "success"}
            >
              {avatarFeedback}
            </p>
          )}
        </section>

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

        <h2>Wachtwoord wijzigen</h2>
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword !== confirmPassword) {
              setPasswordFeedback("Nieuw wachtwoord en herhaling komen niet overeen.");
              return;
            }
            setPasswordFeedback(null);
            passwordMutation.mutate();
          }}
        >
          <label>
            Huidig wachtwoord
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              minLength={4}
              required
            />
          </label>
          <label>
            Nieuw wachtwoord
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={4}
              required
            />
          </label>
          <label>
            Herhaal nieuw wachtwoord
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={4}
              required
            />
          </label>
          <button type="submit" disabled={passwordMutation.isPending}>
            {passwordMutation.isPending ? "Wijzigen..." : "Wachtwoord wijzigen"}
          </button>
          {passwordFeedback && (
            <p
              role="status"
              className={
                passwordFeedback.includes("mislukt") ||
                passwordFeedback.includes("onjuist") ||
                passwordFeedback.includes("niet overeen")
                  ? "error"
                  : "success"
              }
            >
              {passwordFeedback}
            </p>
          )}
        </form>

        {cropSource && (
          <div className="cropper-overlay" role="dialog" aria-modal="true" aria-label="Profielfoto bijsnijden">
            <div className="cropper-card">
              <h2>Profielfoto bijsnijden</h2>
              <div className="cropper-preview-shell">
                <div className="cropper-preview-circle">
                  <img
                    src={cropSource}
                    alt="Crop preview"
                    draggable={false}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startDrag(e.clientX, e.clientY);
                    }}
                    onMouseMove={(e) => {
                      if (!dragStartRef.current) {
                        return;
                      }
                      moveDrag(e.clientX, e.clientY);
                    }}
                    onMouseUp={endDrag}
                    onMouseLeave={endDrag}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      if (!touch) {
                        return;
                      }
                      startDrag(touch.clientX, touch.clientY);
                    }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      if (!touch) {
                        return;
                      }
                      moveDrag(touch.clientX, touch.clientY);
                    }}
                    onTouchEnd={endDrag}
                    style={{
                      transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`
                    }}
                  />
                </div>
              </div>
              <label>
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                />
              </label>
              <label>
                Horizontaal
                <input
                  type="range"
                  min={-120}
                  max={120}
                  step={1}
                  value={cropOffsetX}
                  onChange={(e) => setCropOffsetX(Number(e.target.value))}
                />
              </label>
              <label>
                Verticaal
                <input
                  type="range"
                  min={-120}
                  max={120}
                  step={1}
                  value={cropOffsetY}
                  onChange={(e) => setCropOffsetY(Number(e.target.value))}
                />
              </label>
              <div className="cropper-actions">
                <button
                  type="button"
                  onClick={() => {
                    setCropSource(null);
                    resetCropState();
                  }}
                >
                  Annuleren
                </button>
                <button type="button" onClick={saveAvatarCrop} disabled={avatarMutation.isPending}>
                  {avatarMutation.isPending ? "Opslaan..." : "Ronde foto opslaan"}
                </button>
              </div>
            </div>
          </div>
        )}
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

function initialsForName(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function createCircularAvatarPng(
  source: string,
  zoom: number,
  offsetX: number,
  offsetY: number
): Promise<Blob> {
  const image = await loadImage(source);
  const outputSize = 512;
  const previewSize = 260;
  const offsetScale = outputSize / previewSize;

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  const baseScale = Math.max(outputSize / image.width, outputSize / image.height);
  const finalScale = baseScale * zoom;
  const drawWidth = image.width * finalScale;
  const drawHeight = image.height * finalScale;
  const drawX = (outputSize - drawWidth) / 2 + offsetX * offsetScale;
  const drawY = (outputSize - drawHeight) / 2 + offsetY * offsetScale;

  context.clearRect(0, 0, outputSize, outputSize);
  context.save();
  context.beginPath();
  context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  context.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Avatar rendering failed"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = source;
  });
}
