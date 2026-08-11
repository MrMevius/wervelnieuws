import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, LegacyWorkHoursRedirect } from "./App";
import { VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY } from "./features/admin/vergaderbordenProjectSelection";

const mockApi = vi.hoisted(() => ({
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue({ status: "ok" }),
  setToken: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue({
    id: "u1",
    username: "admin",
    full_name: null,
    email: null,
    is_admin: true,
    theme_preference: "system",
    has_avatar: false
  }),
  updateCurrentUser: vi.fn().mockResolvedValue({
    id: "u1",
    username: "admin",
    full_name: "Admin Naam",
    email: "admin@example.com",
    is_admin: true,
    theme_preference: "dark",
    has_avatar: false
  }),
  listAdminUsers: vi.fn().mockResolvedValue([
    {
      id: "u1",
      username: "admin",
      full_name: "Admin",
      email: "admin@example.com",
      is_admin: true,
      is_active: true
    },
    {
      id: "u2",
      username: "editor",
      full_name: "Editor",
      email: "editor@example.com",
      is_admin: false,
      is_active: true
    }
  ]),
  listBoardProjects: vi.fn().mockResolvedValue([
    {
      id: "bp1",
      name: "Wekelijkse afstemming",
      description: "Teamplanning en besluiten",
      invited_user_ids: ["u1"],
      card_count: 2
    }
  ]),
  listBoardRights: vi.fn().mockResolvedValue({
    users: [
      { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true },
      { id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false, is_active: true }
    ],
    projects: [
      {
        id: "bp1",
        name: "Wekelijkse afstemming",
        description: "Teamplanning en besluiten",
        invited_user_ids: ["u2"],
        card_count: 2,
        last_activity_at: "2026-06-12T08:00:00Z"
      },
      {
        id: "bp2",
        name: "Stille notities",
        description: "",
        invited_user_ids: [],
        card_count: 0,
        last_activity_at: null
      }
    ]
  }),
  updateBoardRights: vi.fn().mockResolvedValue({ id: "bp1", name: "Wekelijkse afstemming", description: "Teamplanning en besluiten", invited_user_ids: ["u2"], card_count: 2, last_activity_at: null }),
  archiveBoardProject: vi.fn().mockResolvedValue({ id: "bp1", name: "Wekelijkse afstemming", description: "Teamplanning en besluiten", invited_user_ids: [], card_count: 2, last_activity_at: null }),
  getBoardProject: vi.fn().mockResolvedValue({
    project: {
      id: "bp1",
      name: "Wekelijkse afstemming",
      description: "Teamplanning en besluiten",
      invited_user_ids: ["u1"],
      card_count: 2
    },
    access_users: [
      { id: "u1", username: "admin", full_name: "Admin", is_admin: true, is_active: true, has_avatar: false },
      { id: "u2", username: "editor", full_name: "Editor", is_admin: false, is_active: true, has_avatar: false }
    ],
    cards: []
  }),
  getBoardCard: vi.fn().mockResolvedValue({
    card: {
      id: "bc1",
      project_id: "bp1",
      title: "Voorbeeldkaart",
      description: "",
      column: "todo",
      position: 0,
      assignments: [],
      updates_count: 0,
      recordings_count: 0
    },
    updates: [],
    recordings: []
  }),
  createBoardProject: vi.fn().mockResolvedValue({ id: "bp2" }),
  createBoardCard: vi.fn().mockResolvedValue({ id: "bc2" }),
  moveBoardCard: vi.fn().mockResolvedValue({ status: "ok" }),
  postBoardCardUpdate: vi.fn().mockResolvedValue({ id: "bu1" }),
  uploadBoardRecording: vi.fn().mockResolvedValue({ id: "br1" }),
  createAdminUser: vi.fn().mockResolvedValue({
    id: "u3",
    username: "redacteur",
    full_name: null,
    email: null,
    is_admin: false,
    is_active: true
  }),
  updateAdminUser: vi.fn().mockResolvedValue({
    id: "u2",
    username: "editor",
    full_name: "Editor",
    email: "editor@example.com",
    is_admin: true,
    is_active: true
  }),
  updateAdminUserProfile: vi.fn().mockResolvedValue({
    id: "u2",
    username: "editor",
    full_name: "Editor Nieuw",
    email: "nieuw@example.com",
    is_admin: false,
    is_active: true,
    has_avatar: false
  }),
  uploadAdminUserAvatar: vi.fn().mockResolvedValue({
    id: "u2",
    username: "editor",
    full_name: "Editor Nieuw",
    email: "nieuw@example.com",
    is_admin: false,
    is_active: true,
    has_avatar: true
  }),
  updateAdminUserActive: vi.fn().mockResolvedValue({
    id: "u2",
    username: "editor",
    full_name: "Editor",
    email: "editor@example.com",
    is_admin: false,
    is_active: false
  }),
  deleteAdminUser: vi.fn().mockResolvedValue({ status: "ok" }),
  changeAdminUserPassword: vi.fn().mockResolvedValue({ status: "ok" }),
  listAdminProjects: vi.fn().mockResolvedValue([
    {
      id: "p1",
      name: "Windpark de Boldijk",
      is_active: true
    }
  ]),
  createAdminProject: vi.fn().mockResolvedValue({
    id: "p2",
    name: "Project Noord",
    is_active: true
  }),
  updateAdminProject: vi.fn().mockResolvedValue({
    id: "p1",
    name: "Windpark de Boldijk Updated",
    is_active: false
  }),
  listAdminThemes: vi.fn().mockResolvedValue([
    {
      id: "planning",
      name: "Planning",
      is_active: true
    }
  ]),
  createAdminTheme: vi.fn().mockResolvedValue({
    id: "communicatie",
    name: "Communicatie",
    is_active: true
  }),
  updateAdminTheme: vi.fn().mockResolvedValue({
    id: "planning",
    name: "Planning aangepast",
    is_active: false
  }),
  getAdminUiSettings: vi.fn().mockResolvedValue({
    wind_theme_enabled: true
  }),
  updateAdminUiSettings: vi.fn().mockResolvedValue({
    wind_theme_enabled: false
  }),
  listAdminActivity: vi.fn().mockResolvedValue([
    {
      id: "a1",
      event_type: "topic.created",
      topic_id: "abc12345-1111",
      topic_subject: "Onderwerp test",
      actor_user_id: "u1",
      actor_username: "admin",
      created_at: "2026-03-14T10:00:00Z"
    }
  ]),
  getAdminGenAIConfig: vi.fn().mockResolvedValue({
    system_prompt: "Standaard systeemprompt voor lokale windparkcommunicatie.",
    website_prompt: "Schrijf uitgebreid voor website.",
    facebook_prompt: "Schrijf kort voor Facebook.",
    newsletter_prompt: "Schrijf overzichtelijk voor nieuwsbrief.",
    text_model: "gpt-4.1-mini",
    image_model: "gpt-image-1",
    whisper_model: "whisper-1",
    whisper_language: "nl",
    websearch_enabled: false,
    websearch_max_results: 3,
    has_api_key: false
  }),
  getAdminGenAIModelOptions: vi.fn().mockResolvedValue({
    text_models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
    image_models: ["gpt-image-1"]
  }),
  updateAdminGenAIConfig: vi.fn().mockResolvedValue({
    system_prompt: "Aangepaste systeemprompt.",
    website_prompt: "Websiteprompt",
    facebook_prompt: "Facebookprompt",
    newsletter_prompt: "Nieuwsbriefprompt",
    text_model: "gpt-4.1-mini",
    image_model: "gpt-image-1",
    whisper_model: "whisper-1",
    whisper_language: "nl",
    websearch_enabled: true,
    websearch_max_results: 4,
    has_api_key: true
  }),
  listDatabaseProjects: vi.fn().mockResolvedValue([
    {
      id: "p1",
      name: "Windpark de Boldijk",
      is_active: true
    }
  ]),
  listDatabaseDocuments: vi.fn().mockResolvedValue([
    {
      id: "d1",
      filename: "wijkbericht.txt",
      doc_type: "txt",
      status: "uploaded",
      extraction_error: "",
      size_bytes: 128,
      project_id: "p1",
      project_name: "Windpark de Boldijk",
      uploaded_by_user_id: "u1",
      uploaded_by_username: "admin",
      created_at: "2026-03-12T10:00:00Z"
    }
  ]),
  uploadDatabaseDocument: vi.fn().mockResolvedValue({
    id: "d2",
    filename: "nieuw.txt",
    doc_type: "txt",
    status: "uploaded",
    extraction_error: "",
    size_bytes: 99,
    project_id: "p1",
    project_name: "Windpark de Boldijk",
    uploaded_by_user_id: "u1",
    uploaded_by_username: "admin",
    created_at: "2026-03-12T11:00:00Z"
  }),
  uploadDatabaseDocumentWithProgress: vi.fn().mockImplementation(async (_projectId, _file, onProgress) => {
    onProgress(45);
    onProgress(100);
    return {
      id: "d2",
      filename: "nieuw.txt",
      doc_type: "txt",
      status: "uploaded",
      extraction_error: "",
      size_bytes: 99,
      project_id: "p1",
      project_name: "Windpark de Boldijk",
      uploaded_by_user_id: "u1",
      uploaded_by_username: "admin",
      created_at: "2026-03-12T11:00:00Z"
    };
  }),
  listWorkHoursMeta: vi.fn().mockResolvedValue({
    projects: [
      {
        id: "whp1",
        name: "Project Uren",
        description: "",
        is_active: true,
        is_archived: false,
        archived_at: null
      }
    ],
    posts: [
      {
        id: "whpost1",
        project_id: "whp1",
        name: "Post A",
        description: "",
        is_active: true,
        is_archived: false,
        archived_at: null
      }
    ],
    external_people: [],
    historical_identities: [],
    is_admin: true
  }),
  listWorkHourGroups: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    sort_key: "work_date",
    sort_direction: "desc",
    page_sizes: [25, 50, 100],
    totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 }
  }),
  listWorkHoursAudit: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 }),
  listWorkHoursAdminHistory: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 }),
  listWorkHoursAdminMasterdata: vi.fn().mockResolvedValue({ projects: [], posts: [], external_people: [] }),
  relinkWorkHistoricalIdentity: vi.fn().mockResolvedValue({ id: "history-1" }),
  createWorkHourGroup: vi.fn().mockResolvedValue({ id: "group-1" }),
  updateWorkHourGroup: vi.fn().mockResolvedValue({ id: "group-1" }),
  deleteWorkHourGroup: vi.fn().mockResolvedValue({ status: "deleted" }),
  restoreWorkHourGroup: vi.fn().mockResolvedValue({ status: "restored" }),
  createWorkExternalPerson: vi.fn().mockResolvedValue({ id: "person-1" }),
  updateWorkExternalPerson: vi.fn().mockResolvedValue({ id: "person-1" }),
  archiveWorkExternalPerson: vi.fn().mockResolvedValue({ id: "person-1" }),
  restoreWorkExternalPerson: vi.fn().mockResolvedValue({ id: "person-1" }),
  mergeWorkExternalPerson: vi.fn().mockResolvedValue({ id: "person-1" }),
  createWorkProject: vi.fn().mockResolvedValue({ id: "whp2" }),
  updateWorkProject: vi.fn().mockResolvedValue({ id: "whp2" }),
  archiveWorkProject: vi.fn().mockResolvedValue({ id: "whp2" }),
  restoreWorkProject: vi.fn().mockResolvedValue({ id: "whp2" }),
  createWorkPost: vi.fn().mockResolvedValue({ id: "whpost2" }),
  updateWorkPost: vi.fn().mockResolvedValue({ id: "whpost2" }),
  archiveWorkPost: vi.fn().mockResolvedValue({ id: "whpost2" }),
  restoreWorkPost: vi.fn().mockResolvedValue({ id: "whpost2" }),
  downloadWorkHoursCsv: vi.fn().mockResolvedValue(new Blob(["csv"], { type: "text/csv" })),
  listTopicDocuments: vi.fn().mockResolvedValue([
    {
      id: "audio-1",
      filename: "opname.webm",
      parent_source_document_id: null,
      doc_type: "audio",
      status: "uploaded",
      duration_seconds: 120,
      transcription_status: "failed",
      transcription_attempts: 1,
      extraction_error: "",
      transcription_error: "Whisper faalde tijdelijk",
      transcription_text: "",
      transcription_model: "whisper-1",
      transcription_language: "nl",
      speaker_labels_json: "[]",
      transcript_document_id: "transcript-1",
      created_at: "2026-06-30T10:00:00Z"
    },
    {
      id: "transcript-1",
      filename: "opname.transcript.txt",
      parent_source_document_id: "audio-1",
      doc_type: "txt",
      status: "indexed",
      duration_seconds: null,
      transcription_status: "not_applicable",
      transcription_attempts: 0,
      extraction_error: "",
      transcription_error: "",
      transcription_text: "De werkzaamheden starten maandag.",
      transcription_model: "",
      transcription_language: "",
      speaker_labels_json: "[]",
      transcript_document_id: null,
      created_at: "2026-06-30T10:05:00Z"
    }
  ]),
  uploadTopicDocument: vi.fn().mockResolvedValue({
    id: "audio-2",
    filename: "nieuw-opname.webm",
    parent_source_document_id: null,
    doc_type: "audio",
    status: "uploaded",
    duration_seconds: 90,
    transcription_status: "queued",
    transcription_attempts: 0,
    extraction_error: "",
    transcription_error: "",
    transcription_text: "",
    transcription_model: "",
    transcription_language: "",
    speaker_labels_json: "[]",
    transcript_document_id: null,
    created_at: "2026-06-30T10:10:00Z"
  }),
  retryTopicDocumentTranscription: vi.fn().mockResolvedValue({
    id: "audio-1",
    filename: "opname.webm",
    parent_source_document_id: null,
    doc_type: "audio",
    status: "uploaded",
    duration_seconds: 120,
    transcription_status: "queued",
    transcription_attempts: 1,
    extraction_error: "",
    transcription_error: "",
    transcription_text: "",
    transcription_model: "whisper-1",
    transcription_language: "nl",
    speaker_labels_json: "[]",
    transcript_document_id: "transcript-1",
    created_at: "2026-06-30T10:00:00Z"
  }),
  deleteDatabaseDocument: vi.fn().mockResolvedValue({ status: "ok" }),
  bulkDeleteDatabaseDocuments: vi.fn().mockResolvedValue({ status: "ok", affected: 1 }),
  bulkMoveDatabaseDocuments: vi.fn().mockResolvedValue({ status: "ok", affected: 1 }),
  bulkCopyDatabaseDocuments: vi.fn().mockResolvedValue({ status: "ok", affected: 1 }),
  changeCurrentUserPassword: vi.fn().mockResolvedValue({ status: "ok" }),
  uploadCurrentUserAvatar: vi.fn(),
  getCurrentUserAvatarBlob: vi.fn(),
  createTopic: vi.fn().mockResolvedValue({
    id: "abc99999-1111",
    title: "Nieuw onderwerp",
    subject: "Nieuw onderwerp",
    theme: "Planning",
    project_id: "p1",
    project_name: "Windpark de Boldijk",
    editorial_notes: "Handmatig toegevoegd",
    planning_at: "2026-03-20T09:00:00Z",
    workflow_state: "draft",
    is_archived: false,
    target_channels: ["website", "facebook"]
  }),
  updateTopic: vi.fn().mockResolvedValue({
    id: "abc12345-1111",
    title: "Titel",
    subject: "Onderwerp test",
    theme: "Thema test",
    project_id: "p1",
    project_name: "Windpark de Boldijk",
    editorial_notes: "Notitie",
    planning_at: null,
    workflow_state: "planned",
    is_archived: false,
    target_channels: ["website", "facebook", "newsletter"]
  }),
  deleteTopic: vi.fn().mockResolvedValue({ status: "deleted" }),
  importTopicsCsv: vi.fn().mockResolvedValue({
    created: 2,
    failed: 0,
    errors: []
  }),
  listTopics: vi.fn().mockResolvedValue([
    {
      id: "abc12345-1111",
      title: "Titel",
      subject: "Onderwerp test",
      theme: "Thema test",
      project_id: "p1",
      project_name: "Windpark de Boldijk",
      editorial_notes: "Notitie",
      planning_at: "2026-03-20T09:00:00Z",
      workflow_state: "draft",
      is_archived: false,
      target_channels: ["website", "facebook", "newsletter"]
    }
  ]),
  listTopicThemes: vi.fn().mockResolvedValue([
    { id: "planning", name: "Planning" },
    { id: "algemeen", name: "Algemeen" }
  ]),
  listTopicScheduleTemplates: vi.fn().mockResolvedValue([
    {
      id: "weekly-update",
      label: "Wekelijkse projectupdate",
      subject_template: "Wekelijkse update {project}",
      theme: "Planning",
      editorial_notes: "Gebruik feitelijke en rustige toon.",
      planning_time: "09:00"
    }
  ]),
  listVersions: vi.fn().mockResolvedValue([
    {
      id: "v1",
      topic_id: "abc12345-1111",
      version_number: 1,
      title: "Onderhoudsupdate",
      slug: "onderhoudsupdate",
      article_body: "Volledige tekst",
      summary: "Korte samenvatting",
      source_trace_json: "[]",
      source_trace: [
        {
          source: "topic",
          source_type: "topic",
          chunk_id: "c1",
          chunk_index: "0",
          relevance_score: 72,
          text: "Topic bronpassage over onderhoud.",
          document_id: "doc-topic-1",
          document_name: "topic-bron.txt",
          topic_id: "abc12345-1111",
          project_id: "",
          project_name: ""
        },
        {
          source: "database",
          source_type: "database",
          chunk_id: "c2",
          chunk_index: "1",
          relevance_score: 91,
          text: "Database bronpassage over veiligheidsinspectie.",
          document_id: "doc-db-1",
          document_name: "database-bron.txt",
          topic_id: "abc12345-1111",
          project_id: "p1",
          project_name: "Windpark de Boldijk"
        }
      ],
      generated_image_id: null,
      is_current: true,
      is_published: false,
      created_at: "2026-03-12T11:00:00Z"
    }
  ]),
  listCurrentVariants: vi.fn().mockResolvedValue([
    {
      id: "cv1",
      content_version_id: "v1",
      topic_id: "abc12345-1111",
      channel: "website",
      title: "Website titel",
      article_body: "<p>Website artikel</p>",
      summary: "<p>Website samenvatting</p>",
      generated_image_id: null,
      generated_image_path: null,
      approval_state: "pending",
      approved_by_user_id: null,
      approved_at: null,
      created_at: "2026-03-12T11:00:00Z",
      updated_at: "2026-03-12T11:00:00Z"
    },
    {
      id: "cv2",
      content_version_id: "v1",
      topic_id: "abc12345-1111",
      channel: "facebook",
      title: "Facebook titel",
      article_body: "<p>Facebook artikel</p>",
      summary: "<p>Facebook samenvatting</p>",
      generated_image_id: null,
      generated_image_path: null,
      approval_state: "approved",
      approved_by_user_id: "u1",
      approved_at: "2026-03-12T11:05:00Z",
      created_at: "2026-03-12T11:00:00Z",
      updated_at: "2026-03-12T11:05:00Z"
    },
    {
      id: "cv3",
      content_version_id: "v1",
      topic_id: "abc12345-1111",
      channel: "newsletter",
      title: "Nieuwsbrief titel",
      article_body: "<p>Nieuwsbrief artikel</p>",
      summary: "<p>Nieuwsbrief samenvatting</p>",
      generated_image_id: null,
      generated_image_path: null,
      approval_state: "rejected",
      approved_by_user_id: "u1",
      approved_at: "2026-03-12T11:05:00Z",
      created_at: "2026-03-12T11:00:00Z",
      updated_at: "2026-03-12T11:05:00Z"
    }
  ]),
  getCurrentSchedule: vi.fn().mockRejectedValue(new Error("No publication schedule")),
  getSchedulerOverview: vi.fn().mockResolvedValue({
    generated_at: "2026-03-14T10:30:00Z",
    recent_runs: [
      {
        schedule_id: "s-recent-1",
        topic_id: "abc12345-1111",
        topic_subject: "Onderwerp test",
        content_version_id: "v1",
        scheduled_for: "2026-03-14T08:00:00Z",
        status: "published",
        updated_at: "2026-03-14T08:01:00Z"
      }
    ],
    upcoming_runs: [
      {
        schedule_id: "s-upcoming-1",
        topic_id: "abc12345-1111",
        topic_subject: "Onderwerp test",
        content_version_id: "v1",
        scheduled_for: "2026-03-15T08:00:00Z",
        status: "scheduled"
      }
    ],
    retry_jobs: [
      {
        id: "r1",
        topic_id: "abc12345-1111",
        topic_subject: "Onderwerp test",
        flow_name: "publish_schedule",
        status: "queued",
        attempt: 1,
        max_attempts: 5,
        next_run_at: "2026-03-14T10:45:00Z",
        error_type: "RuntimeError",
        error_message: "temporary"
      }
    ]
  }),
  listActivityFeed: vi.fn().mockResolvedValue([
    {
      id: "l1",
      event_type: "content.generated",
      topic_id: "abc12345-1111",
      topic_subject: "Onderwerp test",
      actor_user_id: "u1",
      actor_username: "admin",
      details_json: "{}",
      created_at: "2026-03-14T10:20:00Z"
    }
  ]),
  listNotificationFeed: vi.fn().mockResolvedValue([
    {
      id: "n1",
      event_type: "content.generation",
      status: "success",
      topic_id: "abc12345-1111",
      topic_subject: "Onderwerp test",
      message: "Generatie geslaagd",
      payload_json: "{}",
      delivery_attempts: 1,
      delivered_at: "2026-03-14T10:20:02Z",
      last_error: "",
      created_at: "2026-03-14T10:20:01Z"
    }
  ]),
  scheduleTopic: vi.fn().mockResolvedValue({ schedule_id: "s1" }),
  updateVariant: vi.fn().mockResolvedValue({ status: "ok" }),
  approveVariant: vi.fn().mockResolvedValue({ status: "ok" }),
  approveVariantPart: vi.fn().mockResolvedValue({ status: "ok" }),
  rejectVariant: vi.fn().mockResolvedValue({ status: "ok" }),
  rejectVariantPart: vi.fn().mockResolvedValue({ status: "ok" }),
  regenerateContent: vi.fn().mockResolvedValue({ version_id: "v2" }),
  approveTopic: vi.fn().mockResolvedValue({ status: "approved" }),
  getGeneratedImageBlob: vi.fn().mockResolvedValue(new Blob(["img"], { type: "image/png" })),
  listBoardRecycleBin: vi.fn().mockResolvedValue([]),
  getAboutContent: vi.fn().mockResolvedValue({
    description: "Wervelnieuws helpt het communicatieteam.",
    disclaimer: "Controleer inhoud altijd voor publicatie.",
    developed_by: "Energiek Daarle",
    changelog: [
      {
        iteration: "100",
        date: "2026-08-11",
        title: "Topicbronnen ondersteunen nu veilige audio-transcriptie",
        highlights: [
          "Je kunt een geldige WebM-audio-opname als topicbron toevoegen; de opname wordt daarna veilig verwerkt tot een doorzoekbare tekstbron.",
          "Bestanden die niet aan de audiocontroles voldoen, worden direct afgewezen zodat alleen bruikbare opnames verdergaan."
        ]
      },
      {
        iteration: "92",
        date: "2026-07-29",
        title: "Vergaderborden verfijnen tabs, tooltips en archief",
        highlights: [
          "De actieknoppen staan nu compact rechtsboven in de bordheader en wrappen netjes op smalle schermen.",
          "Kaartacties zijn icon-only met native tooltips en duidelijke labels, zodat de UI rustiger oogt zonder functies te verbergen.",
          "Het archief gebruikt dezelfde kaartopbouw als het actieve bord, terwijl add-card en drag/drop daar zijn uitgeschakeld."
        ]
      },
      {
        iteration: "91",
        date: "2026-07-29",
        title: "Lichtmodusknoppen en invoervelden zijn duidelijker",
        highlights: [
          "De knoppen in het vergaderbord-detail zijn nu beter zichtbaar in lichte weergave, inclusief sluit-, upload- en actieknoppen.",
          "Invoervelden, statuslabels en modals gebruiken rustiger oppervlaktes en duidelijkere contrasten zonder de workflow te veranderen.",
          "De interface blijft hetzelfde in opbouw, maar lichtmodus is nu minder gevoelig voor contrastregressies."
        ]
      },
      {
        iteration: "89",
        date: "2026-07-28",
        title: "Vergaderborden krijgen een duidelijke paarse stijl",
        highlights: [
          "Vergaderbordkolommen, knoppen, badges en focusstates hebben nu een herkenbare paarse accentkleur.",
          "De rest van de interface blijft rustig en goed leesbaar, ook in donkere weergave.",
          "Modals en overlays sluiten nu visueel aan op de paarse bordstijl zonder dat je werkwijze verandert."
        ]
      },
      {
        iteration: "73",
        date: "2026-06-11",
        title: "WindWilly-startpagina duidelijker en rijker",
        highlights: [
          "De homepage toont nu directer wat WindWilly doet en voor wie de startpagina bedoeld is.",
          "De belangrijkste instaproutes, module-kaarten en een actuele update-sectie zijn toegevoegd.",
          "De footer geeft nu meer context en snelle toegang tot de hoofdonderdelen van de suite."
        ]
      },
      {
        iteration: "01",
        date: "2026-03-01",
        title: "Eerste basis",
        highlights: ["Startscherm"]
      },
      {
        iteration: "02",
        date: "2026-03-12",
        title: "Nieuwe shell",
        highlights: ["Tabnavigatie", "About API"]
      },
      {
        iteration: "03",
        date: "2026-04-01",
        title: "Aparte changelog",
        highlights: ["Nieuwe changelogpagina"]
      }
    ]
  }),
  getUiSettings: vi.fn().mockResolvedValue({
    wind_theme_enabled: true
  })
}));

