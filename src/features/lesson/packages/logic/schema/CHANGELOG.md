# Content Schema Changelog

## Versioning Policy

Schema versions follow **Semantic Versioning** (MAJOR.MINOR.PATCH):

| Change type                                             | Version bump |
| ------------------------------------------------------- | ------------ |
| New optional field added                                | PATCH        |
| New required field added, new enum value, field renamed | MINOR        |
| Field removed, type changed, ID strategy changed        | MAJOR        |

The `schema_version` field in every `manifest.json` and lesson JSON **must** match the version exported by the tool.  
If a consumer reads a package whose `schema_version` does not match the expected version, it **must** reject the package with a clear error rather than silently applying wrong defaults.

---

## Version 0.1.0 — Initial contract (M1)

**Released:** 2026-09-06  
**Status:** Current

### What's in this version

- `manifest.json` schema: `package_id`, `slug`, `format: "hybrid-zip"`, `lessons[]` index.
- Lesson JSON schema: `id`, `slug`, `schema_version`, `title_en/vi`, `blurb_vi`, `level`, `target_skills`, `estimated_duration_minutes`, `chunks[]` (8–12), `grammar_patterns[]`, `vocabulary[]`, `activities[]`, `audio_assets[]`, `srs_items[]`.
- Chunk schema: required `explanation_vi` per chunk; `dialogue_turns[]`, `qa_items[]`, `audio_ref_ids[]`, `srs_ref_ids[]`, `remediation`.
- Audio asset: `id` + `url` + `checksum` required; checksum may be `sha256:placeholder` during M1.
- SRS items: `id`, `slug`, `item_type` (vocabulary | grammar | dialogue_turn | qa), `source_ref_id`, `front`, `back`.
- Grammar patterns: `tied_to_actions` must include at least one of `speaking` or `listening`.
- Deterministic ID strategy: `sha256(prefix + ":" + slug...)` first 16 hex chars — see `index.ts` → `makeContentId`.

### Breaking changes

None (initial version).

---

## Rollback Procedure

### Rolling back a package to a previous schema version

1. **Identify the target version** from `CHANGELOG.md` (this file).
2. **Check out the schema module at the target commit** using `git`:
   ```sh
   git show <commit-sha>:mobile-app/src/modules/content/schema/index.ts > schema-old.ts
   ```
3. **Re-export the package** using the content-lint tool version that corresponded to that schema:
   ```sh
   # The tool version that produced v0.1.0 packages is tagged content-lint-v0.1.0
   git checkout content-lint-v0.1.0 -- mobile-app/tools/content-lint/
   yarn lint:content --package-dir tools/content-lint/packages/<package-slug>
   ```
4. **Update the `schema_version` field** in `manifest.json` and all lesson JSON files to the target version string.
5. **Distribute the re-exported package** — consumers will see the matching version and accept it.

### No migration tool required for v0.x

During the 0.x series the schema is evolving rapidly.  
Packages are not migrated forward automatically — the exporter re-runs from source whenever the schema changes.  
Data migration tooling will be introduced at the 1.0.0 boundary.

### Field-level rollback

If only one field is incorrect, update the field in the source lesson JSON and re-run `yarn lint:content` to validate before distributing.

---

## Upcoming (not yet scheduled)

- `v0.2.0` — Add `tags[]` to lesson for topic-based filtering.
- `v0.2.0` — Add `remediation_strategy` enum (spaced | immediate | on_demand) to `RemediationSchema`.
- `v1.0.0` — Stable contract; data migration tooling required for breaking changes.
