import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getCurrentUser,
  listWorkHoursAudit,
  listWorkHoursMeta,
  listWorkHourGroups,
  createWorkHourGroup,
  updateWorkHourGroup,
  deleteWorkHourGroup,
  createWorkExternalPerson,
  updateWorkExternalPerson,
  archiveWorkExternalPerson,
  restoreWorkExternalPerson,
  mergeWorkExternalPerson,
  createWorkProject,
  updateWorkProject,
  archiveWorkProject,
  restoreWorkProject,
  createWorkPost,
  updateWorkPost,
  archiveWorkPost,
  restoreWorkPost,
  downloadWorkHoursCsv,
  downloadWorkHoursBackup,
  previewWorkHoursImport,
  commitWorkHoursImport,
  restoreWorkHourGroup,
  listWorkHoursAdminHistory,
  listWorkHoursAdminMasterdata,
  relinkWorkHistoricalIdentity,
  type WorkHourImportEnvelope,
  type WorkHourGroup,
  type WorkHourParticipant,
  type WorkHourExternalPerson,
  type WorkHourProject,
  type WorkHourPost,
  type WorkHourSortKey
} from "../../../lib/api/client";
import { formatAmsterdamDateInput, formatAmsterdamDateTime, formatAmsterdamDisplayDate } from "../../../lib/datetime";

const PAGE_SIZES = [25, 50, 100] as const;

type ParticipantDraft =
  | { kind: "live_user"; user_id: string; display_name_snapshot: string; display_email_snapshot: string; display_type_snapshot: string }
  | { kind: "external_person"; external_person_id: string; display_name_snapshot: string; display_email_snapshot: string; display_type_snapshot: string }
  | { kind: "historical_identity"; historical_identity_id: string; display_name_snapshot: string; display_email_snapshot: string; display_type_snapshot: string };

type ParticipantEditDraft = (ParticipantDraft & { id?: string }) | { id: string; kind: "preserved"; display_name_snapshot: string; display_email_snapshot: string; display_type_snapshot: string };
type DuplicateCandidate = Pick<WorkHourExternalPerson, "id" | "display_name" | "email" | "is_active" | "deleted_at"> & {
  status_label?: string;
  selectable?: boolean;
  guidance?: string | null;
};

type ExternalPersonDraft = {
  display_name: string;
  email: string | null;
  note: string;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

const openHoursModals: string[] = [];

function AccessibleModal({ title, onClose, children, committing = false }: { title: string; onClose: () => void; children: ReactNode; committing?: boolean }) {
  const modalId = useId();
  const headingId = `${modalId}-heading`;
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const portalHost = useMemo(() => {
    const host = document.createElement("div");
    host.dataset.hoursModalHost = modalId;
    return host;
  }, [modalId]);
  const onCloseRef = useRef(onClose);
  const committingRef = useRef(committing);
  onCloseRef.current = onClose;
  committingRef.current = committing;
  useEffect(() => {
    document.body.appendChild(portalHost);
    openHoursModals.push(modalId);
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
    const background = Array.from(document.body.children).filter((element) => element !== portalHost) as HTMLElement[];
    const previous = background.map((element) => ({ element, inert: element.inert, ariaHidden: element.getAttribute("aria-hidden") }));
    background.forEach((element) => { element.inert = true; element.setAttribute("aria-hidden", "true"); });
    (dialog?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? dialog?.querySelector<HTMLElement>("h2") ?? focusable()[0])?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (openHoursModals.at(-1) !== modalId) return;
      if (event.key === "Escape") { event.preventDefault(); if (!committingRef.current) onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const stackIndex = openHoursModals.lastIndexOf(modalId);
      if (stackIndex >= 0) openHoursModals.splice(stackIndex, 1);
      previous.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", ariaHidden);
      });
      portalHost.remove();
      const trigger = returnFocusRef.current;
      if (trigger?.isConnected && !trigger.hasAttribute("disabled")) trigger.focus();
      else document.querySelector<HTMLElement>("[data-hours-focus-fallback]:not([disabled])")?.focus();
    };
  }, [modalId, portalHost]);
  return createPortal(<div className="work-hours-modal-backdrop"><section ref={dialogRef} className="panel work-hours-modal" role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}><h2 id={headingId} tabIndex={-1}>{title}</h2>{children}</section></div>, portalHost);
}

