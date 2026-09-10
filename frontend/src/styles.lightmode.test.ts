import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

describe("light-mode control tokens", () => {
  it("keeps board-detail and navigation controls on shared visible tokens", () => {
    expect(css).toContain("--control-primary-bg");
    expect(css).toContain("--control-neutral-hover-bg");
    expect(css).toContain("--nav-active-bg");
    expect(css).toContain("--md-sys-color-primary: var(--brand)");
    expect(css).toContain(".material-button--danger");

    expect(css).toMatch(/\.board-detail-modal \.material-button \{[^}]*--md-outlined-button-label-text-color: var\(--text\);/);
    expect(css).toMatch(/\.material-button-content \{[^}]*display: flex;[^}]*align-items: center;/);
    // Material owns host geometry. Resetting it to zero collapses real buttons.
    expect(css.match(/\.board-detail-modal \.material-button \{([^}]*)\}/)?.[1]).not.toMatch(/(?:padding|min-height|height):/);
    expect(css).toMatch(/\.board-update-editor-shell:not\(\.board-description-editor-shell\) > \.board-update-toolbar \{[^}]*position: absolute;/);
    expect(css).toMatch(/\.board-update-submit,\n\.board-attachment-submit \{[\s\S]*?background: var\(--control-primary-bg\);[\s\S]*?color: var\(--control-primary-fg\);/);
    expect(css).toMatch(/\.board-attachment-action \{[\s\S]*?background: var\(--control-surface-muted\);[\s\S]*?color: var\(--control-text\);/);
    expect(css).toMatch(/\.channel-tab\.active \{[\s\S]*?background: var\(--nav-active-bg\);[\s\S]*?color: var\(--nav-active-fg\);/);
  });

  it("keeps hours totals static before the shell's narrow breakpoint and pagination left-aligned on mobile", () => {
    expect(css).toMatch(/@media \(max-width: 920px\) \{[\s\S]*?\.work-hours-page-layout \{ grid-template-columns: minmax\(0, 1fr\); \}[\s\S]*?\.work-hours-project-totals \{ order: -1; position: static;/);
    expect(css).toMatch(/\.work-hours-create-row input, \.work-hours-create-row select \{[\s\S]*?box-sizing: border-box;[\s\S]*?height: 34px;/);
    expect(css).toMatch(/@media \(min-width: 921px\) \{\s*\.work-hours-create-row \.work-hours-participant-trigger \{[^}]*min-height: 34px;[^}]*height: 34px;/);
    expect(css).not.toMatch(/@media \(max-width: 920px\) \{[\s\S]*?\.work-hours-create-row \.work-hours-participant-trigger \{[^}]*(?:min-)?height: 34px;/);
    expect(css).not.toMatch(/\.work-hours-create-row \.work-hours-participant-trigger \{[^}]*(?:min-)?height: 30px;/);
    expect(css).toMatch(/@media \(max-width: 560px\) \{[\s\S]*?\.uren-module-page \.table-wrap \{ display: none; \}[\s\S]*?\.work-hours-pagination \{ justify-content: flex-start; \}/);
  });
  it("keeps the footer at the bottom of short application pages", () => {
    expect(css).toMatch(/\.app-shell \{[\s\S]*?min-height: 100dvh;[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/);
    expect(css).toMatch(/\.page-content \{[\s\S]*?flex: 1 0 auto;/);
    expect(css).toMatch(/\.app-footer \{[\s\S]*?margin-top: auto;/);
  });

  it("keeps the board context compact and member tooltips separate from clipped avatars", () => {
    expect(css).toMatch(/@media \(min-width: 921px\) \{[\s\S]*?\.app-shell:has\(\.vergaderborden-page\) \.page-content \{[\s\S]*?padding-top: 76px;/);
    expect(css).not.toContain(".vergaderborden-header-access-badge::after");
    expect(css).toMatch(/\.hover-tooltip \{[^}]*position: fixed;[^}]*max-width: min\(320px, calc\(100vw - 24px\)\);/);
    expect(css).toMatch(/\.user-chip\.vergaderborden-header-access-badge \{[^}]*flex: 0 0 auto;/);
  });

  it("keeps the board calm and the card detail split into work and utility areas", () => {
    expect(css).toMatch(/\.panel\.vergaderborden-page \{[\s\S]*?background: transparent;[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
    expect(css).toMatch(/\.vergaderborden-column \{[\s\S]*?background: var\(--surface-muted\);/);
    expect(css).toMatch(/\.vergaderborden-card-add-toggle \{[\s\S]*?background: transparent;[\s\S]*?border: 1px dashed var\(--line\);/);
    expect(css).toMatch(/\.board-detail-layout \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1\.15fr\) minmax\(360px, 0\.85fr\);/);
    expect(css).toMatch(/\.board-detail-main,\s*\.board-detail-activity \{[^}]*overflow-y: auto;/);
    expect(css).not.toMatch(/\.board-detail-(?:main|layout) \{[^}]*display: contents;/);
    expect(css).toMatch(/\.board-create-overlay \{[\s\S]*?position: fixed;[\s\S]*?justify-content: flex-end;/);
    expect(css).toMatch(/\.board-create-sidebar \{[\s\S]*?width: min\(600px, 100%\);[\s\S]*?height: calc\(100dvh - 108px\);[\s\S]*?background: var\(--surface\);/);
    expect(css).toMatch(/\.board-create-sidebar \.board-description-textarea \{[\s\S]*?min-height: 168px;/);
    expect(css).toMatch(/\.board-create-sidebar \.vergaderborden-card-add-actions \{[\s\S]*?border-top: 1px solid var\(--line\);[\s\S]*?background: var\(--surface\);/);
    expect(css).toMatch(/\.board-voice-capture \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?background: var\(--surface-muted\);/);
    expect(css).toMatch(/\.board-voice-button\.is-recording \{[\s\S]*?var\(--danger\)/);
    expect(css).toMatch(/\.board-card-urgency \{[\s\S]*?background: color-mix\(in srgb, var\(--danger\) 12%, var\(--surface\) 88%\);/);
    expect(css).toMatch(/\.board-detail-status-control\.urgency-urgent,[\s\S]*?\.board-detail-status-value\.urgency-urgent \{[\s\S]*?var\(--danger\)/);
    expect(css).toMatch(/\.board-detail-status-control,[\s\S]*?\.board-detail-status-value \{[^}]*border-radius: 8px;/);
    expect(css).toMatch(/@media \(max-width: 760px\) \{[\s\S]*?\.board-detail-layout \{[\s\S]*?grid-template-columns: 1fr;/);
  });
});
