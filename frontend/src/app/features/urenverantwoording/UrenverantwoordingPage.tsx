import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CSSProperties, FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentUser,
  listWorkHoursMeta,
  listWorkHourGroups,
  createWorkHourGroup,
  updateWorkHourGroup,
  deleteWorkHourGroup,
  updateWorkExternalPerson,
  archiveWorkExternalPerson,
  restoreWorkExternalPerson,
  downloadWorkHoursCsv,
  type WorkHourGroup,
  type WorkHourParticipant
} from "../../../lib/api/client";
import { formatAmsterdamDateInput, formatAmsterdamDisplayDate } from "../../../lib/datetime";
import { AccessibleModal } from "./AccessibleModal";

const PAGE_SIZES = [25, 50, 100] as const;
const DURATION_HALF_HOUR_OPTIONS = Array.from({ length: 16 }, (_, index) => index + 1);

function formatDurationHours(durationHalfHours: number): string {
  const hours = durationHalfHours / 2;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatPersonHours(personHours: number): string {
  return formatDurationHours(personHours * 2);
}

type ParticipantDraft =
  | { kind: "live_user"; user_id: string; display_name_snapshot: string; display_email_snapshot: string; display_type_snapshot: string }
  | { kind: "external_person"; external_person_id: string; display_name_snapshot: string; display_email_snapshot: string; display_type_snapshot: string }
  | { kind: "historical_identity"; historical_identity_id: string; display_name_snapshot: string; display_email_snapshot: string; display_type_snapshot: string };

type ParticipantEditDraft = (ParticipantDraft & { id?: string }) | { id: string; kind: "preserved"; display_name_snapshot: string; display_email_snapshot: string; display_type_snapshot: string };
type CreateParticipantDraft = Extract<ParticipantDraft, { kind: "live_user" }>;

function ParticipantSelectionControls({
  id,
  className,
  participants,
  eligibleUsers,
  onToggle,
  open,
  onOpenChange,
  invalid = false,
  describedBy
}: {
  id: string;
  className: string;
  participants: CreateParticipantDraft[];
  eligibleUsers: Array<{ id: string; username: string; full_name: string | null; email: string | null }>;
  onToggle: (draft: CreateParticipantDraft) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedCount = participants.length;
  const [pickerStyle, setPickerStyle] = useState<CSSProperties>();
  const [placement, setPlacement] = useState<"top" | "bottom" | "mobile">("bottom");

  const focusableControls = () => Array.from(pickerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);

  useLayoutEffect(() => {
    if (!open) return;
    const positionPicker = () => {
      const trigger = triggerRef.current;
      const picker = pickerRef.current;
      if (!trigger || !picker) return;
      if (window.matchMedia?.("(max-width: 560px)").matches) {
        setPlacement("mobile");
        setPickerStyle(undefined);
        return;
      }
      const margin = 12;
      const gap = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const triggerBounds = trigger.getBoundingClientRect();
      const width = Math.min(620, Math.max(0, viewportWidth - margin * 2));
      const height = Math.min(picker.offsetHeight || 360, Math.max(0, viewportHeight - margin * 2));
      const below = viewportHeight - triggerBounds.bottom - gap;
      const above = triggerBounds.top - gap;
      const flipsAbove = below < Math.min(height, 280) && above > below;
      const top = flipsAbove ? triggerBounds.top - gap - height : triggerBounds.bottom + gap;
      setPlacement(flipsAbove ? "top" : "bottom");
      setPickerStyle({
        width: `${width}px`,
        maxHeight: `${Math.max(0, viewportHeight - margin * 2)}px`,
        left: `${Math.max(margin, Math.min(triggerBounds.left, viewportWidth - width - margin))}px`,
        top: `${Math.max(margin, Math.min(top, viewportHeight - height - margin))}px`
      });
    };
    const frame = requestAnimationFrame(positionPicker);
    window.addEventListener("resize", positionPicker);
    window.addEventListener("scroll", positionPicker, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionPicker);
      window.removeEventListener("scroll", positionPicker, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => pickerRef.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus());
  }, [open]);

  function closePicker(returnFocus = true) {
    if (returnFocus) triggerRef.current?.focus();
    onOpenChange(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
      return;
    }
    if (event.key === "Tab") {
      const controls = focusableControls();
      if (!controls.length) {
        event.preventDefault();
        pickerRef.current?.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !pickerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !pickerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <section id={id} className={className} aria-label="Deelnemers kiezen" tabIndex={-1} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
      <button ref={triggerRef} type="button" className="work-hours-participant-trigger" aria-expanded={open} aria-controls={`${id}-picker`} aria-haspopup="dialog" onClick={() => open ? closePicker(false) : onOpenChange(true)}>
        {selectedCount > 0 ? `${selectedCount} deelnemer(s) ▾` : "Deelnemer(s) ▾"}
      </button>
      {open && <div className="work-hours-participant-picker-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}>
        <div ref={pickerRef} id={`${id}-picker`} className="work-hours-participant-picker" role="dialog" aria-modal="false" aria-label="Deelnemers kiezen" data-placement={placement} style={pickerStyle} tabIndex={-1} onKeyDown={handleKeyDown}>
          <p className="work-hours-participant-selector-help">Vink deelnemers aan of uit. Gekozen deelnemers worden één keer opgeslagen.</p>
          <fieldset className="work-hours-participant-group">
            <legend>WindWilly-personen</legend>
            <div className="work-hours-participant-options">
              {eligibleUsers.map((user) => {
                const selected = participants.some((participant) => participant.kind === "live_user" && participant.user_id === user.id);
                const name = user.full_name || user.username;
                return <label key={user.id}><input type="checkbox" checked={selected} onChange={() => onToggle({ kind: "live_user", user_id: user.id, display_name_snapshot: name, display_email_snapshot: user.email || "", display_type_snapshot: "WindWilly-gebruiker" })} />{name}</label>;
              })}
            </div>
          </fieldset>
        </div>
      </div>}
    </section>
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

export function UrenverantwoordingPage() {
  const queryClient = useQueryClient();
  const desktopCreateFormRef = useRef<HTMLFormElement>(null);
  const mobileCreateFormRef = useRef<HTMLFormElement>(null);
  const currentUserQuery = useQuery({ queryKey: ["work-hours-current-user"], queryFn: getCurrentUser });
  const metaQuery = useQuery({ queryKey: ["work-hours-meta"], queryFn: listWorkHoursMeta });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [newGroupProjectId, setNewGroupProjectId] = useState("");
  const [newGroupPostId, setNewGroupPostId] = useState("");
  const [editingGroupProjectId, setEditingGroupProjectId] = useState("");
  const [editingGroupPostId, setEditingGroupPostId] = useState("");
  const [editingGroup, setEditingGroup] = useState<WorkHourGroup | null>(null);
  const [editDurationHalfHours, setEditDurationHalfHours] = useState("");
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<WorkHourGroup | null>(null);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [participants, setParticipants] = useState<CreateParticipantDraft[]>([]);
  const [desktopParticipantDisclosureOpen, setDesktopParticipantDisclosureOpen] = useState(false);
  const [mobileParticipantDisclosureOpen, setMobileParticipantDisclosureOpen] = useState(false);
  const createParticipantsInitialized = useRef(false);
  const [editParticipants, setEditParticipants] = useState<ParticipantEditDraft[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const listQueryParams = useMemo(
    () => ({
      sort_key: "work_date" as const,
      sort_direction: "desc" as const,
      page,
      page_size: pageSize
    }),
    [page, pageSize]
  );


  const groupsQuery = useQuery({
    queryKey: ["work-hours-groups", listQueryParams],
    queryFn: () => listWorkHourGroups(listQueryParams)
  });

  const projectOptions = useMemo(() => (metaQuery.data?.projects ?? []).map((project) => ({ ...project, name: project.name ?? project.display_name ?? "", description: project.description ?? "", row_version: project.row_version ?? 1 })), [metaQuery.data?.projects]);
  const normalizedPosts = useMemo(() => (metaQuery.data?.posts ?? []).map((post) => ({ ...post, name: post.name ?? post.display_name ?? "", description: post.description ?? "", row_version: post.row_version ?? 1 })), [metaQuery.data?.posts]);
  const postOptions = normalizedPosts;
  const historicalIdentities = useMemo(() => (metaQuery.data?.historical_identities ?? []).map((identity) => ({ ...identity, snapshot_display_label: identity.snapshot_display_label ?? identity.display_name ?? "Historische identiteit", snapshot_name: identity.snapshot_name ?? identity.display_name ?? "" })), [metaQuery.data?.historical_identities]);
  const eligibleUsers = useMemo(() => (metaQuery.data?.eligible_users ?? []).filter((user) => user.selectable !== false).map((user) => ({ ...user, username: user.username ?? user.display_name ?? "Gebruiker", full_name: user.full_name ?? user.display_name ?? null, email: user.email ?? null })), [metaQuery.data?.eligible_users]);
  const currentUser = currentUserQuery.data;
  const isAdmin = Boolean(currentUser?.is_admin);
  const totalPages = Math.max(1, Math.ceil((groupsQuery.data?.total ?? 0) / pageSize));
  const newGroupPostOptions = normalizedPosts;
  const editingGroupPostOptions = normalizedPosts;

  function currentUserParticipant(): CreateParticipantDraft | null {
    if (!currentUser) return null;
    return { kind: "live_user", user_id: currentUser.id, display_name_snapshot: currentUser.full_name || currentUser.username, display_email_snapshot: currentUser.email || "", display_type_snapshot: "WindWilly-gebruiker" };
  }

  useEffect(() => {
    if (createParticipantsInitialized.current || !currentUser) return;
    createParticipantsInitialized.current = true;
    setParticipants([currentUserParticipant()!]);
  }, [currentUser]);


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

  const createGroupMutation = useMutation({
    mutationFn: createWorkHourGroup,
    onSuccess: async () => {
      setStatusMessage("Registratie opgeslagen.");
      resetCreate();
      await queryClient.invalidateQueries({ queryKey: ["work-hours-groups"] });
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
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Bijwerken mislukt")
  });


  useEffect(() => {
    if (!errorMessage) return;
    requestAnimationFrame(() => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      (dialog?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? dialog?.querySelector<HTMLElement>('[role="alert"]'))?.focus();
    });
  }, [errorMessage]);

  function addUserParticipant(_target?: "create" | "edit") {
    const user = eligibleUsers.find((item) => item.id === selectedUserId);
    if (!user) return;
    const draft: ParticipantDraft = { kind: "live_user", user_id: user.id, display_name_snapshot: user.full_name || user.username, display_email_snapshot: user.email || "", display_type_snapshot: "WindWilly-gebruiker" };
    setEditParticipants((current) => current.some((item) => item.kind === "live_user" && item.user_id === user.id) ? current : [...current, draft]);
  }

  function toggleCreateParticipant(draft: CreateParticipantDraft) {
    const matchesDraft = (participant: CreateParticipantDraft) => participant.user_id === draft.user_id;
    const nextParticipants = participants.some(matchesDraft) ? participants.filter((participant) => !matchesDraft(participant)) : [...participants, draft];
    setParticipants(nextParticipants);
    if (nextParticipants.length > 0) clearCreateError("participants");
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
    // Historical values above the current limit must never be substituted in a
    // submitted payload. The user must explicitly choose a permitted value.
    setEditDurationHalfHours(group.duration_half_hours <= 16 ? String(group.duration_half_hours) : "");
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
    setNewGroupProjectId("");
    setNewGroupPostId("");
    setSelectedUserId("");
    setParticipants(currentUserParticipant() ? [currentUserParticipant()!] : []);
    setCreateErrors({});
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
    if (!workDate || workDate > formatAmsterdamDateInput() || !project || !post || !newGroupPostOptions.some((item) => item.id === post) || !Number.isInteger(durationHalfHours) || durationHalfHours < 1 || durationHalfHours > 16 || participants.length === 0) {
      const errors = {
        ...(!workDate || workDate > formatAmsterdamDateInput() ? { work_date: "Kies een geldige datum die niet in de toekomst ligt." } : {}),
        ...(!project ? { project_id: "Kies een project." } : {}),
        ...(!post || !newGroupPostOptions.some((item) => item.id === post) ? { post_id: "Kies een post." } : {}),
        ...(!Number.isInteger(durationHalfHours) || durationHalfHours < 1 || durationHalfHours > 16 ? { duration_half_hours: "Kies 0,5 tot en met 8 uur." } : {}),
        ...(participants.length === 0 ? { participants: "Kies minimaal één deelnemer." } : {})
      };
      setCreateErrors(errors);
      setErrorMessage("Controleer de gemarkeerde velden.");
      const mobileCreate = form.classList.contains("work-hours-mobile-create");
      if (errors.participants) {
        if (mobileCreate) setMobileParticipantDisclosureOpen(true);
        else setDesktopParticipantDisclosureOpen(true);
      }
      const prefix = mobileCreate ? "hours-mobile-create" : "hours-create";
      const fieldIds: Record<string, string> = {
        work_date: `${prefix}-date`,
        project_id: `${prefix}-project`,
        post_id: `${prefix}-post`,
        duration_half_hours: `${prefix}-duration`,
        participants: `${prefix}-participants`,
      };
      requestAnimationFrame(() => document.getElementById(fieldIds[Object.keys(errors)[0]])?.focus());
      return;
    }
    setCreateErrors({});
    await createGroupMutation.mutateAsync({
      work_date: workDate,
      project_id: project,
      post_id: post,
      description,
      duration_half_hours: durationHalfHours,
      participants: participants.map((participant, index) => ({
        participant_kind: "live_user" as const,
        user_id: participant.user_id,
        display_name_snapshot: participant.display_name_snapshot,
        display_email_snapshot: participant.display_email_snapshot,
        display_type_snapshot: participant.display_type_snapshot,
        sort_order: index
      }))
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
    const durationHalfHours = Number(editDurationHalfHours);
    if (!Number.isInteger(durationHalfHours) || durationHalfHours < 1 || durationHalfHours > 16) {
      setErrorMessage("Kies een nieuwe duur van 0,5 tot en met 8 uur voordat je opslaat.");
      return;
    }
    await updateGroupMutation.mutateAsync({
      groupId: editingGroup.id,
      payload: {
        work_date: String(data.get("work_date") ?? editingGroup.work_date),
        project_id: editingGroupProjectId,
        post_id: editingGroupPostId,
        description: String(data.get("description") ?? editingGroup.description),
        duration_half_hours: durationHalfHours,
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


  async function onExportCsv() {
    const blob = await downloadWorkHoursCsv({ sort_key: "work_date", sort_direction: "desc" });
    downloadBlob(blob, "urenverantwoording.csv");
  }

  return (
    <section className="main-dashboard uren-module-page">
      <h1 className="work-hours-page-title">Urenregistratie</h1>
      <div className="work-hours-page-layout">
      <div className="work-hours-page-content">
        {statusMessage && <p className="notice success" role="status" aria-live="polite">{statusMessage}</p>}
        {errorMessage && <p className="notice error" role="alert">{errorMessage}</p>}

        <section className="panel">
        <div className="table-wrap">
          <form ref={desktopCreateFormRef} id="work-hours-create-form" onSubmit={onCreateGroup} />
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Persoon</th>
                <th>Project</th>
                <th>Post</th>
                <th>Uren</th>
                <th>Beschrijving</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              <tr className="work-hours-create-row">
                <td><label className="sr-only" htmlFor="hours-create-date">Datum</label><input form="work-hours-create-form" id="hours-create-date" name="work_date" type="date" defaultValue={formatAmsterdamDateInput()} aria-invalid={Boolean(createErrors.work_date)} aria-describedby={createErrors.work_date ? "hours-create-date-error" : undefined} onChange={(event) => { if (event.target.value && event.target.value <= formatAmsterdamDateInput()) clearCreateError("work_date"); }} />{createErrors.work_date && <span id="hours-create-date-error" className="field-error">{createErrors.work_date}</span>}</td>
                <td className="work-hours-create-participant-cell"><ParticipantSelectionControls id="hours-create-participants" className="work-hours-participant-selector work-hours-desktop-participant-selector" participants={participants} eligibleUsers={eligibleUsers} onToggle={toggleCreateParticipant} open={desktopParticipantDisclosureOpen} onOpenChange={(open) => { setDesktopParticipantDisclosureOpen(open); if (open) setMobileParticipantDisclosureOpen(false); }} invalid={Boolean(createErrors.participants)} describedBy={createErrors.participants ? "hours-create-participants-error" : undefined} />{createErrors.participants && <span id="hours-create-participants-error" className="field-error">{createErrors.participants}</span>}</td>
                <td><select form="work-hours-create-form" id="hours-create-project" aria-label="Project voor nieuwe registratie" value={newGroupProjectId} aria-invalid={Boolean(createErrors.project_id)} aria-describedby={createErrors.project_id ? "hours-create-project-error" : undefined} onChange={(event) => { setNewGroupProjectId(event.target.value); if (event.target.value) clearCreateError("project_id"); }}><option value="">Kies project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>{createErrors.project_id && <span id="hours-create-project-error" className="field-error">{createErrors.project_id}</span>}</td>
                <td><select form="work-hours-create-form" id="hours-create-post" aria-label="Post voor nieuwe registratie" value={newGroupPostId} aria-invalid={Boolean(createErrors.post_id)} aria-describedby={createErrors.post_id ? "hours-create-post-error" : undefined} onChange={(event) => { setNewGroupPostId(event.target.value); if (event.target.value) clearCreateError("post_id"); }}><option value="">Kies post</option>{newGroupPostOptions.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}</select>{createErrors.post_id && <span id="hours-create-post-error" className="field-error">{createErrors.post_id}</span>}</td>
                <td><select form="work-hours-create-form" id="hours-create-duration" aria-label="Duur in uren" name="duration_half_hours" defaultValue={2} aria-invalid={Boolean(createErrors.duration_half_hours)} aria-describedby={createErrors.duration_half_hours ? "hours-create-duration-error" : undefined} onChange={() => clearCreateError("duration_half_hours")}>{DURATION_HALF_HOUR_OPTIONS.map((value) => <option key={value} value={value}>{formatDurationHours(value)} uur</option>)}</select>{createErrors.duration_half_hours && <span id="hours-create-duration-error" className="field-error">{createErrors.duration_half_hours}</span>}</td>
                <td><input form="work-hours-create-form" aria-label="Beschrijving nieuwe registratie" name="description" placeholder="Beschrijving" /></td>
                <td className="work-hours-row-actions"><button form="work-hours-create-form" type="submit" aria-label="Registratie opslaan" title="Opslaan" disabled={createGroupMutation.isPending}>✓</button><button type="button" aria-label="Nieuwe registratie resetten" title="Reset" onClick={() => resetCreate(desktopCreateFormRef.current)}>↺</button></td>
              </tr>
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
            <label>Duur<select id="hours-mobile-create-duration" name="duration_half_hours" defaultValue={2} aria-invalid={Boolean(createErrors.duration_half_hours)} aria-describedby={createErrors.duration_half_hours ? "hours-mobile-create-duration-error" : undefined} onChange={() => clearCreateError("duration_half_hours")}>{DURATION_HALF_HOUR_OPTIONS.map((value) => <option key={value} value={value}>{formatDurationHours(value)} uur</option>)}</select></label>
            {createErrors.duration_half_hours && <span id="hours-mobile-create-duration-error" className="field-error">{createErrors.duration_half_hours}</span>}
            <label>Beschrijving<input name="description" aria-label="Beschrijving nieuwe registratie mobiel" /></label>
            <ParticipantSelectionControls id="hours-mobile-create-participants" className="work-hours-participant-selector work-hours-mobile-participant-selector" participants={participants} eligibleUsers={eligibleUsers} onToggle={toggleCreateParticipant} open={mobileParticipantDisclosureOpen} onOpenChange={(open) => { setMobileParticipantDisclosureOpen(open); if (open) setDesktopParticipantDisclosureOpen(false); }} invalid={Boolean(createErrors.participants)} describedBy={createErrors.participants ? "hours-mobile-create-participants-error" : undefined} />
            {createErrors.participants && <span id="hours-mobile-create-participants-error" className="field-error">{createErrors.participants}</span>}
            <div className="section-actions"><button type="submit" disabled={createGroupMutation.isPending}>Registratie mobiel opslaan</button><button type="button" onClick={() => resetCreate(mobileCreateFormRef.current)}>Mobiele registratie resetten</button></div>
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
        <footer className="work-hours-pagination" aria-label="Paginering urenregistraties">
          <button type="button" onClick={onExportCsv}>CSV export</button>
          <label>Per pagina <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as 25 | 50 | 100); setPage(1); }}>{PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Vorige</button>
          <span aria-live="polite">Pagina {groupsQuery.data?.page ?? page} van {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Volgende</button>
        </footer>
        </section>

      {editingGroup && (
        <AccessibleModal title="Registratie bewerken" onClose={() => setEditingGroup(null)} committing={updateGroupMutation.isPending}>
          {errorMessage && <p className="notice error" role="alert" tabIndex={-1}>{errorMessage}</p>}
          <form onSubmit={onSaveEditingGroup} className="form-grid">
            <label><span>Datum</span><input type="date" name="work_date" defaultValue={editingGroup.work_date} /></label>
            <label><span>Project</span><select value={editingGroupProjectId} onChange={(event) => setEditingGroupProjectId(event.target.value)}><option value="">Kies een project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label><span>Post</span><select value={editingGroupPostId} disabled={!editingGroupProjectId || editingGroupPostOptions.length === 0} onChange={(event) => setEditingGroupPostId(event.target.value)}><option value="">Kies een post</option>{editingGroupPostOptions.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}</select></label>
            <label><span>WindWilly-persoon toevoegen</span><select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} disabled={!eligibleUsers.length}><option value="">Kies een actieve gebruiker</option>{eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</select></label>
            <label><span>Duur</span><select name="duration_half_hours" aria-label="Duur" value={editDurationHalfHours} aria-invalid={!editDurationHalfHours || undefined} onChange={(event) => { setEditDurationHalfHours(event.target.value); setErrorMessage(null); }}><option value="" disabled>{editingGroup.duration_half_hours > 16 ? `Historische duur: ${formatDurationHours(editingGroup.duration_half_hours)} uur — kies een nieuwe duur` : "Kies een duur"}</option>{DURATION_HALF_HOUR_OPTIONS.map((value) => <option key={value} value={value}>{formatDurationHours(value)} uur</option>)}</select>{editingGroup.duration_half_hours > 16 && <small>De historische duur blijft ongewijzigd totdat je bewust een geldige nieuwe duur kiest.</small>}</label>
            <label className="span-2"><span>Beschrijving</span><textarea name="description" rows={3} defaultValue={editingGroup.description} /></label>
            <div className="span-2">
              <strong>Deelnemers</strong>
              <div className="section-actions">
                <button type="button" onClick={() => addUserParticipant("edit")} disabled={!eligibleUsers.length}>Actieve WindWilly-persoon toevoegen</button>
                <button type="button" onClick={() => setEditingGroup(null)}>Annuleren</button>
              </div>
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
            <div className="section-actions span-2"><button type="submit" disabled={updateGroupMutation.isPending || !editDurationHalfHours}>Wijzigingen opslaan</button></div>
          </form>
        </AccessibleModal>
      )}

      {deleteGroupTarget && (
        <AccessibleModal title="Registratie verwijderen" onClose={() => setDeleteGroupTarget(null)} committing={deleteGroupMutation.isPending}>
          <p>Weet je zeker dat je deze registratie wilt verwijderen? De registratie blijft herstelbaar voor beheerders.</p>
          <div className="section-actions"><button type="button" disabled={deleteGroupMutation.isPending} onClick={() => deleteGroupMutation.mutate(deleteGroupTarget)}>Bevestig verwijderen</button><button type="button" disabled={deleteGroupMutation.isPending} onClick={() => setDeleteGroupTarget(null)}>Annuleren</button></div>
        </AccessibleModal>
      )}
      </div>
      <section className="work-hours-project-totals" aria-labelledby="work-hours-project-totals-title">
        <h2 id="work-hours-project-totals-title">Projecttotalen</h2>
        {groupsQuery.isPending ? (
          <p role="status">Projecttotalen laden…</p>
        ) : groupsQuery.isError ? (
          <p role="alert">Projecttotalen konden niet worden geladen.</p>
        ) : (groupsQuery.data?.project_totals ?? []).length > 0 ? (
          <dl>
            {(groupsQuery.data?.project_totals ?? []).map((project) => <div key={project.project_id}><dt>{project.project_name}</dt><dd>{formatPersonHours(project.person_hours)} persoon-uren</dd></div>)}
          </dl>
        ) : <p>Geen projecttotalen.</p>}
      </section>
      </div>
    </section>
  );
}