export function UrenverantwoordingPage() {
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery({ queryKey: ["work-hours-current-user"], queryFn: getCurrentUser });
  const metaQuery = useQuery({ queryKey: ["work-hours-meta"], queryFn: listWorkHoursMeta });
  const [auditFilters, setAuditFilters] = useState({ actor: "", action: "", result: "", method: "", path: "", from: "", to: "" });
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState<25 | 50 | 100>(25);
  const auditQuery = useQuery({
    queryKey: ["work-hours-audit", auditFilters, auditPage, auditPageSize],
    queryFn: () => listWorkHoursAudit({ ...auditFilters, page: auditPage, page_size: auditPageSize }),
    enabled: Boolean(currentUserQuery.data?.is_admin)
  });
  const auditEvents = Array.isArray(auditQuery.data) ? auditQuery.data : (auditQuery.data?.items ?? []);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [projectId, setProjectId] = useState("");
  const [postId, setPostId] = useState("");
  const [newGroupProjectId, setNewGroupProjectId] = useState("");
  const [newGroupPostId, setNewGroupPostId] = useState("");
  const [editingGroupProjectId, setEditingGroupProjectId] = useState("");
  const [editingGroupPostId, setEditingGroupPostId] = useState("");
  const [query, setQuery] = useState("");
  const [workDateFilter, setWorkDateFilter] = useState("");
  const [participantKind, setParticipantKind] = useState<"" | "live_user" | "external_person" | "historical_identity">("");
  const [sortKey, setSortKey] = useState<WorkHourSortKey>("work_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showDeleted, setShowDeleted] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WorkHourGroup | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<WorkHourGroup | null>(null);
  const [restoreGroupTarget, setRestoreGroupTarget] = useState<WorkHourGroup | null>(null);
  const [forceCreateConfirm, setForceCreateConfirm] = useState(false);
  const [mergeSource, setMergeSource] = useState<WorkHourExternalPerson | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<25 | 50 | 100>(25);
  const [historyKind, setHistoryKind] = useState<"" | "project" | "post" | "external_person" | "historical_identity">("");
  const [historyQueryText, setHistoryQueryText] = useState("");
  const [editingProject, setEditingProject] = useState<WorkHourProject | null>(null);
  const [editingPost, setEditingPost] = useState<WorkHourPost | null>(null);
  const [editingPerson, setEditingPerson] = useState<WorkHourExternalPerson | null>(null);
  const [importJson, setImportJson] = useState("{\n  \"format_version\": \"1.0\",\n  \"backup_version\": \"2\",\n  \"projects\": [],\n  \"posts\": [],\n  \"external_people\": [],\n  \"historical_identities\": [],\n  \"groups\": []\n}");
  const [importMode, setImportMode] = useState<"merge" | "full_restore">("merge");
  const [previewBatchId, setPreviewBatchId] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backupDownloadUrl, setBackupDownloadUrl] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{ batch_id: string; status: string; counts: Record<string, number>; warnings: string[]; errors: string[]; backup_download_url: string | null } | null>(null);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [editParticipants, setEditParticipants] = useState<ParticipantEditDraft[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateConflictCode, setDuplicateConflictCode] = useState("");
  const [pendingExternalPerson, setPendingExternalPerson] = useState<ExternalPersonDraft | null>(null);
  const [selectedExternalPersonId, setSelectedExternalPersonId] = useState("");
  const [selectedExternalPersonCandidate, setSelectedExternalPersonCandidate] = useState<DuplicateCandidate | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const sharedFilters = useMemo(
    () => ({
      project_id: projectId || undefined,
      post_id: postId || undefined,
      work_date: workDateFilter || undefined,
      participant_kind: participantKind || undefined,
      query: query || undefined,
      sort_key: sortKey,
      sort_direction: sortDirection
    }),
    [projectId, postId, workDateFilter, participantKind, query, sortKey, sortDirection]
  );

  const listQueryParams = useMemo(
    () => ({
      ...sharedFilters,
      page,
      page_size: pageSize
    }),
    [sharedFilters, page, pageSize]
  );

  const deletedListQueryParams = useMemo(
    () => ({
      ...sharedFilters,
      include_deleted: true,
      deleted_only: true,
      page,
      page_size: pageSize
    }),
    [sharedFilters, page, pageSize]
  );

  const groupsQuery = useQuery({
    queryKey: ["work-hours-groups", listQueryParams],
    queryFn: () => listWorkHourGroups(listQueryParams)
  });
  const deletedGroupsQuery = useQuery({
    queryKey: ["work-hours-deleted-groups", deletedListQueryParams],
    queryFn: () => listWorkHourGroups(deletedListQueryParams),
    enabled: showDeleted
  });

  const projectOptions = useMemo(() => (metaQuery.data?.projects ?? []).map((project) => ({ ...project, name: project.name ?? project.display_name ?? "", description: project.description ?? "", row_version: project.row_version ?? 1 })), [metaQuery.data?.projects]);
  const normalizedPosts = useMemo(() => (metaQuery.data?.posts ?? []).map((post) => ({ ...post, name: post.name ?? post.display_name ?? "", project_id: post.project_id ?? post.project_selection_key ?? "", description: post.description ?? "", row_version: post.row_version ?? 1 })), [metaQuery.data?.posts]);
  const postOptions = useMemo(() => (projectId ? normalizedPosts.filter((post) => post.project_id === projectId) : normalizedPosts), [normalizedPosts, projectId]);
  const externalPeople = useMemo(() => (metaQuery.data?.external_people ?? []).map((person) => ({ ...person, email: person.email ?? null, note: person.note ?? "", is_active: person.is_active ?? person.selectable ?? true, row_version: person.row_version ?? 1 })), [metaQuery.data?.external_people]);
  const activeExternalPeople = useMemo(() => externalPeople.filter((person) => person.is_active && !person.deleted_at), [externalPeople]);
  const inactiveHistoricalExternalPeople = useMemo(() => externalPeople.filter((person) => !person.is_active || person.deleted_at), [externalPeople]);
  const historicalIdentities = useMemo(() => (metaQuery.data?.historical_identities ?? []).map((identity) => ({ ...identity, snapshot_display_label: identity.snapshot_display_label ?? identity.display_name ?? "Historische identiteit", snapshot_name: identity.snapshot_name ?? identity.display_name ?? "" })), [metaQuery.data?.historical_identities]);
  const eligibleUsers = useMemo(() => (metaQuery.data?.eligible_users ?? []).map((user) => ({ ...user, username: user.username ?? user.display_name ?? "Gebruiker", full_name: user.full_name ?? user.display_name ?? null, email: user.email ?? null })), [metaQuery.data?.eligible_users]);
  const currentUser = currentUserQuery.data;
  const isAdmin = Boolean(currentUser?.is_admin);
  const historyParams = { page: historyPage, page_size: historyPageSize, kind: historyKind || undefined, query: historyQueryText.trim() || undefined, sort_key: "display_name" as const, sort_direction: "asc" as const };
  const historyQuery = useQuery({ queryKey: ["work-hours-admin-history", historyParams], queryFn: () => listWorkHoursAdminHistory(historyParams), enabled: isAdmin });
  const adminMasterdataQuery = useQuery({ queryKey: ["work-hours-admin-masterdata"], queryFn: listWorkHoursAdminMasterdata, enabled: isAdmin });
  const totalPages = Math.max(1, Math.ceil((groupsQuery.data?.total ?? 0) / pageSize));
  const newGroupPostOptions = useMemo(() => (newGroupProjectId ? normalizedPosts.filter((post) => post.project_id === newGroupProjectId) : []), [normalizedPosts, newGroupProjectId]);
  const editingGroupPostOptions = useMemo(() => (editingGroupProjectId ? normalizedPosts.filter((post) => post.project_id === editingGroupProjectId) : []), [normalizedPosts, editingGroupProjectId]);
  const adminProjects = adminMasterdataQuery.data?.projects ?? [];
  const adminPosts = adminMasterdataQuery.data?.posts ?? [];
  const adminPeople = adminMasterdataQuery.data?.external_people ?? [];

  async function invalidateAdminMasterdata() {
    await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] });
    await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-masterdata"] });
    await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-history"] });
  }

  useEffect(() => {
    if (!newGroupProjectId && projectOptions[0]?.id) {
      setNewGroupProjectId(projectOptions[0].id);
    }
  }, [projectOptions, newGroupProjectId]);

  useEffect(() => {
    if (!newGroupProjectId) {
      setNewGroupPostId("");
      return;
    }
    if (newGroupPostOptions.length === 0) {
      setNewGroupPostId("");
      return;
    }
    if (!newGroupPostOptions.some((post) => post.id === newGroupPostId)) {
      setNewGroupPostId("");
    }
  }, [newGroupPostId, newGroupPostOptions, newGroupProjectId]);

  useEffect(() => {
    if (!editingGroup) {
      setEditingGroupProjectId("");
      setEditingGroupPostId("");
      return;
    }
    setEditingGroupProjectId(editingGroup.project_id);
    setEditingGroupPostId(editingGroup.post_id);
  }, [editingGroup]);

  useEffect(() => {
    if (!editingGroupProjectId) {
      setEditingGroupPostId("");
      return;
    }
    if (editingGroupPostOptions.length === 0) {
      setEditingGroupPostId("");
      return;
    }
    if (!editingGroupPostOptions.some((post) => post.id === editingGroupPostId)) {
      setEditingGroupPostId("");
    }
  }, [editingGroupPostId, editingGroupPostOptions, editingGroupProjectId]);

  useEffect(() => {
    if (!selectedExternalPersonId && activeExternalPeople[0]?.id) {
      setSelectedExternalPersonId(activeExternalPeople[0].id);
    }
  }, [activeExternalPeople, selectedExternalPersonId]);

  useEffect(() => {
    if (!selectedUserId && eligibleUsers[0]?.id) setSelectedUserId(eligibleUsers[0].id);
  }, [eligibleUsers, selectedUserId]);

  function parseApiDetail(error: unknown): { detail?: { code?: string; message?: string; candidates?: DuplicateCandidate[] } } | null {
    if (!(error instanceof Error)) return null;
    try {
      return JSON.parse(error.message) as { detail?: { code?: string; message?: string; candidates?: DuplicateCandidate[] } };
    } catch {
      return null;
    }
  }

  function selectExistingCandidate(candidate: DuplicateCandidate) {
    if (candidate.selectable === false) return;
    setSelectedExternalPersonId(candidate.id);
    setSelectedExternalPersonCandidate(candidate);
    setStatusMessage(`Bestaande persoon gekozen: ${candidate.display_name}.`);
    setErrorMessage(null);
  }

  async function createPendingExternalPerson(force = false) {
    if (!pendingExternalPerson) return;
    await personMutation.mutateAsync({ ...pendingExternalPerson, force_create: force });
    setDuplicateCandidates([]);
    setDuplicateConflictCode("");
    setPendingExternalPerson(null);
  }

  const createGroupMutation = useMutation({
    mutationFn: createWorkHourGroup,
    onSuccess: async () => {
      setStatusMessage("Registratie opgeslagen.");
      setErrorMessage(null);
      setParticipants([]);
      setShowCreateModal(false);
      await queryClient.invalidateQueries({ queryKey: ["work-hours-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["work-hours-audit"] });
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Opslaan mislukt")
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (group: WorkHourGroup) => deleteWorkHourGroup(group.id, group.row_version),
    onSuccess: async () => {
      setDeleteGroupTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["work-hours-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["work-hours-deleted-groups"] });
      setStatusMessage("Registratie is soft-deleted.");
    }
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: Parameters<typeof updateWorkHourGroup>[1] }) => updateWorkHourGroup(groupId, payload),
    onSuccess: async () => {
      setStatusMessage("Registratie bijgewerkt.");
      setEditingGroup(null);
      setEditParticipants([]);
      await queryClient.invalidateQueries({ queryKey: ["work-hours-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["work-hours-audit"] });
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Bijwerken mislukt")
  });

  const restoreGroupMutation = useMutation({
    mutationFn: (group: WorkHourGroup) => restoreWorkHourGroup(group.id, group.row_version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-hours-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["work-hours-deleted-groups"] });
      setStatusMessage("Registratie hersteld.");
      setRestoreGroupTarget(null);
    }
  });

  useEffect(() => {
    if (!errorMessage) return;
    requestAnimationFrame(() => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      (dialog?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? dialog?.querySelector<HTMLElement>('[role="alert"]'))?.focus();
    });
  }, [errorMessage]);

  const projectMutation = useMutation({
    mutationFn: createWorkProject,
    onSuccess: invalidateAdminMasterdata
  });
  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: Parameters<typeof updateWorkProject>[1] }) => updateWorkProject(projectId, payload),
    onSuccess: invalidateAdminMasterdata
  });
  const archiveProjectMutation = useMutation({
    mutationFn: (project: WorkHourProject) => archiveWorkProject(project.id, project.row_version ?? 1),
    onSuccess: invalidateAdminMasterdata
  });
  const restoreProjectMutation = useMutation({
    mutationFn: (project: WorkHourProject) => restoreWorkProject(project.id, project.row_version ?? 1),
    onSuccess: invalidateAdminMasterdata
  });
  const postMutation = useMutation({
    mutationFn: createWorkPost,
    onSuccess: invalidateAdminMasterdata
  });
  const updatePostMutation = useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: Parameters<typeof updateWorkPost>[1] }) => updateWorkPost(postId, payload),
    onSuccess: invalidateAdminMasterdata
  });
  const archivePostMutation = useMutation({
    mutationFn: (post: WorkHourPost) => archiveWorkPost(post.id, post.row_version ?? 1),
    onSuccess: invalidateAdminMasterdata
  });
  const restorePostMutation = useMutation({
    mutationFn: (post: WorkHourPost) => restoreWorkPost(post.id, post.row_version ?? 1),
    onSuccess: invalidateAdminMasterdata
  });
  const personMutation = useMutation({
    mutationFn: createWorkExternalPerson,
    onSuccess: async (created) => {
      setStatusMessage("Externe persoon opgeslagen.");
      setSelectedExternalPersonId(created.id);
      setSelectedExternalPersonCandidate(created);
      setDuplicateCandidates([]);
      setDuplicateConflictCode("");
      setPendingExternalPerson(null);
      await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] });
    }
  });
  const updatePersonMutation = useMutation({
    mutationFn: ({ personId, payload }: { personId: string; payload: Parameters<typeof updateWorkExternalPerson>[1] }) => updateWorkExternalPerson(personId, payload),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] }); }
  });
  const archivePersonMutation = useMutation({
    mutationFn: (person: WorkHourExternalPerson) => archiveWorkExternalPerson(person.id, person.row_version ?? 1),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] }); }
  });
  const restorePersonMutation = useMutation({
    mutationFn: (person: WorkHourExternalPerson) => restoreWorkExternalPerson(person.id, person.row_version ?? 1),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] }); }
  });
  const mergePersonMutation = useMutation({
    mutationFn: ({ personId, payload }: { personId: string; payload: Parameters<typeof mergeWorkExternalPerson>[1] }) => mergeWorkExternalPerson(personId, payload),
    onSuccess: async () => { setMergeSource(null); setStatusMessage("Externe personen zijn samengevoegd."); await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] }); await queryClient.invalidateQueries({ queryKey: ["work-hours-groups"] }); },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Samenvoegen mislukt")
  });
  const relinkIdentityMutation = useMutation({
    mutationFn: ({ identityId, userId, rowVersion }: { identityId: string; userId: string; rowVersion: number }) => relinkWorkHistoricalIdentity(identityId, userId, rowVersion),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-history"] });
      await queryClient.invalidateQueries({ queryKey: ["work-hours-audit"] });
      setStatusMessage("Historische identiteit gekoppeld; de snapshot blijft behouden.");
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Koppelen mislukt")
  });

  const previewImportMutation = useMutation({ mutationFn: ({ payload, mode }: { payload: WorkHourImportEnvelope; mode: "merge" | "full_restore" }) => previewWorkHoursImport(payload, mode) });
  const commitImportMutation = useMutation({ mutationFn: ({ batchId, payload, mode }: { batchId: string; payload: Parameters<typeof previewWorkHoursImport>[0]; mode: "merge" | "full_restore" }) => commitWorkHoursImport(batchId, payload, mode) });

  function addUserParticipant(target: "create" | "edit") {
    const user = eligibleUsers.find((item) => item.id === selectedUserId);
    if (!user) return;
    const draft: ParticipantDraft = { kind: "live_user", user_id: user.id, display_name_snapshot: user.full_name || user.username, display_email_snapshot: user.email || "", display_type_snapshot: "WindWilly-gebruiker" };
    if (target === "create") {
      setParticipants((current) => current.some((item) => item.kind === "live_user" && item.user_id === user.id) ? current : [...current, draft]);
    } else {
      setEditParticipants((current) => current.some((item) => item.kind === "live_user" && item.user_id === user.id) ? current : [...current, draft]);
    }
  }

  function resolveSelectedExternalPerson() {
    if (selectedExternalPersonCandidate) {
      return selectedExternalPersonCandidate.selectable === false ? undefined : selectedExternalPersonCandidate;
    }
    return (selectedExternalPersonId ? activeExternalPeople.find((person) => person.id === selectedExternalPersonId) : undefined) ?? activeExternalPeople[0];
  }

  function addExternalParticipant(target: "create" | "edit") {
    const selected = resolveSelectedExternalPerson();
    if (!selected) return;
    const draft: ParticipantDraft = { kind: "external_person", external_person_id: selected.id, display_name_snapshot: selected.display_name, display_email_snapshot: selected.email || "", display_type_snapshot: "Extern" };
    if (target === "create") {
      setParticipants((current) => [...current, draft]);
      return;
    }
    setEditParticipants((current) => [...current, draft]);
  }

  function participantDraftFromGroup(participant: WorkHourParticipant): ParticipantEditDraft {
    if (participant.participant_kind === "external_person") {
      return {
        id: participant.id,
        kind: "external_person",
        external_person_id: participant.external_person_id || "",
        display_name_snapshot: participant.display_name_snapshot,
        display_email_snapshot: participant.display_email_snapshot || "",
        display_type_snapshot: participant.display_type_snapshot
      };
    }
    if (participant.participant_kind === "historical_identity") {
      return {
        id: participant.id,
        kind: "historical_identity",
        historical_identity_id: participant.historical_identity_id || "",
        display_name_snapshot: participant.display_name_snapshot,
        display_email_snapshot: participant.display_email_snapshot || "",
        display_type_snapshot: participant.display_type_snapshot
      };
    }
    if (!participant.participant_kind) {
      return {
        id: participant.id,
        kind: "preserved",
        display_name_snapshot: participant.display_name_snapshot,
        display_email_snapshot: "",
        display_type_snapshot: participant.display_type_snapshot
      };
    }
    return {
      id: participant.id,
      kind: "live_user",
      user_id: participant.user_id || currentUser?.id || "",
      display_name_snapshot: participant.display_name_snapshot,
      display_email_snapshot: participant.display_email_snapshot || "",
      display_type_snapshot: participant.display_type_snapshot
    };
  }

  function startEditingGroup(group: WorkHourGroup) {
    setEditingGroup(group);
    setEditParticipants(group.participants.map(participantDraftFromGroup));
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function removeEditingParticipant(index: number) {
    setEditParticipants((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function startEditingProject(project: WorkHourProject) {
    setEditingProject(project);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function startEditingPost(post: WorkHourPost) {
    setEditingPost(post);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function startEditingPerson(person: WorkHourExternalPerson) {
    setEditingPerson(person);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function onCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const workDate = String(data.get("work_date") ?? formatAmsterdamDateInput());
    const project = newGroupProjectId;
    const post = newGroupPostId;
    const description = String(data.get("description") ?? "");
    const durationHalfHours = Number(data.get("duration_half_hours") ?? 2);
    if (!project || !post || !newGroupPostOptions.some((item) => item.id === post)) {
      const errors = {
        ...(!project ? { project_id: "Kies een project." } : {}),
        ...(!post || !newGroupPostOptions.some((item) => item.id === post) ? { post_id: "Kies een post binnen het geselecteerde project." } : {})
      };
      setCreateErrors(errors);
      setErrorMessage("Controleer de gemarkeerde velden.");
      requestAnimationFrame(() => document.getElementById(Object.keys(errors)[0] === "project_id" ? "hours-create-project" : "hours-create-post")?.focus());
      return;
    }
    setCreateErrors({});
    const finalParticipants = participants.length ? participants : currentUser ? [{ kind: "live_user", user_id: currentUser.id, display_name_snapshot: currentUser.full_name || currentUser.username, display_email_snapshot: currentUser.email || "", display_type_snapshot: "WindWilly-gebruiker" }] : [];
    await createGroupMutation.mutateAsync({
      work_date: workDate,
      project_id: project,
      post_id: post,
      description,
      duration_half_hours: durationHalfHours,
      participants: finalParticipants.map((participant, index) =>
        participant.kind === "live_user"
          ? (() => {
              const item = participant as Extract<ParticipantDraft, { kind: "live_user" }>;
              return { participant_kind: "live_user", user_id: item.user_id, display_name_snapshot: item.display_name_snapshot, display_email_snapshot: item.display_email_snapshot, display_type_snapshot: item.display_type_snapshot, sort_order: index };
            })()
          : participant.kind === "external_person"
            ? (() => {
                const item = participant as Extract<ParticipantDraft, { kind: "external_person" }>;
                return { participant_kind: "external_person", external_person_id: item.external_person_id, display_name_snapshot: item.display_name_snapshot, display_email_snapshot: item.display_email_snapshot, display_type_snapshot: item.display_type_snapshot, sort_order: index };
              })()
            : (() => {
                const item = participant as Extract<ParticipantDraft, { kind: "historical_identity" }>;
                return { participant_kind: "historical_identity", historical_identity_id: item.historical_identity_id, display_name_snapshot: item.display_name_snapshot, display_email_snapshot: item.display_email_snapshot, display_type_snapshot: item.display_type_snapshot, sort_order: index };
              })()
      )
    });
    event.currentTarget.reset();
  }

  async function onSaveEditingGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingGroup) return;
    const data = new FormData(event.currentTarget);
    if (!editingGroupProjectId || !editingGroupPostId || !editingGroupPostOptions.some((item) => item.id === editingGroupPostId)) {
      setErrorMessage("Kies eerst een post binnen het geselecteerde project.");
      return;
    }
    await updateGroupMutation.mutateAsync({
      groupId: editingGroup.id,
      payload: {
        work_date: String(data.get("work_date") ?? editingGroup.work_date),
        project_id: editingGroupProjectId,
        post_id: editingGroupPostId,
        description: String(data.get("description") ?? editingGroup.description),
        duration_half_hours: Number(data.get("duration_half_hours") ?? editingGroup.duration_half_hours),
        expected_row_version: editingGroup.row_version,
        participants: editParticipants.map((participant, index) =>
          participant.kind === "live_user"
            ? { id: participant.id, participant_kind: "live_user", user_id: participant.user_id, display_name_snapshot: participant.display_name_snapshot, display_email_snapshot: participant.display_email_snapshot, display_type_snapshot: participant.display_type_snapshot, sort_order: index }
            : participant.kind === "external_person"
              ? { id: participant.id, participant_kind: "external_person", external_person_id: participant.external_person_id, display_name_snapshot: participant.display_name_snapshot, display_email_snapshot: participant.display_email_snapshot, display_type_snapshot: participant.display_type_snapshot, sort_order: index }
              : participant.kind === "historical_identity"
                ? { id: participant.id, participant_kind: "historical_identity", historical_identity_id: participant.historical_identity_id, display_name_snapshot: participant.display_name_snapshot, display_email_snapshot: participant.display_email_snapshot, display_type_snapshot: participant.display_type_snapshot, sort_order: index }
                : { id: participant.id, sort_order: index }
        )
      }
    });
  }

  async function onSaveEditingProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProject) return;
    const data = new FormData(event.currentTarget);
    await updateProjectMutation.mutateAsync({
      projectId: editingProject.id,
      payload: {
        name: String(data.get("name") ?? editingProject.name),
        description: String(data.get("description") ?? editingProject.description),
        expected_row_version: editingProject.row_version
      }
    });
    setEditingProject(null);
  }

  async function onSaveEditingPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPost) return;
    const data = new FormData(event.currentTarget);
    await updatePostMutation.mutateAsync({
      postId: editingPost.id,
      payload: {
        name: String(data.get("name") ?? editingPost.name),
        description: String(data.get("description") ?? editingPost.description),
        expected_row_version: editingPost.row_version
      }
    });
    setEditingPost(null);
  }

  async function onSaveEditingPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPerson) return;
    const data = new FormData(event.currentTarget);
    await updatePersonMutation.mutateAsync({
      personId: editingPerson.id,
      payload: {
        display_name: String(data.get("display_name") ?? editingPerson.display_name),
        email: String(data.get("email") ?? editingPerson.email ?? "") || null,
        note: String(data.get("note") ?? editingPerson.note),
        expected_row_version: editingPerson.row_version
      }
    });
    setEditingPerson(null);
  }

  async function onQuickAddExternalPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      display_name: String(data.get("display_name") ?? ""),
      email: String(data.get("email") ?? "") || null,
      note: String(data.get("note") ?? ""),
      force_create: false
    };
    setPendingExternalPerson(payload);
    try {
      await personMutation.mutateAsync(payload);
      setDuplicateCandidates([]);
      setPendingExternalPerson(null);
      setErrorMessage(null);
      event.currentTarget.reset();
    } catch (error) {
      const parsed = parseApiDetail(error);
      const candidates = parsed?.detail?.candidates ?? [];
      if (candidates.length > 0) {
        setDuplicateCandidates(candidates);
        setDuplicateConflictCode(parsed?.detail?.code ?? "");
        setErrorMessage(parsed?.detail?.message ?? "Mogelijke dubbele externe persoon");
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Opslaan mislukt");
    }
  }

  async function onPreviewImport() {
    setErrorMessage(null);
    try {
      const parsed = JSON.parse(importJson) as WorkHourImportEnvelope;
      const response = await previewImportMutation.mutateAsync({ payload: parsed, mode: importMode });
      setPreviewBatchId(response.batch_id);
      setPreviewResult(response);
      setStatusMessage(`Preview gereed: ${response.status}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Import preview mislukt");
    }
  }

  async function onCommitImport() {
    if (!previewBatchId) return;
    try {
      const parsed = JSON.parse(importJson) as WorkHourImportEnvelope;
      const response = await commitImportMutation.mutateAsync({ batchId: previewBatchId, payload: parsed, mode: importMode });
      setBackupDownloadUrl(response.backup_download_url);
      setStatusMessage("Import uitgevoerd.");
      await queryClient.invalidateQueries({ queryKey: ["work-hours-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] });
      await queryClient.invalidateQueries({ queryKey: ["work-hours-deleted-groups"] });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Import commit mislukt");
    }
  }

  async function onDownloadBackup() {
    if (!previewBatchId) return;
    const blob = await downloadWorkHoursBackup(previewBatchId);
    downloadBlob(blob, `urenverantwoording-backup-${previewBatchId}.json`);
  }

  async function onExportCsv() {
    const blob = await downloadWorkHoursCsv(sharedFilters);
    downloadBlob(blob, "urenverantwoording.csv");
  }

  return (
    <section className="main-dashboard uren-module-page">
      <header className="panel">
        <p className="eyebrow">Urenverantwoording</p>
        <h1>Urenregistratie</h1>
        <p>Groepsregistraties, masterdata en import/export in één Nederlands scherm.</p>
        {statusMessage && <p className="notice success" role="status" aria-live="polite">{statusMessage}</p>}
        {errorMessage && <p className="notice error" role="alert">{errorMessage}</p>}
      </header>

      <section className="panel">
        <h2>Filters</h2>
        <div className="form-grid">
           <label><span>Zoekterm</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Zoek in beschrijving, project of post" /></label>
           <label><span>Werkdatum</span><input type="date" value={workDateFilter} onChange={(event) => { setWorkDateFilter(event.target.value); setPage(1); }} /></label>
           <label><span>Persoonstype</span><select value={participantKind} onChange={(event) => { setParticipantKind(event.target.value as typeof participantKind); setPage(1); }}><option value="">Alles</option><option value="live_user">WindWilly-gebruiker</option><option value="external_person">Extern</option><option value="historical_identity">Historisch</option></select></label>
           <label><span>Project</span><select value={projectId} onChange={(event) => { setProjectId(event.target.value); setPage(1); }}><option value="">Alles</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
           <label><span>Post</span><select value={postId} onChange={(event) => { setPostId(event.target.value); setPage(1); }}><option value="">Alles</option>{postOptions.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}</select></label>
            <label><span>Sorteer op</span><select value={sortKey} onChange={(event) => { setSortKey(event.target.value as WorkHourSortKey); setPage(1); }}><option value="work_date">Datum</option><option value="name_person">Naam persoon</option><option value="type_person">Type persoon</option><option value="project">Project</option><option value="post">Post</option><option value="duration_half_hours">Aantal uren</option><option value="created_at">Aangemaakt op</option><option value="updated_at">Laatst gewijzigd op</option></select></label>
           <label><span>Volgorde</span><select value={sortDirection} onChange={(event) => { setSortDirection(event.target.value as "asc" | "desc"); setPage(1); }}><option value="desc">Aflopend</option><option value="asc">Oplopend</option></select></label>
           <label><span>Pagina grootte</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as 25 | 50 | 100); setPage(1); }}>{PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
         </div>
         <div className="section-actions">
           <button type="button" onClick={() => setPage(1)}>Ververs</button>
           <button type="button" onClick={onExportCsv}>CSV export</button>
         </div>
      </section>

      <section className="panel">
        <h2>Registreren</h2>
        <button type="button" data-hours-focus-fallback onClick={() => setShowCreateModal(true)}>Nieuwe registratie</button>
      </section>
      {showCreateModal && <AccessibleModal title="Nieuwe registratie" onClose={() => setShowCreateModal(false)} committing={createGroupMutation.isPending}>
          {errorMessage && <p className="notice error" role="alert" tabIndex={-1}>{errorMessage}</p>}
          <form onSubmit={onCreateGroup} className="form-grid">
            <label><span>Datum</span><input type="date" name="work_date" defaultValue={formatAmsterdamDateInput()} /></label>
             <div><label><span>Project</span><select id="hours-create-project" value={newGroupProjectId} aria-invalid={Boolean(createErrors.project_id)} aria-describedby={createErrors.project_id ? "hours-create-project-error" : undefined} onChange={(event) => { setNewGroupProjectId(event.target.value); setCreateErrors((current) => ({ ...current, project_id: "", post_id: "" })); setPage(1); }}><option value="">Kies een project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>{createErrors.project_id && <span id="hours-create-project-error" className="field-error">{createErrors.project_id}</span>}</div>
             <div><label><span>Post</span><select id="hours-create-post" value={newGroupPostId} aria-invalid={Boolean(createErrors.post_id)} aria-describedby={createErrors.post_id ? "hours-create-post-error" : undefined} disabled={!newGroupProjectId || newGroupPostOptions.length === 0} onChange={(event) => { setNewGroupPostId(event.target.value); if (event.target.value) setCreateErrors((current) => ({ ...current, post_id: "" })); setPage(1); }}><option value="">Kies een post</option>{newGroupPostOptions.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}</select></label>{createErrors.post_id && <span id="hours-create-post-error" className="field-error">{createErrors.post_id}</span>}</div>
            <label><span>WindWilly-persoon</span><select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} disabled={!eligibleUsers.length}><option value="">Kies een actieve gebruiker</option>{eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</select></label>
            <label><span>Externe persoon</span><select value={selectedExternalPersonId} onChange={(event) => setSelectedExternalPersonId(event.target.value)} disabled={!activeExternalPeople.length}><option value="">Kies een externe persoon</option>{activeExternalPeople.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
            <label><span>Duur (half uur)</span><input type="number" name="duration_half_hours" min={1} defaultValue={2} /></label>
            <label className="span-2"><span>Beschrijving</span><textarea name="description" rows={3} /></label>
            <div className="section-actions span-2">
              <button type="button" onClick={() => addUserParticipant("create")} disabled={!eligibleUsers.length}>Voeg WindWilly-persoon toe</button>
              <button type="button" onClick={() => addExternalParticipant("create")} disabled={!activeExternalPeople.length}>Voeg externe persoon toe</button>
            </div>
          <div className="span-2">
            <strong>Deelnemers</strong>
            {participants.length === 0 ? <p className="muted">Er is nog geen deelnemer toegevoegd; standaard wordt de huidige gebruiker gebruikt.</p> : (
              <ul>
                {participants.map((participant, index) => <li key={`${participant.kind}-${index}`}>{participant.display_name_snapshot} · {participant.display_type_snapshot}</li>)}
              </ul>
            )}
          </div>
          <div className="section-actions span-2"><button type="submit" disabled={createGroupMutation.isPending}>Opslaan</button><button type="button" onClick={() => setShowCreateModal(false)}>Annuleren</button></div>
        </form>
      </AccessibleModal>}

      <section className="panel">
        <h2>Externe personen quick-add</h2>
        <form className="form-grid" onSubmit={onQuickAddExternalPerson}>
          <label><span>Naam</span><input name="display_name" /></label>
          <label><span>E-mail</span><input name="email" type="email" /></label>
          <label><span>Notitie</span><textarea name="note" rows={2} /></label>
          <div className="section-actions span-2"><button type="submit">Opslaan</button></div>
        </form>
        {duplicateCandidates.length > 0 && (
          <div className="notice warning">
            <p>Deze persoon lijkt al te bestaan. Kies een bestaande persoon of maak bewust een nieuwe aan.</p>
            <ul>
              {duplicateCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <strong>{candidate.display_name}</strong>
                  {candidate.email ? ` · ${candidate.email}` : ""}
                  {candidate.status_label ? ` · ${candidate.status_label}` : candidate.deleted_at ? " · historisch" : candidate.is_active ? " · beschikbaar" : " · inactief"}
                  {candidate.guidance ? <span> · {candidate.guidance}</span> : null}
                  {candidate.selectable === false ? (
                    <span> · niet selecteerbaar</span>
                  ) : (
                    <button type="button" onClick={() => selectExistingCandidate(candidate)}>Kies bestaande</button>
                  )}
                </li>
              ))}
            </ul>
            <div className="section-actions">
              {duplicateConflictCode === "work_hours_external_person_advisory_conflict" && <button type="button" onClick={() => setForceCreateConfirm(true)} disabled={!pendingExternalPerson}>Toch aanmaken</button>}
            </div>
          </div>
        )}
        {selectedExternalPersonId && (
          <p className="muted">Geselecteerde bestaande persoon voor nieuwe registratie: {selectedExternalPersonCandidate?.display_name ?? activeExternalPeople.find((person) => person.id === selectedExternalPersonId)?.display_name ?? selectedExternalPersonId}</p>
        )}
      </section>

      <section className="panel">
        <h2>Overzicht</h2>
        <p className="muted">Totaal: {groupsQuery.data?.totals.total_groups ?? 0} groepen, {groupsQuery.data?.totals.total_person_hours ?? 0} persoon-uren.</p>
        <section className="work-hours-chart" aria-labelledby="work-hours-chart-title">
          <h3 id="work-hours-chart-title">Urenoverzicht</h3>
          <div className="work-hours-chart-bars" aria-hidden="true">
            <span style={{ width: `${Math.min(100, groupsQuery.data?.totals.total_duration_hours ?? 0)}%` }} />
            <span style={{ width: `${Math.min(100, groupsQuery.data?.totals.total_person_hours ?? 0)}%` }} />
          </div>
          <dl className="work-hours-chart-values">
            <div><dt>Groepsuren</dt><dd>{groupsQuery.data?.totals.total_duration_hours ?? 0}</dd></div>
            <div><dt>Persoon-uren</dt><dd>{groupsQuery.data?.totals.total_person_hours ?? 0}</dd></div>
          </dl>
        </section>
        <div className="section-actions">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Vorige</button>
          <span>Pagina {groupsQuery.data?.page ?? page} van {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Volgende</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Datum</th><th>Persoon(s)</th><th>Project</th><th>Post</th><th>Uren</th><th>Beschrijving</th><th>Acties</th></tr>
            </thead>
            <tbody>
              {(groupsQuery.data?.items ?? []).map((group) => (
                <tr key={group.id}>
                  <td>{formatAmsterdamDisplayDate(group.work_date)}</td>
                  <td>
                    <details>
                      <summary>{group.person_count} persoon/personen</summary>
                      <ul>{group.participants.map((participant) => <li key={participant.id}>{participant.display_name_snapshot} · {participant.display_type_snapshot}</li>)}</ul>
                    </details>
                  </td>
                  <td>{group.project_name}</td>
                  <td>{group.post_name}</td>
                  <td>{group.duration_hours}</td>
                  <td>{group.description}</td>
                  <td className="section-actions">
                    <button type="button" onClick={() => startEditingGroup(group)}>Bewerk</button>
                    <button type="button" onClick={() => setDeleteGroupTarget(group)}>Verwijder</button>
                    {isAdmin && group.deleted_at && <button type="button" onClick={() => restoreGroupMutation.mutate(group)}>Herstel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="work-hours-mobile-cards" aria-label="Urenregistraties">
          {(groupsQuery.data?.items ?? []).map((group) => (
            <article className="work-hours-card" key={`card-${group.id}`}>
              <h3>{formatAmsterdamDisplayDate(group.work_date)} · {group.project_name}</h3>
              <dl><div><dt>Post</dt><dd>{group.post_name}</dd></div><div><dt>Uren</dt><dd>{group.duration_hours}</dd></div><div><dt>Personen</dt><dd>{group.person_count}</dd></div><div><dt>Beschrijving</dt><dd>{group.description || "—"}</dd></div></dl>
              <ul>{group.participants.map((participant) => <li key={participant.id}>{participant.display_name_snapshot} · {participant.display_type_snapshot}</li>)}</ul>
              <div className="section-actions"><button type="button" onClick={() => startEditingGroup(group)}>Bewerk</button><button type="button" onClick={() => setDeleteGroupTarget(group)}>Verwijder</button></div>
            </article>
          ))}
        </div>
      </section>

      {editingGroup && (
        <AccessibleModal title="Registratie bewerken" onClose={() => setEditingGroup(null)} committing={updateGroupMutation.isPending}>
          {errorMessage && <p className="notice error" role="alert" tabIndex={-1}>{errorMessage}</p>}
          <form onSubmit={onSaveEditingGroup} className="form-grid">
            <label><span>Datum</span><input type="date" name="work_date" defaultValue={editingGroup.work_date} /></label>
            <label><span>Project</span><select value={editingGroupProjectId} onChange={(event) => setEditingGroupProjectId(event.target.value)}><option value="">Kies een project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label><span>Post</span><select value={editingGroupPostId} disabled={!editingGroupProjectId || editingGroupPostOptions.length === 0} onChange={(event) => setEditingGroupPostId(event.target.value)}><option value="">Kies een post</option>{editingGroupPostOptions.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}</select></label>
            <label><span>WindWilly-persoon toevoegen</span><select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} disabled={!eligibleUsers.length}><option value="">Kies een actieve gebruiker</option>{eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</select></label>
            <label><span>Externe persoon toevoegen</span><select value={selectedExternalPersonId} onChange={(event) => setSelectedExternalPersonId(event.target.value)} disabled={!activeExternalPeople.length}><option value="">Kies een actieve externe persoon</option>{activeExternalPeople.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
            <label><span>Duur (half uur)</span><input type="number" name="duration_half_hours" min={1} defaultValue={editingGroup.duration_half_hours} /></label>
            <label className="span-2"><span>Beschrijving</span><textarea name="description" rows={3} defaultValue={editingGroup.description} /></label>
            <div className="span-2">
              <strong>Deelnemers</strong>
              <div className="section-actions">
                <button type="button" onClick={() => addUserParticipant("edit")} disabled={!eligibleUsers.length}>Actieve WindWilly-persoon toevoegen</button>
                <button type="button" onClick={() => addExternalParticipant("edit")} disabled={!activeExternalPeople.length}>Actieve externe toevoegen</button>
                <button type="button" onClick={() => setEditingGroup(null)}>Annuleren</button>
              </div>
              {inactiveHistoricalExternalPeople.length > 0 && (
                <div className="muted">
                  <p>Inactieve of historische externe personen zijn alleen leesbaar:</p>
                  <ul>
                    {inactiveHistoricalExternalPeople.map((person) => (
                      <li key={person.id}>{person.display_name} · {person.deleted_at ? "historisch" : "inactief"} · niet selecteerbaar</li>
                    ))}
                  </ul>
                </div>
              )}
              {historicalIdentities.length > 0 && (
                <div className="muted">
                  <p>Historische identiteiten zijn alleen leesbaar:</p>
                  <ul>
                    {historicalIdentities.map((identity) => (
                      <li key={identity.id}>{identity.snapshot_display_label} · {identity.snapshot_name} · niet selecteerbaar</li>
                    ))}
                  </ul>
                </div>
              )}
              <ul>
                {editParticipants.map((participant, index) => (
                  <li key={`${participant.kind}-${index}`}>
                    {participant.display_name_snapshot} · {participant.display_type_snapshot}
                    <button type="button" onClick={() => removeEditingParticipant(index)}>Verwijder</button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="section-actions span-2"><button type="submit" disabled={updateGroupMutation.isPending}>Wijzigingen opslaan</button></div>
          </form>
        </AccessibleModal>
      )}

      {deleteGroupTarget && (
        <AccessibleModal title="Registratie verwijderen" onClose={() => setDeleteGroupTarget(null)} committing={deleteGroupMutation.isPending}>
          <p>Weet je zeker dat je deze registratie wilt verwijderen? De registratie blijft herstelbaar voor beheerders.</p>
          <div className="section-actions"><button type="button" disabled={deleteGroupMutation.isPending} onClick={() => deleteGroupMutation.mutate(deleteGroupTarget)}>Bevestig verwijderen</button><button type="button" disabled={deleteGroupMutation.isPending} onClick={() => setDeleteGroupTarget(null)}>Annuleren</button></div>
        </AccessibleModal>
      )}

      {restoreGroupTarget && (
        <AccessibleModal title="Registratie herstellen" onClose={() => setRestoreGroupTarget(null)} committing={restoreGroupMutation.isPending}>
          <p>Herstel deze registratie met de volledige deelnemershistorie?</p>
          <div className="section-actions"><button type="button" disabled={restoreGroupMutation.isPending} onClick={() => restoreGroupMutation.mutate(restoreGroupTarget)}>Bevestig herstellen</button><button type="button" disabled={restoreGroupMutation.isPending} onClick={() => setRestoreGroupTarget(null)}>Annuleren</button></div>
        </AccessibleModal>
      )}

      {forceCreateConfirm && pendingExternalPerson && (
        <AccessibleModal title="Nieuwe persoon toch aanmaken" onClose={() => setForceCreateConfirm(false)} committing={personMutation.isPending}>
          <p>De naam lijkt op een bestaande persoon. Bevestig alleen wanneer dit echt een andere persoon is.</p>
          <div className="section-actions"><button type="button" disabled={personMutation.isPending} onClick={() => void createPendingExternalPerson(true).then(() => setForceCreateConfirm(false))}>Bewust nieuw aanmaken</button><button type="button" disabled={personMutation.isPending} onClick={() => setForceCreateConfirm(false)}>Annuleren</button></div>
        </AccessibleModal>
      )}

      {mergeSource && (
        <AccessibleModal title="Externe personen samenvoegen" onClose={() => setMergeSource(null)} committing={mergePersonMutation.isPending}>
          {errorMessage && <p className="notice error" role="alert" tabIndex={-1}>{errorMessage}</p>}
          <label><span>Doelpersoon</span><select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}><option value="">Kies een andere persoon</option>{externalPeople.filter((person) => person.id !== mergeSource.id && person.is_active).map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
          <div className="section-actions"><button type="button" disabled={!mergeTargetId || mergePersonMutation.isPending} onClick={() => { const target = externalPeople.find((person) => person.id === mergeTargetId); if (target) mergePersonMutation.mutate({ personId: mergeSource.id, payload: { target_id: target.id, expected_source_row_version: mergeSource.row_version, expected_target_row_version: target.row_version } }); }}>Samenvoegen</button><button type="button" disabled={mergePersonMutation.isPending} onClick={() => setMergeSource(null)}>Annuleren</button></div>
        </AccessibleModal>
      )}

      {currentUser?.is_admin && (
        <section className="panel">
          <h2>Beheer</h2>
          <div className="panel-grid">
            <form className="panel" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void projectMutation.mutateAsync({ name: String(data.get("name") ?? ""), description: String(data.get("description") ?? "") }); event.currentTarget.reset(); }}>
              <h3>Project</h3>
              <label><span>Naam</span><input name="name" /></label>
              <label><span>Beschrijving</span><textarea name="description" rows={2} /></label>
              <button type="submit">Project aanmaken</button>
            </form>
            <form className="panel" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void postMutation.mutateAsync({ project_id: String(data.get("project_id") ?? ""), name: String(data.get("name") ?? ""), description: String(data.get("description") ?? "") }); event.currentTarget.reset(); }}>
              <h3>Post</h3>
              <label><span>Project</span><select name="project_id">{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label><span>Naam</span><input name="name" /></label>
              <label><span>Beschrijving</span><textarea name="description" rows={2} /></label>
              <button type="submit">Post aanmaken</button>
            </form>
            <section className="panel">
              <h3>Import/backup</h3>
              <p>Controleer een JSON-back-up altijd in preview voordat je deze bevestigt.</p>
              <button type="button" onClick={() => setShowImportModal(true)}>Open import en backup</button>
            </section>
            {showImportModal && <AccessibleModal title="Import en backup" onClose={() => setShowImportModal(false)} committing={previewImportMutation.isPending || commitImportMutation.isPending}>
              {errorMessage && <p className="notice error" role="alert" tabIndex={-1}>{errorMessage}</p>}
              <form onSubmit={(event) => { event.preventDefault(); void onPreviewImport(); }}>
              <label><span>Modus</span><select value={importMode} onChange={(event) => setImportMode(event.target.value as "merge" | "full_restore") }><option value="merge">Merge</option><option value="full_restore">Full restore</option></select></label>
              <label><span>JSON backup</span><textarea rows={10} value={importJson} onChange={(event) => setImportJson(event.target.value)} /></label>
               <div className="section-actions"><button type="submit">Preview</button><button type="button" disabled={!previewBatchId || !previewResult?.backup_download_url || previewResult?.status === "conflict" || (previewResult?.errors.length ?? 0) > 0} onClick={() => void onCommitImport()}>Commit</button><button type="button" disabled={!previewResult?.backup_download_url} onClick={() => void onDownloadBackup()}>Download backup</button></div>
              {previewResult && (
                <div className="notice">
                  <p>Preview batch {previewResult.batch_id} — {previewResult.status}</p>
                  <p>Count: {JSON.stringify(previewResult.counts)}</p>
                  {previewResult.warnings.length > 0 && <p>Waarschuwingen: {previewResult.warnings.join(" · ")}</p>}
                  {previewResult.errors.length > 0 && <p>Fouten: {previewResult.errors.join(" · ")}</p>}
                </div>
              )}
               {previewResult?.backup_download_url && <p>Back-up beschikbaar: {previewResult.backup_download_url}</p>}
               {backupDownloadUrl && <p>Back-up gedownload: {backupDownloadUrl}</p>}
              <button type="button" onClick={() => setShowImportModal(false)}>Sluiten</button>
              </form>
            </AccessibleModal>}
          </div>
          <div className="panel-grid">
            <section className="panel">
              <h3>Projecten</h3>
              <label><input type="checkbox" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} /> Gearchiveerd/verwijderd tonen</label>
              <ul>
                {adminProjects.map((project) => (
                  <li key={project.id}>
                    {project.name} {project.is_archived ? "· gearchiveerd" : ""}
                    <button type="button" onClick={() => startEditingProject(project)}>Bewerk</button>
                     <button type="button" onClick={() => archiveProjectMutation.mutate(project)}>Archiveer</button>
                     <button type="button" onClick={() => restoreProjectMutation.mutate(project)}>Herstel</button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h3>Posten</h3>
              <ul>
                {adminPosts.map((post) => (
                  <li key={post.id}>
                    {post.name} · {(projectOptions.find((project) => project.id === post.project_id)?.name) || post.project_id}
                    <button type="button" onClick={() => startEditingPost(post)}>Bewerk</button>
                     <button type="button" onClick={() => archivePostMutation.mutate(post)}>Archiveer</button>
                     <button type="button" onClick={() => restorePostMutation.mutate(post)}>Herstel</button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h3>Externe personen</h3>
              <ul>
                {adminPeople.map((person) => (
                  <li key={person.id}>
                    {person.display_name} {person.deleted_at ? "· verwijderd" : ""}
                    <button type="button" onClick={() => startEditingPerson(person)}>Bewerk</button>
                    <button type="button" onClick={() => { setMergeSource(person); setMergeTargetId(""); }}>Samenvoegen</button>
                     <button type="button" onClick={() => archivePersonMutation.mutate(person)}>Archiveer</button>
                     <button type="button" onClick={() => restorePersonMutation.mutate(person)}>Herstel</button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h3>Verwijderde registraties</h3>
              <button type="button" onClick={() => setShowDeleted((current) => !current)}>{showDeleted ? "Verberg" : "Toon"} verwijderde items</button>
              {showDeleted && (
                <ul>
                  {(deletedGroupsQuery.data?.items ?? []).map((group) => (
                    <li key={group.id}>
                       {formatAmsterdamDisplayDate(group.work_date)} · {group.project_name} · {group.post_name}
                       <button type="button" onClick={() => setRestoreGroupTarget(group)}>Herstel groep</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <h3>Historie en identiteiten</h3>
              <p className="muted">Alleen beheerders zien verwijderde personen en historische koppelingen.</p>
              <div className="form-grid">
                <label><span>Type historie</span><select value={historyKind} onChange={(event) => { setHistoryKind(event.target.value as typeof historyKind); setHistoryPage(1); }}><option value="">Alles</option><option value="project">Projecten</option><option value="post">Posten</option><option value="external_person">Externe personen</option><option value="historical_identity">Historische identiteiten</option></select></label>
                <label><span>Zoek historie</span><input value={historyQueryText} onChange={(event) => { setHistoryQueryText(event.target.value); setHistoryPage(1); }} /></label>
                <label><span>Historie per pagina</span><select value={historyPageSize} onChange={(event) => { setHistoryPageSize(Number(event.target.value) as 25 | 50 | 100); setHistoryPage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
              </div>
              <ul>
                {(historyQuery.data?.items ?? []).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    {item.display_name || item.id} · {item.kind.replace("_", " ")}
                    {item.kind === "project" && <button type="button" onClick={() => restoreProjectMutation.mutate({ id: item.id, row_version: item.row_version })}>Herstel project</button>}
                    {item.kind === "post" && <button type="button" onClick={() => restorePostMutation.mutate({ id: item.id, row_version: item.row_version })}>Herstel post</button>}
                    {item.kind === "external_person" && <button type="button" onClick={() => restorePersonMutation.mutate({ id: item.id, display_name: item.display_name, row_version: item.row_version })}>Herstel persoon</button>}
                    {item.kind === "historical_identity" && eligibleUsers[0] && <button type="button" onClick={() => relinkIdentityMutation.mutate({ identityId: item.id, userId: eligibleUsers[0].id, rowVersion: item.row_version })}>Koppel aan {eligibleUsers[0].full_name || eligibleUsers[0].username}</button>}
                  </li>
                ))}
              </ul>
              <div className="section-actions"><button type="button" disabled={historyPage <= 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}>Vorige historiepagina</button><span>Historiepagina {historyPage}</span><button type="button" disabled={historyPage * historyPageSize >= (historyQuery.data?.total ?? 0)} onClick={() => setHistoryPage((current) => current + 1)}>Volgende historiepagina</button></div>
            </section>
          </div>
        </section>
      )}

      {editingProject && (
        <AccessibleModal title="Project bewerken" onClose={() => setEditingProject(null)}>
          <form onSubmit={onSaveEditingProject} className="form-grid">
            <label><span>Naam</span><input name="name" defaultValue={editingProject.name} /></label>
            <label className="span-2"><span>Beschrijving</span><textarea name="description" rows={3} defaultValue={editingProject.description} /></label>
            <div className="section-actions span-2"><button type="submit">Opslaan</button><button type="button" onClick={() => setEditingProject(null)}>Annuleren</button></div>
          </form>
        </AccessibleModal>
      )}

      {editingPost && (
        <AccessibleModal title="Post bewerken" onClose={() => setEditingPost(null)}>
          <form onSubmit={onSaveEditingPost} className="form-grid">
            <label><span>Naam</span><input name="name" defaultValue={editingPost.name} /></label>
            <label className="span-2"><span>Beschrijving</span><textarea name="description" rows={3} defaultValue={editingPost.description} /></label>
            <div className="section-actions span-2"><button type="submit">Opslaan</button><button type="button" onClick={() => setEditingPost(null)}>Annuleren</button></div>
          </form>
        </AccessibleModal>
      )}

      {editingPerson && (
        <AccessibleModal title="Externe persoon bewerken" onClose={() => setEditingPerson(null)}>
          <form onSubmit={onSaveEditingPerson} className="form-grid">
            <label><span>Naam</span><input name="display_name" defaultValue={editingPerson.display_name} /></label>
            <label><span>E-mail</span><input name="email" defaultValue={editingPerson.email ?? ""} /></label>
            <label className="span-2"><span>Notitie</span><textarea name="note" rows={3} defaultValue={editingPerson.note} /></label>
            <div className="section-actions span-2"><button type="submit">Opslaan</button><button type="button" onClick={() => setEditingPerson(null)}>Annuleren</button></div>
          </form>
        </AccessibleModal>
      )}

      {currentUser?.is_admin && (
        <section className="panel">
          <h2>Audit</h2>
          <div className="form-grid" aria-label="Auditfilters">
            <label><span>Actor-ID</span><input value={auditFilters.actor} onChange={(event) => { setAuditFilters((current) => ({ ...current, actor: event.target.value })); setAuditPage(1); }} /></label>
            <label><span>Actie</span><input value={auditFilters.action} onChange={(event) => { setAuditFilters((current) => ({ ...current, action: event.target.value })); setAuditPage(1); }} /></label>
            <label><span>Resultaat</span><input value={auditFilters.result} onChange={(event) => { setAuditFilters((current) => ({ ...current, result: event.target.value })); setAuditPage(1); }} /></label>
            <label><span>HTTP-methode</span><input value={auditFilters.method} onChange={(event) => { setAuditFilters((current) => ({ ...current, method: event.target.value })); setAuditPage(1); }} /></label>
            <label><span>Requestpad</span><input value={auditFilters.path} onChange={(event) => { setAuditFilters((current) => ({ ...current, path: event.target.value })); setAuditPage(1); }} /></label>
            <label><span>Vanaf</span><input type="datetime-local" value={auditFilters.from} onChange={(event) => { setAuditFilters((current) => ({ ...current, from: event.target.value })); setAuditPage(1); }} /></label>
            <label><span>Tot en met</span><input type="datetime-local" value={auditFilters.to} onChange={(event) => { setAuditFilters((current) => ({ ...current, to: event.target.value })); setAuditPage(1); }} /></label>
            <label><span>Auditregels per pagina</span><select value={auditPageSize} onChange={(event) => { setAuditPageSize(Number(event.target.value) as 25 | 50 | 100); setAuditPage(1); }}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
          </div>
          <ul>
            {auditEvents.map((event) => (
              <li key={event.id}>{event.actor_display_name} · {formatAmsterdamDateTime(event.created_at)} · {event.action} · {event.request_method} {event.request_path} · {event.result}</li>
            ))}
          </ul>
          <div className="section-actions">
            <button type="button" disabled={auditPage <= 1 || (auditQuery.data?.total ?? 0) === 0} onClick={() => setAuditPage((current) => Math.max(1, current - 1))}>Vorige auditpagina</button>
            <span>Auditpagina {auditQuery.data?.page ?? auditPage} van {Math.max(1, Math.ceil((auditQuery.data?.total ?? 0) / auditPageSize))} · totaal {auditQuery.data?.total ?? 0}</span>
            <button type="button" disabled={auditPage * auditPageSize >= (auditQuery.data?.total ?? 0)} onClick={() => setAuditPage((current) => current + 1)}>Volgende auditpagina</button>
          </div>
        </section>
      )}
    </section>
  );
}
