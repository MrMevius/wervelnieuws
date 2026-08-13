import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

describe("light-mode control tokens", () => {
  it("keeps board-detail and navigation controls on shared visible tokens", () => {
    expect(css).toContain("--control-primary-bg");
    expect(css).toContain("--control-neutral-hover-bg");
    expect(css).toContain("--nav-active-bg");

    expect(css).toMatch(/\.board-detail-close \{[\s\S]*?background: var\(--control-surface-muted\);[\s\S]*?color: var\(--control-text\);/);
    expect(css).toMatch(/\.board-update-submit,\n\.board-attachment-submit \{[\s\S]*?background: var\(--control-primary-bg\);[\s\S]*?color: var\(--control-primary-fg\);/);
    expect(css).toMatch(/\.board-attachment-action \{[\s\S]*?background: var\(--control-surface-muted\);[\s\S]*?color: var\(--control-text\);/);
    expect(css).toMatch(/\.channel-tab\.active \{[\s\S]*?background: var\(--nav-active-bg\);[\s\S]*?color: var\(--nav-active-fg\);/);
  });

  it("keeps hours totals static before the shell's narrow breakpoint and pagination right-aligned on mobile", () => {
    expect(css).toMatch(/@media \(max-width: 920px\) \{[\s\S]*?\.work-hours-page-layout \{ grid-template-columns: minmax\(0, 1fr\); \}[\s\S]*?\.work-hours-project-totals \{ order: -1; position: static;/);
    expect(css).toMatch(/@media \(max-width: 560px\) \{[\s\S]*?\.uren-module-page \.table-wrap \{ display: none; \}[\s\S]*?\.work-hours-pagination \{ justify-content: flex-end; \}/);
  });
});
