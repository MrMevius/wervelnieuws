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
  downloadWorkHoursCsv,
  restoreWorkHourGroup,
  listWorkHoursAdminHistory,
  listWorkHoursAdminMasterdata,
  relinkWorkHistoricalIdentity,
  type WorkHourGroup,
  type WorkHourParticipant,
  type WorkHourExternalPerson,
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

function ColumnFilter({ label, active, search, setSearch, onReset, children, searchable = true }: { label: string; active: boolean; search: string; setSearch: (value: string) => void; onReset: () => void; children: ReactNode; searchable?: boolean }) {
  return (
    <details className="work-hours-column-filter">
      <summary aria-label={`Filter ${label}`} title={`Filter ${label}`}>{label}<span aria-hidden="true"> ▾</span>{active && <span className="filter-active-dot" aria-label="filter actief">●</span>}</summary>
      <div className="work-hours-filter-menu">
        {searchable && <label><span>Zoek {label.toLowerCase()}</span><input value={search} onChange={(event) => setSearch(event.target.value)} /></label>}
        <div className="work-hours-filter-options">{children}</div>
        <button type="button" onClick={onReset}>Filter {label.toLowerCase()} wissen</button>
      </div>
    </details>
  );
}

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
  const desktopCreateFormRef = useRef<HTMLFormElement>(null);
  const mobileCreateFormRef = useRef<HTMLFormElement>(null);
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
  const [participantQuery, setParticipantQuery] = useState("");
  const [sortKey, setSortKey] = useState<WorkHourSortKey>("work_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showDeleted, setShowDeleted] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WorkHourGroup | null>(null);
  const [showParticipantEditor, setShowParticipantEditor] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<WorkHourGroup | null>(null);
  const [restoreGroupTarget, setRestoreGroupTarget] = useState<WorkHourGroup | null>(null);
  const [forceCreateConfirm, setForceCreateConfirm] = useState(false);
  const [mergeSource, setMergeSource] = useState<WorkHourExternalPerson | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<25 | 50 | 100>(25);
  const [historyKind, setHistoryKind] = useState<"" | "post" | "external_person" | "historical_identity">("");
  const [historyQueryText, setHistoryQueryText] = useState("");
  const [editingPerson, setEditingPerson] = useState<WorkHourExternalPerson | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [editParticipants, setEditParticipants] = useState<ParticipantEditDraft[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateConflictCode, setDuplicateConflictCode] = useState("");
  const [pendingExternalPerson, setPendingExternalPerson] = useState<ExternalPersonDraft | null>(null);
  const [selectedExternalPersonId, setSelectedExternalPersonId] = useState("");
  const [selectedExternalPersonCandidate, setSelectedExternalPersonCandidate] = useState<DuplicateCandidate | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [filterSearches, setFilterSearches] = useState({ project: "", post: "", person: "", type: "" });

  const sharedFilters = useMemo(
    () => ({
      project_id: projectId || undefined,
      post_id: postId || undefined,
      work_date: workDateFilter || undefined,
      participant_kind: participantKind || undefined,
      participant_query: participantQuery || undefined,
      query: query || undefined,
      sort_key: sortKey,
      sort_direction: sortDirection
    }),
    [projectId, postId, workDateFilter, participantKind, participantQuery, query, sortKey, sortDirection]
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
  const normalizedPosts = useMemo(() => (metaQuery.data?.posts ?? []).map((post) => ({ ...post, name: post.name ?? post.display_name ?? "", description: post.description ?? "", row_version: post.row_version ?? 1 })), [metaQuery.data?.posts]);
  const postOptions = normalizedPosts;
  const filterProjectOptions = useMemo(() => {
    const combined = [...projectOptions, ...(metaQuery.data?.filter_projects ?? []).map((item) => ({ ...item, name: item.name ?? item.display_name ?? "" }))];
    return Array.from(new Map(combined.map((item) => [item.id, item])).values());
  }, [projectOptions, metaQuery.data?.filter_projects]);
  const filterPostOptions = useMemo(() => {
    const combined = [...postOptions, ...(metaQuery.data?.filter_posts ?? []).map((item) => ({ ...item, name: item.name ?? item.display_name ?? "" }))];
    return Array.from(new Map(combined.map((item) => [item.id, item])).values());
  }, [postOptions, metaQuery.data?.filter_posts]);
  const externalPeople = useMemo(() => (metaQuery.data?.external_people ?? []).map((person) => ({ ...person, email: person.email ?? null, note: person.note ?? "", is_active: person.is_active ?? person.selectable ?? true, row_version: person.row_version ?? 1 })), [metaQuery.data?.external_people]);
  const activeExternalPeople = useMemo(() => externalPeople.filter((person) => person.is_active && !person.deleted_at), [externalPeople]);
  const inactiveHistoricalExternalPeople = useMemo(() => externalPeople.filter((person) => !person.is_active || person.deleted_at), [externalPeople]);
  const historicalIdentities = useMemo(() => (metaQuery.data?.historical_identities ?? []).map((identity) => ({ ...identity, snapshot_display_label: identity.snapshot_display_label ?? identity.display_name ?? "Historische identiteit", snapshot_name: identity.snapshot_name ?? identity.display_name ?? "" })), [metaQuery.data?.historical_identities]);
  const eligibleUsers = useMemo(() => (metaQuery.data?.eligible_users ?? []).map((user) => ({ ...user, username: user.username ?? user.display_name ?? "Gebruiker", full_name: user.full_name ?? user.display_name ?? null, email: user.email ?? null })), [metaQuery.data?.eligible_users]);
  const filterParticipantNames = useMemo(() => Array.from(new Set([...(metaQuery.data?.filter_participants ?? []), ...eligibleUsers.map((item) => item.full_name || item.username), ...activeExternalPeople.map((item) => item.display_name)])), [metaQuery.data?.filter_participants, eligibleUsers, activeExternalPeople]);
  const currentUser = currentUserQuery.data;
  const isAdmin = Boolean(currentUser?.is_admin);
  const historyParams = { page: historyPage, page_size: historyPageSize, kind: historyKind || undefined, query: historyQueryText.trim() || undefined, sort_key: "display_name" as const, sort_direction: "asc" as const };
  const historyQuery = useQuery({ queryKey: ["work-hours-admin-history", historyParams], queryFn: () => listWorkHoursAdminHistory(historyParams), enabled: isAdmin });
  const adminMasterdataQuery = useQuery({ queryKey: ["work-hours-admin-masterdata"], queryFn: listWorkHoursAdminMasterdata, enabled: isAdmin });
  const totalPages = Math.max(1, Math.ceil((groupsQuery.data?.total ?? 0) / pageSize));
  const newGroupPostOptions = normalizedPosts;
  const editingGroupPostOptions = normalizedPosts;
  const adminPeople = adminMasterdataQuery.data?.external_people ?? [];

  async function invalidateAdminMasterdata() {
    await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] });
    await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-masterdata"] });
    await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-history"] });
  }

  useEffect(() => {
    if (newGroupPostOptions.length === 0) {
      setNewGroupPostId("");
      return;
    }
    if (!newGroupPostOptions.some((post) => post.id === newGroupPostId)) {
      setNewGroupPostId("");
    }
  }, [newGroupPostId, newGroupPostOptions]);

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
    if (editingGroupPostOptions.length === 0) {
      setEditingGroupPostId("");
      return;
    }
    if (!editingGroupPostOptions.some((post) => post.id === editingGroupPostId)) {
      setEditingGroupPostId("");
    }
  }, [editingGroupPostId, editingGroupPostOptions]);

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
      resetCreate();
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

  const personMutation = useMutation({
    mutationFn: createWorkExternalPerson,
    onSuccess: async (created) => {
      setStatusMessage("Externe persoon opgeslagen.");
      setSelectedExternalPersonId(created.id);
      setSelectedExternalPersonCandidate(created);
      setDuplicateCandidates([]);
      setDuplicateConflictCode("");
      setPendingExternalPerson(null);
      setParticipants((current) => current.some((item) => item.kind === "external_person" && item.external_person_id === created.id) ? current : [...current, { kind: "external_person", external_person_id: created.id, display_name_snapshot: created.display_name, display_email_snapshot: created.email || "", display_type_snapshot: "Extern" }]);
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
    if (!selectedExternalPersonId) return undefined;
    return activeExternalPeople.find((person) => person.id === selectedExternalPersonId);
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

  function clearCreateError(field: string) {
    setCreateErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetCreate(form?: HTMLFormElement | null) {
    form?.reset();
    desktopCreateFormRef.current?.reset();
    mobileCreateFormRef.current?.reset();
    document.querySelectorAll<HTMLFormElement>(".work-hours-quick-add, .work-hours-mobile-quick-add").forEach((quickAddForm) => quickAddForm.reset());
    setNewGroupProjectId("");
    setNewGroupPostId("");
    setSelectedUserId("");
    setSelectedExternalPersonId("");
    setParticipants([]);
    setCreateErrors({});
    setErrorMessage(null);
    setShowParticipantEditor(false);
    setDuplicateCandidates([]);
    setDuplicateConflictCode("");
    setPendingExternalPerson(null);
    setSelectedExternalPersonCandidate(null);
  }

  function startEditingPerson(person: WorkHourExternalPerson) {
    setEditingPerson(person);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function onCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const workDate = String(data.get("work_date") ?? formatAmsterdamDateInput());
    const project = newGroupProjectId;
    const post = newGroupPostId;
    const description = String(data.get("description") ?? "");
    const durationHalfHours = Number(data.get("duration_half_hours") ?? 2);
    if (!workDate || workDate > formatAmsterdamDateInput() || !project || !post || !newGroupPostOptions.some((item) => item.id === post) || !Number.isInteger(durationHalfHours) || durationHalfHours < 1 || durationHalfHours > 48) {
      const errors = {
        ...(!workDate || workDate > formatAmsterdamDateInput() ? { work_date: "Kies een geldige datum die niet in de toekomst ligt." } : {}),
        ...(!project ? { project_id: "Kies een project." } : {}),
        ...(!post || !newGroupPostOptions.some((item) => item.id === post) ? { post_id: "Kies een post." } : {}),
        ...(!Number.isInteger(durationHalfHours) || durationHalfHours < 1 || durationHalfHours > 48 ? { duration_half_hours: "Kies 0,5 tot en met 24 uur." } : {})
      };
      setCreateErrors(errors);
      setErrorMessage("Controleer de gemarkeerde velden.");
      const prefix = form.classList.contains("work-hours-mobile-create") ? "hours-mobile-create" : "hours-create";
      const fieldIds: Record<string, string> = {
        work_date: `${prefix}-date`,
        project_id: `${prefix}-project`,
        post_id: `${prefix}-post`,
        duration_half_hours: `${prefix}-duration`,
      };
      requestAnimationFrame(() => document.getElementById(fieldIds[Object.keys(errors)[0]])?.focus());
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
    resetCreate(form);
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
    const form = event.currentTarget;
    const data = new FormData(form);
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
      form.reset();
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

  async function onExportCsv() {
    const blob = await downloadWorkHoursCsv(sharedFilters);
    downloadBlob(blob, "urenverantwoording.csv");
  }

  return (
    <section className="main-dashboard uren-module-page">
      <header className="panel">
        <p className="eyebrow">Urenverantwoording</p>
        <h1>Urenregistratie</h1>
        <p>Registreer groepen compact inline; projecten en globale posten beheer je centraal in Admin.</p>
        {statusMessage && <p className="notice success" role="status" aria-live="polite">{statusMessage}</p>}
        {errorMessage && <p className="notice error" role="alert">{errorMessage}</p>}
      </header>

      <section className="panel">
        <div className="work-hours-overview-heading"><h2>Overzicht en registreren</h2><button type="button" onClick={() => { setProjectId(""); setPostId(""); setWorkDateFilter(""); setParticipantKind(""); setParticipantQuery(""); setQuery(""); setPage(1); }}>Alle filters wissen</button></div>
        <dl className="work-hours-totals" aria-label="Totalen over gefilterde registraties">
          <div><dt>Groepen</dt><dd>{groupsQuery.data?.totals.total_groups ?? 0}</dd></div><div><dt>Personen</dt><dd>{groupsQuery.data?.totals.total_people ?? 0}</dd></div><div><dt>Groepsuren</dt><dd>{groupsQuery.data?.totals.total_duration_hours ?? 0}</dd></div><div><dt>Persoon-uren</dt><dd>{groupsQuery.data?.totals.total_person_hours ?? 0}</dd></div>
        </dl>
        <div className="work-hours-toolbar"><label>Sorteer <select value={sortKey} onChange={(event) => { setSortKey(event.target.value as WorkHourSortKey); setPage(1); }}><option value="work_date">Datum</option><option value="name_person">Naam</option><option value="type_person">Type</option><option value="project">Project</option><option value="post">Post</option><option value="duration_half_hours">Uren</option></select></label><label>Volgorde <select value={sortDirection} onChange={(event) => { setSortDirection(event.target.value as "asc" | "desc"); setPage(1); }}><option value="desc">Aflopend</option><option value="asc">Oplopend</option></select></label><label>Per pagina <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as 25 | 50 | 100); setPage(1); }}>{PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button type="button" onClick={onExportCsv}>CSV export</button></div>
        <div className="section-actions">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Vorige</button>
          <span>Pagina {groupsQuery.data?.page ?? page} van {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Volgende</button>
        </div>
        <div className="table-wrap">
          <form ref={desktopCreateFormRef} id="work-hours-create-form" onSubmit={onCreateGroup} />
          <table>
            <thead>
              <tr>
                <th><ColumnFilter label="Datum" active={Boolean(workDateFilter)} search="" setSearch={() => undefined} searchable={false} onReset={() => { setWorkDateFilter(""); setPage(1); }}><input aria-label="Kies filterdatum" type="date" value={workDateFilter} onChange={(event) => { setWorkDateFilter(event.target.value); setPage(1); }} />{(metaQuery.data?.filter_dates ?? []).map((value) => <button type="button" key={value} onClick={() => { setWorkDateFilter(value); setPage(1); }}>{formatAmsterdamDisplayDate(value)}</button>)}</ColumnFilter></th>
                <th><ColumnFilter label="Persoon" active={Boolean(participantQuery || participantKind)} search={filterSearches.person} setSearch={(value) => setFilterSearches((current) => ({ ...current, person: value }))} onReset={() => { setParticipantQuery(""); setParticipantKind(""); setPage(1); }}>{filterParticipantNames.filter((name) => name.toLowerCase().includes(filterSearches.person.toLowerCase())).map((name) => <button type="button" key={name} aria-pressed={participantQuery === name} onClick={() => { setParticipantQuery(name); setPage(1); }}>{name}</button>)}</ColumnFilter></th>
                <th><ColumnFilter label="Project" active={Boolean(projectId)} search={filterSearches.project} setSearch={(value) => setFilterSearches((current) => ({ ...current, project: value }))} onReset={() => { setProjectId(""); setPage(1); }}>{filterProjectOptions.filter((item) => item.name.toLowerCase().includes(filterSearches.project.toLowerCase())).map((item) => <button type="button" key={item.id} aria-pressed={projectId === item.id} onClick={() => { setProjectId(item.id); setPage(1); }}>{item.name}{item.selectable === false ? " · historisch" : ""}</button>)}</ColumnFilter></th>
                <th><ColumnFilter label="Post" active={Boolean(postId)} search={filterSearches.post} setSearch={(value) => setFilterSearches((current) => ({ ...current, post: value }))} onReset={() => { setPostId(""); setPage(1); }}>{filterPostOptions.filter((item) => item.name.toLowerCase().includes(filterSearches.post.toLowerCase())).map((item) => <button type="button" key={item.id} aria-pressed={postId === item.id} onClick={() => { setPostId(item.id); setPage(1); }}>{item.name}{item.selectable === false ? " · historisch" : ""}</button>)}</ColumnFilter></th>
                <th>Uren</th>
                <th><ColumnFilter label="Zoeken" active={Boolean(query)} search={query} setSearch={(value) => { setQuery(value); setPage(1); }} onReset={() => { setQuery(""); setPage(1); }}><span className="muted">Zoekt in beschrijving, project en post.</span></ColumnFilter></th>
                <th><ColumnFilter label="Type" active={Boolean(participantKind)} search={filterSearches.type} setSearch={(value) => setFilterSearches((current) => ({ ...current, type: value }))} onReset={() => { setParticipantKind(""); setPage(1); }}>{[["live_user", "WindWilly-gebruiker"], ["external_person", "Extern"], ["historical_identity", "Historisch"]].filter(([, label]) => label.toLowerCase().includes(filterSearches.type.toLowerCase())).map(([value, label]) => <button type="button" key={value} aria-pressed={participantKind === value} onClick={() => { setParticipantKind(value as typeof participantKind); setPage(1); }}>{label}</button>)}</ColumnFilter></th>
              </tr>
            </thead>
            <tbody>
              <tr className="work-hours-create-row">
                <td><label className="sr-only" htmlFor="hours-create-date">Datum</label><input form="work-hours-create-form" id="hours-create-date" name="work_date" type="date" defaultValue={formatAmsterdamDateInput()} aria-invalid={Boolean(createErrors.work_date)} aria-describedby={createErrors.work_date ? "hours-create-date-error" : undefined} onChange={(event) => { if (event.target.value && event.target.value <= formatAmsterdamDateInput()) clearCreateError("work_date"); }} />{createErrors.work_date && <span id="hours-create-date-error" className="field-error">{createErrors.work_date}</span>}</td>
                <td><button type="button" aria-expanded={showParticipantEditor} onClick={() => setShowParticipantEditor((current) => !current)}>{participants.length || 1} deelnemer(s)</button></td>
                <td><select form="work-hours-create-form" id="hours-create-project" aria-label="Project voor nieuwe registratie" value={newGroupProjectId} aria-invalid={Boolean(createErrors.project_id)} aria-describedby={createErrors.project_id ? "hours-create-project-error" : undefined} onChange={(event) => { setNewGroupProjectId(event.target.value); if (event.target.value) clearCreateError("project_id"); }}><option value="">Kies project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>{createErrors.project_id && <span id="hours-create-project-error" className="field-error">{createErrors.project_id}</span>}</td>
                <td><select form="work-hours-create-form" id="hours-create-post" aria-label="Post voor nieuwe registratie" value={newGroupPostId} aria-invalid={Boolean(createErrors.post_id)} aria-describedby={createErrors.post_id ? "hours-create-post-error" : undefined} onChange={(event) => { setNewGroupPostId(event.target.value); if (event.target.value) clearCreateError("post_id"); }}><option value="">Kies post</option>{newGroupPostOptions.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}</select>{createErrors.post_id && <span id="hours-create-post-error" className="field-error">{createErrors.post_id}</span>}</td>
                <td><input form="work-hours-create-form" id="hours-create-duration" aria-label="Duur in halve uren" name="duration_half_hours" type="number" min={1} max={48} defaultValue={2} aria-invalid={Boolean(createErrors.duration_half_hours)} aria-describedby={createErrors.duration_half_hours ? "hours-create-duration-error" : undefined} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 48) clearCreateError("duration_half_hours"); }} />{createErrors.duration_half_hours && <span id="hours-create-duration-error" className="field-error">{createErrors.duration_half_hours}</span>}</td>
                <td><input form="work-hours-create-form" aria-label="Beschrijving nieuwe registratie" name="description" placeholder="Beschrijving" /></td>
                <td className="work-hours-row-actions"><button form="work-hours-create-form" type="submit" aria-label="Registratie opslaan" title="Opslaan" disabled={createGroupMutation.isPending}>✓</button><button type="button" aria-label="Nieuwe registratie resetten" title="Reset" onClick={() => resetCreate(desktopCreateFormRef.current)}>↺</button></td>
              </tr>
              {showParticipantEditor && <tr className="work-hours-create-expanded"><td colSpan={7}><div className="work-hours-participant-editor"><label>WindWilly-persoon <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Kies een actieve gebruiker</option>{eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</select></label><button type="button" onClick={() => addUserParticipant("create")}>Deelnemer toevoegen</button><label>Externe persoon <select value={selectedExternalPersonId} onChange={(event) => setSelectedExternalPersonId(event.target.value)}><option value="">Kies een actieve externe persoon</option>{activeExternalPeople.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><button type="button" onClick={() => addExternalParticipant("create")}>Externe toevoegen</button><ul>{participants.map((participant, index) => <li key={`${participant.kind}-${index}`}>{participant.display_name_snapshot}<button type="button" aria-label={`Verwijder ${participant.display_name_snapshot}`} onClick={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></li>)}</ul><form className="work-hours-quick-add" onSubmit={onQuickAddExternalPerson}><strong>Externe persoon snel toevoegen</strong><input name="display_name" aria-label="Naam externe persoon" placeholder="Naam" required /><input name="email" type="email" aria-label="E-mail externe persoon" placeholder="E-mail (optioneel)" /><input name="note" aria-label="Notitie externe persoon" placeholder="Notitie" /><button type="submit">Aanmaken en toevoegen</button></form>{duplicateCandidates.length > 0 && <div className="notice warning"><p>Mogelijke dubbele persoon.</p>{duplicateCandidates.map((candidate) => <button type="button" key={candidate.id} disabled={candidate.selectable === false} onClick={() => selectExistingCandidate(candidate)}>Kies {candidate.display_name}</button>)}{duplicateConflictCode === "work_hours_external_person_advisory_conflict" && <button type="button" onClick={() => setForceCreateConfirm(true)}>Toch aanmaken</button>}</div>}</div></td></tr>}
              {(groupsQuery.data?.items ?? []).map((group) => (
                <tr key={group.id} className="work-hours-data-row">
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
                  <td className="work-hours-row-actions">
                    <button type="button" aria-label={`Bewerk registratie ${group.project_name}`} title="Bewerk" onClick={() => startEditingGroup(group)}>✎</button>
                    <button type="button" aria-label={`Verwijder registratie ${group.project_name}`} title="Verwijder" onClick={() => setDeleteGroupTarget(group)}>×</button>
                    {isAdmin && group.deleted_at && <button type="button" aria-label="Herstel registratie" title="Herstel" onClick={() => restoreGroupMutation.mutate(group)}>↺</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="work-hours-mobile-create-card" aria-labelledby="hours-mobile-create-title">
          <h3 id="hours-mobile-create-title">Nieuwe registratie</h3>
          <form ref={mobileCreateFormRef} className="work-hours-mobile-create" onSubmit={onCreateGroup}>
            <label>Datum<input id="hours-mobile-create-date" name="work_date" type="date" defaultValue={formatAmsterdamDateInput()} aria-invalid={Boolean(createErrors.work_date)} aria-describedby={createErrors.work_date ? "hours-mobile-create-date-error" : undefined} onChange={(event) => { if (event.target.value && event.target.value <= formatAmsterdamDateInput()) clearCreateError("work_date"); }} /></label>
            {createErrors.work_date && <span id="hours-mobile-create-date-error" className="field-error">{createErrors.work_date}</span>}
            <label>Project<select id="hours-mobile-create-project" aria-label="Project voor nieuwe registratie mobiel" value={newGroupProjectId} aria-invalid={Boolean(createErrors.project_id)} aria-describedby={createErrors.project_id ? "hours-mobile-create-project-error" : undefined} onChange={(event) => { setNewGroupProjectId(event.target.value); if (event.target.value) clearCreateError("project_id"); }}><option value="">Kies project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            {createErrors.project_id && <span id="hours-mobile-create-project-error" className="field-error">{createErrors.project_id}</span>}
            <label>Post<select id="hours-mobile-create-post" aria-label="Post voor nieuwe registratie mobiel" value={newGroupPostId} aria-invalid={Boolean(createErrors.post_id)} aria-describedby={createErrors.post_id ? "hours-mobile-create-post-error" : undefined} onChange={(event) => { setNewGroupPostId(event.target.value); if (event.target.value) clearCreateError("post_id"); }}><option value="">Kies post</option>{newGroupPostOptions.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}</select></label>
            {createErrors.post_id && <span id="hours-mobile-create-post-error" className="field-error">{createErrors.post_id}</span>}
            <label>Duur (halve uren)<input id="hours-mobile-create-duration" name="duration_half_hours" type="number" min={1} max={48} defaultValue={2} aria-invalid={Boolean(createErrors.duration_half_hours)} aria-describedby={createErrors.duration_half_hours ? "hours-mobile-create-duration-error" : undefined} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 48) clearCreateError("duration_half_hours"); }} /></label>
            {createErrors.duration_half_hours && <span id="hours-mobile-create-duration-error" className="field-error">{createErrors.duration_half_hours}</span>}
            <label>Beschrijving<input name="description" aria-label="Beschrijving nieuwe registratie mobiel" /></label>
            <label>WindWilly-persoon<select aria-label="WindWilly-persoon mobiel" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Kies een actieve gebruiker</option>{eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</select></label>
            <button type="button" onClick={() => addUserParticipant("create")}>WindWilly-deelnemer toevoegen</button>
            <label>Externe persoon<select aria-label="Externe persoon mobiel" value={selectedExternalPersonId} onChange={(event) => setSelectedExternalPersonId(event.target.value)}><option value="">Kies een actieve externe persoon</option>{activeExternalPeople.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
            <button type="button" onClick={() => addExternalParticipant("create")}>Externe deelnemer toevoegen</button>
            <ul aria-label="Gekozen deelnemers mobiel">{participants.map((participant, index) => <li key={`${participant.kind}-mobile-${index}`}>{participant.display_name_snapshot}<button type="button" aria-label={`Verwijder ${participant.display_name_snapshot} mobiel`} onClick={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></li>)}</ul>
            <div className="section-actions"><button type="submit" disabled={createGroupMutation.isPending}>Registratie mobiel opslaan</button><button type="button" onClick={() => resetCreate(mobileCreateFormRef.current)}>Mobiele registratie resetten</button></div>
          </form>
          <form className="work-hours-mobile-quick-add" onSubmit={onQuickAddExternalPerson}>
            <strong>Externe persoon snel toevoegen</strong>
            <label>Naam<input name="display_name" aria-label="Naam externe persoon mobiel" required /></label>
            <label>E-mail<input name="email" type="email" aria-label="E-mail externe persoon mobiel" /></label>
            <label>Notitie<input name="note" aria-label="Notitie externe persoon mobiel" /></label>
            <button type="submit">Externe persoon mobiel aanmaken en toevoegen</button>
          </form>
        </section>
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
           <h2>Urenbeheer</h2>
           <div className="panel-grid">
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
                <label><span>Type historie</span><select value={historyKind} onChange={(event) => { setHistoryKind(event.target.value as typeof historyKind); setHistoryPage(1); }}><option value="">Alles</option><option value="post">Posten</option><option value="external_person">Externe personen</option><option value="historical_identity">Historische identiteiten</option></select></label>
                <label><span>Zoek historie</span><input value={historyQueryText} onChange={(event) => { setHistoryQueryText(event.target.value); setHistoryPage(1); }} /></label>
                <label><span>Historie per pagina</span><select value={historyPageSize} onChange={(event) => { setHistoryPageSize(Number(event.target.value) as 25 | 50 | 100); setHistoryPage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
              </div>
              <ul>
                {(historyQuery.data?.items ?? []).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    {item.display_name || item.id} · {item.kind.replace("_", " ")}
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
              <li key={event.id}>{event.actor_display_name} · {formatAmsterdamDateTime(event.created_at)} · {event.action}{event.project_name ? ` · ${event.project_name}` : ""}{event.post_name ? ` · ${event.post_name}` : ""} · {event.request_method} {event.request_path} · {event.result}</li>
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
