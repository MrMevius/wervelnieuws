import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { MaterialButton } from "../../design-system/MaterialButton";
import { WERVEL_PATHS, WINDWILLY_PATHS } from "../routes/paths";

export function MobileNavigation({ projects, boardTarget }: {
  projects: { id: string; name: string }[];
  boardTarget: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  const activeProject = new URLSearchParams(location.search).get("project");

  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1101px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return (
    <div className="mobile-navigation">
      <MaterialButton variant="text" aria-label="Navigatie openen" aria-expanded={open} aria-controls="mobile-navigation-dialog" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        Menu
      </MaterialButton>
      <dialog ref={dialogRef} id="mobile-navigation-dialog" className="mobile-nav-dialog" aria-labelledby="mobile-navigation-title" onClose={() => setOpen(false)} onCancel={() => setOpen(false)}>
        <div className="mobile-nav-heading">
          <h2 id="mobile-navigation-title">Navigatie</h2>
          <MaterialButton variant="icon" aria-label="Navigatie sluiten" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </MaterialButton>
        </div>
        {open && <nav aria-label="Mobiele hoofdnavigatie" onClick={(event) => {
          if ((event.target as Element).closest("a")) setOpen(false);
        }}>
          <NavLink to={boardTarget}>Vergaderborden</NavLink>
          {projects.length > 0 && <details className="mobile-nav-projects" open={location.pathname.includes("vergaderborden")}>
            <summary>Kies een vergaderbord</summary>
            <div>
              {projects.map((project) => <Link key={project.id} to={`${WINDWILLY_PATHS.vergaderborden}?project=${project.id}`}
                className={activeProject === project.id && location.pathname === WINDWILLY_PATHS.vergaderborden ? "active" : undefined}
                aria-current={activeProject === project.id && location.pathname === WINDWILLY_PATHS.vergaderborden ? "page" : undefined}>
                {project.name}
              </Link>)}
            </div>
          </details>}
          <NavLink to={WERVEL_PATHS.urenverantwoording}>Urenregistratie</NavLink>
          <NavLink to="/participatiemomenten">Participatiemomenten</NavLink>
          <details className="mobile-nav-secondary" open={location.pathname.startsWith(WERVEL_PATHS.base) && location.pathname !== WERVEL_PATHS.urenverantwoording}>
            <summary>Overige modules</summary>
            <div>
              <NavLink to={WINDWILLY_PATHS.module}>WindWilly</NavLink>
              <NavLink to={WERVEL_PATHS.main}>Wervelnieuws</NavLink>
              <NavLink to={WERVEL_PATHS.planning}>Planning</NavLink>
              <NavLink to={WERVEL_PATHS.database}>Bronbestanden</NavLink>
              <NavLink to={WERVEL_PATHS.log}>Log</NavLink>
              <NavLink to={WERVEL_PATHS.about}>About</NavLink>
              <NavLink to={WINDWILLY_PATHS.changelog}>Changelog</NavLink>
            </div>
          </details>
        </nav>}
      </dialog>
    </div>
  );
}