vi.mock("../lib/api/client", () => mockApi);

function renderApp(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function LocationEcho() {
  const location = useLocation();
  return <p>{`${location.pathname}${location.search}${location.hash}`}</p>;
}

function renderHoursCompatibility(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/urenverantwoording" element={<LegacyWorkHoursRedirect />} />
        <Route path="/wervelnieuws/urenverantwoording" element={<LocationEcho />} />
        <Route path="/api/urenverantwoording/*" element={<p>API-route</p>} />
      </Routes>
    </MemoryRouter>
  );
}

  async function loginIntoApp() {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    fireEvent.click(screen.getByRole("button", { name: "Inloggen" }));
    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: "Hoofdnavigatie" })).toBeInTheDocument();
    });
  }

function openWervelnieuwsDropdown() {
  const wervelLink = screen.getByRole("link", { name: "Wervelnieuws" });
  fireEvent.mouseEnter(wervelLink.parentElement as HTMLElement);
}

function clickWervelSubmenu(label: string) {
  openWervelnieuwsDropdown();
  fireEvent.click(within(screen.getByLabelText("Wervelnieuws navigatie")).getByRole("link", { name: label }));
}

function openVergaderbordenDropdown() {
  const vergaderLink = screen.getByRole("link", { name: "Vergaderborden" });
  fireEvent.mouseEnter(vergaderLink.parentElement as HTMLElement);
}

