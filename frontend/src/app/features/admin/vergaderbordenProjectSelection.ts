export const VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY = "vergaderborden:last-valid-project-id";

export type BoardProjectSelectionItem = {
  id: string;
  name: string;
};

export function resolveVergaderbordenProjectId(projects: BoardProjectSelectionItem[], preferredProjectId: string | null) {
  if (!projects.length) return null;
  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }
  const algemeenProject = projects.find((project) => project.name.trim().toLowerCase() === "algemeen");
  return algemeenProject?.id ?? projects[0].id;
}
