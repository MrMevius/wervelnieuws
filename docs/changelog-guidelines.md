# Release versions and Dutch changelog

The application changelog in `backend/app/api/meta.py` is the canonical release
version history. `/api/meta/about` returns the highest changelog version as the
current application version; the footer displays it next to **Wijzigingen**.
Package/tooling versions are separate implementation metadata.

Use `0.MINOR.PATCH` during the current pre-1.0 development phase:

- Increase MINOR and reset PATCH to zero for a new module, a substantial new
  workflow, or a significant application-wide change: `0.33.7` → `0.34.0`.
- Increase PATCH for a small feature refinement, layout/text change or bug fix:
  `0.34.0` → `0.34.1`.
- Never reuse a version. Keep assigned versions stable in later releases.

Historical entries were assigned versions retrospectively using their original
dates, legacy iteration order for same-day entries and the functional scope
recorded in each entry. Duplicate iteration labels and labels such as `07B`
are separate changes with unique versions. These labels do not imply historical
Git tags or release artifacts existed. Original dates and changes are retained.

For every completed change, add a release entry with `version`, `date`, `title`
and two to four concise `highlights`. Write all visible changelog text in Dutch
and describe the user's benefit. Product and module names may keep their own
names. Do not use iteration numbers or English release notes. A newer version
sorts before an older one numerically, including `0.10.0` versus `0.9.10`.

Known legacy entries in stored About overrides are mapped to their canonical
versions on read. Unknown custom legacy entries receive unique `0.0.PATCH`
versions within that override; custom descriptions/settings are not rewritten.
No database migration is required for this read-time compatibility.
