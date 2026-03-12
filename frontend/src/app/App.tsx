import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  AdminUser,
  AboutContent,
  CurrentUser,
  Topic,
  changeAdminUserPassword,
  changeCurrentUserPassword,
  getCurrentUserAvatarBlob,
  getAboutContent,
  getCurrentUser,
  listAdminUsers,
  listTopics,
  login,
  setToken,
  updateAdminUser,
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
          <Route path="/database" element={<DummyPage title="Database" text="Database-overzicht volgt in een volgende iteratie." />} />
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

function AdminPage({ currentUser }: { currentUser: CurrentUser | undefined }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [passwordEditorUserId, setPasswordEditorUserId] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<
    Record<string, { password: string; confirm: string }>
  >({});

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
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

  if (!currentUser?.is_admin) {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p>Je hebt geen toegang tot deze pagina.</p>
      </section>
    );
  }

  if (usersQuery.isLoading) {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p>Laden...</p>
      </section>
    );
  }

  if (usersQuery.isError) {
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gebruiker</th>
              <th>Naam</th>
              <th>E-mail</th>
              <th>Rol</th>
              <th>Rolbeheer</th>
              <th>Wachtwoord</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data ?? []).map((user) => {
              const nextIsAdmin = !user.is_admin;
              const draft = passwordDrafts[user.id] ?? { password: "", confirm: "" };
              const isPasswordEditorOpen = passwordEditorUserId === user.id;
              return (
                <Fragment key={user.id}>
                  <tr>
                    <td>{user.username}</td>
                    <td>{user.full_name ?? "-"}</td>
                    <td>{user.email ?? "-"}</td>
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
                      <td colSpan={6}>
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
          className={feedback.includes("mislukt") || feedback.includes("laatste") ? "error" : "success"}
        >
          {feedback}
        </p>
      )}
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