function clickVergaderbordenProject(label: string) {
  openVergaderbordenDropdown();
  fireEvent.click(
    within(screen.getByLabelText("Vergaderborden projectnavigatie")).getByRole("link", { name: label })
  );
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockApi.getCurrentUser.mockReset();
    mockApi.getCurrentUser.mockRejectedValue(new Error("401"));
    mockApi.logout.mockClear();
  });

  it("preserves direct urenverantwoording compatibility route with query and hash", async () => {
    renderHoursCompatibility("/urenverantwoording?project_id=p1#overzicht");
    expect(await screen.findByText("/wervelnieuws/urenverantwoording?project_id=p1#overzicht")).toBeInTheDocument();
  });

  it("does not loop redirect or intercept urenverantwoording api requests", async () => {
    renderHoursCompatibility("/api/urenverantwoording/groepen?project_id=p1");
    expect(await screen.findByText("API-route")).toBeInTheDocument();
  });

  it("renders the same module on canonical and compatibility navigation without placeholder or 404", async () => {
    const first = renderHoursCompatibility("/urenverantwoording");
    expect(await screen.findByText("/wervelnieuws/urenverantwoording")).toBeInTheDocument();
    first.unmount();
    renderHoursCompatibility("/wervelnieuws/urenverantwoording");
    expect(await screen.findByText("/wervelnieuws/urenverantwoording")).toBeInTheDocument();
  });

  it("bootstraps authenticated session via /auth/me", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "WindWilly voor vraag, nieuws en acties" })).toBeInTheDocument();
    });
  });

  it("shows login form first", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "Inloggen" })).toBeInTheDocument();
    expect(screen.getByLabelText("Onthoud mij")).toBeInTheDocument();
  });

  it("sends remember me flag when checkbox is checked", async () => {
    renderApp();

    fireEvent.click(screen.getByLabelText("Onthoud mij"));
    await loginIntoApp();

    expect(mockApi.login).toHaveBeenCalledWith("admin", "admin12345", true);
  });

  it("shows login error when credentials are invalid", async () => {
    mockApi.login.mockRejectedValueOnce(new Error("Invalid credentials"));
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Inloggen" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Ongeldige gebruikersnaam of wachtwoord.");
    });
  });

  it("shows WindWilly suite navigation and simplified landing after login", async () => {
    const { container } = renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "WindWilly" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Wervelnieuws" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Urenverantwoording" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Vergaderborden" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Participatiemomenten" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "WindWilly voor vraag, nieuws en acties" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Samenwerkende coöperaties" })).toBeInTheDocument();
      expect(screen.getByText(/online vraagbaak\./i)).toBeInTheDocument();
      expect(screen.getByText(/brengt nieuws naar buiten\./i)).toBeInTheDocument();
      expect(screen.getByText(/bundelt open acties\./i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Naar overzicht" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Open planning" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Rustig startpunt" })).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Lokale communicatie, planning en publicatie met broncontrole, versiebeheer en menselijke review."
        )
      ).not.toBeInTheDocument();
    });

    expect(container.querySelectorAll(".windwilly-homepage .panel")).toHaveLength(2);

    expect(screen.queryByText("Komende chatbotmodule voor snelle beantwoording van projectvragen.")).not.toBeInTheDocument();
    expect(screen.queryByText("Volledige redactie- en publicatieflow voor lokale windparkcommunicatie.")).not.toBeInTheDocument();
    expect(screen.queryByText("Placeholder voor urenregistratie en teaminzicht per projectfase.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bestuur (placeholder)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Bekijk changelog/i })).not.toBeInTheDocument();
  });

  it("opens vergaderborden page from top navigation", async () => {
    renderApp();
    await loginIntoApp();

    clickVergaderbordenProject("Wekelijkse afstemming");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Wekelijkse afstemming" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Nieuw project" })).not.toBeInTheDocument();
    });
  });

  it("opens last valid vergaderbord from topnav title link", async () => {
    window.localStorage.setItem(VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY, "bp1");
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Vergaderborden" }));

    await waitFor(() => {
      expect(mockApi.getBoardProject).toHaveBeenCalledWith("bp1");
      expect(screen.getByRole("heading", { name: "Wekelijkse afstemming" })).toBeInTheDocument();
    });
  });

  it("falls back to first valid vergaderbord when stored id is stale", async () => {
    window.localStorage.setItem(VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY, "stale-id");
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Vergaderborden" }));

    await waitFor(() => {
      expect(mockApi.getBoardProject).toHaveBeenCalledWith("bp1");
      expect(screen.getByRole("heading", { name: "Wekelijkse afstemming" })).toBeInTheDocument();
    });
  });

  it("shows inline error when adding a card without title", async () => {
    renderApp();
    await loginIntoApp();

    clickVergaderbordenProject("Wekelijkse afstemming");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Wekelijkse afstemming" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /\+ kaart toevoegen/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /\+ kaart toevoegen/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Kaart toevoegen" }));

    await waitFor(() => {
      expect(screen.getByText("Titel is verplicht.")).toBeInTheDocument();
      expect(mockApi.createBoardCard).not.toHaveBeenCalled();
    });
  });

  it("opens only one create form and submits assignment_user_ids as string array", async () => {
    renderApp();
    await loginIntoApp();

    clickVergaderbordenProject("Wekelijkse afstemming");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Wekelijkse afstemming" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /\+ kaart toevoegen/i })).toHaveLength(3);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /\+ kaart toevoegen/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("Titel kaart")).toHaveLength(1);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /\+ kaart toevoegen/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("Titel kaart")).toHaveLength(1);
    });

    fireEvent.change(screen.getByPlaceholderText("Titel kaart"), { target: { value: "Nieuwe kaart" } });
    fireEvent.change(screen.getByPlaceholderText("Korte toelichting (optioneel)"), { target: { value: "Beschrijving" } });

    fireEvent.click(screen.getByRole("button", { name: "Selecteer teamleden" }));
    fireEvent.click(screen.getByLabelText("Admin"));
    fireEvent.click(screen.getByLabelText("Editor"));

    fireEvent.click(screen.getByRole("button", { name: "Kaart toevoegen" }));

    await waitFor(() => {
      expect(mockApi.createBoardCard).toHaveBeenCalled();
      expect(screen.queryByPlaceholderText("Titel kaart")).not.toBeInTheDocument();
    });

    const lastCall = mockApi.createBoardCard.mock.calls[mockApi.createBoardCard.mock.calls.length - 1];
    expect(lastCall[0]).toBe("bp1");
    expect(lastCall[1]).toMatchObject({
      title: "Nieuwe kaart",
      description: "Beschrijving",
      assignment_user_ids: ["u1", "u2"]
    });
  });

  it("shows inline error for empty update and closes detail on outside click", async () => {
    mockApi.getBoardProject.mockResolvedValueOnce({
      project: {
        id: "bp1",
        name: "Wekelijkse afstemming",
        description: "Teamplanning en besluiten",
        invited_user_ids: ["u1"],
        card_count: 1
      },
      cards: [
        {
          id: "bc1",
          project_id: "bp1",
          title: "Voorbeeldkaart",
          description: "",
          column: "todo",
          position: 0,
          assignments: [],
          updates_count: 0,
          recordings_count: 0
        }
      ]
    });

    renderApp();
    await loginIntoApp();

    clickVergaderbordenProject("Wekelijkse afstemming");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Wekelijkse afstemming" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Voorbeeldkaart")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Voorbeeldkaart"));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Update plaatsen" }));

    await waitFor(() => {
      expect(screen.getByText("Vul eerst een update in.")).toBeInTheDocument();
      expect(mockApi.postBoardCardUpdate).not.toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("dialog"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("does not expose legacy /trello placeholder route", async () => {
    renderApp(["/trello"]);
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "WindWilly voor vraag, nieuws en acties" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Trello" })).not.toBeInTheDocument();
    });
  });

  it("opens WindWilly chat placeholder page from top navigation", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "WindWilly" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "WindWilly Assistent" })).toBeInTheDocument();
      expect(screen.getByText(/placeholder · nog niet live/i)).toBeInTheDocument();
      expect(screen.getByText(/nog geen werkende assistent/i)).toBeInTheDocument();
      expect(screen.getByText(/windpark de boldijk/i)).toBeInTheDocument();
      expect(screen.getByLabelText("Vraag invoeren")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Versturen" })).toBeDisabled();
    });
  });

  it("opens general landing page when clicking WindWilly logo", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "WindWilly landing" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "WindWilly voor vraag, nieuws en acties" })).toBeInTheDocument();
      expect(screen.getByText("Één rustig startpunt voor wat er speelt.")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Naar overzicht" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Open planning" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Spring naar de belangrijkste onderdelen" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Wat is er recent veranderd?" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Waarom dit overzicht betrouwbaar is" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Bestuur (placeholder)" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Bestuurslid 1" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Bestuurslid 2" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Bestuurslid 3" })).not.toBeInTheDocument();
      expect(screen.getByText("© 2026 WindWilly · Vibecoded by BJ & MR")).toBeInTheDocument();
      expect(
        screen.queryByText(
          "Lokale communicatie, planning en publicatie met broncontrole, versiebeheer en menselijke review."
        )
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Footer navigatie")).not.toBeInTheDocument();
    });
  });

  it("shows Wervelnieuws subtabs on hover", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Urenverantwoording" }));

    expect(screen.queryByRole("link", { name: "Main" })).not.toBeInTheDocument();

    const wervelLink = screen.getByRole("link", { name: "Wervelnieuws" });
    fireEvent.mouseEnter(wervelLink.parentElement as HTMLElement);

    await waitFor(() => {
      const dropdown = within(screen.getByLabelText("Wervelnieuws navigatie"));
      expect(dropdown.getByRole("link", { name: "Main" })).toBeInTheDocument();
      expect(dropdown.getByRole("link", { name: "Planning" })).toBeInTheDocument();
    });
  });

  it("redirects legacy /main to /wervelnieuws/main", async () => {
    renderApp(["/main"]);
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Workflow overzicht" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Wervelnieuws is nog in ontwikkeling" })).toBeInTheDocument();
    });
  });

  it("shows Wervelnieuws work-in-progress messaging on main page", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Main");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Wervelnieuws is nog in ontwikkeling" })).toBeInTheDocument();
      expect(screen.getByText(/work in progress/i)).toBeInTheDocument();
    });
  });

  it("opens separate changelog page from About with newest items first", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp(["/about"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "changelogpagina" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "changelogpagina" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Changelog" })).toBeInTheDocument();
      expect(screen.getByText("Nieuwste wijzigingen bovenaan.")).toBeInTheDocument();
    });

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Iteratie 100 - Topicbronnen ondersteunen nu veilige audio-transcriptie",
      "Iteratie 92 - Vergaderborden verfijnen tabs, tooltips en archief",
      "Iteratie 91 - Lichtmodusknoppen en invoervelden zijn duidelijker",
      "Iteratie 89 - Vergaderborden krijgen een duidelijke paarse stijl",
      "Iteratie 73 - WindWilly-startpagina duidelijker en rijker",
      "Iteratie 03 - Aparte changelog",
      "Iteratie 02 - Nieuwe shell",
      "Iteratie 01 - Eerste basis"
    ]);
  });

  it("opens user menu and navigates to settings", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
      expect(screen.getByLabelText("Volledige naam")).toBeInTheDocument();
    });
  });

  it("shows admin option in user menu for admins", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));

    expect(screen.getByRole("menuitem", { name: "Admin" })).toBeInTheDocument();
  });

  it("hides admin option in user menu for non-admins", async () => {
    mockApi.getCurrentUser.mockRejectedValueOnce(new Error("401"));
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u3",
      username: "editor",
      full_name: null,
      email: "editor@example.com",
      is_admin: false,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "editor" }));

    expect(screen.queryByRole("menuitem", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows only edit in user table actions and toggles admin rights from the modal", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Gebruikers beheren" })).toBeInTheDocument();
      expect(screen.getByText("Beheer accounts, tijdelijke wachtwoorden, actieve status en adminrechten voor het team.")).toBeInTheDocument();
      expect(screen.getByText("editor")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    const editorActions = screen.getByLabelText("Acties voor editor");
    expect(within(editorActions).getAllByRole("button")).toHaveLength(1);
    expect(within(editorActions).getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Maak admin" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));

    fireEvent.click(screen.getByRole("button", { name: "Maak admin" }));

    await waitFor(() => {
      expect(mockApi.updateAdminUser).toHaveBeenCalledWith("u2", true);
      expect(screen.getByText("Adminrechten bijgewerkt.")).toBeInTheDocument();
    });
  });

  it("opens and closes the admin user edit modal without saving", async () => {
    mockApi.updateAdminUserProfile.mockClear();
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    expect(screen.getByRole("dialog", { name: "Profiel en account beheren: editor" })).toBeInTheDocument();
    expect(screen.getByLabelText("Naam")).toHaveValue("Editor");
    expect(screen.getByText("Bewerk profiel of account. Onopgeslagen wijzigingen blijven beschermd.")).toBeInTheDocument();
    expect(screen.getByText("Avatar kiezen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Annuleren" }));

    expect(screen.queryByRole("dialog", { name: "Profiel en account beheren: editor" })).not.toBeInTheDocument();
    expect(mockApi.updateAdminUserProfile).not.toHaveBeenCalled();
  });

  it("closes the admin user edit modal on overlay click and not on inside click", async () => {
    mockApi.updateAdminUserProfile.mockClear();
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    const dialog = screen.getByRole("dialog", { name: "Profiel en account beheren: editor" });

    fireEvent.mouseDown(screen.getByLabelText("Naam"));
    expect(screen.getByRole("dialog", { name: "Profiel en account beheren: editor" })).toBeInTheDocument();

    fireEvent.mouseDown(dialog);
    expect(screen.queryByRole("dialog", { name: "Profiel en account beheren: editor" })).not.toBeInTheDocument();
    expect(mockApi.updateAdminUserProfile).not.toHaveBeenCalled();
  });

  it("asks confirmation before discarding dirty profile changes from close routes", async () => {
    mockApi.updateAdminUserProfile.mockClear();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "Editor concept" } });

    fireEvent.click(screen.getByLabelText("Profielbewerking sluiten"));
    expect(confirmSpy).toHaveBeenCalledWith("Er zijn onopgeslagen profielwijzigingen. Wil je deze wijzigingen weggooien?");
    expect(screen.getByRole("dialog", { name: "Profiel en account beheren: editor" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Annuleren" }));
    expect(screen.queryByRole("dialog", { name: "Profiel en account beheren: editor" })).not.toBeInTheDocument();
    expect(mockApi.updateAdminUserProfile).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("asks confirmation before discarding selected avatar with overlay and Escape close", async () => {
    mockApi.updateAdminUserProfile.mockClear();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Avatar"), { target: { files: [file] } });
    expect(screen.getByText("Gekozen bestand: avatar.png")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("dialog", { name: "Profiel en account beheren: editor" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Profiel en account beheren: editor" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Profiel en account beheren: editor" })).not.toBeInTheDocument();
    expect(mockApi.updateAdminUserProfile).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("allows admin to save user name, email and avatar", async () => {
    mockApi.updateAdminUserProfile.mockClear();
    mockApi.uploadAdminUserAvatar.mockClear();
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "Editor Nieuw" } });
    fireEvent.change(screen.getByLabelText("E-mailadres"), { target: { value: "nieuw@example.com" } });
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Avatar"), { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => {
      expect(mockApi.uploadAdminUserAvatar).toHaveBeenCalledWith("u2", file);
      expect(mockApi.updateAdminUserProfile).toHaveBeenCalledWith("u2", {
        full_name: "Editor Nieuw",
        email: "nieuw@example.com"
      });
      expect(mockApi.uploadAdminUserAvatar.mock.invocationCallOrder[0]).toBeLessThan(
        mockApi.updateAdminUserProfile.mock.invocationCallOrder[0]
      );
      expect(screen.getByText("Gebruikersprofiel bijgewerkt.")).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Profiel en account beheren: editor" })).not.toBeInTheDocument();
    });
  });

  it("does not patch profile fields when admin avatar upload fails", async () => {
    mockApi.updateAdminUserProfile.mockClear();
    mockApi.uploadAdminUserAvatar.mockClear();
    mockApi.uploadAdminUserAvatar.mockRejectedValueOnce(new Error("Avatar content does not match the selected image type"));
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "Editor Niet Opslaan" } });
    fireEvent.change(screen.getByLabelText("E-mailadres"), { target: { value: "niet-opslaan@example.com" } });
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Avatar"), { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => {
      expect(mockApi.uploadAdminUserAvatar).toHaveBeenCalledWith("u2", file);
      expect(screen.getByRole("alert")).toHaveTextContent("Avatar opslaan is mislukt");
    });
    expect(mockApi.updateAdminUserProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Profiel en account beheren: editor" })).toBeInTheDocument();
  });

  it("shows validation and server feedback in the admin user edit modal", async () => {
    mockApi.updateAdminUserProfile.mockClear();
    mockApi.updateAdminUserProfile.mockRejectedValueOnce(new Error("Email already in use"));
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    fireEvent.change(screen.getByLabelText("E-mailadres"), { target: { value: "ongeldig" } });
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Vul een geldig e-mailadres in.");
    expect(mockApi.updateAdminUserProfile).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("E-mailadres"), { target: { value: "admin@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Dit e-mailadres is al in gebruik.");
    });
  });

  it("keeps the admin user edit modal structured for compact profile and account sections", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    const dialog = screen.getByRole("dialog", { name: "Profiel en account beheren: editor" });

    expect(dialog.querySelector(".admin-user-profile-modal")).toBeInTheDocument();
    expect(dialog.querySelectorAll(".admin-user-modal-section")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Profielgegevens" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Accountacties" })).toBeInTheDocument();
    expect(dialog.querySelector(".admin-avatar-upload-row")).toBeInTheDocument();
    expect(dialog.querySelectorAll(".admin-account-actions-stack")).toHaveLength(2);
  });

  it("renders the board-rights matrix and saves checkbox changes", async () => {
    mockApi.updateBoardRights.mockClear();
    mockApi.listBoardRights.mockResolvedValueOnce({
      users: [
        { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true },
        { id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false, is_active: true }
      ],
      projects: [
        {
          id: "bp1",
          name: "Wekelijkse afstemming",
          description: "Teamplanning en besluiten",
          invited_user_ids: [],
          card_count: 2,
          last_activity_at: "2026-06-12T08:00:00Z"
        },
        {
          id: "bp2",
          name: "Stille notities",
          description: "",
          invited_user_ids: [],
          card_count: 0,
          last_activity_at: null
        }
      ]
    });

    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Bordrechten" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Bordrechten" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Bordrechten" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Bordrechten matrix" })).toBeInTheDocument();
    });

    expect(screen.getByRole("rowheader", { name: /Editor/ })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /Admin/ })).toBeInTheDocument();

    const adminAccess = screen.getByRole("checkbox", {
      name: "Beheerder Admin heeft automatisch toegang tot Wekelijkse afstemming"
    });
    expect(adminAccess).toBeChecked();
    expect(adminAccess).toBeDisabled();

    const editorAccess = screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" });
    expect(editorAccess).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeDisabled();

    fireEvent.click(adminAccess);
    expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeDisabled();
    expect(screen.getByText("Geen onopgeslagen wijzigingen.")).toBeInTheDocument();

    fireEvent.click(editorAccess);

    expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeEnabled();
    expect(screen.getByText("1 bord gewijzigd · 1 checkbox aangepast")).toBeInTheDocument();

    mockApi.listBoardRights.mockResolvedValueOnce({
      users: [
        { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true },
        { id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false, is_active: true }
      ],
      projects: [
        {
          id: "bp1",
          name: "Wekelijkse afstemming",
          description: "Teamplanning en besluiten",
          invited_user_ids: ["u2"],
          card_count: 2,
          last_activity_at: "2026-06-12T08:00:00Z"
        },
        {
          id: "bp2",
          name: "Stille notities",
          description: "",
          invited_user_ids: [],
          card_count: 0,
          last_activity_at: null
        }
      ]
    });

    fireEvent.click(screen.getByRole("button", { name: "Rechten opslaan" }));

    await waitFor(() => {
      expect(mockApi.updateBoardRights).toHaveBeenCalledWith("bp1", { invited_user_ids: ["u2"] });
      expect(screen.getByText("Bordrechten opgeslagen.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeDisabled();
      expect(screen.getByText("Geen onopgeslagen wijzigingen.")).toBeInTheDocument();
    });
  });

  it("shows inactive non-admin users read-only and excludes them from dirty state and save payloads", async () => {
    mockApi.listBoardRights.mockResolvedValueOnce({
      users: [
        { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true },
        { id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false, is_active: true },
        { id: "u3", username: "reviewer", full_name: "Reviewer", email: "reviewer@example.com", is_admin: false, is_active: false }
      ],
      projects: [
        {
          id: "bp1",
          name: "Wekelijkse afstemming",
          description: "Teamplanning en besluiten",
          invited_user_ids: ["u2", "u3"],
          card_count: 2,
          last_activity_at: "2026-06-12T08:00:00Z"
        }
      ]
    });
    mockApi.listBoardRights.mockResolvedValueOnce({
      users: [
        { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true },
        { id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false, is_active: true },
        { id: "u3", username: "reviewer", full_name: "Reviewer", email: "reviewer@example.com", is_admin: false, is_active: false }
      ],
      projects: [
        {
          id: "bp1",
          name: "Wekelijkse afstemming",
          description: "Teamplanning en besluiten",
          invited_user_ids: [],
          card_count: 2,
          last_activity_at: "2026-06-12T08:00:00Z"
        }
      ]
    });

    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Bordrechten" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Bordrechten" }));

    await waitFor(() => {
      expect(screen.getByRole("rowheader", { name: /Editor/ })).toBeInTheDocument();
      expect(screen.getByRole("rowheader", { name: /Reviewer/ })).toBeInTheDocument();
      expect(screen.getByText("Inactief")).toBeInTheDocument();
      expect(screen.getByRole("rowheader", { name: /Admin/ })).toBeInTheDocument();
    });

    const inactiveAccess = screen.getByRole("checkbox", {
      name: "Inactieve gebruiker Reviewer heeft bestaande toegang tot Wekelijkse afstemming en is niet bewerkbaar"
    });
    expect(inactiveAccess).toBeChecked();
    expect(inactiveAccess).toBeDisabled();

    fireEvent.click(inactiveAccess);
    expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeDisabled();
    expect(screen.getByText("Geen onopgeslagen wijzigingen.")).toBeInTheDocument();

    const editorAccess = screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" });
    fireEvent.click(editorAccess);

    expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeEnabled();
    expect(screen.getByText("1 bord gewijzigd · 1 checkbox aangepast")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rechten opslaan" }));

    await waitFor(() => {
      expect(mockApi.updateBoardRights).toHaveBeenCalledWith("bp1", { invited_user_ids: [] });
      expect(screen.getByText("Bordrechten opgeslagen.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeDisabled();
    });
  });

  it("disables matrix controls while board-rights save is in flight", async () => {
    let resolveSave: (() => void) | undefined;
    mockApi.updateBoardRights.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );

    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Bordrechten" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Bordrechten" }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" })).toBeInTheDocument();
    });

    const editorAccess = screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" });
    fireEvent.click(editorAccess);
    fireEvent.click(screen.getByRole("button", { name: "Rechten opslaan" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Opslaan..." })).toBeDisabled();
      expect(screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" })).toBeDisabled();
      expect(screen.getByText("Wijzigingen worden opgeslagen; de matrix is tijdelijk vergrendeld.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" }));
    expect(mockApi.updateBoardRights).toHaveBeenCalledTimes(1);

    resolveSave?.();

    await waitFor(() => {
      expect(screen.getByText("Bordrechten opgeslagen.")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" })).not.toBeDisabled();
    });
  });

  it("keeps unsaved matrix changes visible when save fails", async () => {
    mockApi.updateBoardRights.mockRejectedValueOnce(new Error("Netwerkfout"));
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Bordrechten" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Bordrechten" }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" })).toBeInTheDocument();
    });

    const editorAccess = screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" });
    fireEvent.click(editorAccess);
    fireEvent.click(screen.getByRole("button", { name: "Rechten opslaan" }));

    await waitFor(() => {
      expect(screen.getByText("Bordrechten opslaan is mislukt.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeEnabled();
      expect(screen.getByText("1 bord gewijzigd · 1 checkbox aangepast")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Geef Editor toegang tot Wekelijkse afstemming" })).not.toBeChecked();
    });
  });

  it("allows admin to archive a vergaderbord from Bordrechten", async () => {
    mockApi.archiveBoardProject.mockClear();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Bordrechten" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Bordrechten" }));

    await waitFor(() => {
      const rightsCard = screen.getByRole("heading", { name: "Wekelijkse afstemming" }).closest("article");
      expect(rightsCard).not.toBeNull();
      expect(within(rightsCard as HTMLElement).getByRole("button", { name: "Verwijder bord" })).toBeInTheDocument();
    });
    const rightsCard = screen.getByRole("heading", { name: "Wekelijkse afstemming" }).closest("article");
    expect(rightsCard).not.toBeNull();
    fireEvent.click(within(rightsCard as HTMLElement).getByRole("button", { name: "Verwijder bord" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(mockApi.archiveBoardProject.mock.calls[0][0]).toBe("bp1");
      expect(screen.getByText("Vergaderbord verwijderd.")).toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });

  it("shows admins in the matrix when there are no non-admin users", async () => {
    mockApi.listBoardRights.mockResolvedValueOnce({
      users: [
        { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true }
      ],
      projects: [
        {
          id: "bp1",
          name: "Wekelijkse afstemming",
          description: "Teamplanning en besluiten",
          invited_user_ids: ["u1"],
          card_count: 2,
          last_activity_at: "2026-06-12T08:00:00Z"
        }
      ]
    });
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Bordrechten" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Bordrechten" }));

    await waitFor(() => {
      expect(screen.getByRole("rowheader", { name: /Admin/ })).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", {
          name: "Beheerder Admin heeft automatisch toegang tot Wekelijkse afstemming"
        })
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Rechten opslaan" })).toBeDisabled();
    });
  });

  it("shows an empty state when there are no vergaderborden", async () => {
    mockApi.listBoardRights.mockResolvedValueOnce({
      users: [
        { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true },
        { id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false, is_active: true }
      ],
      projects: []
    });
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Bordrechten" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Bordrechten" }));

    await waitFor(() => {
      expect(screen.getByText("Er zijn nog geen vergaderborden.")).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: "Nieuw vergaderbord aanmaken" }).length).toBeGreaterThan(0);
    });
  });

  it("redirects non-admins away from admin vergaderborden route", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u2",
      username: "editor",
      full_name: "Editor",
      email: "editor@example.com",
      is_admin: false,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp(["/wervelnieuws/admin/vergaderborden"]);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Nieuw project" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Admin" })).not.toBeInTheDocument();
    });
  });

  it("shows 'Nieuw vergaderbord aanmaken' only on board-related Admin tabs and removes old dropdown action", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    openVergaderbordenDropdown();
    expect(screen.queryByRole("link", { name: "Nieuw project \(admin\)" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Bordrechten" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Nieuw vergaderbord aanmaken" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Bordrechten" }));

    await waitFor(() => {
      const rightsSection = screen.getByRole("heading", { name: "Bordrechten" }).closest("section");
      expect(rightsSection).not.toBeNull();
      expect(within(rightsSection as HTMLElement).getByRole("link", { name: "Nieuw vergaderbord aanmaken" })).toBeInTheDocument();
    });

    const rightsSection = screen.getByRole("heading", { name: "Bordrechten" }).closest("section");
    expect(rightsSection).not.toBeNull();
    fireEvent.click(within(rightsSection as HTMLElement).getByRole("link", { name: "Nieuw vergaderbord aanmaken" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Nieuw project" })).toBeInTheDocument();
    });
  });

  it("allows admin to create a new user", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("form", { name: "Nieuwe gebruiker toevoegen" })).toBeInTheDocument();
      expect(screen.getByLabelText("Gebruikersnaam")).toBeInTheDocument();
      expect(screen.getByLabelText("Tijdelijk wachtwoord")).toBeInTheDocument();
      expect(screen.getByLabelText("Nieuwe gebruikersnaam")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Nieuwe gebruikersnaam"), {
      target: { value: "redacteur" }
    });
    fireEvent.change(screen.getByLabelText("Tijdelijk wachtwoord"), {
      target: { value: "redacteur123" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Gebruiker toevoegen" }));

    await waitFor(() => {
      expect(mockApi.createAdminUser).toHaveBeenCalledWith("redacteur", "redacteur123");
      expect(screen.getByText("Nieuwe gebruiker toegevoegd.")).toBeInTheDocument();
      expect(screen.getByText("redacteur")).toBeInTheDocument();
    });
  });

  it("allows admin to change another user password", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
      expect(screen.getByText("editor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    expect(screen.getByRole("heading", { name: "Accountacties" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset wachtwoord voor editor" }));

    fireEvent.change(screen.getByLabelText("Nieuw wachtwoord voor editor"), {
      target: { value: "nieuw5678" }
    });
    fireEvent.change(screen.getByLabelText("Bevestig wachtwoord voor editor"), {
      target: { value: "nieuw5678" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Wijzig wachtwoord voor editor" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("Weet je zeker dat je het wachtwoord van editor wilt resetten?");
      expect(mockApi.changeAdminUserPassword).toHaveBeenCalledWith("u2", "nieuw5678");
      expect(screen.getByText("Wachtwoord bijgewerkt.")).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("allows admin to disable a user", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    expect(screen.getByRole("heading", { name: "Accountacties" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Uitschakelen gebruiker editor" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("Weet je zeker dat je editor wilt uitschakelen?");
      expect(mockApi.updateAdminUserActive).toHaveBeenCalledWith("u2", false);
      expect(screen.getByText("Gebruikersstatus bijgewerkt.")).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("allows admin to delete a user", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    expect(screen.getByRole("heading", { name: "Accountacties" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verwijder gebruiker editor" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        "Wilt u gebruiker editor echt verwijderen?"
      );
      expect(mockApi.deleteAdminUser).toHaveBeenCalledWith("u2");
      expect(screen.getByText("Gebruiker verwijderd.")).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("cancels delete user when confirmation is rejected", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockApi.deleteAdminUser.mockClear();

    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Verwijder gebruiker editor" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Wilt u gebruiker editor echt verwijderen?"
    );
    expect(mockApi.deleteAdminUser).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("does not call risky admin APIs when confirmations are rejected", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockApi.updateAdminUserActive.mockClear();
    mockApi.changeAdminUserPassword.mockClear();

    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Uitschakelen gebruiker editor" }));
    expect(mockApi.updateAdminUserActive).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset wachtwoord voor editor" }));
    fireEvent.change(screen.getByLabelText("Nieuw wachtwoord voor editor"), {
      target: { value: "nieuw5678" }
    });
    fireEvent.change(screen.getByLabelText("Bevestig wachtwoord voor editor"), {
      target: { value: "nieuw5678" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Wijzig wachtwoord voor editor" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockApi.changeAdminUserPassword).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("confirms removing admin rights and blocks self-lockout actions", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApi.updateAdminUser.mockClear();
    mockApi.updateAdminUserActive.mockClear();
    mockApi.deleteAdminUser.mockClear();
    mockApi.listAdminUsers.mockResolvedValueOnce([
      { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true },
      { id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: true, is_active: true }
    ]);
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });

    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker admin" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker admin" }));
    expect(screen.getByText(/Eigen account beschermd:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eigen adminrol behouden" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Uitschakelen gebruiker admin" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verwijder gebruiker admin" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Annuleren" }));
    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Verwijder admin" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("Weet je zeker dat je adminrechten van editor wilt verwijderen?");
      expect(mockApi.updateAdminUser).toHaveBeenCalledWith("u2", false);
      expect(mockApi.updateAdminUserActive).not.toHaveBeenCalled();
      expect(mockApi.deleteAdminUser).not.toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });

  it("does not update admin rights when removing admin confirmation is rejected", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockApi.updateAdminUser.mockClear();
    mockApi.listAdminUsers.mockResolvedValueOnce([
      { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true, is_active: true },
      { id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: true, is_active: true }
    ]);
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });

    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bewerk gebruiker editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerk gebruiker editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Verwijder admin" }));

    expect(confirmSpy).toHaveBeenCalledWith("Weet je zeker dat je adminrechten van editor wilt verwijderen?");
    expect(mockApi.updateAdminUser).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("saves settings and applies selected theme", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Volledige naam"), {
      target: { value: "Admin Naam" }
    });
    fireEvent.change(screen.getByLabelText("E-mailadres"), {
      target: { value: "admin@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Thema"), {
      target: { value: "dark" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => {
      expect(mockApi.updateCurrentUser).toHaveBeenCalled();
      expect(screen.getByText("Instellingen opgeslagen.")).toBeInTheDocument();
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });
  });

  it("changes password from settings", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Wachtwoord wijzigen" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Huidig wachtwoord"), {
      target: { value: "admin12345" }
    });
    fireEvent.change(screen.getByLabelText("Nieuw wachtwoord"), {
      target: { value: "nieuw1234" }
    });
    fireEvent.change(screen.getByLabelText("Herhaal nieuw wachtwoord"), {
      target: { value: "nieuw1234" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Wachtwoord wijzigen" }));

    await waitFor(() => {
      expect(mockApi.changeCurrentUserPassword).toHaveBeenCalledWith({
        current_password: "admin12345",
        new_password: "nieuw1234"
      });
      expect(screen.getByText("Wachtwoord succesvol gewijzigd.")).toBeInTheDocument();
    });
  });

  it("renders planning table with expected columns", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Onderwerp" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Thema" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Project" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Geplande datum" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Plaatsingdatum" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Website" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Facebook" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Nieuwsbrief" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Acties" })).toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Illustratie" })).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Opmerkingen" })).not.toBeInTheDocument();
    });
  });

  it("keeps status read-only and updates per-row target media", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByText("Nieuw")).toBeInTheDocument();
      expect(screen.queryByLabelText("Status Onderwerp test")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Nieuwsbrief Onderwerp test"));

    await waitFor(() => {
      expect(mockApi.updateTopic).toHaveBeenCalledWith(
        "abc12345-1111",
        expect.objectContaining({ target_channels: ["website", "facebook"] })
      );
    });
  });

  it("adds planning rule manually with selected target channels", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByLabelText("Onderwerp")).toBeInTheDocument();
    });

    const exactLimitSubject = "P".repeat(80);
    fireEvent.change(screen.getByLabelText("Onderwerp"), {
      target: { value: exactLimitSubject }
    });
    fireEvent.change(screen.getByLabelText("Thema"), {
      target: { value: "Planning" }
    });
    fireEvent.change(screen.getByLabelText("Geplande datum en tijd"), {
      target: { value: "2026-03-20T09:00" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Nieuwsbrief" }));

    fireEvent.click(screen.getByRole("button", { name: "Regel toevoegen" }));

    await waitFor(() => {
        expect(mockApi.createTopic).toHaveBeenCalledWith(
          expect.objectContaining({
            title: exactLimitSubject,
            subject: exactLimitSubject,
            theme: "Planning",
            editorial_notes: "",
            project_id: "p1",
            target_channels: ["website", "facebook"]
          }),
          expect.any(Object)
      );
      expect(screen.getByText("Planningsregel toegevoegd.")).toBeInTheDocument();
    });
  });

  it("blocks manual planning rule submit when onderwerp is longer than 80 chars", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByLabelText("Onderwerp")).toBeInTheDocument();
    });

    const tooLongSubject = "A".repeat(81);
    fireEvent.change(screen.getByLabelText("Onderwerp"), {
      target: { value: tooLongSubject }
    });
    fireEvent.change(screen.getByLabelText("Thema"), {
      target: { value: "Planning" }
    });
    fireEvent.change(screen.getByLabelText("Geplande datum en tijd"), {
      target: { value: "2026-03-20T09:00" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Regel toevoegen" }));

    await waitFor(() => {
      expect(mockApi.createTopic).not.toHaveBeenCalled();
      expect(screen.getByText("Onderwerp mag maximaal 80 tekens bevatten.")).toBeInTheDocument();
    });
  });

  it("imports planning rules via csv", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByLabelText("CSV planning import")).toBeInTheDocument();
    });

    const file = new File([
      "onderwerp,thema,project,geplande_datum,opmerkingen,website,facebook,nieuwsbrief\n" +
        "Regel 1,Planning,Windpark de Boldijk,2026-03-20 09:00,Opmerking,ja,nee,1\n"
    ], "planning.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("CSV planning import"), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(mockApi.importTopicsCsv).toHaveBeenCalledWith(file, expect.any(Object));
      expect(screen.getByText("Import klaar: 2 toegevoegd.")).toBeInTheDocument();
    });
  });

  it("opens planning rule detail page from table", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Verwijder planningsregel Onderwerp test" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Planningsregel detail" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Planningvoortgang" })).toBeInTheDocument();
      expect(screen.getByText(/Huidige stap:/)).toBeInTheDocument();
      expect(screen.getAllByText("moet nog gebeuren").length).toBeGreaterThan(0);
      expect(screen.getByText("gepland")).toBeInTheDocument();
      expect(screen.getByText(/AI generatie gepland:/)).toBeInTheDocument();
      expect(screen.getByText(/Geplande publicatiedatum:/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Opmerkingen" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Kanaalredactie" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Website/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Facebook/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Nieuwsbrief/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Website" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Facebook" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Nieuwsbrief" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Artikelen opnieuw genereren" })).toBeInTheDocument();
    });
  });

  it("shows all three previews on planning detail by default", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Preview Website" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Facebook" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Nieuwsbrief" })).toBeInTheDocument();
    });
  });

  it("blocks variant save when titel is longer than 80 chars", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    const titleInput = await screen.findByLabelText("Titel Website");
    fireEvent.change(titleInput, { target: { value: "B".repeat(81) } });

    await waitFor(() => {
      expect(screen.getByText("Titel mag maximaal 80 tekens bevatten.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Opslaan" })).toBeDisabled();
      expect(mockApi.updateVariant).not.toHaveBeenCalled();
    });
  });

  it("allows variant save when titel is exactly 80 chars", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    const titleInput = await screen.findByLabelText("Titel Website");
    const exactLimitTitle = "B".repeat(80);
    fireEvent.change(titleInput, { target: { value: exactLimitTitle } });
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => {
      expect(mockApi.updateVariant).toHaveBeenCalledWith(
        "abc12345-1111",
        "website",
        expect.objectContaining({ title: exactLimitTitle })
      );
    });
  });

  it("shows source passages on planning detail page", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Bronpassages" })).toBeInTheDocument();
      expect(screen.getByText(/Bron: Topic - topic-bron.txt - chunk 0/)).toBeInTheDocument();
      expect(screen.getByText(/Bron: Database - database-bron.txt - chunk 1/)).toBeInTheDocument();
      expect(screen.getByText("Score 91")).toBeInTheDocument();
      expect(screen.getByText("Score 72")).toBeInTheDocument();
      expect(mockApi.listVersions).toHaveBeenCalledWith("abc12345-1111");
    });
  });

  it("shows audio transcription status and retry action on planning detail page", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Bronbestanden" })).toBeInTheDocument();
      expect(screen.getByLabelText("Bronbestand uploaden")).toHaveAttribute(
        "accept",
        ".pdf,.docx,.xlsx,.txt,.md,.markdown,audio/webm,.webm"
      );
      expect(screen.getByText("Audio-opname · 2 min")).toBeInTheDocument();
      expect(screen.getByText("Transcriptie mislukt")).toBeInTheDocument();
      expect(screen.getByText("Transcriptie uit audio (read-only)")).toBeInTheDocument();
      expect(screen.getByText("De werkzaamheden starten maandag.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Transcriptie opnieuw proberen" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Transcriptie opnieuw proberen" }));

    await waitFor(() => {
      expect(mockApi.retryTopicDocumentTranscription).toHaveBeenCalledWith("abc12345-1111", "audio-1");
      expect(screen.getByText("Transcriptie opnieuw ingepland.")).toBeInTheDocument();
    });
  });

  it("rejects text part with global text note", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Opmerkingen tekst")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Tekst afwijzen" }).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Opmerkingen tekst"), {
      target: { value: "Herschrijf rustiger" }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Tekst afwijzen" })[0]);

    await waitFor(() => {
      expect(mockApi.rejectVariantPart).toHaveBeenCalledWith(
        "abc12345-1111",
        "facebook",
        "text",
        "Herschrijf rustiger"
      );
    });
  });

  it("shows readable preview when channel content arrives as json", async () => {
    mockApi.listCurrentVariants.mockResolvedValueOnce([
      {
        id: "cv-json-1",
        content_version_id: "v1",
        topic_id: "abc12345-1111",
        channel: "website",
        title: "Ruwe varianttitel",
        article_body:
          '```json\n{"title":"Stormprotocol uitgelegd","article_body":"<p>Het protocol is getest met drie controles.</p>","summary":"<p>Protocol werkt naar verwachting.</p>"}\n```',
        summary: "",
        generated_image_id: null,
        generated_image_path: null,
        approval_state: "pending",
        approved_by_user_id: null,
        approved_at: null,
        created_at: "2026-03-12T11:00:00Z",
        updated_at: "2026-03-12T11:00:00Z"
      },
      {
        id: "cv-json-2",
        content_version_id: "v1",
        topic_id: "abc12345-1111",
        channel: "facebook",
        title: "Facebook titel",
        article_body: "<p>Facebook artikel</p>",
        summary: "<p>Facebook samenvatting</p>",
        generated_image_id: null,
        generated_image_path: null,
        approval_state: "pending",
        approved_by_user_id: null,
        approved_at: null,
        created_at: "2026-03-12T11:00:00Z",
        updated_at: "2026-03-12T11:00:00Z"
      },
      {
        id: "cv-json-3",
        content_version_id: "v1",
        topic_id: "abc12345-1111",
        channel: "newsletter",
        title: "Nieuwsbrief titel",
        article_body: "<p>Nieuwsbrief artikel</p>",
        summary: "<p>Nieuwsbrief samenvatting</p>",
        generated_image_id: null,
        generated_image_path: null,
        approval_state: "pending",
        approved_by_user_id: null,
        approved_at: null,
        created_at: "2026-03-12T11:00:00Z",
        updated_at: "2026-03-12T11:00:00Z"
      }
    ]);

    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Preview Website" })).toBeInTheDocument();
      expect(screen.getByText("Stormprotocol uitgelegd")).toBeInTheDocument();
      expect(screen.getAllByText("Het protocol is getest met drie controles.").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Protocol werkt naar verwachting.").length).toBeGreaterThan(0);
    });
  });

  it("retries publication planning after regeneration when first schedule call fails", async () => {
    mockApi.scheduleTopic.mockClear();
    mockApi.regenerateContent.mockClear();
    mockApi.scheduleTopic
      .mockRejectedValueOnce(new Error('{"detail":"No content version available"}'))
      .mockResolvedValueOnce({ schedule_id: "s2" });

    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publicatiedatum opslaan" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Publicatiedatum"), {
      target: { value: "2026-03-22T08:30" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicatiedatum opslaan" }));

    const expectedIso = new Date("2026-03-22T08:30").toISOString();

    await waitFor(() => {
      expect(mockApi.scheduleTopic).toHaveBeenCalledTimes(2);
      expect(mockApi.regenerateContent).toHaveBeenCalledWith("abc12345-1111");
      expect(mockApi.scheduleTopic).toHaveBeenNthCalledWith(1, "abc12345-1111", expectedIso);
      expect(mockApi.scheduleTopic).toHaveBeenNthCalledWith(2, "abc12345-1111", expectedIso);
      expect(screen.getByText("Publicatiedatum opgeslagen.")).toBeInTheDocument();
    });
  });

  it("removes upload controls from main page", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Main");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Workflow overzicht" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Bestand uploaden")).not.toBeInTheDocument();
    expect(screen.getByText("Totaal onderwerpen")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recente meldingen" })).toBeInTheDocument();
    expect(screen.getAllByText("Generatie").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Feature suggestie #1" })).toBeInTheDocument();
    expect(mockApi.listActivityFeed).toHaveBeenCalledWith({ period: "7d", limit: 5 });
    expect(mockApi.listNotificationFeed).toHaveBeenCalledWith({ period: "7d", limit: 5 });
  });

  it("renders log page with filters and activity rows", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Log");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Log" })).toBeInTheDocument();
      expect(screen.getByLabelText("Actie")).toBeInTheDocument();
      expect(screen.getByLabelText("Status")).toBeInTheDocument();
      expect(screen.getByLabelText("Onderwerp")).toBeInTheDocument();
      expect(screen.getByLabelText("Periode")).toBeInTheDocument();
      expect(screen.getAllByText("Onderwerp test").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Content gegenereerd").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Generatie").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Onderwerp"), {
      target: { value: "test" }
    });
    fireEvent.change(screen.getByLabelText("Periode"), {
      target: { value: "30d" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Filter toepassen" }));

    await waitFor(() => {
      expect(mockApi.listActivityFeed).toHaveBeenLastCalledWith({
        event_type: undefined,
        topic: "test",
        period: "30d",
        limit: 120
      });
      expect(mockApi.listNotificationFeed).toHaveBeenLastCalledWith({
        event_type: undefined,
        status: undefined,
        topic: "test",
        period: "30d",
        limit: 120
      });
    });
  });

  it("uploads a file from database page with project selection", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Bronbestanden");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
      expect(screen.getByText("wijkbericht.txt")).toBeInTheDocument();
      expect(screen.getByText("2026-03-12 11:00")).toBeInTheDocument();
      expect(screen.getByText("128 B")).toBeInTheDocument();
      expect(
        screen.queryByText("Upload bronbestanden per project. Deze database staat los van Topics.")
      ).not.toBeInTheDocument();
      expect(screen.getByText(/max 100 MB per bestand/i)).toBeInTheDocument();
      expect(screen.queryByLabelText("Bulkactie")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Doelproject")).not.toBeInTheDocument();
    });

    const rowCheckbox = await screen.findByLabelText("Selecteer bestand wijkbericht.txt");
    fireEvent.click(rowCheckbox);

    await waitFor(() => {
      expect(screen.getByLabelText("Bulkactie")).toBeInTheDocument();
      expect(screen.getByLabelText("Doelproject")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Voer bulkactie uit" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Bulkactie"), { target: { value: "delete" } });
    expect(screen.queryByLabelText("Doelproject")).not.toBeInTheDocument();

    const file = new File(["inhoud"], "nieuw.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Database bestand uploaden"), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(mockApi.uploadDatabaseDocumentWithProgress).toHaveBeenCalledWith(
        "p1",
        file,
        expect.any(Function)
      );
      expect(screen.getByLabelText("Upload voortgang")).toBeInTheDocument();
      expect(screen.getByLabelText("Bestandstype txt")).toBeInTheDocument();
      expect(screen.getByText("1 bestand(en) geupload naar de database.")).toBeInTheDocument();
    });
  });


  it("does not show per-row delete action on database page", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u3",
      username: "editor",
      full_name: null,
      email: "editor@example.com",
      is_admin: false,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Bronbestanden");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Verwijder bestand/i })).not.toBeInTheDocument();
    });
  });

  it("uploads multiple files in one action on database page", async () => {
    mockApi.uploadDatabaseDocumentWithProgress.mockClear();
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Bronbestanden");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
      expect(screen.getByLabelText("Filter project")).toHaveValue("all");
      expect(screen.getByLabelText("Upload project")).toHaveValue("p1");
    });

    const fileA = new File(["inhoud-a"], "a.txt", { type: "text/plain" });
    const fileB = new File(["inhoud-b"], "b.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Database bestand uploaden"), {
      target: { files: [fileA, fileB] }
    });

    await waitFor(() => {
      expect(mockApi.uploadDatabaseDocumentWithProgress).toHaveBeenCalledTimes(2);
      expect(mockApi.uploadDatabaseDocumentWithProgress).toHaveBeenNthCalledWith(
        1,
        "p1",
        fileA,
        expect.any(Function)
      );
      expect(mockApi.uploadDatabaseDocumentWithProgress).toHaveBeenNthCalledWith(
        2,
        "p1",
        fileB,
        expect.any(Function)
      );
      expect(screen.getByText("2 bestand(en) geupload naar de database.")).toBeInTheDocument();
    });
  });

  it("allows admin to manage projects", async () => {
    mockApi.listWorkHoursAdminMasterdata.mockResolvedValueOnce({
      projects: [],
      posts: [{ id: "whpost1", name: "Communicatie", description: "Globaal", is_active: true, is_archived: false, deleted_at: null, row_version: 1 }],
      external_people: []
    });
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Gebruikers" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Projecten" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Windpark de Boldijk")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Globale urenposten / categorieën" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Communicatie")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Nieuw project"), {
      target: { value: "Project Noord" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Project toevoegen" }));

    await waitFor(() => {
      expect(mockApi.createAdminProject).toHaveBeenCalledWith("Project Noord");
      expect(screen.getByText("Project toegevoegd.")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Nieuwe globale post"), { target: { value: "Techniek" } });
    fireEvent.click(screen.getByRole("button", { name: "Post toevoegen" }));
    await waitFor(() => {
      expect(mockApi.createWorkPost).toHaveBeenCalledWith({ name: "Techniek", description: "" });
    });
  });

  it("allows admin to update GenAI configuration", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Gebruikers" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "AI" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "GenAI configuratie" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Website prompt"), {
      target: { value: "Websiteprompt iteratie 9" }
    });
    fireEvent.change(screen.getByLabelText("Whisper-model"), {
      target: { value: "whisper-1" }
    });
    fireEvent.change(screen.getByLabelText("Whisper-taal"), {
      target: { value: "nl" }
    });
    fireEvent.click(screen.getByLabelText("Websearch inschakelen (standaard uit)"));
    fireEvent.change(screen.getByLabelText(/OpenAI API key/i), {
      target: { value: "new-api-key" }
    });
    fireEvent.click(screen.getByRole("button", { name: "GenAI-config opslaan" }));

    await waitFor(() => {
      expect(mockApi.updateAdminGenAIConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          website_prompt: "Websiteprompt iteratie 9",
          whisper_model: "whisper-1",
          whisper_language: "nl",
          websearch_enabled: true,
          openai_api_key: "new-api-key"
        })
      );
      expect(screen.getByText("GenAI-config opgeslagen.")).toBeInTheDocument();
    });
  });

  it("allows admin to toggle global wind theme", async () => {
    mockApi.updateAdminUiSettings.mockClear();
    mockApi.updateAdminUiSettings.mockResolvedValueOnce({ wind_theme_enabled: false });

    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Thema's" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Thema's" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Wind-thema actief")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Wind-thema actief"));

    await waitFor(() => {
      expect(mockApi.updateAdminUiSettings).toHaveBeenCalledWith({ wind_theme_enabled: false });
      expect(screen.getByText("Wind-thema uitgeschakeld.")).toBeInTheDocument();
    });
  });

  it("opens scheduler tab in admin", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Gebruikers" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Scheduler" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Scheduler" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Recent gedraaid" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Komende planning" })).toBeInTheDocument();
      expect(screen.getAllByText("Onderwerp test").length).toBeGreaterThan(0);
      expect(mockApi.getSchedulerOverview).toHaveBeenCalled();
    });
  });

  it("shows admin log tab with topic subject", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Admin log" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Admin log" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Admin log" })).toBeInTheDocument();
      expect(screen.getAllByText("Onderwerp test").length).toBeGreaterThan(0);
      expect(mockApi.listAdminActivity).toHaveBeenCalled();
    });
  });

  it("loads about content from API", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("About");

    await waitFor(() => {
      expect(screen.getByText("Wervelnieuws helpt het communicatieteam.")).toBeInTheDocument();
      expect(screen.getByText(/Ontwikkeld door:/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "changelogpagina" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Changelog" })).not.toBeInTheDocument();
      expect(screen.queryByText("Iteratie 02 - Nieuwe shell")).not.toBeInTheDocument();
    });
  });
});
