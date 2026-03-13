import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragEvent, FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  AdminUser,
  AboutContent,
  ContentVersion,
  CurrentUser,
  DatabaseDocument,
  Project,
  SourceTraceHit,
  Topic,
  changeAdminUserPassword,
  changeCurrentUserPassword,
  createAdminUser,
  createAdminProject,
  bulkCopyDatabaseDocuments,
  bulkDeleteDatabaseDocuments,
  bulkMoveDatabaseDocuments,
  createTopic,
  deleteAdminUser,
  getCurrentUserAvatarBlob,
  getAboutContent,
  getCurrentUser,
  importTopicsCsv,
  listAdminUsers,
  listAdminProjects,
  listDatabaseDocuments,
  listDatabaseProjects,
  listVersions,
  listTopics,
  login,
  setToken,
  updateTopic,
  updateAdminUserActive,
  updateAdminProject,
  updateAdminUser,
  uploadDatabaseDocumentWithProgress,
  uploadCurrentUserAvatar,
  updateCurrentUser
} from "../lib/api/client";

type ThemePreference = "light" | "dark" | "system";

export function App() {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);

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
    setAvatarUrl(null);
    setAvatarVersion(0);
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

  const displayName = currentUserQuery.data?.full_name ?? currentUserQuery.data?.username ?? "gebruiker";
  const avatarFallback = initialsForName(displayName);

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
              <NavLink to="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>
                Settings
              </NavLink>
              {currentUserQuery.data?.is_admin && (
                <NavLink to="/admin" role="menuitem" onClick={() => setMenuOpen(false)}>
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
          <Route path="/" element={<Navigate to="/main" replace />} />
          <Route path="/main" element={<MainPage username={displayName} />} />
          <Route path="/planning" element={<PlanningPage topics={topicsQuery.data ?? []} />} />
          <Route
            path="/planning/:topicId"
            element={<PlanningRuleDetailPage topics={topicsQuery.data ?? []} />}
          />
          <Route path="/database" element={<DatabasePage currentUser={currentUserQuery.data} />} />
          <Route path="/log" element={<DummyPage title="Log" text="Logweergave volgt in een volgende iteratie." />} />
          <Route
            path="/settings"
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
            path="/admin"
            element={<AdminPage currentUser={currentUserQuery.data} />}
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
        <p>Bekijk hier je planning en ga naar Database om bronbestanden te uploaden.</p>
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
  type PlanningSortKey =
    | "subject"
    | "theme"
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
  const [newPlanningAt, setNewPlanningAt] = useState("");
  const [newChannels, setNewChannels] = useState<string[]>([
    "website",
    "facebook",
    "newsletter"
  ]);
  const planningThemeOptions = useMemo(() => {
    const fallback = [
      "Algemeen",
      "Planning",
      "Techniek",
      "Omgeving",
      "Veiligheid",
      "Participatie"
    ];
    const fromExistingTopics = topics
      .map((topic) => topic.theme.trim())
      .filter((value) => value.length > 0);
    return Array.from(new Set([...fromExistingTopics, ...fallback])).sort((left, right) =>
      left.localeCompare(right, "nl-NL")
    );
  }, [topics]);
  const [sortKey, setSortKey] = useState<PlanningSortKey>("planning_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const createTopicMutation = useMutation({
    mutationFn: createTopic,
    onSuccess: () => {
      setFeedback("Planningsregel toegevoegd.");
      setNewSubject("");
      setNewTheme("");
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
          "CSV-kolommen zijn ongeldig. Gebruik: onderwerp,thema,geplande_datum,opmerkingen,website,facebook,nieuwsbrief"
        );
        return;
      }
      setFeedback("CSV-import mislukt.");
    }
  });

  const sortedTopics = [...topics].sort((left, right) => {
    const leftStatus = displayStatus(left.workflow_state);
    const rightStatus = displayStatus(right.workflow_state);
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
    createTopicMutation.mutate({
      title: newSubject.trim(),
      subject: newSubject.trim(),
      theme: newTheme.trim(),
      editorial_notes: "",
      planning_at: new Date(newPlanningAt).toISOString(),
      target_channels: newChannels
    });
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
            Vaste kolommen: onderwerp,thema,geplande_datum,opmerkingen,website,facebook,nieuwsbrief
          </span>
        </label>

        <form className="planning-form" onSubmit={submitPlanningRule}>
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
          <input
            type="datetime-local"
            aria-label="Geplande datum en tijd"
            value={newPlanningAt}
            onChange={(event) => setNewPlanningAt(event.target.value)}
            required
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
            {topics.length === 0 && (
              <tr>
                <td colSpan={9}>Nog geen records beschikbaar.</td>
              </tr>
            )}
            {sortedTopics.map((topic) => (
              <tr key={topic.id}>
                <td>{topic.subject}</td>
                <td>{topic.theme}</td>
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
                    onClick={() => navigate(`/planning/${topic.id}`)}
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
  const params = useParams<{ topicId: string }>();
  const topicId = params.topicId ?? "";
  const topic = topics.find((item) => item.id === topicId) ?? null;
  const [dummyMessage, setDummyMessage] = useState<string | null>(null);

  const versionsQuery = useQuery({
    queryKey: ["topic-versions", topicId],
    queryFn: () => listVersions(topicId),
    enabled: Boolean(topicId)
  });

  const selectedVersion =
    (versionsQuery.data ?? []).find((version) => version.is_current) ??
    (versionsQuery.data ?? [])[0] ??
    null;
  const sourceTrace = extractSourceTrace(selectedVersion);
  if (!topic) {
    return (
      <section className="panel">
        <h1>Planningsregel niet gevonden</h1>
        <p className="muted">Deze planningsregel bestaat niet meer of is nog niet geladen.</p>
        <div className="detail-actions">
          <button type="button" onClick={() => navigate("/planning")}>Terug naar planning</button>
        </div>
      </section>
    );
  }

  const generationPlannedAt = topic.planning_at
    ? formatAmsterdamDateTime(topic.planning_at)
    : "nog niet gepland";
  const publicationPlannedAt =
    selectedVersion?.is_published && selectedVersion.created_at
      ? formatAmsterdamDateTime(selectedVersion.created_at)
      : "nog niet gepland";

  const planningSteps = getPlanningSteps({
    workflowState: topic.workflow_state,
    generationPlannedAt,
    publicationPlannedAt
  });
  const currentStep = planningSteps.find((step) => step.isCurrent) ?? planningSteps[0];

  return (
    <section className="panel planning-detail-page">
      <h1>Planningsregel detail (dummy)</h1>
      <p className="muted">
        Dit is een tijdelijke detailpagina voor beoordelen/wijzigen. Uitwerking volgt in de volgende iteratie.
      </p>

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
              <span className="step-meta">{step.isDone ? "afgerond" : "moet nog gebeuren"}</span>
              {step.detail && <span className="step-detail">{step.detail}</span>}
            </li>
          ))}
        </ul>
      </section>

      <div className="panel-grid planning-detail-grid">
        <article className="panel">
          <h2>Review (dummy)</h2>
          <p><strong>Onderwerp:</strong> {topic.subject}</p>
          <p><strong>Thema:</strong> {topic.theme}</p>
          <p><strong>Status:</strong> {displayStatus(topic.workflow_state)}</p>
          <p><strong>Geplande datum:</strong> {topic.planning_at ? formatAmsterdamDateTime(topic.planning_at) : "-"}</p>
          <p><strong>Doelmedia:</strong> {topic.target_channels.join(", ")}</p>
          <p><strong>Opmerkingen:</strong> {topic.editorial_notes || "-"}</p>
        </article>

        <article className="panel">
          <h2>Wijzigingen (dummy)</h2>
          <label>
            Artikel (dummy)
            <textarea defaultValue={selectedVersion?.article_body ?? ""} rows={6} />
          </label>
          <label>
            Samenvatting (dummy)
            <textarea defaultValue={selectedVersion?.summary ?? ""} rows={4} />
          </label>
          <div className="detail-actions">
            <button
              type="button"
              onClick={() => setDummyMessage("Dummy: wijziging lokaal bekeken, nog niet opgeslagen.")}
            >
              Wijziging simuleren
            </button>
            <button
              type="button"
              onClick={() => setDummyMessage("Dummy: beoordeling geregistreerd voor demo.")}
            >
              Beoordeling simuleren
            </button>
          </div>
          {dummyMessage && <p role="status" className="success">{dummyMessage}</p>}
        </article>

        <article className="panel">
          <h2>Publicatiebesluit (dummy)</h2>
          <p className="muted">
            Hier komt in de volgende iteratie het besluitproces voor akkoord, afwijzing en publicatieplanning.
          </p>
          <div className="detail-actions">
            <button
              type="button"
              onClick={() => setDummyMessage("Dummy: publicatiebesluit voorlopig op akkoord gezet.")}
            >
              Akkoord simuleren
            </button>
            <button
              type="button"
              onClick={() => setDummyMessage("Dummy: publicatiebesluit voorlopig afgewezen.")}
            >
              Afwijzing simuleren
            </button>
          </div>
        </article>
      </div>

      <section className="review-panel" aria-label="Bronreview detail">
        <h2>Bronpassages</h2>
        {versionsQuery.isLoading && <p>Bronpassages worden geladen...</p>}
        {versionsQuery.isError && <p className="error">Bronpassages konden niet worden geladen.</p>}
        {!versionsQuery.isLoading && !versionsQuery.isError && sourceTrace.length === 0 && (
          <p>Geen bronpassages gekoppeld.</p>
        )}
        {sourceTrace.length > 0 && (
          <div className="source-trace-list">
            {sourceTrace.map((hit) => (
              <article className="source-trace-item" key={`${hit.source_type}-${hit.chunk_id}`}>
                <p className="source-label">
                  {hit.source_type === "database"
                    ? `Database - ${hit.project_name || "Onbekend project"} - ${
                        hit.document_name || "Onbekend document"
                      }`
                    : `Topic - ${hit.document_name || "Onbekend document"}`}
                  {`, chunk ${hit.chunk_index || "?"}`}
                </p>
                <p>{hit.text}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="detail-actions">
        <button type="button" onClick={() => navigate("/planning")}>Terug naar planning</button>
      </div>
    </section>
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
}): Array<{
  key: string;
  label: string;
  isDone: boolean;
  isCurrent: boolean;
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

  return ordered.map((step, index) => ({
    key: step.key,
    label: step.label,
    detail: step.detail,
    isDone: index <= currentIndex,
    isCurrent: index === currentIndex
  }));
}

function extractSourceTrace(version: ContentVersion | null): SourceTraceHit[] {
  if (!version) {
    return [];
  }
  if (Array.isArray(version.source_trace) && version.source_trace.length > 0) {
    return version.source_trace;
  }
  try {
    const parsed = JSON.parse(version.source_trace_json) as Partial<SourceTraceHit>[];
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
      project_name: item.project_name ?? ""
    }));
  } catch {
    return [];
  }
}

function DatabasePage({ currentUser }: { currentUser: CurrentUser | undefined }) {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");
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
    if (selectedProjectId) {
      return;
    }
    const first = projectsQuery.data?.[0];
    if (first) {
      setSelectedProjectId(first.id);
    }
  }, [projectsQuery.data, selectedProjectId]);

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
    queryKey: ["database-documents", selectedProjectId],
    queryFn: () => listDatabaseDocuments(selectedProjectId || undefined)
  });

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      onProgress
    }: {
      file: File;
      onProgress: (progress: number) => void;
    }) => {
      if (!selectedProjectId) {
        throw new Error("Kies eerst een project");
      }
      return uploadDatabaseDocumentWithProgress(selectedProjectId, file, onProgress);
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
          Project
          <select
            aria-label="Project"
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
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
          disabled={uploadMutation.isPending || !selectedProjectId}
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
                <td colSpan={9}>Nog geen bestanden voor dit project.</td>
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

function DummyPage({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel">
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}

function AdminPage({ currentUser }: { currentUser: CurrentUser | undefined }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [passwordEditorUserId, setPasswordEditorUserId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [projectDrafts, setProjectDrafts] = useState<Record<string, string>>({});
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

  if (!currentUser?.is_admin) {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p>Je hebt geen toegang tot deze pagina.</p>
      </section>
    );
  }

  if (usersQuery.isLoading || projectsQuery.isLoading) {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p>Laden...</p>
      </section>
    );
  }

  if (usersQuery.isError || projectsQuery.isError) {
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
